import { useEffect, useMemo, useRef, useState } from 'react'
import type { JointKind, JointSpec } from '../geometry/index.ts'
import { fromMm, toMm } from '../lib/units.ts'
import { useSettings } from '../state/settings.ts'
import { Card, NumField, RangeRow } from './ui.tsx'
import { PresetPick } from './PresetPick.tsx'
import { TemplatePanel } from './TemplatePanel.tsx'
import { OutputControls } from './OutputControls.tsx'

function trimNum(v: number): string {
  return v.toFixed(3).replace(/\.?0+$/, '')
}
function convertStr(s: string, from: 'in' | 'mm', to: 'in' | 'mm'): string {
  const v = parseFloat(s)
  if (!Number.isFinite(v)) return s
  return trimNum(fromMm(toMm(v, from), to))
}

export function SingleJoint() {
  const unit = useSettings((s) => s.unit)
  const [kind, setKind] = useState<JointKind>('branch')
  const [branchStr, setBranchStr] = useState('2')
  const [headerStr, setHeaderStr] = useState('2.375')
  const [off1Str, setOff1Str] = useState('0')
  const [off2Str, setOff2Str] = useState('0')
  const [angle, setAngle] = useState(90)
  const [passThrough, setPassThrough] = useState(false)

  const prevUnit = useRef(unit)
  useEffect(() => {
    if (prevUnit.current === unit) return
    const from = prevUnit.current
    setBranchStr((s) => convertStr(s, from, unit))
    setHeaderStr((s) => convertStr(s, from, unit))
    setOff1Str((s) => convertStr(s, from, unit))
    setOff2Str((s) => convertStr(s, from, unit))
    prevUnit.current = unit
  }, [unit])

  const parseLen = (s: string) => {
    const v = parseFloat(s)
    return Number.isFinite(v) ? toMm(v, unit) : 0
  }
  const branchMm = parseLen(branchStr)
  const headerMm = parseLen(headerStr)
  const valid = branchMm > 0.5 && (kind === 'miter' || headerMm > 0.5) && angle >= 5 && angle <= 175

  const spec: JointSpec = useMemo(
    () => ({
      kind,
      branchOD: branchMm,
      headerOD: headerMm,
      angleDeg: angle,
      offsetInPlane: parseLen(off1Str),
      offsetPerp: parseLen(off2Str),
      passThrough,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, branchMm, headerMm, angle, off1Str, off2Str, passThrough, unit],
  )

  const pick = (setter: (s: string) => void) => (odMm: number) => setter(trimNum(fromMm(odMm, unit)))

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
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
            <PresetPick onPick={pick(setBranchStr)} />
          </div>
        </Card>

        {kind !== 'miter' && (
          <Card title={kind === 'hole' ? 'Header (pierced tube)' : 'Header (main tube)'}>
            <div className="flex gap-2">
              <NumField label="Outside diameter" value={headerStr} onChange={setHeaderStr} unit={unit} />
              <PresetPick onPick={pick(setHeaderStr)} />
            </div>
          </Card>
        )}

        <Card title={kind === 'miter' ? 'Joint angle (each end halved)' : 'Angle between centre lines'}>
          <RangeRow label="" value={angle} min={5} max={175} onChange={setAngle} suffix="°" />
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

        <OutputControls />
      </section>

      <section className="space-y-3">
        {valid ? (
          <TemplatePanel spec={spec} />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-400">
            Enter valid dimensions (OD &gt; 0, angle 5–175°).
          </div>
        )}
      </section>
    </div>
  )
}
