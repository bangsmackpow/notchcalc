import { useMemo } from 'react'
import { isRound, type JointKind, type JointSpec, type Section } from '../geometry/index.ts'
import { useJoint } from '../state/joint.ts'
import { useSettings } from '../state/settings.ts'
import { Card, LocalNum, RangeRow } from './ui.tsx'
import { SectionEditor } from './SectionEditor.tsx'
import { TemplatePanel } from './TemplatePanel.tsx'
import { OutputControls } from './OutputControls.tsx'
import { ProjectsPanel } from './ProjectsPanel.tsx'

function sectionValid(s: Section): boolean {
  return s.shape === 'round' ? s.od > 0.5 : s.width > 0.5 && s.height > 0.5
}

export function SingleJoint() {
  const unit = useSettings((s) => s.unit)
  const kind = useJoint((s) => s.kind)
  const branchSection = useJoint((s) => s.branchSection)
  const headerSection = useJoint((s) => s.headerSection)
  const off1 = useJoint((s) => s.off1)
  const off2 = useJoint((s) => s.off2)
  const angle = useJoint((s) => s.angle)
  const sectionRoll = useJoint((s) => s.sectionRoll)
  const headerRoll = useJoint((s) => s.headerRoll)
  const passThrough = useJoint((s) => s.passThrough)
  const setKind = useJoint((s) => s.setKind)
  const set = useJoint((s) => s.set)

  const valid = sectionValid(branchSection) && (kind === 'miter' || sectionValid(headerSection))
  const holeApprox = kind === 'hole' && (!isRound(branchSection) || !isRound(headerSection))

  const spec: JointSpec = useMemo(
    () => ({
      kind,
      branchSection,
      headerSection,
      angleDeg: angle,
      offsetInPlane: off1,
      offsetPerp: off2,
      sectionRollDeg: sectionRoll,
      headerRollDeg: headerRoll,
      passThrough,
    }),
    [kind, branchSection, headerSection, angle, off1, off2, sectionRoll, headerRoll, passThrough],
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

        <SectionEditor
          title={kind === 'miter' ? 'Tube' : 'Branch (cut tube)'}
          section={branchSection}
          onChange={(s) => set({ branchSection: s })}
          unit={unit}
          roll={sectionRoll}
          onRollChange={(v) => set({ sectionRoll: v })}
        />

        {kind !== 'miter' && (
          <SectionEditor
            title={kind === 'hole' ? 'Header (pierced tube)' : 'Header (main tube)'}
            section={headerSection}
            onChange={(s) => set({ headerSection: s })}
            unit={unit}
            roll={headerRoll}
            onRollChange={(v) => set({ headerRoll: v })}
            extra={
              holeApprox ? (
                <p className="mt-2 text-xs text-amber-600">
                  Square header holes are approximate — the pierced oval is developed as a round tube.
                </p>
              ) : undefined
            }
          />
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
