import { describe, it, expect } from 'vitest'
import { evalExpression } from './expressions.js'
import type { RequestCtx } from './request-context.js'

function ctx(partial: Partial<RequestCtx> = {}): RequestCtx {
  return { body: {}, headers: {}, query: {}, params: {}, ...partial }
}

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
