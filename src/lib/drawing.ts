import type { CutProfile, Template, Unit } from '../geometry/types.ts'
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
  /** wrap rectangle (all bands) in master coords, used by the tiler */
  wrap: { x: number; y: number; w: number; h: number }
  /** filled "remove" regions (master coords) */
  removed: DPoint[][]
  /** solid cut boundaries exported to DXF */
  cutPaths: DPoint[][]
  /** primary notch depth (first band), mm — for header readouts */
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
const BAND_SEP = 6
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

/** A band is one developed profile stacked in the sheet. */
interface Band {
  profile: CutProfile[]
  far?: CutProfile[]
  label: string
  hole: boolean
}
interface PlacedBand extends Band {
  top: number
  height: number
  yBase: number
  max: number
  depth: number
}

/** y grows downward; the shallowest cut (max) sits at the top of the band. */
function mapProfile(profile: CutProfile[], x0: number, yBase: number, max: number): DPoint[] {
  return profile.map((p) => ({ x: x0 + p.arc, y: yBase + (max - p.cut) }))
}

function bandsFor(t: Template): Band[] {
  if (t.kind === 'hole') return [{ profile: t.profile, far: t.far, label: 'HEADER HOLE', hole: true }]
  if (t.kind === 'branch' && t.far) {
    return [
      { profile: t.profile, label: 'NEAR WALL (ENTRY SADDLE)', hole: false },
      { profile: t.far, label: 'FAR WALL (EXIT CUT)', hole: false },
    ]
  }
  return [{ profile: t.profile, label: '', hole: false }]
}

