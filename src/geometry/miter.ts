import type { CutProfile, Template } from './types.ts'
import { extent } from './joint.ts'

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/** Parameters for a straight miter (single-plane angled end cut). */
export interface MiterParams {
  od: number
  /** Angle of the cut plane away from square, in degrees (0–89.5). */
  angleDeg: number
  samples?: number
}

/**
 * A plane slicing a cylinder produces an ellipse; unrolled, that is a sine wave
 * of amplitude r·tan(α).
 */
export function miterCut(p: MiterParams): Template {
  const r = p.od / 2
  const a = Math.min(89.5, Math.max(0, p.angleDeg)) * DEG
  const amp = r * Math.tan(a)
  const N = Math.max(16, Math.floor(p.samples ?? 720))
  const width = TAU * r

  const profile: CutProfile[] = []
  for (let i = 0; i <= N; i++) {
    const arc = (width * i) / N
    const phi = (TAU * i) / N
    profile.push({ arc, cut: amp * Math.cos(phi) })
  }

  const { minCut, maxCut } = extent(profile)

  return {
    kind: 'miter',
    width,
    profile,
    minCut,
    maxCut,
    depth: maxCut - minCut,
    meta: { od: p.od, angleDeg: p.angleDeg },
  }
}

/**
 * Convenience for joining two equal-diameter tubes at `jointAngleDeg`
 * (the angle between their centre lines): each end is cut at half that angle.
 */
export function miterForJointAngle(od: number, jointAngleDeg: number, samples?: number): Template {
  return miterCut({ od, angleDeg: jointAngleDeg / 2, samples })
}
