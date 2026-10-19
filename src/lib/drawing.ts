import type { CutProfile, Template, TemplateKind, Unit } from '../geometry/types.ts'
import { fmtDimsLabel, fromMm, MM_PER_INCH } from './units.ts'

export interface DPoint {
  x: number
  y: number
}

export type Prim =
  | { t: 'line'; a: DPoint; b: DPoint; w?: number; dash?: number[]; c?: string }
  | { t: 'poly'; pts: DPoint[]; closed?: boolean; w?: number; dash?: number[]; c?: string; fill?: string }
  | { t: 'rect'; x: number; y: number; w: number; h: number; lw?: number; dash?: number[]; c?: string; fill?: string }
  | { t: 'circle'; c0: DPoint; r: number; lw?: number; c?: string; fill?: string }
  | {
      t: 'text'
      x: number
      y: number
      s: string
      size?: number
      anchor?: 'start' | 'middle' | 'end'
      c?: string
      bold?: boolean
    }

export interface Drawing {
  /** master sheet size in mm */
  width: number
  height: number
  prims: Prim[]
  /** bounding box of all bands, used by the tiler */
  wrap: { x: number; y: number; w: number; h: number }
  /** filled "remove" regions (master coords) */
  removed: DPoint[][]
  /** solid cut boundaries exported to DXF */
  cutPaths: DPoint[][]
  /** primary cut depth (first band), mm — for header readouts */
  depthMm: number
  meta: { title: string; subtitle: string; kind: string }
}

export interface DrawingOptions {
  unit: Unit
  showGrid?: boolean
  showRulers?: boolean
  showTabs?: boolean
  calibration?: boolean
  title?: string
}

const PAD = 8
const BAND_SEP = 10
const TITLE_BAND = 34
const RULER = 10
const FOOTER = 16
const MIN_W = 130
const GLUE = 12

const C = {
  cut: '#111111',
  faint: '#9aa0a6',
  grid: '#c7ccd1',
  remove: '#d9dee3',
  text: '#111111',
}

interface Band {
  kind: TemplateKind
  profile: CutProfile[]
  far?: CutProfile[]
  label: string
  hole: boolean
  w: number
}
interface PlacedBand extends Band {
  top: number
  height: number
  yBase: number
  max: number
  depth: number
  x0: number
}

function mapProfile(profile: CutProfile[], x0: number, yBase: number, max: number): DPoint[] {
  return profile.map((p) => ({ x: x0 + p.arc, y: yBase + (max - p.cut) }))
}

function bandsFor(t: Template, index: number, count: number, unit: Unit): Band[] {
  const prefix = count > 1 ? `${index + 1}/${count} · ` : ''
  const wrap = `  (WRAP ${fmtDimsLabel(t.width, unit)})`
  if (t.kind === 'hole') return [{ kind: 'hole', profile: t.profile, far: t.far, label: prefix + 'HEADER HOLE', hole: true, w: t.width }]
  if (t.kind === 'branch' && t.far) {
    return [
      { kind: 'branch', profile: t.profile, label: `${prefix}NEAR WALL (ENTRY SADDLE)${count > 1 ? '' : wrap}`, hole: false, w: t.width },
      { kind: 'branch', profile: t.far, label: `${prefix}FAR WALL (EXIT CUT)`, hole: false, w: t.width },
    ]
  }
  return [{ kind: t.kind, profile: t.profile, label: prefix + titleFor(t) + (count > 1 ? wrap : ''), hole: false, w: t.width }]
}

/**
 * Render template(s) as one stacked drawing.
 * Pass `generate(spec)` output — a through-branch yields notch + hole bands.
 */
