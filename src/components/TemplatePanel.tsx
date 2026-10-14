import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { generate, type JointSpec } from '../geometry/index.ts'
import { buildTemplateDrawing } from '../lib/drawing.ts'
import { PAPERS, tile } from '../lib/layout.ts'
import { renderPreviewSVG } from '../lib/svg.ts'
import { printDrawing } from '../lib/print.ts'
import { buildDxf } from '../lib/dxf.ts'
import { downloadBlob, downloadText } from '../lib/download.ts'
import { fromMm } from '../lib/units.ts'
import { useSettings } from '../state/settings.ts'
import { PrintPreview } from './PrintPreview.tsx'

export interface TemplatePanelProps {
  spec: JointSpec
  title?: string
  footer?: ReactNode
  compact?: boolean
}

export function TemplatePanel({ spec, title, footer, compact }: TemplatePanelProps) {
  const unit = useSettings((s) => s.unit)
  const paperId = useSettings((s) => s.paperId)
  const orientation = useSettings((s) => s.orientation)
  const opts = useSettings((s) => s.opts)
  const [preview, setPreview] = useState(false)

  const { drawing, pages } = useMemo(() => {
    const d = buildTemplateDrawing(generate(spec), {
      unit,
      showGrid: opts.grid,
      showRulers: opts.rulers,
      showTabs: opts.tabs,
      calibration: opts.cal,
      title,
    })
    return { drawing: d, pages: tile(d, PAPERS[paperId], { orientation }) }
  }, [spec, unit, paperId, orientation, opts, title])

  const url = `data:image/svg+xml;utf8,${encodeURIComponent(renderPreviewSVG(drawing))}`

  const exportPdf = async () => {
    const { buildPdf } = await import('../lib/pdf.ts')
    const bytes = await buildPdf(drawing, pages)
    downloadBlob('notchcalc-template.pdf', bytes as unknown as BlobPart, 'application/pdf')
  }
  const exportDxf = () => downloadText('notchcalc-template.dxf', buildDxf(drawing, unit), 'application/dxf')
  const exportSvg = () => downloadText('notchcalc-template.svg', renderPreviewSVG(drawing), 'image/svg+xml')

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-500">
          wrap <b>{fromMm(drawing.wrap.w, unit).toFixed(2)}</b> · depth{' '}
          <b>{fromMm(drawing.depthMm, unit).toFixed(2)}</b> {unit} · <b>{pages.length}</b> sheet
          {pages.length === 1 ? '' : 's'} ({pages[0]?.orientation})
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => setPreview(true)}>Preview</Btn>
          <Btn onClick={() => printDrawing(drawing, pages)}>Print</Btn>
          <Btn onClick={exportPdf}>PDF</Btn>
          <Btn onClick={exportDxf}>DXF</Btn>
          <Btn onClick={exportSvg}>SVG</Btn>
        </div>
      </div>
      <div className={`overflow-auto rounded-lg border border-slate-100 bg-white ${compact ? 'max-h-[46vh]' : ''}`}>
        <img src={url} alt="template preview" className="w-full" />
      </div>
      {footer}
      {preview && (
        <PrintPreview
          items={[{ drawing, pages }]}
          onClose={() => setPreview(false)}
          onPrint={() => printDrawing(drawing, pages)}
        />
      )}
    </div>
  )
}

function Btn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
    >
      {children}
    </button>
  )
}
