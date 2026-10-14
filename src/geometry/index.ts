import type { Template } from './types.ts'
import { branchNotch } from './joint.ts'
import { miterForJointAngle } from './miter.ts'
import { headerHole } from './hole.ts'

export * from './types.ts'
export { branchNotch } from './joint.ts'
export { miterCut, miterForJointAngle } from './miter.ts'
export { headerHole } from './hole.ts'

export type JointKind = 'branch' | 'miter' | 'hole'

/** A UI-facing joint description; all lengths in mm. */
export interface JointSpec {
  kind: JointKind
  /** For `branch`/`miter` this is the tube being cut; for `hole` the branch. */
  branchOD: number
  /** The tube being notched into / pierced; ignored for `miter`. */
  headerOD: number
  /** Angle between centre lines (miter: joint angle, halved internally). */
  angleDeg: number
  offsetInPlane: number
  offsetPerp: number
  passThrough: boolean
}

/** Turn a joint spec into the templates needed to make the cut. */
export function generate(spec: JointSpec): Template[] {
  switch (spec.kind) {
    case 'branch':
      return [
        branchNotch({
          branchOD: spec.branchOD,
          headerOD: spec.headerOD,
          angleDeg: spec.angleDeg,
          offsetInPlane: spec.offsetInPlane,
          offsetPerp: spec.offsetPerp,
          passThrough: spec.passThrough,
        }),
      ]
    case 'miter':
      return [miterForJointAngle(spec.branchOD, spec.angleDeg)]
    case 'hole':
      // A through-branch needs the saddle cut on the branch AND the hole in the header.
      return [
        branchNotch({
          branchOD: spec.branchOD,
          headerOD: spec.headerOD,
          angleDeg: spec.angleDeg,
          offsetInPlane: spec.offsetInPlane,
          offsetPerp: spec.offsetPerp,
        }),
        headerHole({
          headerOD: spec.headerOD,
          branchOD: spec.branchOD,
          angleDeg: spec.angleDeg,
          offsetInPlane: spec.offsetInPlane,
          offsetPerp: spec.offsetPerp,
        }),
      ]
  }
}
