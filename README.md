# notchcalc

Generate printable **pipe & tube notching templates** in the browser. Build a
joint (or a whole 3D assembly), and get correct flat-pattern "fishmouth" wraps
you can print, cut out, wrap around the tube, and grind to — no notcher, no CAD.

**Any OD up to 4", any angle 5°–175°, any intersection**, tile-printed onto
normal paper.

## Features

**Single joint**
- Joint types: same-diameter notch, unequal-diameter notch, offset / eccentric
  branch, straight miter / angle cut, and header hole (a through-branch emits
  both the saddle and the hole as one stacked sheet).
- Continuous angle 5°–175°; in-plane and perpendicular offsets; pass-through
  branches (near + far wall).

**3D assembly editor**
- Drag tubes onto a header, drag them along it; connections can be **notch**,
  **miter elbow**, or **header hole**; per-connection OD, angle, roll, offsets.
- Live 3D preview (react-three-fiber) with a joint inspector, and
  assembly-wide **Print all / PDF all / DXF all**.

**Output**
- Tiled printing on Letter, Legal, A4, A3 with crop marks, overlap guides, glue
  flap and a per-sheet **100 mm calibration bar** (verify before cutting metal).
- In-app **print preview** (scaled sheet grid + page count).
- Exports: browser print, **PDF** (exact size, `pdf-lib`), **DXF 1:1**
  (`LWPOLYLINE`, for CNC/plasma), **SVG**.

**Input**
- Inch / mm toggle; standard size presets (tube OD, NPS Sch-40 pipe OD, metric)
  plus custom OD.

**Accounts & projects**
- Email/password + optional Google sign-in, optional TOTP 2FA (QR), email
  verification, password reset, invite-only mode, rate limiting.
- Save/load single joints and assemblies; make a project public to get a
  read-only share link (`/?p=<id>`).

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
- **Miter convention:** the slider is the angle between the two tube axes, so
  the cut is `90° − angle/2` (90° = elbow ⇒ 45° each end; 175° ⇒ nearly
  straight). `miterForJointAngle` handles this.

All lengths are **millimetres internally**; convert only at the UI boundary
(`src/lib/units.ts`).

## Development

```bash
npm install
npm run dev         # Vite dev server (UI only — no /api; see dev:cf)
npm run dev:cf      # build + wrangler pages dev dist  (needs .dev.vars)
npm test            # vitest
npm run typecheck   # tsc for app + worker + scripts configs
npm run lint        # oxlint
npm run build       # tsc + vite build -> dist/
npm run deploy      # wrangler pages deploy dist
```

Generate real exports and inspect them (useful when touching geometry or
renderers):

```bash
npm run export:sample    # writes tmp/<case>.pdf|.dxf|.svg
npm run export:verify    # page counts, DXF polyline vertex counts, sizes
```

Auth and the database only exist under `dev:cf` (Pages Functions + a local D1);
plain `npm run dev` has no `/api`.

### Project layout

```
src/
  geometry/        pure math (mm) + tests: joint.ts, miter.ts, hole.ts, index.ts
  lib/
    units.ts       unit conversion + formatting
    sizes.ts       standard OD presets
    drawing.ts     drawing primitives + template annotation + band stacking
    layout.ts      paper sizes + tiling + shared orientation
    svg.ts         SVG preview + per-sheet print rendering
    pdf.ts         exact-size PDF (pdf-lib)
    dxf.ts         DXF export (dxf-writer)
    print.ts       browser print (tiled sheets)
    project.ts     shared project payload types
    api.ts         client API calls
    auth-client.ts BetterAuth client
  assembly/        assembly model + zustand store
  state/           zustand stores (settings, single-joint)
  components/      UI (Assembly, Scene, TemplatePanel, AuthDialog, …)
  server/          server-only: auth.ts, projects.ts, invites, email.ts,
                   schema.ts, env.ts   (excluded from the app tsconfig)
functions/api/[[route]].ts   Cloudflare Pages Function (Hono)
scripts/           export-sample / verify-exports (run via Node type-stripping)
public/            _headers, _redirects, favicon
wrangler.jsonc     Pages config + D1 binding
```

