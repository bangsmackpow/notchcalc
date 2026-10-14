import { create } from 'zustand'
import {
  DEFAULT_ASSEMBLY,
  makeBranch,
  nextBranchPos,
  type Assembly,
  type Branch,
} from './model.ts'

interface AssemblyStore {
  headerOD: number
  headerLength: number
  branches: Branch[]
  selectedId: string | null
  addBranch: (odMm: number) => void
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

  addBranch: (odMm) => {
    const a: Assembly = {
      headerOD: get().headerOD,
      headerLength: get().headerLength,
      branches: get().branches,
    }
    const b = makeBranch(odMm, nextBranchPos(a))
    set({ branches: [...get().branches, b], selectedId: b.id })
  },

  updateBranch: (id, patch) =>
    set({
      branches: get().branches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }),

  removeBranch: (id) =>
    set({
      branches: get().branches.filter((b) => b.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    }),

  select: (id) => set({ selectedId: id }),

  setHeaderOD: (od) => set({ headerOD: clamp(od, 6, 400) }),

  setHeaderLength: (len) =>
    set({
      headerLength: clamp(len, 100, 6000),
      branches: get().branches.map((b) => ({ ...b, posMm: clamp(b.posMm, -len / 2 + 10, len / 2 - 10) })),
    }),

  load: (a) =>
    set({
      headerOD: a.headerOD,
      headerLength: a.headerLength,
      branches: a.branches,
      selectedId: a.branches[0]?.id ?? null,
    }),
}))
