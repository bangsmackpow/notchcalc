import type { CutProfile, Template, Unit } from '../geometry/types.ts'
import { fmtDimsLabel, MM_PER_INCH } from './units.ts'

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
  /** rectangles in master coords used by the tiler */
  wrap: { x: number; y: number; w: number; h: number }
  /** filled "remove" regions (master coords) */
  removed: DPoint[][]
  /** solid cut boundaries exported to DXF */
  cutPaths: DPoint[][]
  meta: { title: string; subtitle: string; kind: string }
}

export interface DrawingOptions {
  unit: Unit
  showGrid?: boolean
  showRulers?: boolean
  showTabs?: boolean
  showAdjust?: boolean
  calibration?: boolean
  title?: string
}

const PAD = 8
const TITLE_BAND = 34
const RULER = 10
const FOOTER = 16
const MIN_W = 130

const C = {
  cut: '#111111',
  faint: '#9aa0a6',
  grid: '#c7ccd1',
  text: '#111111',
  remove: '#d9dee3',
  title: '#111111',
}

/** Map a profile to master coordinates: y grows downward, maxCut at the top. */
function mapProfile(profile: CutProfile[], x0: number, top: number, maxCut: number): DPoint[] {
  return profile.map((p) => ({ x: x0 + p.arc, y: top + (maxCut - p.cut) }))
}

export function buildTemplateDrawing(t: Template, opts: DrawingOptions): Drawing {
  const unit = opts.unit
  const showRulers = opts.showRulers ?? true
  const showGrid = opts.showGrid ?? true
  const showTabs = opts.showTabs ?? true
  const showAdjust = opts.showAdjust ?? true
  const calibration = opts.calibration ?? true

  const contentW = t.width
  const masterW = Math.max(contentW, MIN_W)
  const x0 = (masterW - contentW) / 2

  const notchTop = TITLE_BAND + (showRulers ? RULER : 0)
  const notchH = t.depth + 2 * PAD
  const afterNotch = notchTop + notchH
  const footerTop = afterNotch + (showRulers ? RULER : 0)
  const masterH = footerTop + FOOTER

  const TOP = notchTop + PAD
  const prims: Prim[] = []
  const removed: DPoint[][] = []
  const cutPaths: DPoint[][] = []

  const outline: DPoint[] = [
    { x: x0, y: notchTop },
    { x: x0 + contentW, y: notchTop },
    { x: x0 + contentW, y: notchTop + notchH },
    { x: x0, y: notchTop + notchH },
  ]
  prims.push({ t: 'poly', pts: outline, closed: true, w: 0.3, c: C.faint })

  const profilePts = mapProfile(t.profile, x0, TOP, t.maxCut)
  cutPaths.push(profilePts)

  if (t.kind === 'hole') {
    // Hole: profile is the upper edge, far is the lower edge; shade between.
    prims.push({ t: 'poly', pts: profilePts, w: 0.4, c: C.cut })
    if (t.far) {
      const farPts = mapProfile(t.far, x0, TOP, t.maxCut)
      prims.push({ t: 'poly', pts: farPts, w: 0.4, c: C.cut })
      const region: DPoint[] = [...profilePts, ...farPts.slice().reverse()]
      removed.push(region)
      prims.push({ t: 'poly', pts: region, closed: true, fill: C.remove, c: C.remove, w: 0.2 })
      cutPaths.push(farPts)
    }
  } else {
    // Notch / miter: shade material to remove (the region above the cut line).
    const waste: DPoint[] = [
      { x: x0, y: notchTop },
      { x: x0 + contentW, y: notchTop },
      { x: x0 + contentW, y: profilePts[profilePts.length - 1].y },
      ...profilePts.slice().reverse(),
      { x: x0, y: profilePts[0].y },
    ]
    removed.push(waste)
    prims.push({ t: 'poly', pts: waste, closed: true, fill: C.remove, c: C.remove, w: 0.2 })
    prims.push({ t: 'poly', pts: profilePts, w: 0.5, c: C.cut })
  }

  // ---- grid ----
  if (showGrid) {
    const step = unit === 'in' ? MM_PER_INCH : 10
    for (let d = step; d < contentW; d += step) {
      prims.push({ t: 'line', a: { x: x0 + d, y: notchTop }, b: { x: x0 + d, y: notchTop + notchH }, w: 0.12, c: C.grid, dash: [1, 2] })
    }
  }

  // ---- centerline ----
  const clx = x0 + contentW / 2
  prims.push({ t: 'line', a: { x: clx, y: notchTop - 2 }, b: { x: clx, y: notchTop + notchH + 2 }, w: 0.3, c: C.cut, dash: [3, 2] })

  // ---- rulers ----
  if (showRulers) {
    buildDegreeRuler(prims, x0, contentW, notchTop - RULER)
    buildLengthRuler(prims, x0, contentW, notchTop + notchH, unit)
  }

  // ---- centerline datum label ----
  prims.push({ t: 'text', x: clx, y: notchTop - 3.5, s: 'CENTERLINE 0° / 180°', size: 2.4, anchor: 'middle', c: C.faint })

  // ---- micro length-adjust window ----
  if (showAdjust) {
    buildAdjust(prims, clx, footerTop - RULER / 2, unit)
  }

  // ---- glue tab ----
  if (showTabs) {
    const tabW = 10
    prims.push({ t: 'rect', x: x0 + contentW, y: notchTop, w: tabW, h: notchH, lw: 0.3, dash: [2, 2], c: C.faint })
    prims.push({ t: 'text', x: x0 + contentW + tabW / 2, y: notchTop + notchH / 2, s: 'GLUE', size: 2.6, anchor: 'middle', c: C.faint })
  }

  // ---- title band ----
  const title = opts.title ?? titleFor(t)
  const subtitle = subtitleFor(t, unit)
  prims.push({ t: 'text', x: 2, y: 8, s: title, size: 5, bold: true, anchor: 'start', c: C.title })
  prims.push({ t: 'text', x: 2, y: 14.5, s: subtitle, size: 3, anchor: 'start', c: C.faint })
  prims.push({ t: 'text', x: masterW - 2, y: 8, s: `WRAP ${fmtDimsLabel(t.width, unit)}`, size: 3, anchor: 'end', c: C.faint })
  prims.push({ t: 'text', x: masterW - 2, y: 13, s: `DEPTH ${fmtDimsLabel(t.depth, unit)}`, size: 3, anchor: 'end', c: C.faint })

  if (calibration) {
    buildCalibration(prims, masterW - 106, 22, unit)
  }

  prims.push({ t: 'line', a: { x: 0, y: TITLE_BAND - 4 }, b: { x: masterW, y: TITLE_BAND - 4 }, w: 0.3, c: C.faint })

  // ---- footer ----
  prims.push({ t: 'line', a: { x: 0, y: footerTop }, b: { x: masterW, y: footerTop }, w: 0.3, c: C.faint })
  prims.push({
    t: 'text',
    x: 2,
    y: footerTop + 5,
    s: 'Cut on the profile line. Grind away the shaded notch. Print at 100% / actual size — never "fit to page".',
    size: 2.6,
    c: C.faint,
  })
  prims.push({
    t: 'text',
    x: 2,
    y: footerTop + 10,
    s: 'notchcalc  •  verify the calibration bar before cutting metal.',
    size: 2.4,
    c: C.faint,
  })

  return {
    width: masterW,
    height: masterH,
    prims,
    wrap: { x: x0, y: notchTop, w: contentW, h: notchH },
    removed,
    cutPaths,
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
    if (major) prims.push({ t: 'text', x, y: y2 + 8, s: `${d.toFixed(0)}`, size: 2, anchor: 'middle', c: C.faint })
  }
}

