import { useCallback, useEffect, useState } from 'react'
import type { ProjectKind, ProjectPayload, ProjectSummary } from '../lib/project.ts'
import { api } from '../lib/api.ts'
import { useSession } from '../lib/auth-client.ts'
import { Btn, Card } from './ui.tsx'

export function ProjectsPanel({
  kind,
  buildPayload,
  apply,
}: {
  kind: ProjectKind
  buildPayload: () => ProjectPayload
  apply: (p: ProjectPayload) => void
}) {
  const { data: session } = useSession()
  const [items, setItems] = useState<ProjectSummary[]>([])
  const [name, setName] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const refresh = useCallback(async () => {
    if (!session) {
      setItems([])
      return
    }
    try {
      const r = await api.listProjects()
      setItems(r.projects.filter((p) => p.kind === kind))
    } catch {
      /* ignore */
    }
  }, [session, kind])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!session) {
    return (
      <Card title="Projects">
        <p className="text-sm text-slate-400">Sign in to save, load and share projects.</p>
      </Card>
    )
  }

  const save = async () => {
    setBusy(true)
    setMsg('')
    try {
      const payload = buildPayload()
      const nm = name.trim() || 'Untitled'
      if (currentId) {
        await api.updateProject(currentId, { name: nm, data: payload })
      } else {
        const { id } = await api.createProject({ name: nm, kind, data: payload })
        setCurrentId(id)
      }
      setMsg('Saved')
      await refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'save failed')
    } finally {
      setBusy(false)
    }
  }

  const load = async (id: string) => {
    setMsg('')
    try {
      const { project } = await api.getProject(id)
      apply(project.data)
      setCurrentId(project.id)
      setName(project.name)
      setMsg('Loaded')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'load failed')
    }
  }

  const remove = async (id: string) => {
    try {
      await api.deleteProject(id)
      if (currentId === id) setCurrentId(null)
      await refresh()
    } catch {
      /* ignore */
    }
  }

  const toggleShare = async (p: ProjectSummary) => {
    try {
      await api.updateProject(p.id, { isPublic: !p.isPublic })
      await refresh()
    } catch {
      /* ignore */
    }
  }

  return (
    <Card title="Projects">
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={currentId ? 'Project name' : 'New project name'}
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400"
          />
          <Btn onClick={save} disabled={busy}>
            {busy ? '…' : currentId ? 'Update' : 'Save'}
          </Btn>
        </div>
        {msg && <p className="text-xs text-slate-500">{msg}</p>}

        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No saved projects yet.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((p) => (
              <li key={p.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-slate-100">
                <button className="min-w-0 flex-1 truncate text-left text-sm" onClick={() => load(p.id)} title="load">
                  {p.name}
                </button>
                <button
                  className={`rounded px-1 text-xs ${p.isPublic ? 'text-green-700' : 'text-slate-400'}`}
                  onClick={() => toggleShare(p)}
                  title={p.isPublic ? 'Make private' : 'Make public / shareable'}
                >
                  {p.isPublic ? 'public' : 'private'}
                </button>
                {p.isPublic && (
                  <button
                    className="rounded px-1 text-xs text-slate-400 hover:text-slate-700"
                    onClick={() => navigator.clipboard.writeText(`${location.origin}/?p=${p.id}`)}
                    title="copy share link"
                  >
                    link
                  </button>
                )}
                <button
                  className="rounded px-1 text-xs text-slate-400 hover:text-red-600"
                  onClick={() => remove(p.id)}
                  title="delete"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
