import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireProjectAccess, requireProjectAdmin } from '../../lib/auth.js'
import { assertPathInProject, assertResourceInProject } from '../../lib/ownership.js'

const resourceSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  customPath: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  delay: z.number().int().nullable().optional(),
  delayMin: z.number().int().nullable().optional(),
  delayMax: z.number().int().nullable().optional(),
  errorRate: z.number().min(0).max(1).optional(),
  strategy: z.enum(['FIXED', 'CONDITIONAL', 'SEQUENTIAL', 'RANDOM']).optional(),
})

const resourceSelect = {
  id: true,
  pathId: true,
  method: true,
  customPath: true,
  isActive: true,
  delay: true,
  delayMin: true,
  delayMax: true,
  errorRate: true,
  strategy: true,
  seqIndex: true,
  createdAt: true,
  _count: { select: { responses: true } },
}

export async function resourceRoutes(app: FastifyInstance) {
  // GET /api/projects/:projectId/paths/:pathId/resources
  app.get('/:projectId/paths/:pathId/resources', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId, pathId } = request.params as { projectId: string; pathId: string }
    await assertPathInProject(pathId, projectId)
    const resources = await prisma.resource.findMany({
      where: { pathId },
      select: resourceSelect,
      orderBy: { createdAt: 'asc' },
    })
    return reply.send(resources)
  })

  // POST /api/projects/:projectId/paths/:pathId/resources
  app.post('/:projectId/paths/:pathId/resources', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId, pathId } = request.params as { projectId: string; pathId: string }
    await assertPathInProject(pathId, projectId)
    const body = resourceSchema.parse(request.body)
    const resource = await prisma.resource.create({
      data: { ...body, pathId },
      select: resourceSelect,
    })
    return reply.code(201).send(resource)
  })

  // PATCH /api/projects/:projectId/paths/:pathId/resources/:resourceId
  app.patch('/:projectId/paths/:pathId/resources/:resourceId', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId, resourceId } = request.params as { projectId: string; pathId: string; resourceId: string }
    await assertResourceInProject(resourceId, projectId)
    const body = resourceSchema.partial().parse(request.body)
    const resource = await prisma.resource.update({
      where: { id: resourceId },
      data: body,
      select: resourceSelect,
    })
    return reply.send(resource)
  })

  // DELETE /api/projects/:projectId/paths/:pathId/resources/:resourceId
  app.delete('/:projectId/paths/:pathId/resources/:resourceId', {
    preHandler: (req, rep) => requireProjectAdmin(req as Parameters<typeof requireProjectAdmin>[0], rep),
  }, async (request, reply) => {
    const { projectId, resourceId } = request.params as { projectId: string; pathId: string; resourceId: string }
    await assertResourceInProject(resourceId, projectId)
    await prisma.resource.delete({ where: { id: resourceId } })
    return reply.code(204).send()
  })
}
