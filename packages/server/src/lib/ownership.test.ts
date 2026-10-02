import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./prisma.js', () => ({
  prisma: {
    path: { findFirst: vi.fn() },
    resource: { findFirst: vi.fn() },
    response: { findFirst: vi.fn() },
    condition: { findFirst: vi.fn() },
    variable: { findFirst: vi.fn() },
  },
}))

import {
  assertPathInProject,
  assertResourceInProject,
  assertResponseInProject,
  assertConditionInProject,
  assertVariableInProject,
} from './ownership.js'
import { prisma } from './prisma.js'

beforeEach(() => {
  vi.mocked(prisma.path.findFirst).mockReset()
  vi.mocked(prisma.resource.findFirst).mockReset()
  vi.mocked(prisma.response.findFirst).mockReset()
  vi.mocked(prisma.condition.findFirst).mockReset()
  vi.mocked(prisma.variable.findFirst).mockReset()
})

describe('assertPathInProject', () => {
  it('resolves when the path belongs to the project', async () => {
    vi.mocked(prisma.path.findFirst).mockResolvedValue({ id: 'path1' } as never)
    await expect(assertPathInProject('path1', 'proj-a')).resolves.toBeUndefined()
    expect(prisma.path.findFirst).toHaveBeenCalledWith({ where: { id: 'path1', projectId: 'proj-a' } })
  })

  it('throws 404 when the path belongs to a different project (or does not exist)', async () => {
    vi.mocked(prisma.path.findFirst).mockResolvedValue(null)
    await expect(assertPathInProject('path-from-proj-b', 'proj-a')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('assertResourceInProject', () => {
  it('resolves when the resource\'s path belongs to the project', async () => {
    vi.mocked(prisma.resource.findFirst).mockResolvedValue({ id: 'res1' } as never)
    await expect(assertResourceInProject('res1', 'proj-a')).resolves.toBeUndefined()
    expect(prisma.resource.findFirst).toHaveBeenCalledWith({
      where: { id: 'res1', path: { projectId: 'proj-a' } },
    })
  })

  it('throws 404 for a resource belonging to another project', async () => {
    vi.mocked(prisma.resource.findFirst).mockResolvedValue(null)
    await expect(assertResourceInProject('res-from-proj-b', 'proj-a')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('assertResponseInProject', () => {
  it('throws 404 for a response belonging to another project', async () => {
    vi.mocked(prisma.response.findFirst).mockResolvedValue(null)
    await expect(assertResponseInProject('resp-from-proj-b', 'proj-a')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('resolves for a response in the same project', async () => {
    vi.mocked(prisma.response.findFirst).mockResolvedValue({ id: 'resp1' } as never)
    await expect(assertResponseInProject('resp1', 'proj-a')).resolves.toBeUndefined()
  })
})

describe('assertConditionInProject', () => {
  it('throws 404 for a condition belonging to another project', async () => {
    vi.mocked(prisma.condition.findFirst).mockResolvedValue(null)
    await expect(assertConditionInProject('cond-from-proj-b', 'proj-a')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('assertVariableInProject', () => {
  it('accepts a project-scoped variable belonging to the project', async () => {
    vi.mocked(prisma.variable.findFirst).mockResolvedValue({ id: 'var1' } as never)
    await expect(assertVariableInProject('var1', 'proj-a')).resolves.toBeUndefined()
    expect(prisma.variable.findFirst).toHaveBeenCalledWith({
      where: { id: 'var1', OR: [{ projectId: 'proj-a' }, { resource: { path: { projectId: 'proj-a' } } }] },
    })
  })

  it('throws 404 for a variable scoped to another project', async () => {
    vi.mocked(prisma.variable.findFirst).mockResolvedValue(null)
    await expect(assertVariableInProject('var-from-proj-b', 'proj-a')).rejects.toMatchObject({ statusCode: 404 })
  })
})
