import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAdmin, authenticate } from '../../lib/auth.js'
import { AppError } from '../../lib/errors.js'

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  isAdmin: z.boolean().default(false),
  password: z.string().min(8).optional(), // auto-generated if omitted
})

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  isAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

const userSelect = {
  id: true, email: true, name: true,
  isAdmin: true, isActive: true, mustChangePassword: true,
  createdAt: true,
}

export async function userRoutes(app: FastifyInstance) {
  // GET /_admin/api/users
  app.get('/', { preHandler: requireAdmin }, async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(users)
  })

  // POST /_admin/api/users
  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = createUserSchema.parse(request.body)

    const exists = await prisma.user.findUnique({ where: { email: body.email } })
    if (exists) throw new AppError(409, 'Email already in use')

    const rawPassword = body.password ?? generateTempPassword()
    const hash = await bcrypt.hash(rawPassword, 10)

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        isAdmin: body.isAdmin,
        passwordHash: hash,
        mustChangePassword: true,
      },
      select: userSelect,
    })

    // Return temp password so admin can share it (only on creation)
    return reply.code(201).send({ ...user, tempPassword: body.password ? undefined : rawPassword })
  })

  // GET /_admin/api/users/:id
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    // Users can only see themselves unless admin
    if (!request.user.isAdmin && request.user.userId !== id) {
      throw new AppError(403, 'Forbidden')
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: userSelect })
    return reply.send(user)
  })

  // PATCH /_admin/api/users/:id
  app.patch('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateUserSchema.parse(request.body)

    const user = await prisma.user.update({
      where: { id },
      data: body,
      select: userSelect,
    })
    return reply.send(user)
  })

  // DELETE /_admin/api/users/:id  (deactivate, not hard delete)
  app.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (id === request.user.userId) throw new AppError(400, 'Cannot deactivate yourself')

    await prisma.user.update({ where: { id }, data: { isActive: false } })
    return reply.code(204).send()
  })
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
