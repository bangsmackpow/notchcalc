import { Hono } from 'hono'
import type { Context } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { createAuth, type Auth } from '../../src/server/auth.ts'
import { projectRoutes } from '../../src/server/projects.ts'
import { ensureSchema } from '../../src/server/schema.ts'
import { isEmailVerificationOn, isInviteOnly, type Env } from '../../src/server/env.ts'

type AppEnv = { Bindings: Env; Variables: { auth: Auth | null } }

const app = new Hono<AppEnv>()

// Diagnostics: never depends on auth initialising, so it can report misconfig.
app.get('/api/health', (c) =>
  c.json({
    ok: true,
    db: !!c.env.DB,
    authSecret: !!c.env.BETTER_AUTH_SECRET,
    google: !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
    emailVerification: isEmailVerificationOn(c.env),
    inviteOnly: isInviteOnly(c.env),
    baseURL: c.env.BETTER_AUTH_URL ?? new URL(c.req.url).origin,
  }),
)

app.use('*', async (c, next) => {
  try {
    await ensureSchema(c.env)
  } catch (e) {
    console.error('schema bootstrap failed:', e)
  }
  let auth: Auth | null = null
  try {
    auth = createAuth(c.env, new URL(c.req.url).origin)
  } catch (e) {
    console.error('auth init failed:', e)
  }
  c.set('auth', auth)
  await next()
})

async function currentUser(c: Context<AppEnv>) {
  const auth = c.get('auth')
  if (!auth) return null
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  return session?.user ?? null
}

// Invite-only gate around sign-ups. Client passes the code as ?i=<code>.
app.post('/api/auth/sign-up/email', async (c) => {
  const auth = c.get('auth')
  if (!auth) return c.json({ message: 'auth not configured' }, 503)
  const invite = new URL(c.req.url).searchParams.get('i')

  if (isInviteOnly(c.env)) {
    if (!invite) return c.json({ message: 'This instance is invite-only — an invite code is required.' }, 403)
    const row = await c.env.DB.prepare('SELECT used_by FROM invites WHERE code = ?').bind(invite).first<{ used_by: string | null }>()
    if (!row) return c.json({ message: 'Invalid invite code.' }, 403)
    if (row.used_by) return c.json({ message: 'That invite code was already used.' }, 403)
  }

  const res = await auth.handler(c.req.raw)

  if (invite && isInviteOnly(c.env) && res.status === 200) {
    try {
      const body = (await res.clone().json()) as { user?: { id?: string } }
      if (body?.user?.id) {
        await c.env.DB.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?')
          .bind(body.user.id, Date.now(), invite)
          .run()
      }
    } catch {
      /* non-JSON response; nothing to claim */
    }
  }
  return res
})

// Invite codes (signed-in users).
app.get('/api/invites', async (c) => {
  const u = await currentUser(c)
  if (!u) return c.json({ error: 'unauthorized' }, 401)
  const { results } = await c.env.DB.prepare(
    'SELECT code, used_by, created_at FROM invites WHERE created_by = ? ORDER BY created_at DESC LIMIT 100',
  )
    .bind(u.id)
    .all<{ code: string; used_by: string | null; created_at: number }>()
  return c.json({ invites: (results ?? []).map((r) => ({ code: r.code, used: !!r.used_by, createdAt: r.created_at })) })
})

app.post('/api/invites', async (c) => {
  const u = await currentUser(c)
  if (!u) return c.json({ error: 'unauthorized' }, 401)
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  await c.env.DB.prepare('INSERT INTO invites (code, created_by, created_at) VALUES (?, ?, ?)').bind(code, u.id, Date.now()).run()
  return c.json({ code })
})

const authRoute = (c: Context<AppEnv>): Response | Promise<Response> => {
  const auth = c.get('auth')
  if (!auth) return c.json({ error: 'auth not configured' }, 503)
  return auth.handler(c.req.raw)
}

app.get('/api/auth/*', authRoute)
app.post('/api/auth/*', authRoute)

app.route('/api', projectRoutes)

export const onRequest = handle(app)
