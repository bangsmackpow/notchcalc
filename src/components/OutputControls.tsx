import { PAPERS } from '../lib/layout.ts'
import { useSettings } from '../state/settings.ts'
import { Card, Check, Select } from './ui.tsx'

export function OutputControls() {
  const paperId = useSettings((s) => s.paperId)
  const setPaperId = useSettings((s) => s.setPaperId)
  const orientation = useSettings((s) => s.orientation)
  const setOrientation = useSettings((s) => s.setOrientation)
  const opts = useSettings((s) => s.opts)
  const setOpt = useSettings((s) => s.setOpt)

  return (
    <>
      <Card title="Paper">
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={paperId}
            onChange={setPaperId}
            options={Object.values(PAPERS).map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            value={orientation}
            onChange={(v) => setOrientation(v as 'auto' | 'portrait' | 'landscape')}
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
          <Check label="Ruler grid" checked={opts.grid} onChange={(v) => setOpt('grid', v)} />
          <Check label="Degree ruler" checked={opts.rulers} onChange={(v) => setOpt('rulers', v)} />
          <Check label="Glue flap" checked={opts.tabs} onChange={(v) => setOpt('tabs', v)} />
          <Check label="Calibration bar" checked={opts.cal} onChange={(v) => setOpt('cal', v)} />
        </div>
      </Card>
    </>
  )
}
