import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { authenticate, requireAdmin, requireProjectAdmin, requireProjectAccess } from '../../lib/auth.js'
import { AppError } from '../../lib/errors.js'

const projectSchema = z.object({
  name: z.string().min(1),
  slug: z.string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only'),
  description: z.string().optional(),
})

const projectSelect = {
  id: true, name: true, slug: true, description: true,
  isActive: true, createdAt: true, updatedAt: true,
  _count: { select: { paths: true, projectRoles: true } },
}

export async function projectRoutes(app: FastifyInstance) {
  // GET /api/projects — list accessible projects
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const where = request.user.isAdmin
      ? {}
      : {
          projectRoles: {
            some: { userId: request.user.userId },
          },
        }

    const projects = await prisma.project.findMany({
      where,
      select: projectSelect,
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(projects)
  })

  // POST /api/projects
  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = projectSchema.parse(request.body)

    const exists = await prisma.project.findUnique({ where: { slug: body.slug } })
    if (exists) throw new AppError(409, `Slug "${body.slug}" is already in use`)

    const project = await prisma.project.create({
      data: body,
      select: projectSelect,
    })
    return reply.code(201).send(project)
  })

  // GET /api/projects/:projectId
  app.get('/:projectId', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: projectSelect,
    })
    return reply.send(project)
  })

  // PATCH /api/projects/:projectId
  app.patch('/:projectId', {
    preHandler: (req, rep) => requireProjectAdmin(req as Parameters<typeof requireProjectAdmin>[0], rep),
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const body = projectSchema.partial().parse(request.body)

    if (body.slug) {
      const conflict = await prisma.project.findFirst({
        where: { slug: body.slug, id: { not: projectId } },
      })
      if (conflict) throw new AppError(409, `Slug "${body.slug}" is already in use`)
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: body,
      select: projectSelect,
    })
    return reply.send(project)
  })

  // DELETE /api/projects/:projectId
  app.delete('/:projectId', { preHandler: requireAdmin }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    await prisma.project.delete({ where: { id: projectId } })
    return reply.code(204).send()
  })

  // GET /api/projects/:projectId/members
  app.get('/:projectId/members', {
    preHandler: (req, rep) => requireProjectAccess(req as Parameters<typeof requireProjectAccess>[0], rep),
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const members = await prisma.projectRole.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    })
    return reply.send(members)
  })

  // POST /api/projects/:projectId/members
  app.post('/:projectId/members', {
    preHandler: (req, rep) => requireProjectAdmin(req as Parameters<typeof requireProjectAdmin>[0], rep),
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const body = z.object({
      userId: z.string().uuid(),
      role: z.enum(['PROJECT_ADMIN', 'TESTER']),
    }).parse(request.body)

    const member = await prisma.projectRole.upsert({
      where: { userId_projectId: { userId: body.userId, projectId } },
      create: { userId: body.userId, projectId, role: body.role },
      update: { role: body.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    return reply.code(201).send(member)
  })

  // DELETE /api/projects/:projectId/members/:userId
  app.delete('/:projectId/members/:userId', {
    preHandler: (req, rep) => requireProjectAdmin(req as Parameters<typeof requireProjectAdmin>[0], rep),
  }, async (request, reply) => {
    const { projectId, userId } = request.params as { projectId: string; userId: string }
    await prisma.projectRole.delete({
      where: { userId_projectId: { userId, projectId } },
    })
    return reply.code(204).send()
  })
}
