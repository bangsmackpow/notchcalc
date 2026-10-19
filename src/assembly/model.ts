import { sectionDims, toSection, type JointKind, type JointSpec, type Section } from '../geometry/index.ts'

const DEG = Math.PI / 180

/** A connection attached to the assembly's single header (or floating for miter). */
export interface Branch {
  id: string
  /** connection type; legacy records without this are 'branch' */
  kind?: JointKind
  /** branch/tube cross-section */
  section: Section
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
  /** twist of the branch section about its own axis, degrees */
  sectionRollDeg?: number
  /** branch continues through the header (adds far-wall cut) */
  passThrough?: boolean
}

export interface Assembly {
  headerSection: Section
  headerLength: number
  branches: Branch[]
}

export const DEFAULT_ASSEMBLY: Assembly = {
  headerSection: { shape: 'round', od: 60.325 }, // 2-3/8" NPS
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

/** The cut spec this connection implies for the geometry engine. */
export function jointSpecFor(b: Branch, headerSection: Section): JointSpec {
  const kind = b.kind ?? 'branch'
  return {
    kind,
    branchSection: b.section,
    headerSection: kind === 'miter' ? b.section : headerSection,
    angleDeg: b.angleDeg,
    offsetInPlane: b.offsetInPlane,
    offsetPerp: b.offsetPerp,
    sectionRollDeg: b.sectionRollDeg ?? 0,
    headerRollDeg: 0,
    passThrough: kind === 'branch' ? !!b.passThrough : false,
  }
}

export function makeBranch(section: Section, posMm: number, kind: JointKind = 'branch', angleDeg = 90): Branch {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    kind,
    section,
    posMm,
    angleDeg,
    rollDeg: 0,
    offsetInPlane: 0,
    offsetPerp: 0,
    sectionRollDeg: 0,
    passThrough: false,
  }
}

/** Two tube directions for a miter elbow at `b` (corner at posMm on the header line). */
export function miterDirs(b: Branch): { dA: Vec3; dB: Vec3 } {
  // Joint angle θ between centre lines ⇒ each tube deviates (90° − θ/2) from the line.
  const h = (90 - b.angleDeg / 2) * DEG
  const rho = b.rollDeg * DEG
  const ch = Math.cos(h)
  const sh = Math.sin(h)
  return {
    dA: [-ch, -sh * Math.cos(rho), -sh * Math.sin(rho)],
    dB: [ch, -sh * Math.cos(rho), -sh * Math.sin(rho)],
  }
}

/** Coerce persisted/legacy assembly data (old `headerOD`/`odMm`) into sections. */
export function migrateAssembly(input: unknown): Assembly {
  const a = (input ?? {}) as Record<string, unknown>
  const branches = Array.isArray(a.branches) ? a.branches : []
  return {
    headerSection: toSection(a.headerSection ?? a.headerOD),
    headerLength: typeof a.headerLength === 'number' ? a.headerLength : DEFAULT_ASSEMBLY.headerLength,
    branches: branches.map((raw) => {
      const b = (raw ?? {}) as Record<string, unknown>
      return {
        id: typeof b.id === 'string' ? b.id : Math.random().toString(36).slice(2),
        kind: (typeof b.kind === 'string' ? b.kind : 'branch') as JointKind,
        section: toSection(b.section ?? b.odMm),
        posMm: typeof b.posMm === 'number' ? b.posMm : 0,
        angleDeg: typeof b.angleDeg === 'number' ? b.angleDeg : 90,
        rollDeg: typeof b.rollDeg === 'number' ? b.rollDeg : 0,
        offsetInPlane: typeof b.offsetInPlane === 'number' ? b.offsetInPlane : 0,
        offsetPerp: typeof b.offsetPerp === 'number' ? b.offsetPerp : 0,
        sectionRollDeg: typeof b.sectionRollDeg === 'number' ? b.sectionRollDeg : 0,
        passThrough: !!b.passThrough,
      }
    }),
  }
}

/** Evenly distribute branches across the usable header span, preserving order. */
export function distribute(branches: Branch[], headerSection: Section, headerLength: number): Branch[] {
  const n = branches.length
  if (n === 0) return branches
  const dims = sectionDims(headerSection)
  const headerSize = Math.max(dims.w, dims.h)
  const half = headerLength / 2
  const margin = headerSize * 0.75 + 20
  const lo = -half + margin
  const hi = half - margin
  const span = Math.max(0, hi - lo)
  const gap = n > 1 ? span / (n - 1) : 0
  return branches.map((b, i) => {
    const pos = n === 1 ? (lo + hi) / 2 : lo + gap * i
    return { ...b, posMm: Math.round(pos * 10) / 10 }
  })
}
