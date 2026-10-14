/**
 * Core geometry types.
 *
 * All distances inside the geometry engine are in **millimetres**, regardless of
 * the user's display unit. Convert at the UI boundary with `lib/units.ts`.
 */

export type Unit = 'in' | 'mm'

export interface Point {
  x: number
  y: number
}

/**
 * One sample of a developed (unrolled) curve.
 *
 * - `arc` is the distance around the cut tube's circumference from the datum
 *   meridian (φ = 0), measured in mm, running 0 → `Template.width`.
 * - `cut` is the distance from the reference plane (the plane through the
 *   header axis, perpendicular to the branch axis) to the intersection curve,
 *   measured along the branch axis in mm. Larger = further from the header =
 *   more material retained.
 */
export interface CutProfile {
  arc: number
  cut: number
}

export type TemplateKind = 'branch' | 'miter' | 'hole'

export interface TemplateMeta {
  branchOD?: number
  headerOD?: number
  angleDeg?: number
  offsetInPlane?: number
  offsetPerp?: number
  passThrough?: boolean
  /** true when part of the branch surface never reaches the header (clamped) */
  clipped?: boolean
  [key: string]: string | number | boolean | undefined
}

export interface Template {
  kind: TemplateKind
  /** Arc length of one full wrap = circumference of the cut tube, mm. */
  width: number
  /** Near-wall curve (branch notch / upper hole edge). */
  profile: CutProfile[]
  /** Far-wall curve for pass-through joints or the lower hole edge. */
  far?: CutProfile[]
  /** min / max of `profile` (and `far` when present), mm. */
  minCut: number
  maxCut: number
  /** total cut depth = maxCut - minCut, mm. */
  depth: number
  meta: TemplateMeta
}
