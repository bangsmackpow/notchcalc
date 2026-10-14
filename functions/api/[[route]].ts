import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { createAuth, type Auth } from '../../src/server/auth.ts'
import { projectRoutes } from '../../src/server/projects.ts'
import { ensureSchema } from '../../src/server/schema.ts'
import type { Env } from '../../src/server/env.ts'

const app = new Hono<{ Bindings: Env; Variables: { auth: Auth } }>()

app.use('*', async (c, next) => {
  await ensureSchema(c.env)
  c.set('auth', createAuth(c.env, new URL(c.req.url).origin))
  await next()
})

app.get('/api/health', (c) => c.json({ ok: true }))
app.on(['POST', 'GET'], '/api/auth/*', (c) => c.get('auth').handler(c.req.raw))
app.route('/api', projectRoutes)

export const onRequest = handle(app)
