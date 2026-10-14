import type { JointSpec } from '../geometry/index.ts'
import type { Assembly } from '../assembly/model.ts'

export type ProjectKind = 'single' | 'assembly'

export type ProjectPayload =
  | { kind: 'single'; spec: JointSpec }
  | { kind: 'assembly'; assembly: Assembly }

export interface ProjectRecord {
  id: string
  name: string
  kind: ProjectKind
  data: ProjectPayload
  isPublic: boolean
  createdAt: number
  updatedAt: number
}

export interface ProjectSummary {
  id: string
  name: string
  kind: ProjectKind
  isPublic: boolean
  updatedAt: number
}
