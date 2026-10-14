import type { Drawing, DPoint, Prim } from './drawing.ts'
import type { Page } from './layout.ts'

const n = (v: number) => (Math.round(v * 1000) / 1000).toString()

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ptsAttr(pts: DPoint[]): string {
  return pts.map((p) => `${n(p.x)},${n(p.y)}`).join(' ')
}

export function primToSvg(p: Prim): string {
  switch (p.t) {
    case 'line':
      return `<line x1="${n(p.a.x)}" y1="${n(p.a.y)}" x2="${n(p.b.x)}" y2="${n(p.b.y)}" stroke="${p.c ?? '#000'}" stroke-width="${p.w ?? 0.3}"${p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : ''} />`
    case 'poly': {
      const tag = p.closed ? 'polygon' : 'polyline'
      const fill = p.fill ?? 'none'
      return `<${tag} points="${ptsAttr(p.pts)}" fill="${fill}" stroke="${p.c ?? 'none'}" stroke-width="${p.w ?? 0.2}"${p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : ''} stroke-linejoin="round" />`
    }
    case 'rect':
      return `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" fill="${p.fill ?? 'none'}" stroke="${p.c ?? 'none'}" stroke-width="${p.lw ?? 0.3}"${p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : ''} />`
    case 'circle':
      return `<circle cx="${n(p.c0.x)}" cy="${n(p.c0.y)}" r="${n(p.r)}" fill="${p.fill ?? 'none'}" stroke="${p.c ?? 'none'}" stroke-width="${p.lw ?? 0.3}" />`
    case 'text': {
      const anchor = p.anchor ?? 'start'
      const weight = p.bold ? ' font-weight="700"' : ''
      return `<text x="${n(p.x)}" y="${n(p.y)}" font-size="${p.size ?? 2.5}" text-anchor="${anchor}" fill="${p.c ?? '#000'}" font-family="Arial, Helvetica, sans-serif"${weight}>${esc(p.s)}</text>`
    }
  }
}

/** Live preview: the whole master drawing scaled to fit its container. */
export function renderPreviewSVG(drawing: Drawing): string {
  const body = drawing.prims.map(primToSvg).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(drawing.width)} ${n(drawing.height)}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;background:#fff">
  <rect x="0" y="0" width="${n(drawing.width)}" height="${n(drawing.height)}" fill="#ffffff" />
  ${body}
</svg>`
}

function cropMarks(page: Page): string {
  const { margin, pageW, pageH } = page
  const len = 4
  const at = (x: number, y: number, dx: number, dy: number) =>
    `<path d="M ${n(x)} ${n(y)} l ${n(dx * len)} 0 M ${n(x)} ${n(y)} l 0 ${n(dy * len)}" stroke="#000" stroke-width="0.25" fill="none" />`
  const x0 = margin
  const y0 = margin
  const x1 = pageW - margin
  const y1 = pageH - margin
  return [
    at(x0, y0, 1, 1),
    at(x1, y0, -1, 1),
    at(x0, y1, 1, -1),
    at(x1, y1, -1, -1),
  ].join('')
}

export interface PageRenderOptions {
  /** clipping id uniqueness */
  withMarks?: boolean
  /** scale to container width instead of fixed mm (for on-screen previews) */
  fit?: boolean
}

/** A single print sheet, exact size in mm, with the master clipped to it. */
export function renderPageSVG(drawing: Drawing, page: Page, opts: PageRenderOptions = {}): string {
  const id = `clip-${page.index}`
  const body = drawing.prims.map(primToSvg).join('')
  const tx = page.margin - page.offsetX
  const ty = page.margin - page.offsetY
  const marks = opts.withMarks === false ? '' : cropMarks(page)
  const size = opts.fit
    ? 'style="width:100%;height:auto;display:block"'
    : `width="${n(page.pageW)}mm" height="${n(page.pageH)}mm"`

  // overlap hints: right edge / bottom edge when another tile continues
  const right = page.col < page.cols - 1
  const bottom = page.row < page.rows - 1

  return `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${n(page.pageW)} ${n(page.pageH)}">
  <defs><clipPath id="${id}"><rect x="${n(page.margin)}" y="${n(page.margin)}" width="${n(page.printableW)}" height="${n(page.printableH)}" /></clipPath></defs>
  <rect x="0" y="0" width="${n(page.pageW)}" height="${n(page.pageH)}" fill="#ffffff" />
  <g clip-path="url(#${id})">
    <g transform="translate(${n(tx)} ${n(ty)})">${body}</g>
  </g>
  ${marks}
  <text x="${n(page.margin)}" y="${n(page.margin - 2)}" font-size="3" fill="#000" font-family="Arial, sans-serif">notchcalc · ${esc(drawing.meta.title)} · sheet ${page.index + 1}/${page.total} (r${page.row + 1}c${page.col + 1})</text>
  ${right ? `<line x1="${n(page.pageW - page.margin)}" y1="${n(page.margin)}" x2="${n(page.pageW - page.margin)}" y2="${n(page.pageH - page.margin)}" stroke="#c00" stroke-width="0.3" stroke-dasharray="3 2" /><text x="${n(page.pageW - page.margin + 1)}" y="${n(page.pageH / 2)}" font-size="2.4" fill="#c00" font-family="Arial, sans-serif" transform="rotate(90 ${n(page.pageW - page.margin + 1)} ${n(page.pageH / 2)})">overlap →</text>` : ''}
  ${bottom ? `<line x1="${n(page.margin)}" y1="${n(page.pageH - page.margin)}" x2="${n(page.pageW - page.margin)}" y2="${n(page.pageH - page.margin)}" stroke="#c00" stroke-width="0.3" stroke-dasharray="3 2" /><text x="${n(page.pageW / 2)}" y="${n(page.pageH - page.margin + 3)}" font-size="2.4" fill="#c00" text-anchor="middle" font-family="Arial, sans-serif">overlap ↓</text>` : ''}
</svg>`
}

/** All sheets concatenated (for the hidden #print-area). */
export function renderPrintHTML(drawing: Drawing, pages: Page[]): string {
  return pages
    .map(
      (p) =>
        `<div class="print-page" style="width:${n(p.pageW)}mm;height:${n(p.pageH)}mm">${renderPageSVG(drawing, p)}</div>`,
    )
    .join('\n')
}
