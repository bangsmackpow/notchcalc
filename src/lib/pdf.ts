import { degrees, PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage, PDFPageDrawSVGOptions, RGB } from 'pdf-lib'
import type { Drawing, DPoint, Prim } from './drawing.ts'
import type { Page } from './layout.ts'

const K = 72 / 25.4 // mm → PDF points

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}

const BLACK = rgb(0, 0, 0)
const RED = rgb(0.75, 0, 0)

/** Standard 14 fonts are WinAnsi; downgrade glyphs they cannot encode. */
function sanitize(s: string): string {
  const map: Record<string, string> = { '⚠': '(!)', '∥': '||', '⊥': 'T', '→': '->', '↓': 'v' }
  let out = ''
  for (const ch of s.replace(/[⚠∥⊥→↓]/g, (c) => map[c] ?? c)) {
    out += (ch.codePointAt(0) ?? 0) <= 0xff ? ch : '?'
  }
  return out
}

interface Ctx {
  page: PDFPage
  tx: number
  ty: number
  pageHpt: number
  helv: PDFFont
  helvB: PDFFont
}

const px = (c: Ctx, mx: number) => (mx + c.tx) * K
const py = (c: Ctx, my: number) => c.pageHpt - (my + c.ty) * K

function pathOf(pts: DPoint[], closed: boolean): string {
  const seg = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return closed ? `${seg} Z` : seg
}

function drawPrim(c: Ctx, p: Prim): void {
  const { page } = c
  switch (p.t) {
    case 'line': {
      page.drawLine({
        start: { x: px(c, p.a.x), y: py(c, p.a.y) },
        end: { x: px(c, p.b.x), y: py(c, p.b.y) },
        thickness: (p.w ?? 0.3) * K,
        color: hexToRgb(p.c ?? '#000000'),
        ...(p.dash ? { dashArray: p.dash.map((d) => d * K) } : {}),
      })
      return
    }
    case 'poly': {
      if (!p.c && !p.fill) return
      const opts: PDFPageDrawSVGOptions = {
        x: c.tx * K,
        y: c.pageHpt - c.ty * K,
        scale: K,
        borderColor: hexToRgb(p.c ?? '#000000'),
        borderWidth: (p.w ?? 0.3) * K,
      }
      if (p.fill && p.fill !== 'none') opts.color = hexToRgb(p.fill)
      if (p.dash) opts.borderDashArray = p.dash.map((d) => d * K)
      page.drawSvgPath(pathOf(p.pts, p.closed ?? false), opts)
      return
    }
    case 'rect': {
      const pts: DPoint[] = [
        { x: p.x, y: p.y },
        { x: p.x + p.w, y: p.y },
        { x: p.x + p.w, y: p.y + p.h },
        { x: p.x, y: p.y + p.h },
      ]
      const opts: PDFPageDrawSVGOptions = {
        x: c.tx * K,
        y: c.pageHpt - c.ty * K,
        scale: K,
        borderColor: hexToRgb(p.c ?? '#000000'),
        borderWidth: (p.lw ?? 0.3) * K,
      }
      if (p.fill && p.fill !== 'none') opts.color = hexToRgb(p.fill)
      if (p.dash) opts.borderDashArray = p.dash.map((d) => d * K)
      page.drawSvgPath(pathOf(pts, true), opts)
      return
    }
    case 'circle': {
      page.drawCircle({
        x: px(c, p.c0.x),
        y: py(c, p.c0.y),
        size: p.r * K,
        borderColor: hexToRgb(p.c ?? '#000000'),
        borderWidth: (p.lw ?? 0.3) * K,
        ...(p.fill && p.fill !== 'none' ? { color: hexToRgb(p.fill) } : {}),
      })
      return
    }
    case 'text': {
      const font = p.bold ? c.helvB : c.helv
      const size = (p.size ?? 2.5) * K
      const s = sanitize(p.s)
      const w = font.widthOfTextAtSize(s, size)
      let x = px(c, p.x)
      if ((p.anchor ?? 'start') === 'middle') x -= w / 2
      else if (p.anchor === 'end') x -= w
      page.drawText(s, { x, y: py(c, p.y), size, font, color: hexToRgb(p.c ?? '#000000') })
      return
    }
  }
}

function drawPage(doc: PDFDocument, drawing: Drawing, pg: Page, helv: PDFFont, helvB: PDFFont): void {
  const page = doc.addPage([pg.pageW * K, pg.pageH * K])
  const ctx: Ctx = {
    page,
    tx: pg.margin - pg.offsetX,
    ty: pg.margin - pg.offsetY,
    pageHpt: pg.pageH * K,
    helv,
    helvB,
  }

  for (const prim of drawing.prims) drawPrim(ctx, prim)

  // crop marks
  const m = pg.margin
  const len = 4
  const corners: [number, number, number, number][] = [
    [m, m, 1, 1],
    [pg.pageW - m, m, -1, 1],
    [m, pg.pageH - m, 1, -1],
    [pg.pageW - m, pg.pageH - m, -1, -1],
  ]
  for (const [x, y, dx, dy] of corners) {
    page.drawLine({ start: { x: x * K, y: pg.pageH * K - y * K }, end: { x: (x + dx * len) * K, y: pg.pageH * K - y * K }, thickness: 0.25 * K, color: BLACK })
    page.drawLine({ start: { x: x * K, y: pg.pageH * K - y * K }, end: { x: x * K, y: pg.pageH * K - (y + dy * len) * K }, thickness: 0.25 * K, color: BLACK })
  }

  page.drawText(`notchcalc · ${drawing.meta.title} · sheet ${pg.index + 1}/${pg.total} (r${pg.row + 1}c${pg.col + 1})`, {
    x: m * K,
    y: pg.pageH * K - (m - 2) * K,
    size: 3 * K,
    font: helv,
    color: BLACK,
  })

  if (pg.col < pg.cols - 1) {
    page.drawText('overlap ->', { x: (pg.pageW - m + 1) * K, y: (pg.pageH / 2) * K, size: 2.4 * K, font: helv, color: RED, rotate: degrees(90) })
  }
  if (pg.row < pg.rows - 1) {
    page.drawText('overlap v', { x: (pg.pageW / 2) * K, y: (pg.pageH - m + 3) * K, size: 2.4 * K, font: helv, color: RED })
  }
}

export interface PdfItem {
  drawing: Drawing
  pages: Page[]
}

export async function buildPdfMany(items: PdfItem[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold)
  for (const it of items) for (const pg of it.pages) drawPage(doc, it.drawing, pg, helv, helvB)
  return doc.save()
}

export async function buildPdf(drawing: Drawing, pages: Page[]): Promise<Uint8Array> {
  return buildPdfMany([{ drawing, pages }])
}
