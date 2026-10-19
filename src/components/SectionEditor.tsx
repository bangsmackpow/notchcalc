import type { ReactNode } from 'react'
import type { Section, Unit } from '../geometry/index.ts'
import { cornerRadiusOf } from '../geometry/index.ts'
import { withShape } from '../state/joint.ts'
import { RECT_GROUPS, ROUND_GROUPS } from '../lib/sizes.ts'
import { Card, LocalNum, RangeRow } from './ui.tsx'
import { PresetPick } from './PresetPick.tsx'

export function SectionEditor({
  title,
  section,
  onChange,
  unit,
  extra,
  roll,
  onRollChange,
}: {
  title: string
  section: Section
  onChange: (s: Section) => void
  unit: Unit
  extra?: ReactNode
  roll?: number
  onRollChange?: (v: number) => void
}) {
  const shape: 'round' | 'rect' = section.shape
  return (
    <Card title={title}>
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs">
        {(['round', 'rect'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onChange(withShape(section, s))}
            className={`rounded-md px-2 py-1 font-medium ${shape === s ? 'bg-white shadow-sm' : 'text-slate-500'}`}
          >
            {s === 'round' ? 'Round' : 'Square / Rect'}
          </button>
        ))}
      </div>

      {section.shape === 'round' ? (
        <div className="flex gap-2">
          <LocalNum
            label="Outside diameter"
            mm={section.od}
            unit={unit}
            onChangeMm={(mm) => onChange({ ...section, od: mm })}
          />
          <PresetPick groups={ROUND_GROUPS} onPick={onChange} />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <LocalNum
              label="Width (across)"
              mm={section.width}
              unit={unit}
              onChangeMm={(mm) => onChange({ ...section, width: mm })}
            />
            <LocalNum
              label="Height"
              mm={section.height}
              unit={unit}
              onChangeMm={(mm) => onChange({ ...section, height: mm })}
            />
          </div>
          <div className="flex gap-2">
            <LocalNum
              label="Corner radius"
              mm={cornerRadiusOf(section)}
              unit={unit}
              min={0}
              onChangeMm={(mm) => onChange({ ...section, cornerRadius: mm })}
            />
            <PresetPick groups={RECT_GROUPS} onPick={onChange} />
          </div>
        </div>
      )}

      {onRollChange && roll != null && (
        <div className="mt-2">
          <RangeRow label="Section roll (flat to header = 0°)" value={roll} min={0} max={90} onChange={onRollChange} suffix="°" />
        </div>
      )}

      {extra}
    </Card>
  )
}
