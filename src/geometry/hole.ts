import type { CutProfile, Template } from './types.ts'
import { extent } from './joint.ts'

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/**
 * Parameters for the hole cut in the header where a branch passes through.
 * Same frame of reference as `branchNotch`.
 */
export interface HoleParams {
  headerOD: number
  branchOD: number
  angleDeg: number
  offsetInPlane?: number
  offsetPerp?: number
  samples?: number
}

/**
 * Develop the intersection oval on the **header** surface.
 *
 * Parametrise the header surface by ψ (around the axis) and z (along the axis):
 *   Q = (R·cosψ, R·sinψ, z)
 * The branch axis is the line through d with direction u = (sinθ, 0, cosθ) and
 * the branch surface is every point at distance r from that line. Expanding
 * |Q − d|² − ((Q − d)·u)² = r² yields a quadratic in z:
 *   B²·z² + 2B(d₁ − R·A·cosψ)·z + K = 0,  A = cosθ, B = sinθ
 *   K = d₁² + R²A²cos²ψ + R²sin²ψ − 2R·A·d₁cosψ − 2R·d₂sinψ + d₂² − r²
 * The two roots are the near and far walls of the header.
 */
export function headerHole(p: HoleParams): Template {
  const R = p.headerOD / 2
  const r = p.branchOD / 2
  const th = p.angleDeg * DEG
  const B = Math.sin(th)
  const A = Math.cos(th)
  const d1 = p.offsetInPlane ?? 0
  const d2 = p.offsetPerp ?? 0
  const N = Math.max(16, Math.floor(p.samples ?? 720))
  const width = TAU * R

  const upper: CutProfile[] = []
  const lower: CutProfile[] = []
  let clipped = false

  for (let i = 0; i <= N; i++) {
    const arc = (width * i) / N
    const psi = (TAU * i) / N
    const cp = Math.cos(psi)
    const sp = Math.sin(psi)

    const a = B * B
    const b = 2 * B * (d1 - R * A * cp)
    const k =
      d1 * d1 +
      R * R * A * A * cp * cp +
      R * R * sp * sp -
      2 * R * A * d1 * cp -
      2 * R * d2 * sp +
      d2 * d2 -
      r * r

    let zUp: number
    let zLo: number
    if (Math.abs(a) < 1e-12) {
      // Degenerate (θ → 0 or 180): linear in z.
      const z = Math.abs(b) < 1e-12 ? 0 : -k / b
      zUp = z
      zLo = z
      clipped = true
    } else {
      const disc = b * b - 4 * a * k
      const sq = disc > 0 ? Math.sqrt(disc) : 0
      if (disc < -1e-9) clipped = true
      zUp = (-b + sq) / (2 * a)
      zLo = (-b - sq) / (2 * a)
    }

    upper.push({ arc, cut: zUp })
    lower.push({ arc, cut: zLo })
  }

  const { minCut, maxCut } = extent([...upper, ...lower])

  return {
    kind: 'hole',
    width,
    profile: upper,
    far: lower,
    minCut,
    maxCut,
    depth: maxCut - minCut,
    meta: {
      headerOD: p.headerOD,
      branchOD: p.branchOD,
      angleDeg: p.angleDeg,
      offsetInPlane: d1,
      offsetPerp: d2,
      clipped,
    },
  }
}
