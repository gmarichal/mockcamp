import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireProjectAccess, requireProjectAdmin } from '../../lib/auth.js'
import { assertResourceInProject, assertResponseInProject } from '../../lib/ownership.js'
import { sendError } from '../../lib/errors.js'

const responseSchema = z.object({
  name: z.string().nullable().optional(),
  statusCode: z.number().int().min(100).max(599).optional(),
  bodyType: z.enum(['JSON', 'XML', 'TEXT']).optional(),
  body: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  weight: z.number().int().min(1).optional(),
  order: z.number().int().optional(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
})

const responseSelect = {
  id: true,
  resourceId: true,
  name: true,
  statusCode: true,
  bodyType: true,
  body: true,
  isDefault: true,
  weight: true,
  order: true,
  createdAt: true,
  headers: { select: { id: true, key: true, value: true } },
}

export async function responseRoutes(app: FastifyInstance) {
  // GET /api/projects/:projectId/paths/:pathId/resources/:resourceId/responses
  app.get('/:projectId/paths/:pathId/resources/:resourceId/responses', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    try {
      const { projectId, resourceId } = request.params as { projectId: string; pathId: string; resourceId: string }
      await assertResourceInProject(resourceId, projectId)
      const responses = await prisma.response.findMany({
        where: { resourceId },
        select: responseSelect,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      })
      return reply.send(responses)
    } catch (err) {
      return sendError(reply, err)
    }
  })

  // POST /api/projects/:projectId/paths/:pathId/resources/:resourceId/responses
  app.post('/:projectId/paths/:pathId/resources/:resourceId/responses', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    try {
      const { projectId, resourceId } = request.params as { projectId: string; pathId: string; resourceId: string }
      await assertResourceInProject(resourceId, projectId)
      const body = responseSchema.parse(request.body)
      const { headers, ...rest } = body

      // If isDefault, unset previous default
      if (rest.isDefault) {
        await prisma.response.updateMany({
          where: { resourceId, isDefault: true },
          data: { isDefault: false },
        })
      }

      // Auto-assign order
      const count = await prisma.response.count({ where: { resourceId } })

      const response = await prisma.response.create({
        data: {
          ...rest,
          order: rest.order ?? count,
          resourceId,
          headers: headers ? { create: headers } : undefined,
        },
        select: responseSelect,
      })
      return reply.code(201).send(response)
    } catch (err) {
      return sendError(reply, err)
    }
  })

  // PATCH /api/projects/:projectId/paths/:pathId/resources/:resourceId/responses/:responseId
  app.patch('/:projectId/paths/:pathId/resources/:resourceId/responses/:responseId', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    try {
      const { projectId, resourceId, responseId } = request.params as {
        projectId: string; pathId: string; resourceId: string; responseId: string
      }
      await assertResponseInProject(responseId, projectId)
      const body = responseSchema.partial().parse(request.body)
      const { headers, ...rest } = body

      // If setting as default, unset others
      if (rest.isDefault) {
        await prisma.response.updateMany({
          where: { resourceId, isDefault: true, NOT: { id: responseId } },
          data: { isDefault: false },
        })
      }

      const response = await prisma.response.update({
        where: { id: responseId },
        data: {
          ...rest,
          ...(headers !== undefined ? {
            headers: { deleteMany: {}, create: headers },
          } : {}),
        },
        select: responseSelect,
      })
      return reply.send(response)
    } catch (err) {
      return sendError(reply, err)
    }
  })

  // DELETE /api/projects/:projectId/paths/:pathId/resources/:resourceId/responses/:responseId
  app.delete('/:projectId/paths/:pathId/resources/:resourceId/responses/:responseId', {
    preHandler: (req, rep) => requireProjectAdmin(req as Parameters<typeof requireProjectAdmin>[0], rep),
  }, async (request, reply) => {
    try {
      const { projectId, responseId } = request.params as {
        projectId: string; pathId: string; resourceId: string; responseId: string
      }
      await assertResponseInProject(responseId, projectId)
      await prisma.response.delete({ where: { id: responseId } })
      return reply.code(204).send()
    } catch (err) {
      return sendError(reply, err)
    }
  })
}
