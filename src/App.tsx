import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Unit } from './geometry/types.ts'
import { generate, type JointKind, type JointSpec } from './geometry/index.ts'
import { buildTemplateDrawing, type Drawing } from './lib/drawing.ts'
import { PAPERS, tile, type Orientation } from './lib/layout.ts'
import { renderPreviewSVG } from './lib/svg.ts'
import { printDrawing } from './lib/print.ts'
import { buildDxf } from './lib/dxf.ts'
import { downloadBlob, downloadText } from './lib/download.ts'
import { fromMm, toMm } from './lib/units.ts'
import { GROUP_LABEL, PRESETS, type SizeGroup } from './lib/sizes.ts'

function trimNum(v: number): string {
  return v.toFixed(3).replace(/\.?0+$/, '')
}

function convertStr(s: string, from: Unit, to: Unit): string {
  const v = parseFloat(s)
  if (!Number.isFinite(v)) return s
  return trimNum(fromMm(toMm(v, from), to))
}

export default function App() {
  const [unit, setUnit] = useState<Unit>('in')
  const [kind, setKind] = useState<JointKind>('branch')
  const [branchStr, setBranchStr] = useState('2')
  const [headerStr, setHeaderStr] = useState('2.375')
  const [off1Str, setOff1Str] = useState('0')
  const [off2Str, setOff2Str] = useState('0')
  const [angle, setAngle] = useState(90)
  const [passThrough, setPassThrough] = useState(false)
  const [paperId, setPaperId] = useState('letter')
  const [orientation, setOrientation] = useState<'auto' | Orientation>('auto')
  const [opts, setOpts] = useState({ grid: true, rulers: true, tabs: true, adjust: true, cal: true })

  const parseLen = (s: string) => {
    const v = parseFloat(s)
    return Number.isFinite(v) ? toMm(v, unit) : 0
  }

  const branchMm = parseLen(branchStr)
  const headerMm = parseLen(headerStr)
  const valid = branchMm > 0.5 && (kind === 'miter' || headerMm > 0.5) && angle >= 5 && angle <= 175

  const { drawing, pages } = useMemo(() => {
    if (!valid) return { drawing: null as Drawing | null, pages: [] }
    const spec: JointSpec = {
      kind,
      branchOD: branchMm,
      headerOD: headerMm,
      angleDeg: angle,
      offsetInPlane: parseLen(off1Str),
      offsetPerp: parseLen(off2Str),
      passThrough,
    }
    const templates = generate(spec)
    const d = buildTemplateDrawing(templates[0], {
      unit,
      showGrid: opts.grid,
      showRulers: opts.rulers,
      showTabs: opts.tabs,
      showAdjust: opts.adjust,
      calibration: opts.cal,
    })
    const p = tile(d, PAPERS[paperId], { orientation })
    return { drawing: d, pages: p }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, kind, branchMm, headerMm, angle, off1Str, off2Str, passThrough, unit, paperId, orientation, opts])

  const previewUrl = drawing ? `data:image/svg+xml;utf8,${encodeURIComponent(renderPreviewSVG(drawing))}` : ''

  const onUnit = (u: Unit) => {
    setBranchStr((s) => convertStr(s, unit, u))
    setHeaderStr((s) => convertStr(s, unit, u))
    setOff1Str((s) => convertStr(s, unit, u))
    setOff2Str((s) => convertStr(s, unit, u))
    setUnit(u)
  }

  const pickPreset = (setter: (s: string) => void) => (odMm: number) => setter(trimNum(fromMm(odMm, unit)))

  const exportPdf = async () => {
    if (!drawing) return
    const { buildPdf } = await import('./lib/pdf.ts')
    const bytes = await buildPdf(drawing, pages)
    downloadBlob('notchcalc-template.pdf', bytes as unknown as BlobPart, 'application/pdf')
  }
  const exportDxf = () => {
    if (!drawing) return
    downloadText('notchcalc-template.dxf', buildDxf(drawing, unit), 'application/dxf')
  }
  const exportSvg = () => {
    if (!drawing) return
    downloadText('notchcalc-template.svg', renderPreviewSVG(drawing), 'image/svg+xml')
  }

  const groups: SizeGroup[] = ['tube', 'pipe', 'metric']

  return (
    <>
      <div className="app-shell min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight">notchcalc</h1>
              <p className="text-xs text-slate-500">Pipe &amp; tube notching template generator</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm">
              {(['in', 'mm'] as Unit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => onUnit(u)}
                  className={`rounded-md px-3 py-1 font-medium ${unit === u ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                >
                  {u === 'in' ? 'inch' : 'mm'}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[360px_1fr]">
          {/* ---------------- controls ---------------- */}
          <section className="space-y-3">
            <Card title="Joint">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs">
                {(['branch', 'miter', 'hole'] as JointKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`rounded-md px-2 py-1 font-medium ${kind === k ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                  >
                    {k === 'branch' ? 'Notch' : k === 'miter' ? 'Miter' : 'Header hole'}
                  </button>
                ))}
              </div>
            </Card>

            <Card title={kind === 'miter' ? 'Tube' : 'Branch (cut tube)'}>
              <div className="flex gap-2">
                <NumField label="Outside diameter" value={branchStr} onChange={setBranchStr} unit={unit} />
                <PresetPick onPick={pickPreset(setBranchStr)} groups={groups} />
              </div>
            </Card>

            {kind !== 'miter' && (
              <Card title={kind === 'hole' ? 'Header (pierced tube)' : 'Header (main tube)'}>
                <div className="flex gap-2">
                  <NumField label="Outside diameter" value={headerStr} onChange={setHeaderStr} unit={unit} />
                  <PresetPick onPick={pickPreset(setHeaderStr)} groups={groups} />
                </div>
              </Card>
            )}

            <Card title={kind === 'miter' ? 'Joint angle (each end halved)' : 'Angle between centre lines'}>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={5}
                  max={175}
                  step={1}
                  value={angle}
                  onChange={(e) => setAngle(parseFloat(e.target.value))}
                  className="w-full"
                />
                <input
                  type="number"
                  min={5}
                  max={175}
                  value={angle}
                  onChange={(e) => setAngle(Math.max(5, Math.min(175, parseFloat(e.target.value) || 90)))}
                  className="w-16 rounded-md border border-slate-200 px-2 py-1 text-right text-sm"
                />
              </div>
            </Card>

            {kind !== 'miter' && (
              <Card title="Offset (eccentric)">
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="In plane" value={off1Str} onChange={setOff1Str} unit={unit} />
                  <NumField label="Perpendicular" value={off2Str} onChange={setOff2Str} unit={unit} />
                </div>
                {kind === 'branch' && (
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={passThrough} onChange={(e) => setPassThrough(e.target.checked)} />
                    Pass-through branch (also show far wall)
                  </label>
                )}
              </Card>
            )}

            <Card title="Paper">
              <div className="grid grid-cols-2 gap-2">
                <Select value={paperId} onChange={setPaperId} options={Object.values(PAPERS).map((p) => ({ value: p.id, label: p.name }))} />
                <Select
                  value={orientation}
                  onChange={(v) => setOrientation(v as 'auto' | Orientation)}
                  options={[
                    { value: 'auto', label: 'Auto orient' },
                    { value: 'portrait', label: 'Portrait' },
                    { value: 'landscape', label: 'Landscape' },
                  ]}
                />
              </div>
            </Card>

            <Card title="Template options">
              <div className="grid grid-cols-2 gap-1 text-sm">
                <Check label="Ruler grid" checked={opts.grid} onChange={(v) => setOpts({ ...opts, grid: v })} />
                <Check label="Degree ruler" checked={opts.rulers} onChange={(v) => setOpts({ ...opts, rulers: v })} />
                <Check label="Glue tab" checked={opts.tabs} onChange={(v) => setOpts({ ...opts, tabs: v })} />
                <Check label="Length adjust" checked={opts.adjust} onChange={(v) => setOpts({ ...opts, adjust: v })} />
                <Check label="Calibration bar" checked={opts.cal} onChange={(v) => setOpts({ ...opts, cal: v })} />
              </div>
            </Card>
          </section>

          {/* ---------------- preview + export ---------------- */}
          <section className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-slate-500">
                  {drawing ? (
                    <>
                      wrap <b>{fromMm(drawing.wrap.w, unit).toFixed(2)}</b> · depth{' '}
                      <b>{fromMm(drawing.wrap.h - 2 * 8, unit).toFixed(2)}</b> {unit} · <b>{pages.length}</b> sheet
                      {pages.length === 1 ? '' : 's'} ({pages[0]?.orientation})
                    </>
                  ) : (
                    'Enter valid dimensions'
                  )}
                </div>
                <div className="flex gap-2">
                  <Btn onClick={() => drawing && printDrawing(drawing, pages)} disabled={!drawing}>
                    Print
                  </Btn>
                  <Btn onClick={exportPdf} disabled={!drawing}>
                    PDF
                  </Btn>
                  <Btn onClick={exportDxf} disabled={!drawing}>
                    DXF
                  </Btn>
                  <Btn onClick={exportSvg} disabled={!drawing}>
                    SVG
                  </Btn>
                </div>
              </div>
              <div className="overflow-auto rounded-lg border border-slate-100 bg-white">
                {drawing ? (
                  <img src={previewUrl} alt="template preview" className="w-full" />
                ) : (
                  <div className="flex h-64 items-center justify-center text-slate-400">No template</div>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Print at <b>100% / actual size</b> — disable “fit to page”. Verify the 100&nbsp;mm calibration bar with a
                ruler before cutting. Large wraps tile across sheets with overlap and registration marks.
              </p>
            </div>
          </section>
        </main>
      </div>
      <div id="print-area" />
    </>
  )
}

/* ---------------- small UI primitives ---------------- */

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string
  value: string
  onChange: (s: string) => void
  unit: Unit
}) {
  return (
    <label className="block flex-1">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <div className="flex items-center rounded-md border border-slate-200">
        <input
          type="number"
          step="0.001"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md px-2 py-1 text-sm outline-none"
        />
        <span className="px-2 text-xs text-slate-400">{unit === 'in' ? 'in' : 'mm'}</span>
      </div>
    </label>
  )
}

function PresetPick({ onPick, groups }: { onPick: (odMm: number) => void; groups: SizeGroup[] }) {
  return (
    <label className="block w-28 self-end">
      <span className="mb-1 block text-xs text-transparent">.</span>
      <select
        value=""
        onChange={(e) => {
          const v = e.target.value
          if (v) onPick(parseFloat(v))
          e.target.value = ''
        }}
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
      >
        <option value="">standard…</option>
        {groups.map((g) => (
          <optgroup key={g} label={GROUP_LABEL[g]}>
            {PRESETS.filter((p) => p.group === g).map((p) => (
              <option key={p.label} value={p.odMm}>
                {p.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-200 px-2 py-1 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Btn({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {children}
    </button>
  )
}
