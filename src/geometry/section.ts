/**
 * 2D tube cross-sections and the line/section intersection primitive.
 *
 * Every tube is modelled as a 2D **section** swept along its axis. A round
 * section reproduces the legacy cylinder maths exactly; a rounded-rectangle
 * section adds square/rectangular tubing. Both the branch notch and the header
 * hole developments reduce to `lineIntersections`, so supporting every
 * branch×header shape combination needs only this one primitive.
 *
 * All distances are millimetres.
 */

export type Section =
  | { shape: 'round'; od: number }
  | { shape: 'rect'; width: number; height: number; cornerRadius: number }

export interface Pt {
  x: number
  y: number
}

export interface Sample {
  /** arc-length around the perimeter from the datum (0), mm */
  arc: number
  x: number
  y: number
}

export interface SectionGeom {
  section: Section
  /** one full wrap length = perimeter, mm */
  perimeter: number
  /** boundary point at arc-length `s` (wrapped into range), mm */
  pointAt(s: number): Pt
  /** ordered boundary samples: even steps plus exact corner breakpoints */
  sample(n: number): Sample[]
  /** parameters `t` where `p0 + t·dir` meets the boundary (sorted, deduped) */
  lineIntersections(p0: Pt, dir: Pt): number[]
}

const TAU = Math.PI * 2
const HALF_PI = Math.PI / 2

/** Standard HSS outside corner radius is ~2 × wall thickness. */
export const DEFAULT_CORNER_FACTOR = 2

export function defaultCornerRadius(wallMm: number): number {
  return DEFAULT_CORNER_FACTOR * wallMm
}

/** Effective (clamped) corner radius for a rect section. */
export function cornerRadiusOf(s: { width: number; height: number; cornerRadius: number }): number {
  const w = Math.max(0.001, s.width)
  const h = Math.max(0.001, s.height)
  return Math.max(0, Math.min(s.cornerRadius, Math.min(w, h) / 2 - 1e-6))
}

export function sectionPerimeter(s: Section): number {
  if (s.shape === 'round') return Math.PI * Math.max(0.001, s.od)
  const rho = cornerRadiusOf(s)
  return 2 * (s.width - 2 * rho) + 2 * (s.height - 2 * rho) + TAU * rho
}

export function makeSection(s: Section): SectionGeom {
  return s.shape === 'round' ? roundGeom(s) : rectGeom(s)
}

/** Diameter of the circle with the same perimeter (round sections return their OD). */
export function sectionEquivalentOd(s: Section): number {
  return sectionPerimeter(s) / Math.PI
}

/** Primary/secondary dimensions of a section, for labels. */
export function sectionDims(s: Section): { shape: 'round' | 'rect'; w: number; h: number } {
  return s.shape === 'round' ? { shape: 'round', w: s.od, h: s.od } : { shape: 'rect', w: s.width, h: s.height }
}

/**
 * Coerce persisted/legacy data into a Section. A bare number (the old `OD`) is
 * treated as a round section so pre-square records keep loading.
 */
export function toSection(v: unknown, fallbackOd = 50): Section {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (o.shape === 'round' && typeof o.od === 'number') return { shape: 'round', od: o.od }
    if (o.shape === 'rect' && typeof o.width === 'number' && typeof o.height === 'number') {
      return {
        shape: 'rect',
        width: o.width,
        height: o.height,
        cornerRadius: typeof o.cornerRadius === 'number' ? o.cornerRadius : 0,
      }
    }
  }
  if (typeof v === 'number' && v > 0) return { shape: 'round', od: v }
  return { shape: 'round', od: fallbackOd }
}

