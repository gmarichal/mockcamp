import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { projectRoutes } from './projects.js'
import { prisma } from '../../lib/prisma.js'
import { buildTestApp, signToken } from './test-helpers.js'

async function buildProjectsApp() {
  return buildTestApp(projectRoutes, '/api/projects')
}

describe('POST /api/projects', () => {
  beforeEach(() => {
    vi.mocked(prisma.project.findUnique).mockReset()
    vi.mocked(prisma.project.create).mockReset()
  })

  it('rejects a non-admin with 403', async () => {
    const app = await buildProjectsApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Payments', slug: 'payments' },
    })
    expect(res.statusCode).toBe(403)
    expect(prisma.project.create).not.toHaveBeenCalled()
  })

  it('creates a project with a unique slug as admin', async () => {
    const app = await buildProjectsApp()
    const token = signToken(app, { userId: 'u1', isAdmin: true })
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.project.create).mockResolvedValue({
      id: 'p1', name: 'Payments', slug: 'payments', description: null,
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
      _count: { paths: 0, projectRoles: 0 },
    } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Payments', slug: 'payments' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().slug).toBe('payments')
  })

  it('rejects a duplicate slug with 409', async () => {
    const app = await buildProjectsApp()
    const token = signToken(app, { userId: 'u1', isAdmin: true })
    vi.mocked(prisma.project.findUnique).mockResolvedValue({ id: 'existing' } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Payments 2', slug: 'payments' },
    })
    expect(res.statusCode).toBe(409)
    expect(prisma.project.create).not.toHaveBeenCalled()
  })

  it('rejects an invalid slug shape with 400 before touching the database', async () => {
    const app = await buildProjectsApp()
    const token = signToken(app, { userId: 'u1', isAdmin: true })
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Bad Slug', slug: 'Not A Valid Slug!' },
    })
    expect(res.statusCode).toBe(400)
    expect(prisma.project.findUnique).not.toHaveBeenCalled()
  })
})

describe('GET /api/projects', () => {
  beforeEach(() => {
    vi.mocked(prisma.project.findMany).mockReset()
  })

  it('queries without a role filter for a global admin', async () => {
    const app = await buildProjectsApp()
    const token = signToken(app, { userId: 'u1', isAdmin: true })
    vi.mocked(prisma.project.findMany).mockResolvedValue([])

    const res = await app.inject({
      method: 'GET', url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    )
  })

  it('scopes the query to the user\'s project roles for a non-admin', async () => {
    const app = await buildProjectsApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    vi.mocked(prisma.project.findMany).mockResolvedValue([])

    const res = await app.inject({
      method: 'GET', url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectRoles: { some: { userId: 'u1' } } },
      }),
    )
  })

  it('rejects an unauthenticated request with 401', async () => {
    const app = await buildProjectsApp()
    const res = await app.inject({ method: 'GET', url: '/api/projects' })
    expect(res.statusCode).toBe(401)
  })
})
