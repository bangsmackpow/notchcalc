import type { Drawing, DPoint } from './drawing.ts'
import type { Unit } from '../geometry/types.ts'
import { fromMm } from './units.ts'

/**
 * dxf-writer has no bundled types; a minimal declaration lives in
 * `src/types/dxf-writer.d.ts`.
 */
import DxfWriter from 'dxf-writer'

export interface DxfOptions {
  /** include the pattern bounding rectangle on a separate layer */
  includeBounds?: boolean
}

/**
 * Export the cut boundaries of a drawing as R12 DXF, 1:1.
 *
 * Coordinates are re-originated so the pattern's own top-left is (0, 0), with
 * y flipped to a conventional y-up CAD frame, in the caller's display unit.
 */
export function buildDxf(drawing: Drawing, unit: Unit, opts: DxfOptions = {}): string {
  const d = new DxfWriter()
  d.setUnits(unit === 'in' ? 'Inches' : 'Millimeters')
  d.addLayer('cut', DxfWriter.ACI.RED, 'CONTINUOUS')
  d.addLayer('bounds', DxfWriter.ACI.BLUE, 'DASHED')
  d.setActiveLayer('cut')

  const w = drawing.wrap
  const conv = (pts: DPoint[]): [number, number][] =>
    pts.map((p) => [fromMm(p.x - w.x, unit), fromMm(w.y + w.h - p.y, unit)] as [number, number])

  for (const path of drawing.cutPaths) {
    if (path.length >= 2) d.drawPolyline(conv(path), false)
  }

  if (opts.includeBounds !== false) {
    d.setActiveLayer('bounds')
    d.drawPolyline(
      [
        [0, 0],
        [fromMm(w.w, unit), 0],
        [fromMm(w.w, unit), fromMm(w.h, unit)],
        [0, fromMm(w.h, unit)],
      ],
      true,
    )
  }

  return d.toDxfString()
}
