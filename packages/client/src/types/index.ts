export type Project = {
  id: string
  name: string
  slug: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: { paths: number; projectRoles: number }
}

export type Path = {
  id: string
  name: string
  path: string
  projectId: string
  parentId: string | null
  order: number
  createdAt: string
  _count: { resources: number }
}

export type PathNode = Path & { children: PathNode[] }
