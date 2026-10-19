import { mkdirSync, writeFileSync } from 'node:fs'
import { generate, type JointSpec, type Section } from '../src/geometry/index.ts'
import { buildTemplateDrawing } from '../src/lib/drawing.ts'
import { PAPERS, tile } from '../src/lib/layout.ts'
import { buildPdf } from '../src/lib/pdf.ts'
import { buildDxf } from '../src/lib/dxf.ts'
import { renderPreviewSVG } from '../src/lib/svg.ts'

const R = (od: number): Section => ({ shape: 'round', od })
const SQ = (side: number, wall = 4): Section => ({ shape: 'rect', width: side, height: side, cornerRadius: 2 * wall })
const base = { offsetInPlane: 0, offsetPerp: 0, sectionRollDeg: 0, headerRollDeg: 0, passThrough: false }
const cases: [string, JointSpec][] = [
  ['notch-2on2-375-90', { kind: 'branch', branchSection: R(50.8), headerSection: R(60.325), angleDeg: 90, ...base }],
  ['notch-2on3-5-45', { kind: 'branch', branchSection: R(50.8), headerSection: R(88.9), angleDeg: 45, ...base }],
  ['pass-through-2on3', { kind: 'branch', branchSection: R(50.8), headerSection: R(88.9), angleDeg: 90, ...base, passThrough: true }],
  ['notch-4on4-30', { kind: 'branch', branchSection: R(101.6), headerSection: R(101.6), angleDeg: 30, ...base }],
  ['miter-2-90', { kind: 'miter', branchSection: R(50.8), headerSection: R(50.8), angleDeg: 90, ...base }],
  ['hole-2in2-375', { kind: 'hole', branchSection: R(50.8), headerSection: R(60.325), angleDeg: 90, ...base }],
  ['square40-on-round60', { kind: 'branch', branchSection: SQ(40), headerSection: R(60.325), angleDeg: 90, ...base }],
  ['square40-on-square50', { kind: 'branch', branchSection: SQ(40), headerSection: SQ(50), angleDeg: 90, ...base }],
]

mkdirSync('tmp', { recursive: true })
for (const [name, spec] of cases) {
  const templates = generate(spec)
  const drawing = buildTemplateDrawing(templates, { unit: 'in' })
  const pages = tile(drawing, PAPERS.letter, {})
  writeFileSync(`tmp/${name}.svg`, renderPreviewSVG(drawing))
  writeFileSync(`tmp/${name}.dxf`, buildDxf(drawing, 'in'))
  writeFileSync(`tmp/${name}.pdf`, await buildPdf(drawing, pages))
  console.log(
    name.padEnd(20),
    'sheets=' + pages.length,
    'orient=' + pages[0].orientation,
    'wrap=' + drawing.wrap.w.toFixed(1) + 'mm',
    'depth=' + drawing.wrap.h.toFixed(1) + 'mm',
    'cutPaths=' + drawing.cutPaths.length,
    'prims=' + drawing.prims.length,
  )
}
console.log('OK')
