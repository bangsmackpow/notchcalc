# notchcalc

Generate printable **pipe & tube notching templates** in the browser. Pick two
pipes (or a pipe and an angle), and get a correct flat-pattern "fishmouth" wrap
you can print, cut out, wrap around the tube, and grind to — no notcher, no CAD.

This is the tool behind the marketing: **any OD up to 4", any angle 5°–175°, any
intersection**, tile-printed onto normal paper.

## Features (Phase 1)

- **Joint types:** same-diameter notch, unequal-diameter notch, offset /
  eccentric branch, straight miter / angle cut, header hole template.
- **Continuous angle** 5°–175° (slider).
- **Offsets:** in-plane and perpendicular (eccentric branches).
- **Pass-through** branches (near + far wall).
- **Units:** inch / mm toggle.
- **Standard size picker** (tube OD, NPS Sch-40 pipe OD, metric) plus custom OD.
- **Tiled printing** on Letter, Legal, A4, A3 with crop marks, overlap guides
  and a per-sheet 100 mm calibration bar.
- **Exports:** browser print, PDF (exact size), DXF 1:1 (CNC/plasma), SVG.
- **Template extras:** ruler grid, degree/rotation ruler, centerline, glue tab,
  micro length-adjust window, part labels.

## Geometry

The engine is pure TypeScript (`src/geometry`), unit-tested with Vitest. The
branch notch develops the closed-form cylinder↔cylinder intersection:

```
cut(φ) = [ −(d₁ + r·cosφ)·cosθ + √(R² − (d₂ + r·sinφ)²) ] / sinθ
```

- `r`, `R` — branch / header radii, `θ` — angle between centre lines.
- `d₁`, `d₂` — in-plane / perpendicular offsets.
- A miter is the `R → ∞` (plane) case; the header hole is the same solve
  developed on the header surface.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # vitest (geometry + renderers)
npm run typecheck  # tsc --noEmit
npm run lint       # oxlint
npm run build      # production build -> dist/
```

### Project layout

```
src/
  geometry/        pure math + tests (mm throughout)
  lib/
    units.ts       unit conversion + formatting
    sizes.ts       standard OD presets
    drawing.ts     drawing primitives + template annotations
    layout.ts      paper sizes + tiling
    svg.ts         SVG preview + print sheets
    pdf.ts         exact-size PDF (pdf-lib)
    dxf.ts         DXF export (dxf-writer)
    print.ts       browser print
  App.tsx          UI
```

## Roadmap

- **Phase 1 (done):** engine + all joint types + tiled print/PDF/DXF/UI.
- **Phase 2:** 3D drag-and-drop assembly editor (react-three-fiber), joint
  auto-detection, assembly-wide export.
- **Phase 3:** accounts (BetterAuth on Cloudflare D1 — email/password + Google
  OAuth + optional TOTP MFA), saved projects, R2 assets.

## Hosting

Static SPA; deploy to **Cloudflare Pages** connected to this GitHub repo
(autobuild on push). Phase 3 adds Pages Functions + D1 + R2.
