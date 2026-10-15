# AGENTS.md — notchcalc

Overrides the workspace `../AGENTS.md` for this subtree. Prefix every shell
command with `rtk` (see the workspace file / `~/.claude/CLAUDE.md` → `RTK.md`).

Pipe/tube **notching template generator**: a React SPA (Cloudflare Pages) that
renders printable flat-pattern wraps, plus a Pages Function backend (BetterAuth
on D1). No marketing pages — just the tool.

## Commands

| Task | Command |
|---|---|
| Dev server (UI only, no `/api`) | `npm run dev` |
| Dev with auth + local D1 | `npm run dev:cf` (needs `.dev.vars`) |
| Tests | `npm test` |
| Typecheck (app + worker + scripts) | `npm run typecheck` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Sample exports + inspect | `npm run export:sample` then `npm run export:verify` |
| Deploy | `npm run deploy` |

**Quality gate — never report done without it:**

```
rtk npm run typecheck && rtk npm run lint && rtk npm test && rtk npm run build
```

`typecheck` runs **three** configs: `tsconfig.json` (app, excludes `src/server`),
`tsconfig.worker.json` (server + `functions`, workers-types), and
`tsconfig.scripts.json` (Node). A server-only type error will not be caught by
`npm run build` alone.

## Architecture

| Area | Where |
|---|---|
| Geometry (pure, mm, tested) | `src/geometry/` — `joint.ts` (notch), `miter.ts`, `hole.ts`, `index.ts` (`generate`) |
| Drawing primitives + annotation + band stacking | `src/lib/drawing.ts` |
| Tiling / paper | `src/lib/layout.ts` |
| Renderers | `src/lib/svg.ts`, `pdf.ts`, `dxf.ts`, `print.ts` |
| UI | `src/components/` (+ `App.tsx`) |
| 3D editor | `src/components/Scene.tsx`, `Assembly.tsx`, `src/assembly/` |
| State | zustand in `src/state/` and `src/assembly/store.ts` |
| Backend (server-only) | `src/server/` + `functions/api/[[route]].ts` |
| DB bootstrap | `src/server/schema.ts` (`ensureSchema`) |

Conventions:
- **Millimetres everywhere internally**; convert only at the UI boundary
  (`src/lib/units.ts`). `JointSpec` and `Template` are mm.
- Geometry is pure and unit-tested — add tests for any math change.
- Draw via the `Prim` model in `drawing.ts`; don't hand-roll SVG strings
  elsewhere (SVG/PDF/DXF all consume `Drawing`).
- `src/server/*` must not import DOM code; `src/*` must not import `src/server`.
- Sparse comments — only for non-obvious gotchas (matches existing style).

## Backend / Cloudflare

- Pages config + D1 binding: `wrangler.jsonc` (`DB` → `notchcalc`).
- Secrets live in the dashboard (and `.dev.vars` locally, gitignored).
  **Env changes require a redeploy** before Functions see them.
- New app tables go in `APP_STATEMENTS` in `src/server/schema.ts`; the bootstrap
  is idempotent and runs on the first `/api` request per isolate.
- `/api/health` reports which config is present — check it when auth misbehaves.
- Email sends are recorded in `mail_log`; **Pages Function logs are not exposed
  via the observability API**, so `mail_log` is the way to diagnose delivery.

## Gotchas (learned the hard way)

1. **D1 `exec()` splits its input on newlines** — a multi-line statement is
   chopped and the whole call fails silently. Use `DB.batch()` over
   single-line prepared statements (see `schema.ts`).
2. **BetterAuth endpoint paths are not the obvious names.** The reset endpoint
   is `/request-password-reset`, **not** `/forget-password`. Client methods:
   `authClient.requestPasswordReset`, `authClient.resetPassword`,
   `authClient.twoFactor.verifyTotp`, `authClient.sendVerificationEmail`.
   Verify paths against `node_modules/better-auth/dist/**` before wiring them.
3. **`emailVerification.sendOnSignUp` is required**, or sign-up creates the user
   and sends nothing.
4. **`twoFactor({ allowPasswordless: true })`** — otherwise Google-only accounts
   cannot enable 2FA (no local password to confirm).
5. **Await email sends.** A floating promise is cancelled when the Worker
   response returns; `sendEmail` is awaited inside the auth callbacks.
6. **2FA challenge only covers email/username sign-in.** Social (Google)
   callbacks are not challenged — see README "Known limitations".
7. **D1 columns from BetterAuth are camelCase** (`"user"."emailVerified"`,
   quoted because `user` is reserved).
8. **Printing:** `#print-area` must stay a direct child of `<body>` (it is
   rendered through a portal); the print CSS hides `.app-shell` only. `@page`
   size comes from the first sheet, so multi-document prints share one
   orientation (`sharedOrientation`).
9. **Miter convention:** the slider is the angle between tube axes, so the cut
   is `90° − angle/2` (`miterForJointAngle`).
10. **Scripts** (`scripts/*.ts`) run via Node's type stripping — plain
    `node scripts/x.ts`, no build step.
11. `qrcode` resolves to its browser build via Vite (a separate chunk); keep it
    dynamically imported so it stays out of the main bundle.

## Commits

Conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`) with the
co-author trailer:

```
Co-Authored-By: <agent model> <noreply@example.com>
```

Only commit when asked. Never commit `.dev.vars` or any secret.
