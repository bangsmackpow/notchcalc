import { describe, expect, it } from 'vitest'
import { branchNotch, type Section } from '../geometry/index.ts'
import { buildTemplateDrawing } from './drawing.ts'

const R = (od: number): Section => ({ shape: 'round', od })
import { PAPERS, tile } from './layout.ts'
import { buildPdf } from './pdf.ts'
import { buildDxf } from './dxf.ts'
import { renderPreviewSVG, renderPrintHTML } from './svg.ts'
import { toMm } from './units.ts'

// 4" OD tube on a 4" tube at 90° — the largest common case.
const t = branchNotch({ branchSection: R(toMm(4, 'in')), headerSection: R(toMm(4, 'in')), angleDeg: 90 })
const drawing = buildTemplateDrawing(t, { unit: 'in' })

describe('layout / tiling', () => {
  it('a 4" wrap needs multiple Letter sheets', () => {
    const pages = tile(drawing, PAPERS.letter)
    expect(pages.length).toBeGreaterThan(1)
  })
  it('a small wrap fits one Letter sheet', () => {
    const small = buildTemplateDrawing(
      branchNotch({ branchSection: R(toMm(1, 'in')), headerSection: R(toMm(1, 'in')), angleDeg: 90 }),
      { unit: 'in' },
    )
    expect(tile(small, PAPERS.letter)).toHaveLength(1)
  })
  it('A3 needs no more sheets than A4', () => {
    const a4 = tile(drawing, PAPERS.a4).length
    const a3 = tile(drawing, PAPERS.a3).length
    expect(a3).toBeLessThanOrEqual(a4)
  })
  it('every page carries grid coordinates', () => {
    const pages = tile(drawing, PAPERS.letter)
    for (const p of pages) {
      expect(p.index).toBeLessThan(p.total)
      expect(p.cols).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('svg rendering', () => {
  it('preview is a single well-formed svg', () => {
    const s = renderPreviewSVG(drawing)
    expect(s.startsWith('<svg')).toBe(true)
    expect(s.trimEnd().endsWith('</svg>')).toBe(true)
  })
  it('print html has one page div per sheet', () => {
    const pages = tile(drawing, PAPERS.letter)
    const html = renderPrintHTML(drawing, pages)
    const count = (html.match(/class="print-page"/g) ?? []).length
    expect(count).toBe(pages.length)
  })
})

describe('dxf export', () => {
  const s = buildDxf(drawing, 'in')
  it('is a DXF with sections and an EOF', () => {
    expect(s).toContain('SECTION')
    expect(s).toContain('POLYLINE')
    expect(s).toContain('EOF')
  })
  it('declares inches', () => {
    expect(s).toContain('INSUNITS')
  })
})

describe('pdf export', () => {
  it('produces a valid PDF buffer with one page per sheet', async () => {
    const pages = tile(drawing, PAPERS.letter)
    const bytes = await buildPdf(drawing, pages)
    expect(bytes.length).toBeGreaterThan(1000)
    const head = new TextDecoder().decode(bytes.slice(0, 5))
    expect(head).toBe('%PDF-')
  })
})