export function buildTemplateDrawing(templates: Template | Template[], opts: DrawingOptions): Drawing {
  const list = Array.isArray(templates) ? templates : [templates]
  const t0 = list[0]
  const unit = opts.unit
  const showRulers = opts.showRulers ?? true
  const showGrid = opts.showGrid ?? true
  const showTabs = opts.showTabs ?? true
  const calibration = opts.calibration ?? true

  const contentW = Math.max(...list.map((tt) => tt.width))
  const uniformW = list.every((tt) => Math.abs(tt.width - t0.width) < 0.01)
  const masterW = Math.max(contentW + (showTabs ? GLUE : 0) + 4, MIN_W)
  const x0 = (masterW - (contentW + (showTabs ? GLUE : 0) + 4)) / 2

  // ---- stack bands ----
  const raw = list.flatMap((tt, i) => bandsFor(tt, i, list.length, unit))
  let cursor = TITLE_BAND + (showRulers && uniformW ? RULER : 0)
  const wrapTop = cursor
  const bands: PlacedBand[] = raw.map((b, i) => {
    const pts = b.far ? [...b.profile, ...b.far] : b.profile
    let mn = Infinity
    let mx = -Infinity
    for (const p of pts) {
      if (p.cut < mn) mn = p.cut
      if (p.cut > mx) mx = p.cut
    }
    if (!Number.isFinite(mn)) {
      mn = 0
      mx = 0
    }
    const depth = mx - mn
    const height = depth + 2 * PAD
    const top = cursor
    cursor += height + (i < raw.length - 1 ? BAND_SEP : 0)
    return { ...b, top, height, yBase: top + PAD, max: mx, depth, x0: x0 + (contentW - b.w) / 2 }
  })
  const notchBottom = cursor
  const wrapH = notchBottom - wrapTop

  const footerTop = notchBottom + (showRulers && uniformW ? RULER : 0)
  const masterH = footerTop + FOOTER

  const prims: Prim[] = []
  const removed: DPoint[][] = []
  const cutPaths: DPoint[][] = []

  // ---- bands ----
  for (const band of bands) {
    prims.push({ t: 'rect', x: band.x0, y: band.top, w: band.w, h: band.height, lw: 0.3, c: C.faint })

    const profilePts = mapProfile(band.profile, band.x0, band.yBase, band.max)
    cutPaths.push(profilePts)

    if (band.hole && band.far) {
      const farPts = mapProfile(band.far, band.x0, band.yBase, band.max)
      prims.push({ t: 'poly', pts: profilePts, w: 0.4, c: C.cut })
      prims.push({ t: 'poly', pts: farPts, w: 0.4, c: C.cut })
      const region = [...profilePts, ...farPts.slice().reverse()]
      removed.push(region)
      prims.push({ t: 'poly', pts: region, closed: true, fill: C.remove, c: C.remove, w: 0.2 })
      cutPaths.push(farPts)
    } else {
      const waste: DPoint[] = [
        { x: band.x0, y: band.yBase },
        { x: band.x0 + band.w, y: band.yBase },
        { x: band.x0 + band.w, y: profilePts[profilePts.length - 1].y },
        ...profilePts.slice().reverse(),
        { x: band.x0, y: profilePts[0].y },
      ]
      removed.push(waste)
      prims.push({ t: 'poly', pts: waste, closed: true, fill: C.remove, c: C.remove, w: 0.2 })
      prims.push({ t: 'poly', pts: profilePts, w: 0.5, c: C.cut })
    }

    // grid
    if (showGrid) {
      const step = unit === 'in' ? MM_PER_INCH : 10
      for (let d = step; d < band.w; d += step) {
        prims.push({ t: 'line', a: { x: band.x0 + d, y: band.top }, b: { x: band.x0 + d, y: band.top + band.height }, w: 0.12, c: C.grid, dash: [1, 2] })
      }
    }

    // centerline + seams
    const clx = band.x0 + band.w / 2
    prims.push({ t: 'line', a: { x: clx, y: band.top - 2 }, b: { x: clx, y: band.top + band.height + 2 }, w: 0.3, c: C.cut, dash: [3, 2] })
    for (const sx of [band.x0, band.x0 + band.w]) {
      prims.push({ t: 'line', a: { x: sx, y: band.top }, b: { x: sx, y: band.top + band.height }, w: 0.3, c: C.cut })
    }

    // band label + datum labels
    prims.push({ t: 'text', x: band.x0 + 1, y: band.top - 2, s: band.label, size: 2.6, c: C.faint, bold: true })
    if (!uniformW || list.length > 1) {
      prims.push({ t: 'text', x: clx, y: band.top + band.height + 5.5, s: 'CENTERLINE 180°', size: 2, anchor: 'middle', c: C.faint })
      prims.push({ t: 'text', x: band.x0 + 1, y: band.top + band.height + 5.5, s: 'SEAM 0°', size: 2, c: C.faint })
      prims.push({ t: 'text', x: band.x0 + band.w - 1, y: band.top + band.height + 5.5, s: 'SEAM 360°', size: 2, anchor: 'end', c: C.faint })
    }
  }

  // ---- shared rulers (only when all bands share the wrap width) ----
  if (showRulers && uniformW) {
    buildDegreeRuler(prims, x0, contentW, wrapTop - RULER)
    buildLengthRuler(prims, x0, contentW, notchBottom, unit)
    const clx = x0 + contentW / 2
    prims.push({ t: 'text', x: clx, y: wrapTop - 3.5, s: 'CENTERLINE 180°', size: 2.4, anchor: 'middle', c: C.faint })
    prims.push({ t: 'text', x: x0 + 1, y: notchBottom + RULER + 5, s: 'SEAM 0° / 360°', size: 2, anchor: 'start', c: C.faint })
  }

  // ---- glue / overlap flap ----
  if (showTabs && uniformW) {
    prims.push({ t: 'line', a: { x: x0 + contentW, y: wrapTop }, b: { x: x0 + contentW, y: notchBottom }, w: 0.3, dash: [2, 1.5], c: C.faint })
    prims.push({ t: 'rect', x: x0 + contentW, y: wrapTop, w: GLUE, h: wrapH, lw: 0.3, c: C.faint })
    prims.push({ t: 'text', x: x0 + contentW + GLUE / 2, y: (wrapTop + notchBottom) / 2, s: 'GLUE FLAP', size: 2.4, anchor: 'middle', c: C.faint })
  }

  // ---- title band ----
  const title = opts.title ?? (list.length > 1 ? 'THROUGH-BRANCH SET (NOTCH + HEADER HOLE)' : titleFor(t0))
  const subtitle = subtitleFor(t0, unit)
  prims.push({ t: 'text', x: 2, y: 8, s: title, size: 5, bold: true, anchor: 'start', c: C.text })
  prims.push({ t: 'text', x: 2, y: 14.5, s: subtitle, size: 3, anchor: 'start', c: C.faint })
  prims.push({ t: 'text', x: masterW - 2, y: 8, s: `WRAP ${fmtDimsLabel(t0.width, unit)}`, size: 3, anchor: 'end', c: C.faint })
  prims.push({ t: 'text', x: masterW - 2, y: 13, s: `DEPTH ${fmtDimsLabel(bands[0].depth, unit)}`, size: 3, anchor: 'end', c: C.faint })

  if (calibration) buildCalibration(prims, masterW - 106, 22)

  prims.push({ t: 'line', a: { x: 0, y: TITLE_BAND - 4 }, b: { x: masterW, y: TITLE_BAND - 4 }, w: 0.3, c: C.faint })

  // ---- footer ----
  prims.push({ t: 'line', a: { x: 0, y: footerTop }, b: { x: masterW, y: footerTop }, w: 0.3, c: C.faint })
  prims.push({
    t: 'text',
    x: 2,
    y: footerTop + 5,
    s: 'Cut on the profile line. Grind away the shaded area. Print at 100% / actual size — never "fit to page".',
    size: 2.6,
    c: C.faint,
  })
  prims.push({
    t: 'text',
    x: 2,
    y: footerTop + 10,
    s: 'notchcalc • verify the calibration bar before cutting metal.',
    size: 2.4,
    c: C.faint,
  })

  return {
    width: masterW,
    height: masterH,
    prims,
    wrap: { x: x0, y: wrapTop, w: contentW, h: wrapH },
    removed,
    cutPaths,
    depthMm: bands[0].depth,
    meta: { title, subtitle, kind: t0.kind },
  }
}

