import { useMemo, useState } from 'react'
import { generate, sectionDims, type JointKind, type Section } from '../geometry/index.ts'
import { jointSpecFor, type Branch } from '../assembly/model.ts'
import { useAssembly } from '../assembly/store.ts'
import { buildTemplateDrawing } from '../lib/drawing.ts'
import { PAPERS, sharedOrientation, tile } from '../lib/layout.ts'
import { printDrawings } from '../lib/print.ts'
import { buildDxfMany } from '../lib/dxf.ts'
import { downloadBlob, downloadText } from '../lib/download.ts'
import { toMm } from '../lib/units.ts'
import { useSettings } from '../state/settings.ts'
import { Scene } from './Scene.tsx'
import { TemplatePanel } from './TemplatePanel.tsx'
import { PrintPreview } from './PrintPreview.tsx'
import { OutputControls } from './OutputControls.tsx'
import { ProjectsPanel } from './ProjectsPanel.tsx'
import { SectionEditor } from './SectionEditor.tsx'
import { Btn, Card, LocalNum, RangeRow } from './ui.tsx'

const QUICK: [string, number][] = [
  ['1"', 1],
  ['1¼"', 1.25],
  ['1½"', 1.5],
  ['1¾"', 1.75],
  ['2"', 2],
  ['2⅜"', 2.375],
  ['2½"', 2.5],
  ['3"', 3],
  ['4"', 4],
]

function scaleSection(s: Section, f: number): Section {
  return s.shape === 'round'
    ? { shape: 'round', od: Math.max(3, s.od * f) }
    : {
        shape: 'rect',
        width: Math.max(3, s.width * f),
        height: Math.max(3, s.height * f),
        cornerRadius: s.cornerRadius * f,
      }
}

function secLabel(s: Section): string {
  const d = sectionDims(s)
  return d.shape === 'round' ? `Ø${d.w.toFixed(1)}` : `${d.w.toFixed(1)}×${d.h.toFixed(1)}`
}

