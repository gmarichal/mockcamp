import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { matchPath } from '../lib/mock-engine/path-matching.js'
import { pickFixed, pickRandom, pickConditional, type DbResponse } from '../lib/mock-engine/strategies.js'
import { applyDelay } from '../lib/mock-engine/delay.js'
import { interpolateVariables } from '../lib/mock-engine/variables.js'
import type { RequestCtx } from '../lib/mock-engine/request-context.js'

const CONTENT_TYPES: Record<string, string> = {
  JSON: 'application/json',
  XML: 'application/xml',
  TEXT: 'text/plain',
}

async function handleMockRequest(request: FastifyRequest, reply: FastifyReply, slug: string) {
  const start = Date.now()

  // Strip slug from URL to get the resource path
  const rawUrl = request.url.split('?')[0]
  const resourcePath = rawUrl.replace(new RegExp(`^/${slug}`), '') || '/'
  const queryString = request.url.includes('?') ? request.url.split('?')[1] : ''
  const query: Record<string, string> = {}
  if (queryString) {
    for (const [k, v] of new URLSearchParams(queryString)) query[k] = v
  }

  // 1. Find project
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  })

  if (!project) {
    return reply.code(404).send({ error: `No project with slug "${slug}"` })
  }
  if (!project.isActive) {
    return reply.code(503).send({ error: `Project "${slug}" is inactive` })
  }

  // 2. Load all resources for this project with their path and responses
  const resources = await prisma.resource.findMany({
    where: {
      isActive: true,
      path: { projectId: project.id },
    },
    select: {
      id: true,
      method: true,
      customPath: true,
      delay: true,
      delayMin: true,
      delayMax: true,
      errorRate: true,
      strategy: true,
      seqIndex: true,
      path: { select: { path: true } },
      responses: {
        select: {
          id: true, statusCode: true, bodyType: true, body: true,
          isDefault: true, weight: true, order: true, name: true,
          headers: { select: { key: true, value: true } },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      },
      conditions: {
        select: { id: true, responseId: true, expression: true, order: true },
        orderBy: { order: 'asc' },
      },
    },
  })

  // 3. Match resource
  let matched: typeof resources[number] | null = null
  let pathParams: Record<string, string> = {}

  for (const resource of resources) {
    if (resource.method !== request.method) continue
    const template = resource.customPath ?? resource.path.path
    const params = matchPath(template, resourcePath)
    if (params !== null) {
      matched = resource
      pathParams = params
      break
    }
  }

  if (!matched) {
    logRequest(project.id, null, request.method, resourcePath, request.headers as Record<string, string>, null, 404, null, null, Date.now() - start)
    return reply.code(404).send({ error: `No resource matches ${request.method} ${resourcePath}` })
  }

  // 4. Error rate
  if (matched.errorRate > 0 && Math.random() < matched.errorRate) {
    await applyDelay(matched)
    logRequest(project.id, matched.id, request.method, resourcePath, request.headers as Record<string, string>, null, 500, null, null, Date.now() - start)
    return reply.code(500).send({ error: 'Simulated error' })
  }

  // 5. Apply delay
  await applyDelay(matched)

  // 6. Build the request context once — shared by the CONDITIONAL strategy and variable interpolation
  let body: Record<string, unknown> = {}
  try { body = (request.body as Record<string, unknown>) ?? {} } catch {}
  const requestCtx: RequestCtx = {
    body,
    headers: request.headers as Record<string, string>,
    query,
    params: pathParams,
  }

  // 7. Select response by strategy
  const responses = matched.responses
  let selected: DbResponse | null = null

  if (matched.strategy === 'FIXED') {
    selected = pickFixed(responses)
  } else if (matched.strategy === 'RANDOM') {
    selected = pickRandom(responses)
  } else if (matched.strategy === 'SEQUENTIAL') {
    const idx = matched.seqIndex % (responses.length || 1)
    selected = responses[idx] ?? null
    // Advance seqIndex (fire-and-forget)
    prisma.resource.update({
      where: { id: matched.id },
      data: { seqIndex: idx + 1 },
    }).catch(() => {})
  } else if (matched.strategy === 'CONDITIONAL') {
    selected = pickConditional(responses, matched.conditions, requestCtx)
  }

  if (!selected) {
    logRequest(project.id, matched.id, request.method, resourcePath, request.headers as Record<string, string>, null, 204, null, null, Date.now() - start)
    return reply.code(204).send()
  }

  // 8. Interpolate variables in body
  const interpolatedBody = await interpolateVariables(
    selected.body ?? '',
    project.id,
    matched.id,
    requestCtx,
  )

  // 9. Set headers
  reply.header('Content-Type', CONTENT_TYPES[selected.bodyType] ?? 'application/json')
  reply.header('X-MockCamp-Resource', matched.id)
  reply.header('X-MockCamp-Response', selected.id)

  for (const h of selected.headers) {
    reply.header(h.key, h.value)
  }

  const responseBody = interpolatedBody
  const latencyMs = Date.now() - start

  // 10. Log — collect response headers that were set
  const sentResponseHeaders: Record<string, string> = {}
  const rawHeaders = reply.getHeaders()
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (v != null) sentResponseHeaders[k] = String(v)
  }

  logRequest(
    project.id, matched.id, request.method, resourcePath,
    request.headers as Record<string, string>,
    typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? null),
    selected.statusCode, sentResponseHeaders, responseBody, latencyMs,
  )

  return reply.code(selected.statusCode).send(responseBody)
}

async function logRequest(
  projectId: string,
  resourceId: string | null,
  method: string,
  path: string,
  requestHeaders: Record<string, unknown>,
  requestBody: string | null,
  statusCode: number,
  responseHeaders: Record<string, string> | null,
  responseBody: string | null,
  latencyMs: number,
) {
  try {
    await prisma.requestLog.create({
      data: {
        projectId,
        resourceId,
        method,
        path,
        requestHeaders: requestHeaders as Prisma.InputJsonValue,
        requestBody,
        statusCode,
        responseHeaders: responseHeaders === null ? Prisma.JsonNull : (responseHeaders as Prisma.InputJsonValue),
        responseBody,
        latencyMs,
      },
    })
  } catch { /* non-critical */ }
}

export async function mockEngineRoutes(app: FastifyInstance) {
  // Handle /:slug (no trailing path)
  app.all('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    if (slug.startsWith('_')) return reply.code(404).send({ error: 'Not found' })
    return handleMockRequest(request, reply, slug)
  })

  // Handle /:slug/* (with path)
  app.all('/:slug/*', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    if (slug.startsWith('_')) return reply.code(404).send({ error: 'Not found' })
    return handleMockRequest(request, reply, slug)
  })
}
