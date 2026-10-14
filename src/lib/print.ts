import type { Drawing } from './drawing.ts'
import type { Page } from './layout.ts'
import { renderPrintHTML } from './svg.ts'

export interface PrintItem {
  drawing: Drawing
  pages: Page[]
}

/** Inject one or more tiled drawings into #print-area and open the print dialog. */
export function printDrawings(items: PrintItem[]): void {
  const area = document.getElementById('print-area')
  if (!area) throw new Error('#print-area element not found')
  const usable = items.filter((it) => it.pages.length > 0)
  if (usable.length === 0) return

  let style = document.getElementById('print-page-style') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'print-page-style'
    document.head.appendChild(style)
  }
  const p0 = usable[0].pages[0]
  style.textContent = `@page { size: ${p0.pageW}mm ${p0.pageH}mm; margin: 0; }`

  area.innerHTML = usable.map((it) => renderPrintHTML(it.drawing, it.pages)).join('\n')
  // Give the browser a frame to lay the sheets out before opening the dialog.
  requestAnimationFrame(() => window.print())
}

export function printDrawing(drawing: Drawing, pages: Page[]): void {
  printDrawings([{ drawing, pages }])
}
