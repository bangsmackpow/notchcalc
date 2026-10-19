import { create } from 'zustand'
import type { JointKind, Section } from '../geometry/index.ts'
import { DEFAULT_ASSEMBLY, distribute, makeBranch, migrateAssembly } from './model.ts'
import type { Assembly, Branch } from './model.ts'

interface AssemblyStore {
  headerSection: Section
  headerLength: number
  branches: Branch[]
  selectedId: string | null
  addConnection: (kind: JointKind, section: Section) => void
  updateBranch: (id: string, patch: Partial<Omit<Branch, 'id'>>) => void
  removeBranch: (id: string) => void
  select: (id: string | null) => void
  setHeaderSection: (s: Section) => void
  setHeaderLength: (len: number) => void
  load: (a: Assembly) => void
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const useAssembly = create<AssemblyStore>((set, get) => ({
  headerSection: DEFAULT_ASSEMBLY.headerSection,
  headerLength: DEFAULT_ASSEMBLY.headerLength,
  branches: DEFAULT_ASSEMBLY.branches,
  selectedId: null,

  addConnection: (kind, section) => {
    const b = makeBranch(section, 0, kind)
    const next = [...get().branches, b]
    set({
      branches: distribute(next, get().headerSection, get().headerLength),
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
        get().headerSection,
        get().headerLength,
      ),
      selectedId: get().selectedId === id ? null : get().selectedId,
    }),

  select: (id) => set({ selectedId: id }),

  setHeaderSection: (s) => {
    set({ headerSection: s, branches: distribute(get().branches, s, get().headerLength) })
  },

  setHeaderLength: (len) => {
    const headerLength = clamp(len, 100, 6000)
    set({ headerLength, branches: distribute(get().branches, get().headerSection, headerLength) })
  },

  load: (a) => {
    const m = migrateAssembly(a)
    set({
      headerSection: m.headerSection,
      headerLength: m.headerLength,
      branches: m.branches,
      selectedId: m.branches[0]?.id ?? null,
    })
  },
}))
