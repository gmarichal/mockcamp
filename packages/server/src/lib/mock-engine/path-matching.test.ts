import { describe, it, expect } from 'vitest'
import { buildPattern, matchPath } from './path-matching.js'

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
