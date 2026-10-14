import { create } from 'zustand'
import type { Unit } from '../geometry/types.ts'
import type { Orientation } from '../lib/layout.ts'

export interface TemplateOptions {
  grid: boolean
  rulers: boolean
  tabs: boolean
  cal: boolean
}

interface SettingsStore {
  unit: Unit
  paperId: string
  orientation: 'auto' | Orientation
  opts: TemplateOptions
  setUnit: (u: Unit) => void
  setPaperId: (id: string) => void
  setOrientation: (o: 'auto' | Orientation) => void
  setOpt: <K extends keyof TemplateOptions>(k: K, v: boolean) => void
}

export const useSettings = create<SettingsStore>((set) => ({
  unit: 'in',
  paperId: 'letter',
  orientation: 'auto',
  opts: { grid: true, rulers: true, tabs: true, cal: true },
  setUnit: (unit) => set({ unit }),
  setPaperId: (paperId) => set({ paperId }),
  setOrientation: (orientation) => set({ orientation }),
  setOpt: (k, v) => set((s) => ({ opts: { ...s.opts, [k]: v } })),
}))
