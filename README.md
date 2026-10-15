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

Generate sample PDF/DXF/SVG files into `tmp/` and check them:

```bash
npm run export:sample    # writes tmp/<case>.pdf|.dxf|.svg
npm run export:verify    # reports page counts, DXF polyline vertex counts, etc.
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

## Accounts, saving & sharing (Phase 3+)

- **Auth:** [BetterAuth](https://better-auth.com) on Cloudflare **D1** —
  email/password + optional **Google** sign-in + optional **TOTP 2FA** (QR code).
- **Rate limiting:** enabled (database-backed) — tight limits on email
  sign-in/sign-up endpoints.
- **Email verification:** set `RESEND_API_KEY` (+ optional `MAIL_FROM`) and
  sign-ups get a verification link; **without** the key, accounts are
  auto-verified so dev/demo never dead-ends.
- **Password reset:** "Forgot password?" emails a 1-hour link (Resend) that
  returns to the app (`/?token=…`) to set a new password; other sessions are
  revoked. Works for Google-only accounts too (they gain a local password).
  Every send is recorded in the `mail_log` table with the Resend status.
- **Invite-only mode:** set `INVITE_ONLY=true` — sign-ups then need a code
  (logged-in users copy invite links from the account menu; one account per code).
- **Projects:** save/load single joints and 3D assemblies per user; toggle a
  project public to get a share link (`/?p=<id>`) that loads it read-only.
- **Backend:** a single Pages Function (`functions/api/[[route]].ts`, Hono)
  serving `/api/auth/*` (BetterAuth), `/api/invites`, `/api/projects` (CRUD)
  and `/api/health` diagnostics. Auth tables are created automatically on first
  request; `projects` + `invites` by the same bootstrap.

### Local development (with auth)

```bash
cp .dev.vars.example .dev.vars   # then edit BETTER_AUTH_SECRET
npm run dev:cf                   # build + wrangler pages dev dist
```

### Deploy to Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Connect to Git**
   → pick this repo.
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Env var: `NODE_VERSION = 22`
2. Bindings come from `wrangler.jsonc` (D1 `DB` → `notchcalc`).
3. Add secrets (Settings → Environment variables, encrypted):
   - `BETTER_AUTH_SECRET` — long random string (**required**)
   - `BETTER_AUTH_URL` — your Pages URL (e.g. `https://notchcalc.pages.dev`)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional, for Google sign-in.
     Redirect URI: `https://<your-domain>/api/auth/callback/google`.
4. Open the site once — the schema self-provisions on the first `/api` request.

CLI alternative: `npm run deploy` (after `wrangler login`).

## Roadmap

- **Phase 1 (done):** engine + all joint types + tiled print/PDF/DXF/UI.
- **Phase 2 (done):** 3D drag-and-drop assembly editor + assembly-wide export.
- **Phase 3 (done):** BetterAuth (email/password + Google + TOTP) on D1, saved
  projects, share links.
- **Next:** QR code for 2FA enrolment, R2-backed project thumbnails,
  snap-to-angle handles in the 3D editor.
