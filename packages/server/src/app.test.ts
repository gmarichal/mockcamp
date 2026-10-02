import { describe, it, expect, afterEach } from 'vitest'
import { buildApp } from './app.js'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('buildApp JWT_SECRET guard', () => {
  it('refuses to start in production without a JWT_SECRET', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET
    await expect(buildApp()).rejects.toThrow(/JWT_SECRET/)
  })

  it('refuses to start in production with the default placeholder secret', async () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'mockcamp-dev-secret-change-in-production'
    await expect(buildApp()).rejects.toThrow(/JWT_SECRET/)
  })

  it('starts in production with a real JWT_SECRET set', async () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'a-real-production-secret'
    const app = await buildApp()
    await app.close()
  })

  it('starts outside production even without JWT_SECRET', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    const app = await buildApp()
    await app.close()
  })
})
