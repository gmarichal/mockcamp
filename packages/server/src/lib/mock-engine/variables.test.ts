import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma.js', () => ({
  prisma: {
    variable: { findMany: vi.fn() },
  },
}))

import { resolveVariable, interpolateVariables } from './variables.js'
import { prisma } from '../prisma.js'
import type { RequestCtx } from './request-context.js'

function ctx(partial: Partial<RequestCtx> = {}): RequestCtx {
  return { body: {}, headers: {}, query: {}, params: {}, ...partial }
}

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

  it('still lets the resource-scoped variable win when it comes first in the query result', () => {
    // Regression guard for the sort in interpolateVariables: without it, whichever
    // row Prisma happens to return last would silently become the "winner".
    return (async () => {
      vi.mocked(prisma.variable.findMany).mockResolvedValue([
        { name: 'env', type: 'STATIC', value: 'resource-level', expression: null, resourceId: 'r1' },
        { name: 'env', type: 'STATIC', value: 'project-level', expression: null, resourceId: null },
      ] as never)

      const result = await interpolateVariables('{{env}}', 'p1', 'r1', ctx())
      expect(result).toBe('resource-level')
    })()
  })

  it('leaves unknown placeholders untouched', async () => {
    vi.mocked(prisma.variable.findMany).mockResolvedValue([])
    const result = await interpolateVariables('{{unknown}}', 'p1', 'r1', ctx())
    expect(result).toBe('{{unknown}}')
  })

  it('only queries for the distinct names referenced in the template', async () => {
    vi.mocked(prisma.variable.findMany).mockResolvedValue([])
    await interpolateVariables('{{a}} {{b}} {{a}}', 'p1', 'r1', ctx())
    expect(prisma.variable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ name: { in: ['a', 'b'] } }) }),
    )
  })
})
