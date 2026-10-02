import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { authRoutes } from './auth.js'
import { prisma } from '../../lib/prisma.js'
import { buildTestApp, signToken } from './test-helpers.js'

async function buildAuthApp() {
  return buildTestApp(authRoutes, '/api/auth')
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset()
  })

  it('returns a token and user payload for valid credentials', async () => {
    const app = await buildAuthApp()
    const passwordHash = await bcrypt.hash('correct-password', 10)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1', email: 'a@b.com', name: 'A', passwordHash,
      isActive: true, isAdmin: false, mustChangePassword: true,
    } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'a@b.com', password: 'correct-password' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeTypeOf('string')
    expect(body.user).toMatchObject({ id: 'u1', email: 'a@b.com', mustChangePassword: true })
    expect(body.user.passwordHash).toBeUndefined()
  })

  it('rejects an unknown email with 401', async () => {
    const app = await buildAuthApp()
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@b.com', password: 'whatever' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a wrong password with 401', async () => {
    const app = await buildAuthApp()
    const passwordHash = await bcrypt.hash('correct-password', 10)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1', email: 'a@b.com', name: 'A', passwordHash,
      isActive: true, isAdmin: false, mustChangePassword: false,
    } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'a@b.com', password: 'wrong-password' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a deactivated user with 401', async () => {
    const app = await buildAuthApp()
    const passwordHash = await bcrypt.hash('correct-password', 10)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1', email: 'a@b.com', name: 'A', passwordHash,
      isActive: false, isAdmin: false, mustChangePassword: false,
    } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'a@b.com', password: 'correct-password' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a malformed payload with 400, not 500', async () => {
    const app = await buildAuthApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'not-an-email' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('protected auth routes without a token', () => {
  it('rejects /change-password with 401', async () => {
    const app = await buildAuthApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      payload: { currentPassword: 'a', newPassword: 'newpassword1' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects /me with 401', async () => {
    const app = await buildAuthApp()
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockReset()
    vi.mocked(prisma.user.update).mockReset()
  })

  it('updates the password and clears mustChangePassword on success', async () => {
    const app = await buildAuthApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    const currentHash = await bcrypt.hash('old-password', 10)
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: 'u1', passwordHash: currentHash,
    } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'old-password', newPassword: 'newpassword1' },
    })

    expect(res.statusCode).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ mustChangePassword: false }),
    })
  })

  it('rejects an incorrect current password with 400', async () => {
    const app = await buildAuthApp()
    const token = signToken(app, { userId: 'u1', isAdmin: false })
    const currentHash = await bcrypt.hash('old-password', 10)
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: 'u1', passwordHash: currentHash,
    } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'wrong', newPassword: 'newpassword1' },
    })
    expect(res.statusCode).toBe(400)
  })
})
