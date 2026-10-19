import { create } from 'zustand'
import { defaultCornerRadius, migrateJointSpec, type JointKind, type JointSpec, type Section } from '../geometry/index.ts'

type NumPatch =
  | 'off1'
  | 'off2'
  | 'angle'
  | 'sectionRoll'
  | 'headerRoll'
  | 'passThrough'

export interface JointStore {
  kind: JointKind
  branchSection: Section
  headerSection: Section
  off1: number
  off2: number
  angle: number
  sectionRoll: number
  headerRoll: number
  passThrough: boolean
  setKind: (k: JointKind) => void
  set: (patch: Partial<Pick<JointStore, NumPatch>> & { branchSection?: Section; headerSection?: Section }) => void
  loadSpec: (spec: JointSpec) => void
}

const clampAngle = (a: number) => Math.max(5, Math.min(175, a))

const DEFAULT_BRANCH: Section = { shape: 'round', od: 50.8 } // 2"
const DEFAULT_HEADER: Section = { shape: 'round', od: 60.325 } // 2-3/8" NPS

/** Convert a section between round and rectangular, keeping a sensible size. */
export function withShape(prev: Section, shape: 'round' | 'rect'): Section {
  if (shape === 'round') return prev.shape === 'round' ? prev : { shape: 'round', od: prev.width }
  if (prev.shape === 'rect') return prev
  const wall = Math.max(1, prev.od * 0.05)
  return { shape: 'rect', width: prev.od, height: prev.od, cornerRadius: defaultCornerRadius(wall) }
}

export const useJoint = create<JointStore>((set) => ({
  kind: 'branch',
  branchSection: DEFAULT_BRANCH,
  headerSection: DEFAULT_HEADER,
  off1: 0,
  off2: 0,
  angle: 90,
  sectionRoll: 0,
  headerRoll: 0,
  passThrough: false,

  setKind: (kind) => set({ kind }),
  set: (patch) => set(patch),
  loadSpec: (spec) => {
    const s = migrateJointSpec(spec)
    set({
      kind: s.kind,
      branchSection: s.branchSection,
      headerSection: s.headerSection,
      off1: s.offsetInPlane,
      off2: s.offsetPerp,
      angle: clampAngle(s.angleDeg),
      sectionRoll: s.sectionRollDeg,
      headerRoll: s.headerRollDeg,
      passThrough: s.passThrough,
    })
  },
}))
