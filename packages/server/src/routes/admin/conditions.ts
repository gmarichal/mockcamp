import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireProjectAccess, requireProjectAdmin } from '../../lib/auth.js'
import { assertResourceInProject, assertConditionInProject } from '../../lib/ownership.js'
import { sendError } from '../../lib/errors.js'

const conditionSchema = z.object({
  responseId: z.string().uuid(),
  expression: z.string().min(1),
  order: z.number().int().optional(),
})

const conditionSelect = {
  id: true,
  resourceId: true,
  responseId: true,
  expression: true,
  order: true,
}

export async function conditionRoutes(app: FastifyInstance) {
  const base = '/:projectId/paths/:pathId/resources/:resourceId/conditions'

  // GET
  app.get(base, {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    try {
      const { projectId, resourceId } = request.params as { projectId: string; resourceId: string }
      await assertResourceInProject(resourceId, projectId)
      const conditions = await prisma.condition.findMany({
        where: { resourceId },
        select: conditionSelect,
        orderBy: { order: 'asc' },
      })
      return reply.send(conditions)
    } catch (err) { return sendError(reply, err) }
  })

  // POST
  app.post(base, {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    try {
      const { projectId, resourceId } = request.params as { projectId: string; resourceId: string }
      await assertResourceInProject(resourceId, projectId)
      const body = conditionSchema.parse(request.body)
      const count = await prisma.condition.count({ where: { resourceId } })
      const condition = await prisma.condition.create({
        data: { ...body, order: body.order ?? count, resourceId },
        select: conditionSelect,
      })
      return reply.code(201).send(condition)
    } catch (err) { return sendError(reply, err) }
  })

  // PATCH
  app.patch(`${base}/:conditionId`, {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    try {
      const { projectId, conditionId } = request.params as { projectId: string; conditionId: string }
      await assertConditionInProject(conditionId, projectId)
      const body = conditionSchema.partial().parse(request.body)
      const condition = await prisma.condition.update({
        where: { id: conditionId },
        data: body,
        select: conditionSelect,
      })
      return reply.send(condition)
    } catch (err) { return sendError(reply, err) }
  })

  // DELETE
  app.delete(`${base}/:conditionId`, {
    preHandler: (req, rep) => requireProjectAdmin(req as Parameters<typeof requireProjectAdmin>[0], rep),
  }, async (request, reply) => {
    try {
      const { projectId, conditionId } = request.params as { projectId: string; conditionId: string }
      await assertConditionInProject(conditionId, projectId)
      await prisma.condition.delete({ where: { id: conditionId } })
      return reply.code(204).send()
    } catch (err) { return sendError(reply, err) }
  })
}
