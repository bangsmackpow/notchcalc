import type { CutProfile, Template } from './types.ts'
import { extent } from './joint.ts'
import { makeSection, rotate, sectionDims, type Section } from './section.ts'

const DEG = Math.PI / 180

/** Parameters for a straight miter (single-plane angled end cut). */
export interface MiterParams {
  section: Section
  /** Angle of the cut plane away from square, in degrees (0–89.5). */
  angleDeg: number
  /** twist of the section about its axis (which way the plane leans), degrees */
  rollDeg?: number
  samples?: number
}

/**
 * A plane slicing a swept section. For a cylinder the unrolled cut is a sine
 * wave of amplitude r·tan(α); in general it is `tan(α)` times the boundary
 * point's distance along the tilt direction — flats unroll to straight ramps,
 * corners to arcs.
 */
export function miterCut(p: MiterParams): Template {
  const g = makeSection(p.section)
  const a = Math.min(89.5, Math.max(0, p.angleDeg)) * DEG
  const slope = Math.tan(a)
  const roll = p.rollDeg ?? 0
  const tilt = roll ? rotate({ x: 1, y: 0 }, roll) : { x: 1, y: 0 }
  const N = Math.max(16, Math.floor(p.samples ?? 720))
  const width = g.perimeter

  const profile: CutProfile[] = g.sample(N).map((bit) => ({
    arc: bit.arc,
    cut: slope * (bit.x * tilt.x + bit.y * tilt.y),
  }))

  const { minCut, maxCut } = extent(profile)
  const d = sectionDims(p.section)

  return {
    kind: 'miter',
    width,
    profile,
    minCut,
    maxCut,
    depth: maxCut - minCut,
    meta: { section: d.shape, branchSize: d.w, branchSize2: d.h, angleDeg: p.angleDeg, rollDeg: roll },
  }
}

/**
 * Convenience for joining two equal tubes at `jointAngleDeg` (the angle between
 * their centre lines, 90° = elbow, 180° = straight). The bend deviation is
 * 180° − θ, so each end is cut at 90° − θ/2.
 */
export function miterForJointAngle(section: Section, jointAngleDeg: number, samples?: number): Template {
  return miterCut({ section, angleDeg: 90 - jointAngleDeg / 2, samples })
}
