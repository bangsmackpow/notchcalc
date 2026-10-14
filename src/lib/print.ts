import type { Drawing } from './drawing.ts'
import type { Page } from './layout.ts'
import { renderPrintHTML } from './svg.ts'

/** Inject the tiled sheets into #print-area and open the browser print dialog. */
export function printDrawing(drawing: Drawing, pages: Page[]): void {
  const area = document.getElementById('print-area')
  if (!area) throw new Error('#print-area element not found')
  if (pages.length === 0) return

  let style = document.getElementById('print-page-style') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'print-page-style'
    document.head.appendChild(style)
  }
  const p0 = pages[0]
  style.textContent = `@page { size: ${p0.pageW}mm ${p0.pageH}mm; margin: 0; }`

  area.innerHTML = renderPrintHTML(drawing, pages)
  window.print()
}