function titleFor(t: Template): string {
  switch (t.kind) {
    case 'branch':
      return t.meta.passThrough ? 'BRANCH NOTCH (PASS-THROUGH)' : 'BRANCH NOTCH (FISHMOUTH)'
    case 'miter':
      return 'MITER / ANGLE CUT'
    case 'hole':
      return 'HEADER HOLE'
  }
}

function sectionLabel(
  name: string,
  shape: string | number | boolean | undefined,
  a: number | undefined,
  b: number | undefined,
  unit: Unit,
): string | null {
  if (typeof shape !== 'string' || a == null) return null
  if (shape === 'round') return `${name} Ø${fmtDimsLabel(a, unit)}`
  return `${name} □${fmtDimsLabel(a, unit)}×${fmtDimsLabel(b ?? a, unit)}`
}

function subtitleFor(t: Template, unit: Unit): string {
  const m = t.meta
  const parts: string[] = []
  const isMiter = t.kind === 'miter'
  const branch = sectionLabel(isMiter ? 'tube' : 'branch', m.branchSection, m.branchSize, m.branchSize2, unit)
  const header = sectionLabel('header', m.headerSection, m.headerSize, m.headerSize2, unit)
  if (branch) parts.push(branch)
  if (header) parts.push(header)
  if (!branch && m.branchOD) parts.push(`branch OD ${fmtDimsLabel(m.branchOD, unit)}`)
  if (!header && m.headerOD) parts.push(`header OD ${fmtDimsLabel(m.headerOD, unit)}`)
  if (m.angleDeg != null) parts.push(`angle ${m.angleDeg}°`)
  if (m.offsetInPlane) parts.push(`offset ∥ ${fmtDimsLabel(m.offsetInPlane, unit)}`)
  if (m.offsetPerp) parts.push(`offset ⊥ ${fmtDimsLabel(m.offsetPerp, unit)}`)
  if (m.sectionRollDeg) parts.push(`roll ${m.sectionRollDeg}°`)
  if (m.approx) parts.push('⚠ approx hole')
  if (m.clipped) parts.push('⚠ clamped')
  return parts.join('   ·   ')
}

