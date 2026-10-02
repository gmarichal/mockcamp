import { describe, it, expect } from 'vitest'
import { pickFixed, pickRandom, pickConditional, type DbResponse, type DbCondition } from './strategies.js'
import type { RequestCtx } from './request-context.js'

function ctx(partial: Partial<RequestCtx> = {}): RequestCtx {
  return { body: {}, headers: {}, query: {}, params: {}, ...partial }
}

function response(overrides: Partial<DbResponse> = {}): DbResponse {
  return {
    id: 'r1',
    statusCode: 200,
    bodyType: 'JSON',
    body: null,
    isDefault: false,
    weight: 1,
    order: 0,
    name: null,
    headers: [],
    ...overrides,
  }
}

describe('pickFixed', () => {
  it('returns the response flagged as default', () => {
    const a = response({ id: 'a' })
    const b = response({ id: 'b', isDefault: true })
    expect(pickFixed([a, b])).toBe(b)
  })

  it('falls back to the first response when none is default', () => {
    const a = response({ id: 'a' })
    const b = response({ id: 'b' })
    expect(pickFixed([a, b])).toBe(a)
  })

  it('returns null for an empty list', () => {
    expect(pickFixed([])).toBeNull()
  })
})

describe('pickRandom', () => {
  it('returns null for an empty list', () => {
    expect(pickRandom([])).toBeNull()
  })

  it('only ever returns a response with weight > 0 when others have weight 0', () => {
    const zero = response({ id: 'zero', weight: 0 })
    const heavy = response({ id: 'heavy', weight: 10 })
    for (let i = 0; i < 20; i++) {
      expect(pickRandom([zero, heavy])).toBe(heavy)
    }
  })

  it('distributes selection across all weighted responses', () => {
    const a = response({ id: 'a', weight: 1 })
    const b = response({ id: 'b', weight: 1 })
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      seen.add(pickRandom([a, b])!.id)
    }
    expect(seen).toEqual(new Set(['a', 'b']))
  })
})

describe('pickConditional', () => {
  it('returns the response of the first matching condition, in order', () => {
    const ok = response({ id: 'ok', isDefault: true })
    const err = response({ id: 'err' })
    const conditions: DbCondition[] = [
      { id: 'c1', responseId: 'err', expression: 'request.body.amount > 1000', order: 0 },
      { id: 'c2', responseId: 'ok', expression: 'request.body.amount <= 1000', order: 1 },
    ]
    expect(pickConditional([ok, err], conditions, ctx({ body: { amount: 2000 } }))).toBe(err)
    expect(pickConditional([ok, err], conditions, ctx({ body: { amount: 500 } }))).toBe(ok)
  })

  it('falls back to the default response when nothing matches', () => {
    const ok = response({ id: 'ok', isDefault: true })
    const conditions: DbCondition[] = [
      { id: 'c1', responseId: 'ok', expression: 'request.body.amount > 1000', order: 0 },
    ]
    expect(pickConditional([ok], conditions, ctx({ body: { amount: 1 } }))).toBe(ok)
  })
})
