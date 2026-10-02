import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireProjectAccess, requireProjectAdmin } from '../../lib/auth.js'
import { assertPathInProject } from '../../lib/ownership.js'

const pathSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1).regex(/^\//, 'Path must start with /'),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().optional(),
})

const pathSelect = {
  id: true, name: true, path: true,
  projectId: true, parentId: true, order: true,
  createdAt: true,
  _count: { select: { resources: true } },
}

export async function pathRoutes(app: FastifyInstance) {
  // GET /api/projects/:projectId/paths — full tree
  app.get('/:projectId/paths', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const paths = await prisma.path.findMany({
      where: { projectId },
      select: pathSelect,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    return reply.send(paths)
  })

  // POST /api/projects/:projectId/paths
  app.post('/:projectId/paths', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const body = pathSchema.parse(request.body)
    if (body.parentId) await assertPathInProject(body.parentId, projectId)

    // Auto-assign order at end of siblings
    const siblingCount = await prisma.path.count({
      where: { projectId, parentId: body.parentId ?? null },
    })

    const path = await prisma.path.create({
      data: {
        ...body,
        parentId: body.parentId ?? null,
        order: body.order ?? siblingCount,
        projectId,
      },
      select: pathSelect,
    })
    return reply.code(201).send(path)
  })

  // PATCH /api/projects/:projectId/paths/:pathId
  app.patch('/:projectId/paths/:pathId', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId, pathId } = request.params as { projectId: string; pathId: string }
    await assertPathInProject(pathId, projectId)
    const body = pathSchema.partial().parse(request.body)
    if (body.parentId) await assertPathInProject(body.parentId, projectId)
    const path = await prisma.path.update({
      where: { id: pathId },
      data: body,
      select: pathSelect,
    })
    return reply.send(path)
  })

  // DELETE /api/projects/:projectId/paths/:pathId
  app.delete('/:projectId/paths/:pathId', {
    preHandler: (req, rep) => requireProjectAdmin(req as Parameters<typeof requireProjectAdmin>[0], rep),
  }, async (request, reply) => {
    const { projectId, pathId } = request.params as { projectId: string; pathId: string }
    await assertPathInProject(pathId, projectId)
    await prisma.path.delete({ where: { id: pathId } })
    return reply.code(204).send()
  })
}
