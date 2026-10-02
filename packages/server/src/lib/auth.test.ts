import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'

vi.mock('./prisma.js', () => ({
  prisma: {
    projectRole: { findUnique: vi.fn() },
  },
}))

import { authenticate, requireAdmin, requireProjectAccess, requireProjectAdmin } from './auth.js'
import { prisma } from './prisma.js'
import { AppError } from './errors.js'

function fakeRequest(opts: {
  jwtOk?: boolean
  user?: { userId: string; isAdmin: boolean }
  projectId?: string
} = {}) {
  const { jwtOk = true, user = { userId: 'u1', isAdmin: false }, projectId = 'p1' } = opts
  return {
    jwtVerify: jwtOk ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error('bad token')),
    user,
    params: { projectId },
  } as unknown as FastifyRequest<{ Params: { projectId: string } }>
}

const fakeReply = {} as FastifyReply

describe('authenticate', () => {
  it('passes through when the token is valid', async () => {
    await expect(authenticate(fakeRequest({ jwtOk: true }), fakeReply)).resolves.toBeUndefined()
  })

  it('throws a 401 AppError when the token is invalid', async () => {
    await expect(authenticate(fakeRequest({ jwtOk: false }), fakeReply)).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})

describe('requireAdmin', () => {
  it('allows a global admin', async () => {
    const req = fakeRequest({ user: { userId: 'u1', isAdmin: true } })
    await expect(requireAdmin(req, fakeReply)).resolves.toBeUndefined()
  })

  it('rejects a non-admin with a 403 AppError', async () => {
    const req = fakeRequest({ user: { userId: 'u1', isAdmin: false } })
    await expect(requireAdmin(req, fakeReply)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects before checking role if the token itself is invalid', async () => {
    const req = fakeRequest({ jwtOk: false })
    await expect(requireAdmin(req, fakeReply)).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('requireProjectAccess', () => {
  beforeEach(() => {
    vi.mocked(prisma.projectRole.findUnique).mockReset()
  })

  it('lets a global admin through without querying project roles', async () => {
    const req = fakeRequest({ user: { userId: 'u1', isAdmin: true } })
    await expect(requireProjectAccess(req, fakeReply)).resolves.toBeUndefined()
    expect(prisma.projectRole.findUnique).not.toHaveBeenCalled()
  })

  it('allows a user with any role on the project', async () => {
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'TESTER' } as never)
    const req = fakeRequest({ user: { userId: 'u1', isAdmin: false } })
    await expect(requireProjectAccess(req, fakeReply)).resolves.toBeUndefined()
  })

  it('rejects a user with no role on the project', async () => {
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue(null)
    const req = fakeRequest({ user: { userId: 'u1', isAdmin: false } })
    await expect(requireProjectAccess(req, fakeReply)).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('requireProjectAdmin', () => {
  beforeEach(() => {
    vi.mocked(prisma.projectRole.findUnique).mockReset()
  })

  it('lets a global admin through without querying project roles', async () => {
    const req = fakeRequest({ user: { userId: 'u1', isAdmin: true } })
    await expect(requireProjectAdmin(req, fakeReply)).resolves.toBeUndefined()
    expect(prisma.projectRole.findUnique).not.toHaveBeenCalled()
  })

  it('allows a PROJECT_ADMIN', async () => {
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'PROJECT_ADMIN' } as never)
    const req = fakeRequest({ user: { userId: 'u1', isAdmin: false } })
    await expect(requireProjectAdmin(req, fakeReply)).resolves.toBeUndefined()
  })

  it('rejects a TESTER', async () => {
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue({ role: 'TESTER' } as never)
    const req = fakeRequest({ user: { userId: 'u1', isAdmin: false } })
    await expect(requireProjectAdmin(req, fakeReply)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects a user with no role at all', async () => {
    vi.mocked(prisma.projectRole.findUnique).mockResolvedValue(null)
    const req = fakeRequest({ user: { userId: 'u1', isAdmin: false } })
    await expect(requireProjectAdmin(req, fakeReply)).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('AppError', () => {
  it('carries statusCode and message', () => {
    const err = new AppError(409, 'conflict', 'SLUG_TAKEN')
    expect(err.statusCode).toBe(409)
    expect(err.message).toBe('conflict')
    expect(err.code).toBe('SLUG_TAKEN')
  })
})
