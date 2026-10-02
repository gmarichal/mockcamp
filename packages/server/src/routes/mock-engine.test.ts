import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    variable: { findMany: vi.fn() },
  },
}))

import {
  buildPattern,
  matchPath,
  pickFixed,
  pickRandom,
  evalExpression,
  pickConditional,
  applyDelay,
  resolveVariable,
  extractValue,
  interpolateVariables,
  type DbResponse,
  type DbCondition,
  type RequestCtx,
} from './mock-engine.js'
import { prisma } from '../lib/prisma.js'

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

// ─── buildPattern / matchPath ───────────────────────────────────────────────

describe('matchPath', () => {
  it('matches a literal path with no params', () => {
    expect(matchPath('/payments', '/payments')).toEqual({})
    expect(matchPath('/payments', '/orders')).toBeNull()
  })

  it('extracts :param style params', () => {
    expect(matchPath('/payments/:id', '/payments/42')).toEqual({ id: '42' })
  })

  it('extracts {param} style params', () => {
    expect(matchPath('/payments/{id}', '/payments/42')).toEqual({ id: '42' })
  })

  it('supports multiple params', () => {
    expect(matchPath('/orgs/:orgId/users/:userId', '/orgs/a/users/b'))
      .toEqual({ orgId: 'a', userId: 'b' })
  })

  it('treats * as a wildcard', () => {
    expect(matchPath('/files/*', '/files/a/b/c')).toEqual({})
  })

  it('does not match a param segment against a slash', () => {
    expect(matchPath('/payments/:id', '/payments/42/extra')).toBeNull()
  })

  it('escapes regex-special characters in literal segments', () => {
    expect(buildPattern('/a.b+c').regex.test('/a.b+c')).toBe(true)
    expect(buildPattern('/a.b+c').regex.test('/aXbXc')).toBe(false)
  })
})

// ─── pickFixed / pickRandom ─────────────────────────────────────────────────

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

// ─── evalExpression ─────────────────────────────────────────────────────────

describe('evalExpression', () => {
  it('evaluates equality against request.body', () => {
    expect(evalExpression('request.body.amount == 100', ctx({ body: { amount: 100 } }))).toBe(true)
    expect(evalExpression('request.body.amount == 100', ctx({ body: { amount: 200 } }))).toBe(false)
  })

  it('evaluates numeric comparisons', () => {
    expect(evalExpression('request.body.amount > 1000', ctx({ body: { amount: 1500 } }))).toBe(true)
    expect(evalExpression('request.body.amount > 1000', ctx({ body: { amount: 500 } }))).toBe(false)
    expect(evalExpression('request.body.amount <= 1000', ctx({ body: { amount: 1000 } }))).toBe(true)
  })

  it('evaluates contains on strings', () => {
    expect(evalExpression('request.query.name contains "gaston"', ctx({ query: { name: 'gastonmarichal' } }))).toBe(true)
    expect(evalExpression('request.query.name contains "zzz"', ctx({ query: { name: 'gaston' } }))).toBe(false)
  })

  it('reads headers case-insensitively by key', () => {
    expect(evalExpression('request.headers["x-api-key"] == "secret"', ctx({ headers: { 'x-api-key': 'secret' } }))).toBe(true)
  })

  it('reads path params', () => {
    expect(evalExpression('request.params.id == "42"', ctx({ params: { id: '42' } }))).toBe(true)
  })

  it('evaluates exists / !exists', () => {
    expect(evalExpression('request.body.amount exists', ctx({ body: { amount: 1 } }))).toBe(true)
    expect(evalExpression('request.body.amount exists', ctx({ body: {} }))).toBe(false)
    expect(evalExpression('request.body.amount !exists', ctx({ body: {} }))).toBe(true)
  })

  it('resolves dotted nested body paths', () => {
    expect(evalExpression('request.body.user.id == 1', ctx({ body: { user: { id: 1 } } }))).toBe(true)
  })

  it('returns false for a malformed expression instead of throwing', () => {
    expect(evalExpression('not a real expression', ctx())).toBe(false)
  })
})

// ─── pickConditional ────────────────────────────────────────────────────────

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

// ─── applyDelay ──────────────────────────────────────────────────────────────

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

// ─── resolveVariable / extractValue ─────────────────────────────────────────

describe('extractValue', () => {
  it('reads from body, headers, query and params', () => {
    const c = ctx({
      body: { id: 1 },
      headers: { 'x-trace': 't1' },
      query: { page: '2' },
      params: { slug: 'x' },
    })
    expect(extractValue('request.body.id', c)).toBe(1)
    expect(extractValue('request.headers["x-trace"]', c)).toBe('t1')
    expect(extractValue('request.query.page', c)).toBe('2')
    expect(extractValue('request.params.slug', c)).toBe('x')
  })
})

describe('resolveVariable', () => {
  it('returns the static value as-is', () => {
    expect(resolveVariable({ type: 'STATIC', value: 'hello', expression: null }, ctx())).toBe('hello')
  })

  it('resolves a dynamic value from the request', () => {
    const c = ctx({ body: { orderId: 'abc' } })
    expect(resolveVariable({ type: 'DYNAMIC', value: null, expression: 'request.body.orderId' }, c)).toBe('abc')
  })

  it('returns an empty string for an unknown variable type', () => {
    expect(resolveVariable({ type: 'UNKNOWN', value: null, expression: null }, ctx())).toBe('')
  })
})

// ─── interpolateVariables ────────────────────────────────────────────────────

describe('interpolateVariables', () => {
  beforeEach(() => {
    vi.mocked(prisma.variable.findMany).mockReset()
  })

  it('returns the template unchanged when it has no placeholders', async () => {
    const result = await interpolateVariables('plain text', 'p1', 'r1', ctx())
    expect(result).toBe('plain text')
    expect(prisma.variable.findMany).not.toHaveBeenCalled()
  })

  it('lets a resource-scoped variable override a project-scoped one of the same name', async () => {
    vi.mocked(prisma.variable.findMany).mockResolvedValue([
      { name: 'env', type: 'STATIC', value: 'project-level', expression: null, resourceId: null },
      { name: 'env', type: 'STATIC', value: 'resource-level', expression: null, resourceId: 'r1' },
    ] as never)

    const result = await interpolateVariables('{{env}}', 'p1', 'r1', ctx())
    expect(result).toBe('resource-level')
  })

  it('leaves unknown placeholders untouched', async () => {
    vi.mocked(prisma.variable.findMany).mockResolvedValue([])
    const result = await interpolateVariables('{{unknown}}', 'p1', 'r1', ctx())
    expect(result).toBe('{{unknown}}')
  })
})
