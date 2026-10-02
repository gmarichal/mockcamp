import { describe, it, expect } from 'vitest'
import { extractValue, type RequestCtx } from './request-context.js'

function ctx(partial: Partial<RequestCtx> = {}): RequestCtx {
  return { body: {}, headers: {}, query: {}, params: {}, ...partial }
}

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
