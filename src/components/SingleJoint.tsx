import { useMemo } from 'react'
import type { JointKind, JointSpec } from '../geometry/index.ts'
import { useJoint } from '../state/joint.ts'
import { useSettings } from '../state/settings.ts'
import { Card, LocalNum, RangeRow } from './ui.tsx'
import { PresetPick } from './PresetPick.tsx'
import { TemplatePanel } from './TemplatePanel.tsx'
import { OutputControls } from './OutputControls.tsx'
import { ProjectsPanel } from './ProjectsPanel.tsx'

export function SingleJoint() {
  const unit = useSettings((s) => s.unit)
  const kind = useJoint((s) => s.kind)
  const branchOD = useJoint((s) => s.branchOD)
  const headerOD = useJoint((s) => s.headerOD)
  const off1 = useJoint((s) => s.off1)
  const off2 = useJoint((s) => s.off2)
  const angle = useJoint((s) => s.angle)
  const passThrough = useJoint((s) => s.passThrough)
  const setKind = useJoint((s) => s.setKind)
  const set = useJoint((s) => s.set)

  const valid = branchOD > 0.5 && (kind === 'miter' || headerOD > 0.5)

  const spec: JointSpec = useMemo(
    () => ({
      kind,
      branchOD,
      headerOD,
      angleDeg: angle,
      offsetInPlane: off1,
      offsetPerp: off2,
      passThrough,
    }),
    [kind, branchOD, headerOD, angle, off1, off2, passThrough],
  )

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
            <LocalNum label="Outside diameter" mm={branchOD} unit={unit} onChangeMm={(mm) => set({ branchOD: mm })} />
            <PresetPick onPick={(odMm) => set({ branchOD: odMm })} />
          </div>
        </Card>

        {kind !== 'miter' && (
          <Card title={kind === 'hole' ? 'Header (pierced tube)' : 'Header (main tube)'}>
            <div className="flex gap-2">
              <LocalNum label="Outside diameter" mm={headerOD} unit={unit} onChangeMm={(mm) => set({ headerOD: mm })} />
              <PresetPick onPick={(odMm) => set({ headerOD: odMm })} />
            </div>
          </Card>
        )}

        <Card title={kind === 'miter' ? 'Joint angle (each end halved)' : 'Angle between centre lines'}>
          <RangeRow label="" value={angle} min={5} max={175} onChange={(v) => set({ angle: v })} suffix="°" />
        </Card>

        {kind !== 'miter' && (
          <Card title="Offset (eccentric)">
            <div className="grid grid-cols-2 gap-2">
              <LocalNum label="In plane" mm={off1} unit={unit} onChangeMm={(mm) => set({ off1: mm })} />
              <LocalNum label="Perpendicular" mm={off2} unit={unit} onChangeMm={(mm) => set({ off2: mm })} />
            </div>
            {kind === 'branch' && (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={passThrough} onChange={(e) => set({ passThrough: e.target.checked })} />
                Pass-through branch (also show far wall)
              </label>
            )}
          </Card>
        )}

        <ProjectsPanel
          kind="single"
          buildPayload={() => ({ kind: 'single', spec })}
          apply={(p) => {
            if (p.kind === 'single') useJoint.getState().loadSpec(p.spec)
          }}
        />
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
