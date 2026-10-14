import { create } from 'zustand'
import type { JointKind, JointSpec } from '../geometry/index.ts'

interface JointStore {
  kind: JointKind
  branchOD: number
  headerOD: number
  off1: number
  off2: number
  angle: number
  passThrough: boolean
  setKind: (k: JointKind) => void
  set: (patch: Partial<Pick<JointStore, 'branchOD' | 'headerOD' | 'off1' | 'off2' | 'angle' | 'passThrough'>>) => void
  loadSpec: (spec: JointSpec) => void
}

const clampAngle = (a: number) => Math.max(5, Math.min(175, a))

export const useJoint = create<JointStore>((set) => ({
  kind: 'branch',
  branchOD: 50.8, // 2"
  headerOD: 60.325, // 2-3/8" NPS
  off1: 0,
  off2: 0,
  angle: 90,
  passThrough: false,

  setKind: (kind) => set({ kind }),
  set: (patch) => set(patch),
  loadSpec: (spec) =>
    set({
      kind: spec.kind,
      branchOD: spec.branchOD,
      headerOD: spec.headerOD,
      off1: spec.offsetInPlane,
      off2: spec.offsetPerp,
      angle: clampAngle(spec.angleDeg),
      passThrough: spec.passThrough,
    }),
}))

export function currentSpec(): JointSpec {
  const s = useJoint.getState()
  return {
    kind: s.kind,
    branchOD: s.branchOD,
    headerOD: s.headerOD,
    angleDeg: s.angle,
    offsetInPlane: s.off1,
    offsetPerp: s.off2,
    passThrough: s.passThrough,
  }
}