function buildDegreeRuler(prims: Prim[], x0: number, w: number, y: number): void {
  const y2 = y + RULER
  prims.push({ t: 'line', a: { x: x0, y: y2 }, b: { x: x0 + w, y: y2 }, w: 0.3, c: C.faint })
  for (let d = 0; d <= 360; d += 5) {
    const x = x0 + (w * d) / 360
    const major = d % 45 === 0
    prims.push({ t: 'line', a: { x, y: y2 }, b: { x, y: y2 - (major ? 4 : d % 15 === 0 ? 2.6 : 1.6) }, w: 0.2, c: C.faint })
    if (major) prims.push({ t: 'text', x, y: y2 - 5, s: `${d}°`, size: 2.2, anchor: 'middle', c: C.faint })
  }
}

function buildLengthRuler(prims: Prim[], x0: number, w: number, y: number, unit: Unit): void {
  const y2 = y + 1.5
  prims.push({ t: 'line', a: { x: x0, y: y2 }, b: { x: x0 + w, y: y2 }, w: 0.3, c: C.faint })
  const step = unit === 'in' ? MM_PER_INCH / 2 : 10
  const majorEvery = unit === 'in' ? 2 : 5
  let n = 0
  for (let d = 0; d <= w + 0.001; d += step, n++) {
    const x = x0 + d
    const major = n % majorEvery === 0
    prims.push({ t: 'line', a: { x, y: y2 }, b: { x, y: y2 + (major ? 4 : 2.2) }, w: 0.2, c: C.faint })
    if (major) {
      const label = unit === 'in' ? `${Math.round(fromMm(d, 'in'))}"` : `${Math.round(d)}`
      prims.push({ t: 'text', x, y: y2 + 8, s: label, size: 2, anchor: 'middle', c: C.faint })
    }
  }
}

function buildCalibration(prims: Prim[], x: number, y: number): void {
  const len = 100
  prims.push({ t: 'line', a: { x, y }, b: { x: x + len, y }, w: 0.4, c: C.cut })
  for (const xx of [x, x + len]) {
    prims.push({ t: 'line', a: { x: xx, y: y - 3 }, b: { x: xx, y: y + 3 }, w: 0.4, c: C.cut })
  }
  prims.push({
    t: 'text',
    x: x + len / 2,
    y: y - 4,
    s: `CALIBRATION 100 mm (${(100 / MM_PER_INCH).toFixed(2)}")`,
    size: 2.4,
    anchor: 'middle',
    c: C.cut,
  })
}