function buildCalibration(prims: Prim[], x: number, y: number, unit: Unit): void {
  const len = 100
  prims.push({ t: 'line', a: { x, y }, b: { x: x + len, y }, w: 0.4, c: C.cut })
  for (const xx of [x, x + len]) {
    prims.push({ t: 'line', a: { x: xx, y: y - 3 }, b: { x: xx, y: y + 3 }, w: 0.4, c: C.cut })
  }
  prims.push({ t: 'text', x: x + len / 2, y: y - 4, s: `CALIBRATION 100 mm (${(100 / MM_PER_INCH).toFixed(2)}")`, size: 2.4, anchor: 'middle', c: C.cut })
  void unit
}

function buildAdjust(prims: Prim[], cx: number, y: number, unit: Unit): void {
  const span = unit === 'in' ? MM_PER_INCH : 10
  prims.push({ t: 'rect', x: cx - span, y: y - 5, w: span * 2, h: 10, lw: 0.3, c: C.faint })
  prims.push({ t: 'text', x: cx, y: y - 6.2, s: 'LENGTH ADJUST', size: 2.2, anchor: 'middle', c: C.faint })
  const ticks = unit === 'in' ? 16 : 10
  for (let i = -ticks; i <= ticks; i++) {
    const x = cx + (span * i) / ticks
    const major = i % (ticks / 2) === 0
    prims.push({ t: 'line', a: { x, y: y + 4.6 }, b: { x, y: y + 4.6 - (major ? 3 : 1.6) }, w: 0.2, c: C.faint })
  }
  prims.push({ t: 'circle', c0: { x: cx, y }, r: 1.1, lw: 0.3, c: C.cut })
}
