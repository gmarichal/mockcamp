import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { authenticate } from '../../lib/auth.js'
import { AppError, sendError } from '../../lib/errors.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /_admin/api/auth/login
  app.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body)

      const user = await prisma.user.findUnique({ where: { email: body.email } })
      if (!user || !user.isActive) {
        throw new AppError(401, 'Invalid credentials')
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash)
      if (!valid) throw new AppError(401, 'Invalid credentials')

      const token = app.jwt.sign({ userId: user.id, isAdmin: user.isAdmin })

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          mustChangePassword: user.mustChangePassword,
        },
      })
    } catch (err) {
      return sendError(reply, err)
    }
  })

  // POST /_admin/api/auth/change-password
  app.post('/change-password', { preHandler: authenticate }, async (request, reply) => {
    try {
      const body = changePasswordSchema.parse(request.body)
      const userId = request.user.userId

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

      const valid = await bcrypt.compare(body.currentPassword, user.passwordHash)
      if (!valid) throw new AppError(400, 'Current password is incorrect')

      const hash = await bcrypt.hash(body.newPassword, 10)
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hash, mustChangePassword: false },
      })

      return reply.send({ ok: true })
    } catch (err) {
      return sendError(reply, err)
    }
  })

  // GET /_admin/api/auth/me
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    try {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.user.userId },
        select: {
          id: true, email: true, name: true,
          isAdmin: true, mustChangePassword: true,
        },
      })
      return reply.send(user)
    } catch (err) {
      return sendError(reply, err)
    }
  })
}