export function Assembly() {
  const unit = useSettings((s) => s.unit)
  const paperId = useSettings((s) => s.paperId)
  const orientation = useSettings((s) => s.orientation)
  const opts = useSettings((s) => s.opts)

  const headerSection = useAssembly((s) => s.headerSection)
  const headerLength = useAssembly((s) => s.headerLength)
  const branches = useAssembly((s) => s.branches)
  const selectedId = useAssembly((s) => s.selectedId)
  const addConnection = useAssembly((s) => s.addConnection)
  const updateBranch = useAssembly((s) => s.updateBranch)
  const removeBranch = useAssembly((s) => s.removeBranch)
  const select = useAssembly((s) => s.select)
  const setHeaderSection = useAssembly((s) => s.setHeaderSection)
  const setHeaderLength = useAssembly((s) => s.setHeaderLength)

  const KIND_ICON: Record<JointKind, string> = { branch: 'notch', miter: 'elbow', hole: 'hole' }

  const items = useMemo(
    () =>
      branches.map((b, i) => {
        const spec = jointSpecFor(b, headerSection)
        const templates = generate(spec)
        const drawing = buildTemplateDrawing(templates, {
          unit,
          showGrid: opts.grid,
          showRulers: opts.rulers,
          showTabs: opts.tabs,
          calibration: opts.cal,
          title: `${(b.kind ?? 'branch') === 'branch' ? 'BRANCH' : (b.kind ?? 'branch') === 'miter' ? 'MITER ELBOW' : 'THROUGH-BRANCH'} #${i + 1}`,
        })
        const pages = tile(drawing, PAPERS[paperId], { orientation })
        return { b, spec, drawing, pages }
      }),
    [branches, headerSection, unit, paperId, orientation, opts],
  )

  const selected = items.find((it) => it.b.id === selectedId)

  // One shared orientation so a single print job uses one paper size.
  const exportItems = useMemo(() => {
    const paper = PAPERS[paperId]
    const orient =
      orientation === 'auto'
        ? sharedOrientation(items.map((it) => ({ w: it.drawing.width, h: it.drawing.height })), paper)
        : orientation
    return items.map((it) => ({ drawing: it.drawing, pages: tile(it.drawing, paper, { orientation: orient }) }))
  }, [items, paperId, orientation])

  const [previewOpen, setPreviewOpen] = useState(false)
  const totalSheets = exportItems.reduce((n, it) => n + it.pages.length, 0)

  const printAll = () => printDrawings(exportItems)
  const pdfAll = async () => {
    const { buildPdfMany } = await import('../lib/pdf.ts')
    const bytes = await buildPdfMany(exportItems)
    downloadBlob('notchcalc-assembly.pdf', bytes as unknown as BlobPart, 'application/pdf')
  }
  const dxfAll = () =>
    downloadText('notchcalc-assembly.dxf', buildDxfMany(exportItems.map((it) => it.drawing), unit), 'application/dxf')

  const patch = (b: Branch, p: Partial<Branch>) => updateBranch(b.id, p)
  const half = headerLength / 2

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="space-y-3">
        <Card title="Add connection">
          <div className="flex flex-wrap gap-1">
            {QUICK.map(([label, inch]) => (
              <button
                key={label}
                onClick={() => addConnection('branch', { shape: 'round', od: toMm(inch, 'in') })}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => addConnection('miter', headerSection)}
              className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              + Miter elbow
            </button>
            <button
              onClick={() => addConnection('hole', scaleSection(headerSection, 0.5))}
              className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              + Header hole
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">Click to drop a tube on the header, then drag it along.</p>
        </Card>

        <SectionEditor
          title="Header"
          section={headerSection}
          onChange={setHeaderSection}
          unit={unit}
          extra={<LocalNum label="Length" mm={headerLength} unit={unit} step={1} onChangeMm={setHeaderLength} />}
        />

        <Card title={`Branches (${branches.length})`}>
          {branches.length === 0 ? (
            <p className="text-sm text-slate-400">No branches yet.</p>
          ) : (
            <ul className="space-y-1">
              {branches.map((b, i) => (
                <li key={b.id}>
                  <div
                    className={`flex items-center justify-between rounded-md px-2 py-1 text-sm ${
                      b.id === selectedId ? 'bg-orange-100' : 'hover:bg-slate-100'
                    }`}
                  >
                    <button className="flex-1 text-left" onClick={() => select(b.id)}>
                      #{i + 1} · {KIND_ICON[b.kind ?? 'branch']} · {secLabel(b.section)} mm · {b.angleDeg}°
                    </button>
                    <button
                      className="ml-2 text-slate-400 hover:text-red-600"
                      onClick={() => removeBranch(b.id)}
                      title="remove"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected && (
          <Card title="Selected connection">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs">
                {(['branch', 'miter', 'hole'] as JointKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => patch(selected.b, { kind: k })}
                    className={`rounded-md px-2 py-1 font-medium ${(selected.b.kind ?? 'branch') === k ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                  >
                    {KIND_ICON[k]}
                  </button>
                ))}
              </div>
              <SectionEditor
                title={selected.b.kind === 'miter' ? 'Tube' : 'Branch'}
                section={selected.b.section}
                onChange={(s) => patch(selected.b, { section: s })}
                unit={unit}
                roll={selected.b.sectionRollDeg ?? 0}
                onRollChange={(v) => patch(selected.b, { sectionRollDeg: v })}
              />
              <RangeRow
                label={selected.b.kind === 'miter' ? 'Angle between tubes (90° = elbow)' : 'Angle to header'}
                value={selected.b.angleDeg}
                min={5}
                max={175}
                onChange={(v) => patch(selected.b, { angleDeg: v })}
                suffix="°"
              />
              <RangeRow
                label="Roll about header"
                value={selected.b.rollDeg}
                min={0}
                max={360}
                onChange={(v) => patch(selected.b, { rollDeg: v })}
                suffix="°"
              />
              <RangeRow
                label="Position along header"
                value={Math.round(selected.b.posMm)}
                min={Math.round(-half + 20)}
                max={Math.round(half - 20)}
                onChange={(v) => patch(selected.b, { posMm: v })}
                suffix=" mm"
              />
              {selected.b.kind !== 'miter' && (
                <div className="grid grid-cols-2 gap-2">
                  <LocalNum
                    label="Offset in plane"
                    mm={selected.b.offsetInPlane}
                    unit={unit}
                    onChangeMm={(mm) => patch(selected.b, { offsetInPlane: mm })}
                  />
                  <LocalNum
                    label="Offset perp"
                    mm={selected.b.offsetPerp}
                    unit={unit}
                    onChangeMm={(mm) => patch(selected.b, { offsetPerp: mm })}
                  />
                </div>
              )}
              {(selected.b.kind ?? 'branch') === 'branch' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!selected.b.passThrough}
                    onChange={(e) => patch(selected.b, { passThrough: e.target.checked })}
                  />
                  Pass-through branch (adds far-wall exit cut)
                </label>
              )}
            </div>
          </Card>
        )}

        <OutputControls />
        <ProjectsPanel
          kind="assembly"
          buildPayload={() => ({ kind: 'assembly', assembly: { headerSection, headerLength, branches } })}
          apply={(p) => {
            if (p.kind === 'assembly') useAssembly.getState().load(p.assembly)
          }}
        />
      </section>

      <section className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
          <div className="h-[440px] w-full">
            <Scene />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-sm text-slate-500">
            {branches.length} joint{branches.length === 1 ? '' : 's'} · {totalSheets} sheet
            {totalSheets === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <Btn onClick={() => setPreviewOpen(true)} disabled={!branches.length} variant="ghost">
              Preview
            </Btn>
            <Btn onClick={printAll} disabled={!branches.length}>
              Print all
            </Btn>
            <Btn onClick={pdfAll} disabled={!branches.length}>
              PDF all
            </Btn>
            <Btn onClick={dxfAll} disabled={!branches.length}>
              DXF all
            </Btn>
          </div>
        </div>

        {previewOpen && (
          <PrintPreview items={exportItems} onClose={() => setPreviewOpen(false)} onPrint={() => printAll()} />
        )}

        {selected ? (
          <TemplatePanel spec={selected.spec} compact />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-400">
            Select a branch to preview its notch template.
          </div>
        )}
      </section>
    </div>
  )
}
