import { getMigrations } from 'better-auth/db/migration'
import { createAuth } from './auth.ts'
import type { Env } from './env.ts'

/** Idempotent, memoized-per-isolate schema bootstrap. */
let ready: Promise<void> | null = null

export function ensureSchema(env: Env): Promise<void> {
  if (!ready) {
    ready = run(env).catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}

async function run(env: Env): Promise<void> {
  const auth = createAuth(env, env.BETTER_AUTH_URL ?? 'http://localhost:8788')
  const { runMigrations } = await getMigrations(auth.options)
  await runMigrations()
  await env.DB.exec(APP_SQL)
}

const APP_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  data TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_user_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_public_idx ON projects(is_public);
`
