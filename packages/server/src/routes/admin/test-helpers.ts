import Fastify, { type FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import { sendError } from '../../lib/errors.js'

export async function buildTestApp(
  register: (app: FastifyInstance) => Promise<void>,
  prefix = '/api',
) {
  const app = Fastify({ logger: false })
  await app.register(jwt, { secret: 'test-secret' })
  app.setErrorHandler((err, _request, reply) => sendError(reply, err))
  await app.register(register, { prefix })
  await app.ready()
  return app
}

export function signToken(app: FastifyInstance, payload: { userId: string; isAdmin: boolean }) {
  return app.jwt.sign(payload)
}
