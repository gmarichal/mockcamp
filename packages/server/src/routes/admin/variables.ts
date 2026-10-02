import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireProjectAccess, requireProjectAdmin } from '../../lib/auth.js'
import { assertResourceInProject, assertVariableInProject } from '../../lib/ownership.js'
import { AppError } from '../../lib/errors.js'

const variableSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Name must be a valid identifier (letters, numbers, underscores)'),
  type: z.enum(['STATIC', 'DYNAMIC']),
  value: z.string().nullable().optional(),
  expression: z.string().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
})

const variableSelect = {
  id: true,
  name: true,
  type: true,
  value: true,
  expression: true,
  projectId: true,
  resourceId: true,
  createdAt: true,
  updatedAt: true,
}

export async function variableRoutes(app: FastifyInstance) {
  // GET /api/projects/:projectId/variables
  app.get('/:projectId/variables', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const variables = await prisma.variable.findMany({
      where: { projectId },
      select: variableSelect,
      orderBy: { createdAt: 'asc' },
    })
    return reply.send(variables)
  })

  // POST /api/projects/:projectId/variables
  app.post('/:projectId/variables', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const body = variableSchema.parse(request.body)
    if (body.resourceId) await assertResourceInProject(body.resourceId, projectId)

    // Validate: STATIC needs value, DYNAMIC needs expression
    if (body.type === 'STATIC' && !body.value && body.value !== '') {
      throw new AppError(400, 'STATIC variables require a value')
    }
    if (body.type === 'DYNAMIC' && !body.expression) {
      throw new AppError(400, `${body.type} variables require an expression`)
    }

    const variable = await prisma.variable.create({
      data: { ...body, projectId },
      select: variableSelect,
    })
    return reply.code(201).send(variable)
  })

  // PATCH /api/projects/:projectId/variables/:variableId
  app.patch('/:projectId/variables/:variableId', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId, variableId } = request.params as { projectId: string; variableId: string }
    await assertVariableInProject(variableId, projectId)
    const body = variableSchema.partial().parse(request.body)
    if (body.resourceId) await assertResourceInProject(body.resourceId, projectId)
    const variable = await prisma.variable.update({
      where: { id: variableId },
      data: body,
      select: variableSelect,
    })
    return reply.send(variable)
  })

  // DELETE /api/projects/:projectId/variables/:variableId
  app.delete('/:projectId/variables/:variableId', {
    preHandler: (req, rep) => requireProjectAdmin(req as Parameters<typeof requireProjectAdmin>[0], rep),
  }, async (request, reply) => {
    const { projectId, variableId } = request.params as { projectId: string; variableId: string }
    await assertVariableInProject(variableId, projectId)
    await prisma.variable.delete({ where: { id: variableId } })
    return reply.code(204).send()
  })
}