## Accounts & backend

- **Auth:** [BetterAuth](https://better-auth.com) on Cloudflare **D1**.
- **Rate limiting:** database-backed; tight rules on `/sign-in/email`,
  `/sign-up/email`, `/request-password-reset`.
- **Email:** Resend. Verification emails are sent on sign-up (`sendOnSignUp`);
  password reset emails use a 1-hour token and revoke other sessions. Without
  `RESEND_API_KEY`, accounts auto-verify (dev/demo) and no mail is sent.
- **Delivery log:** every send is recorded in the `mail_log` table
  (email, kind, ok, Resend status, error detail) — Pages Function logs are not
  exposed via the observability API, so this is the diagnostic path.
- **Invite-only:** `INVITE_ONLY=true` gates sign-ups behind one-time codes;
  signed-in users copy invite links (`/?invite=<code>`) from the account menu.
- **Backend:** one Pages Function (`functions/api/[[route]].ts`, Hono) serving
  `/api/auth/*` (BetterAuth), `/api/projects` (CRUD), `/api/invites`, and
  `/api/health` (config diagnostics).

Tables are created automatically on the first `/api` request: BetterAuth's
(`user`, `session`, `account`, `verification`, `twoFactor`, `rateLimit`) plus
app tables `projects`, `invites`, `mail_log`.

### Local development (with auth)

```bash
cp .dev.vars.example .dev.vars   # then set BETTER_AUTH_SECRET
npm run dev:cf
```

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `BETTER_AUTH_SECRET` | **yes** | signs sessions/tokens; auth fails without it |
| `BETTER_AUTH_URL` | recommended | canonical origin (trailing slashes are stripped) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google sign-in |
| `RESEND_API_KEY` | optional | enables verification + password-reset emails |
| `MAIL_FROM` | optional | From header for Resend (verified domain) |
| `INVITE_ONLY` | optional | `"true"` = invite-only sign-ups |
| `NODE_VERSION` | build | `22` on Cloudflare Pages |

## Deploy to Cloudflare Pages

1. Dashboard → Workers & Pages → Create → Pages → **Connect to Git** → pick the
   repo. Build command `npm run build`, output `dist`, env `NODE_VERSION=22`.
2. Bindings come from `wrangler.jsonc` (D1 `DB` → `notchcalc`,
   `9a857509-06e9-47e8-af04-1bde04613a25`).
3. Add the variables above under Settings → Environment variables (secrets
   encrypted). **Env changes need a redeploy** to reach the Functions.
4. Open the site once so the schema self-provisions.
5. Check `https://<domain>/api/health` — it reports which config is present.

CI (`.github/workflows/ci.yml`) runs typecheck + lint + test + build on push/PR;
Pages rebuilds on every push to `main`.

## Known limitations

- **Google sign-ins are not challenged for TOTP** — BetterAuth only challenges
  email/username sign-in paths, so 2FA protects password logins; a Google
  account relies on Google's own 2FA.
- **Email verification is soft:** unverified users can still sign in (a banner
  nudges them) and the projects API does not require verification.
- **Invite-only applies to email sign-ups**; Google sign-up bypasses it.
- **CSP is Report-Only** (`public/_headers`) — flip to `Content-Security-Policy`
  once the reports look clean.
- The assembly is one header plus connections (notch / elbow / hole) — not a
  general free-form tube graph.
- Print at **100% / actual size** (never "fit to page"). A multi-document print
  uses one shared orientation, so every sheet matches the `@page` size.

## Roadmap

- **Done:** geometry engine + all joint types; 3D assembly editor; tiled
  print/PDF/DXF/SVG + preview; accounts (email/Google/2FA/verification/reset/
  invites/rate limiting); projects + share links; CI.
- **Next:** enforce 2FA for social sign-ins (custom hook or endpoint gating);
  hard email verification; R2-backed project thumbnails; snap-to-angle handles
  and duplicate-branch in the editor; multi-header assemblies.