export function buildTemplateDrawing(t: Template, opts: DrawingOptions): Drawing {
  const unit = opts.unit
  const showRulers = opts.showRulers ?? true
  const showGrid = opts.showGrid ?? true
  const showTabs = opts.showTabs ?? true
  const calibration = opts.calibration ?? true

  const contentW = t.width
  const masterW = Math.max(contentW, MIN_W)
  const x0 = (masterW - contentW) / 2

  // ---- stack bands ----
  const raw = bandsFor(t)
  let cursor = TITLE_BAND + (showRulers ? RULER : 0)
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
    return { ...b, top, height, yBase: top + PAD, max: mx, depth }
  })
  const notchBottom = cursor
  const wrapH = notchBottom - wrapTop

  const footerTop = notchBottom + (showRulers ? RULER : 0)
  const masterH = footerTop + FOOTER

  const prims: Prim[] = []
  const removed: DPoint[][] = []
  const cutPaths: DPoint[][] = []

  // outer wrap outline
  prims.push({
    t: 'rect',
    x: x0,
    y: wrapTop,
    w: contentW,
    h: wrapH,
    lw: 0.3,
    c: C.faint,
  })

  // ---- per-band geometry ----
  for (const band of bands) {
    const profilePts = mapProfile(band.profile, x0, band.yBase, band.max)
    cutPaths.push(profilePts)

    if (band.hole && band.far) {
      const farPts = mapProfile(band.far, x0, band.yBase, band.max)
      prims.push({ t: 'poly', pts: profilePts, w: 0.4, c: C.cut })
      prims.push({ t: 'poly', pts: farPts, w: 0.4, c: C.cut })
      const region = [...profilePts, ...farPts.slice().reverse()]
      removed.push(region)
      prims.push({ t: 'poly', pts: region, closed: true, fill: C.remove, c: C.remove, w: 0.2 })
      cutPaths.push(farPts)
    } else {
      const waste: DPoint[] = [
        { x: x0, y: band.yBase },
        { x: x0 + contentW, y: band.yBase },
        { x: x0 + contentW, y: profilePts[profilePts.length - 1].y },
        ...profilePts.slice().reverse(),
        { x: x0, y: profilePts[0].y },
      ]
      removed.push(waste)
      prims.push({ t: 'poly', pts: waste, closed: true, fill: C.remove, c: C.remove, w: 0.2 })
      prims.push({ t: 'poly', pts: profilePts, w: 0.5, c: C.cut })
    }

    if (band.label) {
      prims.push({ t: 'text', x: x0 + 1, y: band.top + 3.5, s: band.label, size: 2.4, c: C.faint })
    }
    // band separator
    prims.push({
      t: 'line',
      a: { x: x0, y: band.top + band.height + BAND_SEP / 2 },
      b: { x: x0 + contentW, y: band.top + band.height + BAND_SEP / 2 },
      w: 0.15,
      c: C.grid,
      dash: [2, 2],
    })
  }

  // ---- grid ----
  if (showGrid) {
    const step = unit === 'in' ? MM_PER_INCH : 10
    for (let d = step; d < contentW; d += step) {
      prims.push({ t: 'line', a: { x: x0 + d, y: wrapTop }, b: { x: x0 + d, y: notchBottom }, w: 0.12, c: C.grid, dash: [1, 2] })
    }
  }

  // ---- centerline ----
  const clx = x0 + contentW / 2
  prims.push({ t: 'line', a: { x: clx, y: wrapTop - 2 }, b: { x: clx, y: notchBottom + 2 }, w: 0.3, c: C.cut, dash: [3, 2] })

  // ---- seam marks (arc 0 / 360) ----
  for (const sx of [x0, x0 + contentW]) {
    prims.push({ t: 'line', a: { x: sx, y: wrapTop - 2 }, b: { x: sx, y: notchBottom + 2 }, w: 0.3, c: C.cut })
  }

  // ---- rulers ----
  if (showRulers) {
    buildDegreeRuler(prims, x0, contentW, wrapTop - RULER)
    buildLengthRuler(prims, x0, contentW, notchBottom, unit)
  }

  // ---- datum labels ----
  prims.push({ t: 'text', x: clx, y: wrapTop - 3.5, s: 'CENTERLINE 180°', size: 2.4, anchor: 'middle', c: C.faint })
  prims.push({ t: 'text', x: x0 + 1, y: notchBottom + RULER + 5, s: 'SEAM 0° / 360°', size: 2, anchor: 'start', c: C.faint })

  // ---- glue / overlap flap (real seam tab) ----
  if (showTabs) {
    prims.push({ t: 'line', a: { x: x0 + contentW, y: wrapTop }, b: { x: x0 + contentW, y: notchBottom }, w: 0.3, dash: [2, 1.5], c: C.faint })
    prims.push({ t: 'rect', x: x0 + contentW, y: wrapTop, w: GLUE, h: wrapH, lw: 0.3, c: C.faint })
    prims.push({
      t: 'text',
      x: x0 + contentW + GLUE / 2,
      y: (wrapTop + notchBottom) / 2,
      s: 'GLUE FLAP',
      size: 2.4,
      anchor: 'middle',
      c: C.faint,
    })
  }

  // ---- title band ----
  const title = opts.title ?? titleFor(t)
  const subtitle = subtitleFor(t, unit)
  prims.push({ t: 'text', x: 2, y: 8, s: title, size: 5, bold: true, anchor: 'start', c: C.text })
  prims.push({ t: 'text', x: 2, y: 14.5, s: subtitle, size: 3, anchor: 'start', c: C.faint })
  prims.push({ t: 'text', x: masterW - 2, y: 8, s: `WRAP ${fmtDimsLabel(t.width, unit)}`, size: 3, anchor: 'end', c: C.faint })
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
    meta: { title, subtitle, kind: t.kind },
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

function subtitleFor(t: Template, unit: Unit): string {
  const m = t.meta
  const parts: string[] = []
  if (m.branchOD) parts.push(`branch OD ${fmtDimsLabel(m.branchOD, unit)}`)
  if (m.headerOD) parts.push(`header OD ${fmtDimsLabel(m.headerOD, unit)}`)
  if (m.angleDeg != null) parts.push(`angle ${m.angleDeg}°`)
  if (m.offsetInPlane) parts.push(`offset ∥ ${fmtDimsLabel(m.offsetInPlane, unit)}`)
  if (m.offsetPerp) parts.push(`offset ⊥ ${fmtDimsLabel(m.offsetPerp, unit)}`)
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
