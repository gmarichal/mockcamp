import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import staticPlugin from '@fastify/static'
import websocket from '@fastify/websocket'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { prisma } from './lib/prisma.js'
import { sendError } from './lib/errors.js'
import { adminRoutes } from './routes/admin/index.js'
import { mockEngineRoutes } from './routes/mock-engine.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DEFAULT_JWT_SECRET = 'mockcamp-dev-secret-change-in-production'

export async function buildApp() {
  // Anyone who reads this public source knows the fallback secret, so a production
  // deployment that forgot to set JWT_SECRET would let an attacker forge admin tokens.
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET)) {
    throw new Error('JWT_SECRET must be set to a non-default value when NODE_ENV=production')
  }

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  // ── Plugins ───────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
    sign: { expiresIn: '24h' },
  })

  await app.register(websocket)

  // Admin route handlers throw AppError/ZodError instead of wrapping themselves in
  // try/catch — this is the single place that turns those into HTTP responses.
  app.setErrorHandler((err, _request, reply) => sendError(reply, err))

  // Accept text/plain and application/xml bodies (for mock requests)
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body)
  })
  app.addContentTypeParser('application/xml', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body)
  })
  app.addContentTypeParser('text/xml', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body)
  })

  // ── Admin API routes (/_admin/api/*) ──────────────────────────────────────
  await app.register(adminRoutes, { prefix: '/_admin' })

  // ── Serve React client build (/_admin) ───────────────────────────────────
  const clientDist = join(__dirname, '../../client/dist')
  try {
    await app.register(staticPlugin, {
      root: clientDist,
      prefix: '/_admin/',
      index: 'index.html',
      decorateReply: false,
    })

    // SPA fallback: any /_admin/* not matched → serve index.html
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/_admin')) {
        return reply.sendFile('index.html', clientDist)
      }
      reply.code(404).send({ error: 'Not found' })
    })
  } catch {
    app.log.warn('Client dist not found — run `npm run build` in packages/client first')
  }

  // ── Mock engine routes (/{project-slug}/*) ────────────────────────────────
  await app.register(mockEngineRoutes)

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async () => {
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return app
}
