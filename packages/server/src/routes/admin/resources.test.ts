import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    projectRole: { findUnique: vi.fn() },
    path: { findFirst: vi.fn() },
    resource: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { resourceRoutes } from './resources.js'
import { prisma } from '../../lib/prisma.js'
import { buildTestApp, signToken } from './test-helpers.js'

async function buildResourcesApp() {
  return buildTestApp(resourceRoutes, '/api/projects')
}

const BASE = '/api/projects/p1/paths/path1/resources'

describe('GET .../resources', () => {
  beforeEach(() => {
    vi.mocked(prisma.projectRole.findUnique).mockReset()
    vi.mocked(prisma.path.findFirst).mockReset()
    vi.mocked(prisma.resource.findMany).mockReset()
  })

  it('rejects a user with no role on the project with 403', async () => {
    const app = await buildResourcesApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue(null)

    const res = await app.inject({ method: 'GET', url: BASE, headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(403)
  })

  it('allows a TESTER to list resources', async () => {
    const app = await buildResourcesApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'TESTER' } as never)
    vi.mocked(prisma.path.findFirst).mockResolvedValue({ id: 'path1' } as never)
    vi.mocked(prisma.resource.findMany).mockResolvedValue([])

    const res = await app.inject({ method: 'GET', url: BASE, headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
  })

  it('rejects with 404 when the path belongs to a different project', async () => {
    const app = await buildResourcesApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'TESTER' } as never)
    vi.mocked(prisma.path.findFirst).mockResolvedValue(null)

    const res = await app.inject({ method: 'GET', url: BASE, headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(404)
    expect(prisma.resource.findMany).not.toHaveBeenCalled()
  })
})

describe('POST .../resources', () => {
  beforeEach(() => {
    vi.mocked(prisma.projectRole.findUnique).mockReset()
    vi.mocked(prisma.path.findFirst).mockReset()
    vi.mocked(prisma.resource.create).mockReset()
  })

  it('allows a TESTER to create a resource (requireProjectAccess, not admin-only)', async () => {
    const app = await buildResourcesApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'TESTER' } as never)
    vi.mocked(prisma.path.findFirst).mockResolvedValue({ id: 'path1' } as never)
    vi.mocked(prisma.resource.create).mockResolvedValue({ id: 'r1', method: 'GET' } as never)

    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${token}` },
      payload: { method: 'GET' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('rejects with 404 when the path belongs to a different project', async () => {
    const app = await buildResourcesApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'TESTER' } as never)
    vi.mocked(prisma.path.findFirst).mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST', url: BASE,
      headers: { authorization: `Bearer ${token}` },
      payload: { method: 'GET' },
    })
    expect(res.statusCode).toBe(404)
    expect(prisma.resource.create).not.toHaveBeenCalled()
  })
})

describe('PATCH .../resources/:resourceId', () => {
  beforeEach(() => {
    vi.mocked(prisma.projectRole.findUnique).mockReset()
    vi.mocked(prisma.resource.findFirst).mockReset()
  })

  it('rejects with 404 when the resource belongs to a different project (IDOR guard)', async () => {
    const app = await buildResourcesApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'TESTER' } as never)
    vi.mocked(prisma.resource.findFirst).mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH', url: `${BASE}/r1`,
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: false },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE .../resources/:resourceId', () => {
  beforeEach(() => {
    vi.mocked(prisma.projectRole.findUnique).mockReset()
    vi.mocked(prisma.resource.findFirst).mockReset()
    vi.mocked(prisma.resource.delete).mockReset()
  })

  it('rejects a TESTER with 403 (requireProjectAdmin)', async () => {
    const app = await buildResourcesApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'TESTER' } as never)

    const res = await app.inject({
      method: 'DELETE', url: `${BASE}/r1`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(prisma.resource.delete).not.toHaveBeenCalled()
  })

  it('allows a PROJECT_ADMIN to delete', async () => {
    const app = await buildResourcesApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'PROJECT_ADMIN' } as never)
    vi.mocked(prisma.resource.findFirst).mockResolvedValue({ id: 'r1' } as never)
    vi.mocked(prisma.resource.delete).mockResolvedValue({} as never)

    const res = await app.inject({
      method: 'DELETE', url: `${BASE}/r1`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(204)
  })

  it('rejects with 404 when the resource belongs to a different project (IDOR guard)', async () => {
    const app = await buildResourcesApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'PROJECT_ADMIN' } as never)
    vi.mocked(prisma.resource.findFirst).mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE', url: `${BASE}/r1`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    expect(prisma.resource.delete).not.toHaveBeenCalled()
  })
})