/** Rotate a point about the origin by `deg` (used for section roll). */
export function rotate(p: Pt, deg: number): Pt {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

function wrap(v: number, m: number): number {
  const r = v % m
  return r < 0 ? r + m : r
}

function dedupe(ts: number[]): number[] {
  const sorted = ts.filter((t) => Number.isFinite(t)).sort((a, b) => a - b)
  const out: number[] = []
  for (const t of sorted) {
    if (out.length === 0 || Math.abs(t - out[out.length - 1]) > 1e-7) out.push(t)
  }
  return out
}

// ---------------------------------------------------------------------------
// Round
// ---------------------------------------------------------------------------

function roundGeom(section: { shape: 'round'; od: number }): SectionGeom {
  const r = Math.max(0.001, section.od / 2)
  const perimeter = TAU * r
  const pointAt = (arc: number): Pt => {
    const phi = (TAU * wrap(arc, perimeter)) / perimeter
    return { x: r * Math.cos(phi), y: r * Math.sin(phi) }
  }
  return {
    section,
    perimeter,
    pointAt,
    sample: (n) => {
      const N = Math.max(8, Math.floor(n))
      const out: Sample[] = []
      for (let i = 0; i <= N; i++) {
        const arc = (perimeter * i) / N
        const p = pointAt(arc)
        out.push({ arc, x: p.x, y: p.y })
      }
      return out
    },
    lineIntersections: (p0, dir) => {
      const a = dir.x * dir.x + dir.y * dir.y
      if (a < 1e-18) return []
      const b = 2 * (p0.x * dir.x + p0.y * dir.y)
      const c = p0.x * p0.x + p0.y * p0.y - r * r
      const disc = b * b - 4 * a * c
      if (disc < -1e-9) return []
      const sq = Math.sqrt(Math.max(0, disc))
      return dedupe([(-b - sq) / (2 * a), (-b + sq) / (2 * a)])
    },
  }
}

// ---------------------------------------------------------------------------
// Rounded rectangle
// ---------------------------------------------------------------------------

interface FlatSeg {
  kind: 'flat'
  ax: number
  ay: number
  bx: number
  by: number
  len: number
  start: number
}
interface ArcSeg {
  kind: 'arc'
  cx: number
  cy: number
  r: number
  a0: number
  a1: number
  len: number
  start: number
}
type Seg = FlatSeg | ArcSeg

function rectGeom(section: {
  shape: 'rect'
  width: number
  height: number
  cornerRadius: number
}): SectionGeom {
  const w = Math.max(0.001, section.width)
  const h = Math.max(0.001, section.height)
  const rho = cornerRadiusOf(section)
  const a = w / 2
  const b = h / 2
  const cw = Math.max(0, a - rho)
  const ch = Math.max(0, b - rho)

  const segs: Seg[] = []
  let cursor = 0
  const addFlat = (ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay)
    segs.push({ kind: 'flat', ax, ay, bx, by, len, start: cursor })
    cursor += len
  }
  const addArc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    const len = r * Math.abs(a1 - a0)
    segs.push({ kind: 'arc', cx, cy, r, a0, a1, len, start: cursor })
    cursor += len
  }

  // Walk counter-clockwise from the middle of the bottom flat, so arc 0 is the
  // centre of a flat (the natural seam / datum for a square or rectangular tube).
  addFlat(0, -b, cw, -b)
  if (rho > 1e-9) addArc(cw, -ch, rho, -HALF_PI, 0)
  addFlat(a, -ch, a, ch)
  if (rho > 1e-9) addArc(cw, ch, rho, 0, HALF_PI)
  addFlat(cw, b, -cw, b)
  if (rho > 1e-9) addArc(-cw, ch, rho, HALF_PI, Math.PI)
  addFlat(-a, ch, -a, -ch)
  if (rho > 1e-9) addArc(-cw, -ch, rho, Math.PI, 1.5 * Math.PI)
  addFlat(-cw, -b, 0, -b)

  const perimeter = cursor

  const pointAt = (arc: number): Pt => {
    const s = wrap(arc, perimeter)
    for (const seg of segs) {
      if (s <= seg.start + seg.len + 1e-9) {
        const local = Math.min(seg.len, Math.max(0, s - seg.start))
        if (seg.kind === 'flat') {
          const f = seg.len > 1e-9 ? local / seg.len : 0
          return { x: seg.ax + (seg.bx - seg.ax) * f, y: seg.ay + (seg.by - seg.ay) * f }
        }
        const f = seg.len > 1e-9 ? local / seg.len : 0
        const ang = seg.a0 + (seg.a1 - seg.a0) * f
        return { x: seg.cx + seg.r * Math.cos(ang), y: seg.cy + seg.r * Math.sin(ang) }
      }
    }
    const last = segs[segs.length - 1]
    return last.kind === 'flat'
      ? { x: last.bx, y: last.by }
      : { x: last.cx + last.r * Math.cos(last.a1), y: last.cy + last.r * Math.sin(last.a1) }
  }

  const sample = (n: number): Sample[] => {
    const step = perimeter / Math.max(8, Math.floor(n))
    const arcs: number[] = []
    for (const seg of segs) {
      const k = Math.max(1, Math.ceil(seg.len / step))
      for (let j = 0; j < k; j++) arcs.push(seg.start + (seg.len * j) / k)
    }
    arcs.push(perimeter)
    return arcs.map((arc) => {
      const p = pointAt(arc)
      return { arc, x: p.x, y: p.y }
    })
  }

  const lineIntersections = (p0: Pt, dir: Pt): number[] => {
    const out: number[] = []
    for (const seg of segs) {
      if (seg.kind === 'flat') {
        const ex = seg.bx - seg.ax
        const ey = seg.by - seg.ay
        const fx = seg.ax - p0.x
        const fy = seg.ay - p0.y
        const det = ex * dir.y - ey * dir.x
        if (Math.abs(det) < 1e-12) continue
        const t = (ex * fy - ey * fx) / det
        const u = (dir.x * fy - dir.y * fx) / det
        if (u >= -1e-9 && u <= 1 + 1e-9) out.push(t)
      } else {
        const aa = dir.x * dir.x + dir.y * dir.y
        if (aa < 1e-18) continue
        const px = p0.x - seg.cx
        const py = p0.y - seg.cy
        const bb = 2 * (dir.x * px + dir.y * py)
        const cc = px * px + py * py - seg.r * seg.r
        const disc = bb * bb - 4 * aa * cc
        if (disc < -1e-9) continue
        const sq = Math.sqrt(Math.max(0, disc))
        for (const t of [(-bb - sq) / (2 * aa), (-bb + sq) / (2 * aa)]) {
          const X = p0.x + t * dir.x - seg.cx
          const Y = p0.y + t * dir.y - seg.cy
          let ang = Math.atan2(Y, X)
          while (ang < seg.a0 - 1e-9) ang += TAU
          while (ang > seg.a0 + TAU - 1e-9) ang -= TAU
          if (ang <= seg.a1 + 1e-9) out.push(t)
        }
      }
    }
    return dedupe(out)
  }

  return { section, perimeter, pointAt, sample, lineIntersections }
}
