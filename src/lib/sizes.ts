import type { Unit } from '../geometry/types.ts'
import { toMm } from './units.ts'

export type SizeGroup = 'tube' | 'pipe' | 'metric'

export interface SizePreset {
  /** Nominal label shown in the picker. */
  label: string
  /** True outside diameter in millimetres. */
  odMm: number
  group: SizeGroup
}

const TUBE_OD_IN: [string, number][] = [
  ['1/2" tube', 0.5],
  ['5/8" tube', 0.625],
  ['3/4" tube', 0.75],
  ['7/8" tube', 0.875],
  ['1" tube', 1.0],
  ['1-1/8" tube', 1.125],
  ['1-1/4" tube', 1.25],
  ['1-1/2" tube', 1.5],
  ['1-5/8" tube', 1.625],
  ['1-3/4" tube', 1.75],
  ['2" tube', 2.0],
  ['2-1/2" tube', 2.5],
  ['3" tube', 3.0],
  ['3-1/2" tube', 3.5],
  ['4" tube', 4.0],
]

// NPS Schedule 40 outside diameters (schedule-independent for notching).
const PIPE_OD_IN: [string, number][] = [
  ['1/2" NPS', 0.84],
  ['3/4" NPS', 1.05],
  ['1" NPS', 1.315],
  ['1-1/4" NPS', 1.66],
  ['1-1/2" NPS', 1.9],
  ['2" NPS', 2.375],
  ['2-1/2" NPS', 2.875],
  ['3" NPS', 3.5],
  ['4" NPS', 4.5],
]

const METRIC_OD_MM: [string, number][] = [
  ['20 mm', 20],
  ['25 mm', 25],
  ['30 mm', 30],
  ['32 mm', 32],
  ['38 mm', 38],
  ['40 mm', 40],
  ['42 mm', 42],
  ['48 mm', 48],
  ['50 mm', 50],
  ['60 mm', 60],
  ['76 mm', 76],
  ['89 mm', 89],
  ['101.6 mm', 101.6],
]

export const PRESETS: SizePreset[] = [
  ...TUBE_OD_IN.map(([label, od]): SizePreset => ({ label, odMm: toMm(od, 'in'), group: 'tube' })),
  ...PIPE_OD_IN.map(([label, od]): SizePreset => ({ label, odMm: toMm(od, 'in'), group: 'pipe' })),
  ...METRIC_OD_MM.map(([label, od]): SizePreset => ({ label, odMm: od, group: 'metric' })),
]

export const GROUP_LABEL: Record<SizeGroup, string> = {
  tube: 'Tube — outside diameter',
  pipe: 'Pipe — NPS (Sch 40 OD)',
  metric: 'Metric tube',
}

/** Which groups to show for a given display unit (metric still needs both plenty). */
export function groupsForUnit(unit: Unit): SizeGroup[] {
  return unit === 'in' ? ['tube', 'pipe', 'metric'] : ['metric', 'tube', 'pipe']
}

/** Nearest preset within `tolMm`, used to show a friendly nominal next to a custom OD. */
export function nearestPreset(odMm: number, tolMm = 0.15): SizePreset | undefined {
  let best: SizePreset | undefined
  let bestDist = Infinity
  for (const p of PRESETS) {
    const d = Math.abs(p.odMm - odMm)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  return bestDist <= tolMm ? best : undefined
}
