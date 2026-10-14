import { Hono } from 'hono'
import type { Context } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { createAuth, type Auth } from '../../src/server/auth.ts'
import { projectRoutes } from '../../src/server/projects.ts'
import { ensureSchema } from '../../src/server/schema.ts'
import type { Env } from '../../src/server/env.ts'

type AppEnv = { Bindings: Env; Variables: { auth: Auth | null } }

const app = new Hono<AppEnv>()

// Diagnostics: never depends on auth initialising, so it can report misconfig.
app.get('/api/health', (c) =>
  c.json({
    ok: true,
    db: !!c.env.DB,
    authSecret: !!c.env.BETTER_AUTH_SECRET,
    google: !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
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

const authRoute = (c: Context<AppEnv>): Response | Promise<Response> => {
  const auth = c.get('auth')
  if (!auth) return c.json({ error: 'auth not configured' }, 503)
  return auth.handler(c.req.raw)
}

app.get('/api/auth/*', authRoute)
app.post('/api/auth/*', authRoute)

app.route('/api', projectRoutes)

export const onRequest = handle(app)
