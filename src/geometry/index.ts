import type { Template } from './types.ts'
import { branchNotch } from './joint.ts'
import { miterForJointAngle } from './miter.ts'
import { headerHole } from './hole.ts'
import { sectionEquivalentOd, toSection, type Section } from './section.ts'

export * from './types.ts'
export * from './section.ts'
export { branchNotch } from './joint.ts'
export { miterCut, miterForJointAngle } from './miter.ts'
export { headerHole } from './hole.ts'

export type JointKind = 'branch' | 'miter' | 'hole'

/** A UI-facing joint description; all lengths in mm. */
export interface JointSpec {
  kind: JointKind
  /** For `branch`/`miter` this is the tube being cut; for `hole` the branch. */
  branchSection: Section
  /** The tube being notched into / pierced; ignored for `miter`. */
  headerSection: Section
  /** Angle between centre lines (miter: joint angle, halved internally). */
  angleDeg: number
  offsetInPlane: number
  offsetPerp: number
  /** twist of the branch section about its axis, degrees */
  sectionRollDeg: number
  /** twist of the header section about its axis, degrees */
  headerRollDeg: number
  passThrough: boolean
}

/** True when a section is a plain circle. */
export function isRound(s: Section): boolean {
  return s.shape === 'round'
}

const n = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** Coerce persisted/legacy joint data (old `branchOD`/`headerOD`) into a spec. */
export function migrateJointSpec(input: unknown): JointSpec {
  const s = (input ?? {}) as Record<string, unknown>
  const kind = (typeof s.kind === 'string' ? s.kind : 'branch') as JointKind
  if (s.branchSection && s.headerSection) {
    return {
      kind,
      branchSection: toSection(s.branchSection),
      headerSection: toSection(s.headerSection),
      angleDeg: n(s.angleDeg, 90),
      offsetInPlane: n(s.offsetInPlane, 0),
      offsetPerp: n(s.offsetPerp, 0),
      sectionRollDeg: n(s.sectionRollDeg, 0),
      headerRollDeg: n(s.headerRollDeg, 0),
      passThrough: !!s.passThrough,
    }
  }
  return {
    kind,
    branchSection: toSection(s.branchOD),
    headerSection: toSection(s.headerOD),
    angleDeg: n(s.angleDeg, 90),
    offsetInPlane: n(s.offsetInPlane, 0),
    offsetPerp: n(s.offsetPerp, 0),
    sectionRollDeg: 0,
    headerRollDeg: 0,
    passThrough: !!s.passThrough,
  }
}

/** Turn a joint spec into the templates needed to make the cut. */
export function generate(spec: JointSpec): Template[] {
  switch (spec.kind) {
    case 'branch':
      return [
        branchNotch({
          branchSection: spec.branchSection,
          headerSection: spec.headerSection,
          angleDeg: spec.angleDeg,
          offsetInPlane: spec.offsetInPlane,
          offsetPerp: spec.offsetPerp,
          sectionRollDeg: spec.sectionRollDeg,
          headerRollDeg: spec.headerRollDeg,
          passThrough: spec.passThrough,
        }),
      ]
    case 'miter':
      return [miterForJointAngle(spec.branchSection, spec.angleDeg)]
    case 'hole': {
      // The pierced oval is developed for round tubes; square headers are a
      // later pass, so approximate by the perimeter-equivalent circle.
      const approx = !isRound(spec.headerSection) || !isRound(spec.branchSection)
      const notch = branchNotch({
        branchSection: spec.branchSection,
        headerSection: spec.headerSection,
        angleDeg: spec.angleDeg,
        offsetInPlane: spec.offsetInPlane,
        offsetPerp: spec.offsetPerp,
        sectionRollDeg: spec.sectionRollDeg,
        headerRollDeg: spec.headerRollDeg,
      })
      const hole = headerHole({
        headerOD: sectionEquivalentOd(spec.headerSection),
        branchOD: sectionEquivalentOd(spec.branchSection),
        angleDeg: spec.angleDeg,
        offsetInPlane: spec.offsetInPlane,
        offsetPerp: spec.offsetPerp,
      })
      if (approx) hole.meta.approx = true
      return [notch, hole]
    }
  }
}
