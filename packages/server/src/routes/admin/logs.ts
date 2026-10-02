import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { requireProjectAccess } from '../../lib/auth.js'

export async function logRoutes(app: FastifyInstance) {
  // GET /api/projects/:projectId/logs?limit=50&offset=0&method=GET&status=200
  app.get('/:projectId/logs', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const { limit = '50', offset = '0', method, status } = request.query as {
      limit?: string; offset?: string; method?: string; status?: string
    }

    const where: Record<string, unknown> = { projectId }
    if (method) where.method = method.toUpperCase()
    if (status) where.statusCode = parseInt(status)

    const [total, logs] = await Promise.all([
      prisma.requestLog.count({ where }),
      prisma.requestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit), 200),
        skip: parseInt(offset),
        select: {
          id: true,
          method: true,
          path: true,
          statusCode: true,
          latencyMs: true,
          requestHeaders: true,
          requestBody: true,
          responseHeaders: true,
          responseBody: true,
          resourceId: true,
          createdAt: true,
        },
      }),
    ])

    return reply.send({ total, logs })
  })

  // DELETE /api/projects/:projectId/logs — clear all logs for project
  app.delete('/:projectId/logs', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    await prisma.requestLog.deleteMany({ where: { projectId } })
    return reply.code(204).send()
  })
}
