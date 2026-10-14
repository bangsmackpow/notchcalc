import { mkdirSync, writeFileSync } from 'node:fs'
import { generate, type JointSpec } from '../src/geometry/index.ts'
import { buildTemplateDrawing } from '../src/lib/drawing.ts'
import { PAPERS, tile } from '../src/lib/layout.ts'
import { buildPdf } from '../src/lib/pdf.ts'
import { buildDxf } from '../src/lib/dxf.ts'
import { renderPreviewSVG } from '../src/lib/svg.ts'

const base = { offsetInPlane: 0, offsetPerp: 0, passThrough: false }
const cases: [string, JointSpec][] = [
  ['notch-2on2-375-90', { kind: 'branch', branchOD: 50.8, headerOD: 60.325, angleDeg: 90, ...base }],
  ['notch-2on3-5-45', { kind: 'branch', branchOD: 50.8, headerOD: 88.9, angleDeg: 45, ...base }],
  ['notch-4on4-30', { kind: 'branch', branchOD: 101.6, headerOD: 101.6, angleDeg: 30, ...base }],
  ['miter-2-90', { kind: 'miter', branchOD: 50.8, headerOD: 50.8, angleDeg: 90, ...base }],
  ['hole-2in2-375', { kind: 'hole', branchOD: 50.8, headerOD: 60.325, angleDeg: 90, ...base }],
]

mkdirSync('tmp', { recursive: true })
for (const [name, spec] of cases) {
  const t = generate(spec)[0]
  const drawing = buildTemplateDrawing(t, { unit: 'in' })
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
