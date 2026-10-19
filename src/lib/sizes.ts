import { defaultCornerRadius, type Section } from '../geometry/section.ts'
import { inchFraction, toMm } from './units.ts'

export type SizeGroup = 'tube' | 'pipe' | 'metric' | 'square' | 'rect' | 'square-metric' | 'rect-metric'

export interface SizePreset {
  /** Nominal label shown in the picker. */
  label: string
  group: SizeGroup
  /** Cross-section (mm). */
  section: Section
  /** Wall thickness, mm — drives the default corner radius for rect sections. */
  wallMm?: number
}

const round = (label: string, od: number, group: SizeGroup): SizePreset => ({
  label,
  group,
  section: { shape: 'round', od },
})

// ---- round tube OD (inches) -------------------------------------------------
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

// ---- NPS Schedule 40 outside diameters (round) ------------------------------
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

// ---- metric round OD (mm) ---------------------------------------------------
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

// ---- square / rectangular tubing --------------------------------------------
// HSS outside corner radius is taken as 2 × wall thickness (AISC/CSA basis).

function rect(
  group: SizeGroup,
  label: string,
  widthMm: number,
  heightMm: number,
  wallMm: number,
): SizePreset {
  return {
    label,
    group,
    wallMm,
    section: { shape: 'rect', width: widthMm, height: heightMm, cornerRadius: defaultCornerRadius(wallMm) },
  }
}

const SQ_SIDES_IN = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
const SQ_WALLS_IN = [0.065, 0.083, 0.12, 0.188]
const RECT_IN: [number, number][] = [
  [1, 2],
  [1, 3],
  [1.5, 3],
  [2, 3],
  [2, 4],
  [3, 4],
  [1, 1.5],
  [1.5, 2.5],
]
const RECT_WALLS_IN = [0.083, 0.12, 0.188]

const SQUARE_IN: SizePreset[] = SQ_SIDES_IN.flatMap((s) =>
  SQ_WALLS_IN.map((t) => rect('square', `${inchFraction(s)} sq · ${t.toFixed(3)}" wall`, toMm(s, 'in'), toMm(s, 'in'), toMm(t, 'in'))),
)

const RECT_IN_PRESETS: SizePreset[] = RECT_IN.flatMap(([w, h]) =>
  RECT_WALLS_IN.map((t) =>
    rect('rect', `${inchFraction(w)} × ${inchFraction(h)} · ${t.toFixed(3)}" wall`, toMm(w, 'in'), toMm(h, 'in'), toMm(t, 'in')),
  ),
)

const SQ_SIDES_MM = [20, 25, 30, 40, 50, 60, 80, 100]
const SQ_WALLS_MM = [1.5, 2, 3, 4]
const RECT_MM: [number, number][] = [
  [20, 40],
  [25, 50],
  [30, 50],
  [30, 60],
  [40, 80],
  [50, 100],
]
const RECT_WALLS_MM = [2, 3]

const SQUARE_MM: SizePreset[] = SQ_SIDES_MM.flatMap((s) =>
  SQ_WALLS_MM.map((t) => rect('square-metric', `${s}×${s}×${t} mm`, s, s, t)),
)

const RECT_MM_PRESETS: SizePreset[] = RECT_MM.flatMap(([w, h]) =>
  RECT_WALLS_MM.map((t) => rect('rect-metric', `${w}×${h}×${t} mm`, w, h, t)),
)

export const PRESETS: SizePreset[] = [
  ...TUBE_OD_IN.map(([label, od]) => round(label, toMm(od, 'in'), 'tube')),
  ...PIPE_OD_IN.map(([label, od]) => round(label, toMm(od, 'in'), 'pipe')),
  ...METRIC_OD_MM.map(([label, od]) => round(label, od, 'metric')),
  ...SQUARE_IN,
  ...RECT_IN_PRESETS,
  ...SQUARE_MM,
  ...RECT_MM_PRESETS,
]

export const GROUP_LABEL: Record<SizeGroup, string> = {
  tube: 'Tube — outside diameter',
  pipe: 'Pipe — NPS (Sch 40 OD)',
  metric: 'Metric tube',
  square: 'Square tube (A500)',
  rect: 'Rectangular tube (A500)',
  'square-metric': 'Square tube (mm)',
  'rect-metric': 'Rectangular tube (mm)',
}

/** Groups to offer for a given section shape. */
export const ROUND_GROUPS: SizeGroup[] = ['tube', 'pipe', 'metric']
export const RECT_GROUPS: SizeGroup[] = ['square', 'rect', 'square-metric', 'rect-metric']
