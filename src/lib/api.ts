import type { ProjectKind, ProjectPayload, ProjectRecord, ProjectSummary } from './project.ts'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

const opts = (method: string, body?: unknown): RequestInit => ({
  method,
  credentials: 'include',
  headers: body ? { 'content-type': 'application/json' } : undefined,
  body: body ? JSON.stringify(body) : undefined,
})

export const api = {
  listProjects: () => fetch('/api/projects', opts('GET')).then(json<{ projects: ProjectSummary[] }>),
  getProject: (id: string) => fetch(`/api/projects/${id}`, opts('GET')).then(json<{ project: ProjectRecord }>),
  createProject: (input: { name: string; kind: ProjectKind; data: ProjectPayload; isPublic?: boolean }) =>
    fetch('/api/projects', opts('POST', input)).then(json<{ id: string }>),
  updateProject: (id: string, input: { name?: string; data?: ProjectPayload; isPublic?: boolean }) =>
    fetch(`/api/projects/${id}`, opts('PUT', input)).then(json<{ ok: boolean }>),
  deleteProject: (id: string) => fetch(`/api/projects/${id}`, opts('DELETE')).then(json<{ ok: boolean }>),
}
