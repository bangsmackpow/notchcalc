import type { JointSpec } from '../geometry/index.ts'

const DEG = Math.PI / 180

/** A branch tube joined to the single header of an assembly. */
export interface Branch {
  id: string
  /** branch outside diameter, mm */
  odMm: number
  /** joint centre position along the header axis, mm (0 = header centre) */
  posMm: number
  /** angle between branch and header centre lines, degrees */
  angleDeg: number
  /** rotation of the branch about the header axis, degrees */
  rollDeg: number
  /** in-plane offset (in the header/branch plane), mm */
  offsetInPlane: number
  /** perpendicular offset (out of the header/branch plane), mm */
  offsetPerp: number
}

export interface Assembly {
  headerOD: number
  headerLength: number
  branches: Branch[]
}

export const DEFAULT_ASSEMBLY: Assembly = {
  headerOD: 60.325, // 2-3/8" NPS
  headerLength: 1200,
  branches: [],
}

export type Vec3 = [number, number, number]

/** Unit direction of the branch axis, in world space (header runs along +X). */
export function branchDir(b: Branch): Vec3 {
  const th = b.angleDeg * DEG
  const rho = b.rollDeg * DEG
  return [Math.cos(th), Math.sin(th) * Math.cos(rho), Math.sin(th) * Math.sin(rho)]
}

/** In-plane (e1) and out-of-plane (e2) offset directions for the roll angle. */
export function branchBasis(b: Branch): { e1: Vec3; e2: Vec3 } {
  const rho = b.rollDeg * DEG
  return {
    e1: [0, Math.cos(rho), Math.sin(rho)],
    e2: [0, -Math.sin(rho), Math.cos(rho)],
  }
}

/** World origin of the branch axis at the joint (offsets applied). */
export function branchOrigin(b: Branch): Vec3 {
  const { e1, e2 } = branchBasis(b)
  return [
    b.posMm + b.offsetInPlane * e1[0] + b.offsetPerp * e2[0],
    b.offsetInPlane * e1[1] + b.offsetPerp * e2[1],
    b.offsetInPlane * e1[2] + b.offsetPerp * e2[2],
  ]
}

/** The cut spec this branch implies for the geometry engine. */
export function jointSpecFor(b: Branch, headerOD: number): JointSpec {
  return {
    kind: 'branch',
    branchOD: b.odMm,
    headerOD,
    angleDeg: b.angleDeg,
    offsetInPlane: b.offsetInPlane,
    offsetPerp: b.offsetPerp,
    passThrough: false,
  }
}

export function makeBranch(odMm: number, posMm: number, angleDeg = 90): Branch {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    odMm,
    posMm,
    angleDeg,
    rollDeg: 0,
    offsetInPlane: 0,
    offsetPerp: 0,
  }
}

/** Evenly distribute branches across the usable header span, preserving order. */
export function distribute(branches: Branch[], headerOD: number, headerLength: number): Branch[] {
  const n = branches.length
  if (n === 0) return branches
  const half = headerLength / 2
  const margin = headerOD * 0.75 + 20
  const lo = -half + margin
  const hi = half - margin
  const span = Math.max(0, hi - lo)
  const gap = n > 1 ? span / (n - 1) : 0
  return branches.map((b, i) => {
    const pos = n === 1 ? (lo + hi) / 2 : lo + gap * i
    return { ...b, posMm: Math.round(pos * 10) / 10 }
  })
}
