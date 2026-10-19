import type { CutProfile, Template } from './types.ts'
import { makeSection, rotate, sectionDims, type Section } from './section.ts'

/**
 * Parameters for a branch-on-header (fishmouth / saddle) notch.
 *
 * Frame of reference:
 *   - Header: section swept along +Z.
 *   - Branch: `branchSection` swept along u = (sinθ, 0, cosθ), radius/centre at
 *     offset d = (d₁, d₂).
 *   - θ (`angleDeg`) is the angle between the two centre lines.
 *     90° = square tee, smaller = swept/longer joint.
 *
 * The branch surface is a 2D section swept along the axis, so the intersection
 * with the header reduces to a line/section test: for each point around the
 * branch perimeter, shoot the line `p0 + s·(sinθ,0)` through the header section
 * and keep the two crossings. Round sections reproduce the closed-form circles.
 */
export interface BranchJointParams {
  branchSection: Section
  headerSection: Section
  angleDeg: number
  offsetInPlane?: number
  offsetPerp?: number
  /** twist of the branch section about its own axis, degrees (0 = flat to header) */
  sectionRollDeg?: number
  /** twist of the header section about its axis, degrees */
  headerRollDeg?: number
  passThrough?: boolean
  samples?: number
}

const DEG = Math.PI / 180

export function branchNotch(p: BranchJointParams): Template {
  const bg = makeSection(p.branchSection)
  const hg = makeSection(p.headerSection)
  const th = p.angleDeg * DEG
  const sin = Math.sin(th)
  const cos = Math.cos(th)
  const d1 = p.offsetInPlane ?? 0
  const d2 = p.offsetPerp ?? 0
  const roll = p.sectionRollDeg ?? 0
  const hRoll = p.headerRollDeg ?? 0
  const N = Math.max(16, Math.floor(p.samples ?? 720))
  const width = bg.perimeter

  const profile: CutProfile[] = []
  const far: CutProfile[] = []
  let clipped = false

  for (const bit of bg.sample(N)) {
    const rp = roll ? rotate({ x: bit.x, y: bit.y }, roll) : { x: bit.x, y: bit.y }
    let p0 = { x: (d1 + rp.x) * cos, y: d2 + rp.y }
    let dir = { x: sin, y: 0 }
    if (hRoll) {
      p0 = rotate(p0, hRoll)
      dir = rotate(dir, hRoll)
    }
    const roots = hg.lineIntersections(p0, dir)
    if (roots.length >= 1) {
      profile.push({ arc: bit.arc, cut: roots[roots.length - 1] })
      if (p.passThrough) far.push({ arc: bit.arc, cut: roots[0] })
    } else {
      // The point never reaches the header (e.g. a corner overhangs a small
      // header). Clamp to the line's closest approach to the section centre.
      const dd = dir.x * dir.x + dir.y * dir.y
      const t = dd > 1e-18 ? -(p0.x * dir.x + p0.y * dir.y) / dd : 0
      clipped = true
      profile.push({ arc: bit.arc, cut: t })
      if (p.passThrough) far.push({ arc: bit.arc, cut: t })
    }
  }

  const { minCut, maxCut } = extent(p.passThrough ? [...profile, ...far] : profile)
  const bd = sectionDims(p.branchSection)
  const hd = sectionDims(p.headerSection)

  return {
    kind: 'branch',
    width,
    profile,
    far: p.passThrough ? far : undefined,
    minCut,
    maxCut,
    depth: maxCut - minCut,
    meta: {
      branchSection: bd.shape,
      branchSize: bd.w,
      branchSize2: bd.h,
      headerSection: hd.shape,
      headerSize: hd.w,
      headerSize2: hd.h,
      angleDeg: p.angleDeg,
      offsetInPlane: d1,
      offsetPerp: d2,
      sectionRollDeg: roll,
      headerRollDeg: hRoll,
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
