import { create } from 'zustand'
import type { JointKind } from '../geometry/index.ts'
import { DEFAULT_ASSEMBLY, distribute, makeBranch } from './model.ts'
import type { Assembly, Branch } from './model.ts'

interface AssemblyStore {
  headerOD: number
  headerLength: number
  branches: Branch[]
  selectedId: string | null
  addConnection: (kind: JointKind, odMm: number) => void
  updateBranch: (id: string, patch: Partial<Omit<Branch, 'id'>>) => void
  removeBranch: (id: string) => void
  select: (id: string | null) => void
  setHeaderOD: (od: number) => void
  setHeaderLength: (len: number) => void
  load: (a: Assembly) => void
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const useAssembly = create<AssemblyStore>((set, get) => ({
  headerOD: DEFAULT_ASSEMBLY.headerOD,
  headerLength: DEFAULT_ASSEMBLY.headerLength,
  branches: DEFAULT_ASSEMBLY.branches,
  selectedId: null,

  addConnection: (kind, odMm) => {
    const b = makeBranch(odMm, 0, kind)
    const next = [...get().branches, b]
    set({
      branches: distribute(next, get().headerOD, get().headerLength),
      selectedId: b.id,
    })
  },

  updateBranch: (id, patch) =>
    set({
      branches: get().branches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }),

  removeBranch: (id) =>
    set({
      branches: distribute(
        get().branches.filter((b) => b.id !== id),
        get().headerOD,
        get().headerLength,
      ),
      selectedId: get().selectedId === id ? null : get().selectedId,
    }),

  select: (id) => set({ selectedId: id }),

  setHeaderOD: (od) => {
    const headerOD = clamp(od, 6, 400)
    set({ headerOD, branches: distribute(get().branches, headerOD, get().headerLength) })
  },

  setHeaderLength: (len) => {
    const headerLength = clamp(len, 100, 6000)
    set({ headerLength, branches: distribute(get().branches, get().headerOD, headerLength) })
  },

  load: (a) =>
    set({
      headerOD: a.headerOD,
      headerLength: a.headerLength,
      branches: a.branches,
      selectedId: a.branches[0]?.id ?? null,
    }),
}))
