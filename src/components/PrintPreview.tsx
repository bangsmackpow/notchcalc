import type { Drawing } from '../lib/drawing.ts'
import type { Page } from '../lib/layout.ts'
import { renderPageSVG } from '../lib/svg.ts'
import { Btn } from './ui.tsx'

interface Item {
  drawing: Drawing
  pages: Page[]
}

export function PrintPreview({
  items,
  onClose,
  onPrint,
}: {
  items: Item[]
  onClose: () => void
  onPrint: () => void
}) {
  const total = items.reduce((n, it) => n + it.pages.length, 0)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-4" onClick={onClose}>
      <div
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-xl bg-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-700">
            Print preview · {total} sheet{total === 1 ? '' : 's'}
          </h2>
          <div className="flex items-center gap-3">
            <Btn onClick={onPrint}>Print</Btn>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="close">
              ✕
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4">
          {items.map((it, gi) => (
            <div key={gi} className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {it.drawing.meta.title}
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {it.pages.map((pg) => (
                  <figure key={pg.index} className="m-0">
                    <div
                      className="border border-slate-300 bg-white shadow-sm"
                      style={{ aspectRatio: `${pg.pageW} / ${pg.pageH}` }}
                      dangerouslySetInnerHTML={{ __html: renderPageSVG(it.drawing, pg, { fit: true }) }}
                    />
                    <figcaption className="mt-1 text-center text-[11px] text-slate-500">
                      sheet {pg.index + 1} / {pg.total}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
