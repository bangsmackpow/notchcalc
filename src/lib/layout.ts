import type { Drawing } from './drawing.ts'

/** Paper sizes in millimetres (portrait). */
export interface Paper {
  id: string
  name: string
  w: number
  h: number
}

export const PAPERS: Record<string, Paper> = {
  letter: { id: 'letter', name: 'Letter 8.5×11"', w: 215.9, h: 279.4 },
  legal: { id: 'legal', name: 'Legal 8.5×14"', w: 215.9, h: 355.6 },
  a4: { id: 'a4', name: 'A4', w: 210, h: 297 },
  a3: { id: 'a3', name: 'A3', w: 297, h: 420 },
}

export type Orientation = 'portrait' | 'landscape'

export interface TileOptions {
  /** printer margin, mm */
  margin?: number
  /** glue/registration overlap between adjacent pages, mm */
  overlap?: number
  orientation?: 'auto' | Orientation
}

export interface Page {
  index: number
  total: number
  col: number
  row: number
  cols: number
  rows: number
  orientation: Orientation
  /** full page size in mm (post-orientation) */
  pageW: number
  pageH: number
  margin: number
  overlap: number
  /** master-coordinate of the page's printable top-left */
  offsetX: number
  offsetY: number
  printableW: number
  printableH: number
}

function countDim(size: number, printable: number, overlap: number): number {
  if (size <= printable) return 1
  const step = printable - overlap
  return 1 + Math.ceil((size - printable) / step)
}

function plan(
  dw: number,
  dh: number,
  paper: Paper,
  orientation: Orientation,
  margin: number,
  overlap: number,
): { cols: number; rows: number; pageW: number; pageH: number } {
  const pageW = orientation === 'portrait' ? paper.w : paper.h
  const pageH = orientation === 'portrait' ? paper.h : paper.w
  const printableW = pageW - 2 * margin
  const printableH = pageH - 2 * margin
  const cols = countDim(dw, printableW, overlap)
  const rows = countDim(dh, printableH, overlap)
  return { cols, rows, pageW, pageH }
}

/** One orientation that minimises total sheets across several drawings (single print job). */
export function sharedOrientation(
  dims: { w: number; h: number }[],
  paper: Paper,
  opts: TileOptions = {},
): Orientation {
  const margin = opts.margin ?? 8
  const overlap = opts.overlap ?? 6
  let p = 0
  let l = 0
  for (const d of dims) {
    const pp = plan(d.w, d.h, paper, 'portrait', margin, overlap)
    const ll = plan(d.w, d.h, paper, 'landscape', margin, overlap)
    p += pp.cols * pp.rows
    l += ll.cols * ll.rows
  }
  return p <= l ? 'portrait' : 'landscape'
}

export function tile(drawing: Drawing, paper: Paper, opts: TileOptions = {}): Page[] {
  const margin = opts.margin ?? 8
  const overlap = opts.overlap ?? 6
  const dw = drawing.width
  const dh = drawing.height

  let orientation: Orientation
  if (opts.orientation && opts.orientation !== 'auto') {
    orientation = opts.orientation
  } else {
    // Pick the orientation that tiles into the fewest pages.
    const p = plan(dw, dh, paper, 'portrait', margin, overlap)
    const l = plan(dw, dh, paper, 'landscape', margin, overlap)
    orientation = p.cols * p.rows <= l.cols * l.rows ? 'portrait' : 'landscape'
  }

  const { cols, rows, pageW, pageH } = plan(dw, dh, paper, orientation, margin, overlap)
  const printableW = pageW - 2 * margin
  const printableH = pageH - 2 * margin
  const stepX = printableW - overlap
  const stepY = printableH - overlap

  const pages: Page[] = []
  const total = cols * rows
  let index = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      pages.push({
        index: index++,
        total,
        col,
        row,
        cols,
        rows,
        orientation,
        pageW,
        pageH,
        margin,
        overlap,
        offsetX: col * stepX,
        offsetY: row * stepY,
        printableW,
        printableH,
      })
    }
  }
  return pages
}
