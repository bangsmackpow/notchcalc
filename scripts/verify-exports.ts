import { readFileSync, readdirSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'

for (const f of readdirSync('tmp').sort()) {
  const p = `tmp/${f}`
  const buf = readFileSync(p)
  if (f.endsWith('.pdf')) {
    const doc = await PDFDocument.load(buf)
    const pages = doc.getPages()
    const size = `${pages[0].getWidth().toFixed(0)}x${pages[0].getHeight().toFixed(0)}pt`
    console.log(f.padEnd(26), `pages=${pages.length}`, `page0=${size}`, `bytes=${buf.length}`)
  } else if (f.endsWith('.dxf')) {
    const s = buf.toString('utf8')
    const segs = s.split('LWPOLYLINE').slice(1)
    const verts = segs.map((seg) => (seg.match(/(^|\n)10\n/g) ?? []).length)
    console.log(
      f.padEnd(26),
      `LWPOLYLINE=${segs.length}`,
      `verts=[${verts.join(',')}]`,
      `INSUNITS=${/INSUNITS/.test(s)}`,
      `EOF=${s.trimEnd().endsWith('EOF')}`,
      `bytes=${buf.length}`,
    )
  } else if (f.endsWith('.svg')) {
    const s = buf.toString('utf8')
    console.log(
      f.padEnd(26),
      `svg=${s.startsWith('<svg') && s.trimEnd().endsWith('</svg>')}`,
      `polyline=${(s.match(/<polyline/g) ?? []).length}`,
      `polygon=${(s.match(/<polygon/g) ?? []).length}`,
      `text=${(s.match(/<text/g) ?? []).length}`,
      `bytes=${buf.length}`,
    )
  }
}
