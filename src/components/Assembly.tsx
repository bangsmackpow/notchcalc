import { useMemo } from 'react'
import { generate } from '../geometry/index.ts'
import { jointSpecFor, type Branch } from '../assembly/model.ts'
import { useAssembly } from '../assembly/store.ts'
import { buildTemplateDrawing } from '../lib/drawing.ts'
import { PAPERS, tile } from '../lib/layout.ts'
import { printDrawings } from '../lib/print.ts'
import { buildDxfMany } from '../lib/dxf.ts'
import { downloadBlob, downloadText } from '../lib/download.ts'
import { toMm } from '../lib/units.ts'
import { useSettings } from '../state/settings.ts'
import { Scene } from './Scene.tsx'
import { TemplatePanel } from './TemplatePanel.tsx'
import { OutputControls } from './OutputControls.tsx'
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

export function Assembly() {
  const unit = useSettings((s) => s.unit)
  const paperId = useSettings((s) => s.paperId)
  const orientation = useSettings((s) => s.orientation)
  const opts = useSettings((s) => s.opts)

  const headerOD = useAssembly((s) => s.headerOD)
  const headerLength = useAssembly((s) => s.headerLength)
  const branches = useAssembly((s) => s.branches)
  const selectedId = useAssembly((s) => s.selectedId)
  const addBranch = useAssembly((s) => s.addBranch)
  const updateBranch = useAssembly((s) => s.updateBranch)
  const removeBranch = useAssembly((s) => s.removeBranch)
  const select = useAssembly((s) => s.select)
  const setHeaderOD = useAssembly((s) => s.setHeaderOD)
  const setHeaderLength = useAssembly((s) => s.setHeaderLength)

  const items = useMemo(
    () =>
      branches.map((b, i) => {
        const spec = jointSpecFor(b, headerOD)
        const t = generate(spec)[0]
        const drawing = buildTemplateDrawing(t, {
          unit,
          showGrid: opts.grid,
          showRulers: opts.rulers,
          showTabs: opts.tabs,
          showAdjust: opts.adjust,
          calibration: opts.cal,
          title: `BRANCH NOTCH #${i + 1}`,
        })
        const pages = tile(drawing, PAPERS[paperId], { orientation })
        return { b, spec, drawing, pages }
      }),
    [branches, headerOD, unit, paperId, orientation, opts],
  )

  const selected = items.find((it) => it.b.id === selectedId)

  const printAll = () => printDrawings(items.map((it) => ({ drawing: it.drawing, pages: it.pages })))
  const pdfAll = async () => {
    const { buildPdfMany } = await import('../lib/pdf.ts')
    const bytes = await buildPdfMany(items.map((it) => ({ drawing: it.drawing, pages: it.pages })))
    downloadBlob('notchcalc-assembly.pdf', bytes as unknown as BlobPart, 'application/pdf')
  }
  const dxfAll = () => downloadText('notchcalc-assembly.dxf', buildDxfMany(items.map((it) => it.drawing), unit), 'application/dxf')

  const patch = (b: Branch, p: Partial<Branch>) => updateBranch(b.id, p)
  const half = headerLength / 2

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="space-y-3">
        <Card title="Add branch">
          <div className="flex flex-wrap gap-1">
            {QUICK.map(([label, inch]) => (
              <button
                key={label}
                onClick={() => addBranch(toMm(inch, 'in'))}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Click to drop a tube on the header, then drag it along.</p>
        </Card>

        <Card title="Header">
          <div className="grid grid-cols-2 gap-2">
            <LocalNum label="Outside diameter" mm={headerOD} unit={unit} onChangeMm={setHeaderOD} />
            <LocalNum label="Length" mm={headerLength} unit={unit} step={1} onChangeMm={setHeaderLength} />
          </div>
        </Card>

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
                      #{i + 1} · {b.odMm.toFixed(1)} mm · {b.angleDeg}°
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
          <Card title="Selected branch">
            <div className="space-y-3">
              <LocalNum label="Branch OD" mm={selected.b.odMm} unit={unit} onChangeMm={(mm) => patch(selected.b, { odMm: mm })} />
              <RangeRow
                label="Angle to header"
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
            </div>
          </Card>
        )}

        <OutputControls />
      </section>

      <section className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
          <div className="h-[440px] w-full">
            <Scene />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-sm text-slate-500">
            {branches.length} joint{branches.length === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
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
