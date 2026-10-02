import type { FastifyReply } from 'fastify'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      error: error.message,
      code: error.code,
    })
  }
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'Validation error',
      issues: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  console.error(error)
  return reply.code(500).send({ error: 'Internal server error' })
}
