import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env } from './env.ts'
import type { Auth } from './auth.ts'

type AppEnv = { Bindings: Env; Variables: { auth: Auth | null } }
type Ctx = Context<AppEnv>

interface ProjectRow {
  id: string
  user_id: string
  name: string
  kind: string
  data: string
  is_public: number
  created_at: number
  updated_at: number
}

const MAX_DATA = 512 * 1024

export const projectRoutes = new Hono<AppEnv>()

async function currentUser(c: Ctx) {
  const auth = c.get('auth')
  if (!auth) return null
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  return session?.user ?? null
}

function summary(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    isPublic: !!row.is_public,
    updatedAt: row.updated_at,
  }
}

function full(row: ProjectRow, isOwner: boolean) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    data: JSON.parse(row.data),
    isPublic: !!row.is_public,
    isOwner,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

projectRoutes.get('/projects', async (c) => {
  const u = await currentUser(c)
  if (!u) return c.json({ error: 'unauthorized' }, 401)
  const { results } = await c.env.DB.prepare(
    'SELECT id, user_id, name, kind, data, is_public, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200',
  )
    .bind(u.id)
    .all<ProjectRow>()
  return c.json({ projects: (results ?? []).map(summary) })
})

projectRoutes.post('/projects', async (c) => {
  const u = await currentUser(c)
  if (!u) return c.json({ error: 'unauthorized' }, 401)
  const body = await c.req.json<{ name?: string; kind?: string; data?: unknown; isPublic?: boolean }>()
  if (!body?.kind || body.data === undefined) return c.json({ error: 'kind and data required' }, 400)
  const data = JSON.stringify(body.data)
  if (data.length > MAX_DATA) return c.json({ error: 'project too large' }, 413)

  const id = crypto.randomUUID()
  const now = Date.now()
  await c.env.DB.prepare(
    'INSERT INTO projects (id, user_id, name, kind, data, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, u.id, (body.name || 'Untitled').slice(0, 120), body.kind, data, body.isPublic ? 1 : 0, now, now)
    .run()

  return c.json({ id })
})

projectRoutes.get('/projects/:id', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>()
  if (!row) return c.json({ error: 'not found' }, 404)
  const u = await currentUser(c)
  const isOwner = !!u && u.id === row.user_id
  if (!row.is_public && !isOwner) return c.json({ error: 'forbidden' }, 403)
  return c.json({ project: full(row, isOwner) })
})

projectRoutes.put('/projects/:id', async (c) => {
  const u = await currentUser(c)
  if (!u) return c.json({ error: 'unauthorized' }, 401)
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>()
  if (!row) return c.json({ error: 'not found' }, 404)
  if (row.user_id !== u.id) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json<{ name?: string; data?: unknown; isPublic?: boolean }>()
  const data = body.data === undefined ? row.data : JSON.stringify(body.data)
  if (data.length > MAX_DATA) return c.json({ error: 'project too large' }, 413)

  await c.env.DB.prepare('UPDATE projects SET name = ?, data = ?, is_public = ?, updated_at = ? WHERE id = ?')
    .bind((body.name ?? row.name).slice(0, 120), data, body.isPublic === undefined ? row.is_public : body.isPublic ? 1 : 0, Date.now(), id)
    .run()
  return c.json({ ok: true })
})

projectRoutes.delete('/projects/:id', async (c) => {
  const u = await currentUser(c)
  if (!u) return c.json({ error: 'unauthorized' }, 401)
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').bind(id, u.id).run()
  return c.json({ ok: true })
})
