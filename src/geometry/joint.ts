import type { CutProfile, Template } from './types.ts'

/**
 * Parameters for a branch-on-header (fishmouth / saddle) notch.
 *
 * Frame of reference:
 *   - Header cylinder: axis = +Z, radius R, centred on the origin.
 *   - Branch cylinder: axis direction u = (sinθ, 0, cosθ), radius r.
 *   - θ (`angleDeg`) is the angle between the two centre lines.
 *     90° = square tee, smaller = swept/longer joint.
 *   - `offsetInPlane` (d₁) shifts the branch along e₁ (within the plane of the
 *     two axes). `offsetPerp` (d₂) shifts it along e₂ (out of that plane).
 */
export interface BranchJointParams {
  branchOD: number
  headerOD: number
  angleDeg: number
  offsetInPlane?: number
  offsetPerp?: number
  passThrough?: boolean
  samples?: number
}

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/**
 * Develop the near-wall intersection curve of a branch cylinder on a header
 * cylinder.
 *
 * Derivation — point on the branch surface:
 *   x = (d₁ + r·cosφ)·cosθ + s·sinθ
 *   y = d₂ + r·sinφ
 * Setting x² + y² = R² and solving the quadratic for the axial coordinate `s`
 * gives the closed form below.
 */
export function branchNotch(p: BranchJointParams): Template {
  const r = p.branchOD / 2
  const R = p.headerOD / 2
  const th = p.angleDeg * DEG
  const sin = Math.sin(th)
  const cos = Math.cos(th)
  const d1 = p.offsetInPlane ?? 0
  const d2 = p.offsetPerp ?? 0
  const N = Math.max(16, Math.floor(p.samples ?? 720))
  const width = TAU * r

  const profile: CutProfile[] = []
  const far: CutProfile[] = []
  let clipped = false

  for (let i = 0; i <= N; i++) {
    const arc = (width * i) / N
    const phi = (TAU * i) / N
    const c = d1 + r * Math.cos(phi)
    const q = d2 + r * Math.sin(phi)
    const disc = R * R - q * q
    let root: number
    if (disc < -1e-9) {
      clipped = true
    }
    root = disc > 0 ? Math.sqrt(disc) : 0
    profile.push({ arc, cut: (-c * cos + root) / sin })
    if (p.passThrough) far.push({ arc, cut: (-c * cos - root) / sin })
  }

  const { minCut, maxCut } = extent(p.passThrough ? [...profile, ...far] : profile)

  return {
    kind: 'branch',
    width,
    profile,
    far: p.passThrough ? far : undefined,
    minCut,
    maxCut,
    depth: maxCut - minCut,
    meta: {
      branchOD: p.branchOD,
      headerOD: p.headerOD,
      angleDeg: p.angleDeg,
      offsetInPlane: d1,
      offsetPerp: d2,
      passThrough: !!p.passThrough,
      clipped,
    },
  }
}

export function extent(pts: CutProfile[]): { minCut: number; maxCut: number } {
  let minCut = Infinity
  let maxCut = -Infinity
  for (const pt of pts) {
    if (pt.cut < minCut) minCut = pt.cut
    if (pt.cut > maxCut) maxCut = pt.cut
  }
  if (!Number.isFinite(minCut)) {
    minCut = 0
    maxCut = 0
  }
  return { minCut, maxCut }
}
