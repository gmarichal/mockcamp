import { describe, it, expect } from 'vitest'
import { applyDelay } from './delay.js'

describe('applyDelay', () => {
  it('waits at least the fixed delay', async () => {
    const start = Date.now()
    await applyDelay({ delay: 30, delayMin: null, delayMax: null })
    expect(Date.now() - start).toBeGreaterThanOrEqual(25)
  })

  it('waits within the min/max range when no fixed delay is set', async () => {
    const start = Date.now()
    await applyDelay({ delay: null, delayMin: 10, delayMax: 20 })
    expect(Date.now() - start).toBeGreaterThanOrEqual(5)
  })

  it('does not wait when no delay is configured', async () => {
    const start = Date.now()
    await applyDelay({ delay: null, delayMin: null, delayMax: null })
    expect(Date.now() - start).toBeLessThan(20)
  })
})
