import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

// ─── Path matching ────────────────────────────────────────────────────────────

export function buildPattern(template: string): { regex: RegExp; params: string[] } {
  const params: string[] = []
  // Replace :param and {param} before escaping
  let escaped = ''
  let i = 0
  while (i < template.length) {
    if (template[i] === ':' && /\w/.test(template[i + 1] ?? '')) {
      let name = ''
      i++
      while (i < template.length && /\w/.test(template[i])) { name += template[i]; i++ }
      params.push(name)
      escaped += '([^/]+)'
    } else if (template[i] === '{' && template.indexOf('}', i) !== -1) {
      const end = template.indexOf('}', i)
      const name = template.slice(i + 1, end)
      params.push(name)
      escaped += '([^/]+)'
      i = end + 1
    } else if (template[i] === '*') {
      escaped += '.*'
      i++
    } else {
      escaped += template[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      i++
    }
  }
  return { regex: new RegExp(`^${escaped}$`), params }
}

// Path templates rarely change relative to request volume — cache the compiled regex per template.
const patternCache = new Map<string, { regex: RegExp; params: string[] }>()

function getPattern(template: string): { regex: RegExp; params: string[] } {
  let pattern = patternCache.get(template)
  if (!pattern) {
    pattern = buildPattern(template)
    patternCache.set(template, pattern)
  }
  return pattern
}

export function matchPath(template: string, url: string): Record<string, string> | null {
  const { regex, params } = getPattern(template)
  const match = url.match(regex)
  if (!match) return null
  const result: Record<string, string> = {}
  params.forEach((p, i) => { result[p] = match[i + 1] })
  return result
}

// ─── Strategy: select response ────────────────────────────────────────────────

export type DbResponse = {
  id: string
  statusCode: number
  bodyType: string
  body: string | null
  isDefault: boolean
  weight: number
  order: number
  name: string | null
  headers: { key: string; value: string }[]
}

export type DbCondition = {
  id: string
  responseId: string
  expression: string
  order: number
}

export function pickFixed(responses: DbResponse[]): DbResponse | null {
  return responses.find(r => r.isDefault) ?? responses[0] ?? null
}

export function pickRandom(responses: DbResponse[]): DbResponse | null {
  if (!responses.length) return null
  const total = responses.reduce((s, r) => s + r.weight, 0)
  let rand = Math.random() * total
  for (const r of responses) {
    rand -= r.weight
    if (rand <= 0) return r
  }
  return responses[responses.length - 1]
}

function resolveRight(raw: string): unknown {
  const t = raw.trim()
  if (/^["'](.*)["']$/.test(t)) return t.slice(1, -1)
  if (t === 'null') return null
  if (t === 'true') return true
  if (t === 'false') return false
  const n = Number(t)
  if (!isNaN(n)) return n
  return t
}

// Expression evaluator — supports:
//   left op right     where op: == != > < >= <= contains
//   left exists       field is present (not null/undefined)
//   left !exists      field is absent (null/undefined)
//
// left sources: request.body.x  |  request.headers["y"]  |  request.query.z  |  request.params.z
export function evalExpression(expression: string, ctx: RequestCtx): boolean {
  try {
    // Unary: exists / !exists
    const existsMatch = expression.match(/^(.+?)\s+(!?exists)$/)
    if (existsMatch) {
      const val = extractValue(existsMatch[1], ctx)
      return existsMatch[2] === 'exists' ? (val != null) : (val == null)
    }

    // Binary: left op right
    const opMatch = expression.match(/^(.+?)\s*(==|!=|>=|<=|>|<|contains)\s*(.+)$/)
    if (!opMatch) return false
    const [, leftRaw, op, rightRaw] = opMatch
    const left = extractValue(leftRaw, ctx)
    const right = resolveRight(rightRaw)

    switch (op) {
      case '==':       return left == right   // eslint-disable-line eqeqeq
      case '!=':       return left != right   // eslint-disable-line eqeqeq
      case '>':        return Number(left) > Number(right)
      case '<':        return Number(left) < Number(right)
      case '>=':       return Number(left) >= Number(right)
      case '<=':       return Number(left) <= Number(right)
      case 'contains': return String(left ?? '').includes(String(right ?? ''))
    }
  } catch { /* fall through */ }
  return false
}

export function pickConditional(
  responses: DbResponse[],
  conditions: DbCondition[],
  ctx: Parameters<typeof evalExpression>[1],
): DbResponse | null {
  const sorted = [...conditions].sort((a, b) => a.order - b.order)
  for (const cond of sorted) {
    if (evalExpression(cond.expression, ctx)) {
      const resp = responses.find(r => r.id === cond.responseId)
      if (resp) return resp
    }
  }
  // Fallback to default
  return pickFixed(responses)
}

// ─── Delay helper ─────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function applyDelay(resource: { delay: number | null; delayMin: number | null; delayMax: number | null }) {
  if (resource.delay != null && resource.delay > 0) {
    await sleep(resource.delay)
  } else if (resource.delayMin != null && resource.delayMax != null) {
    const ms = resource.delayMin + Math.random() * (resource.delayMax - resource.delayMin)
    await sleep(ms)
  }
}

// ─── Variable interpolation ───────────────────────────────────────────────────

export type RequestCtx = {
  body: Record<string, unknown>
  headers: Record<string, string>
  query: Record<string, string>
  params: Record<string, string>
}

export async function interpolateVariables(
  template: string,
  projectId: string,
  resourceId: string,
  ctx: RequestCtx,
): Promise<string> {
  if (!template.includes('{{')) return template

  // Load variables: resource-scoped first (higher priority), then project-scoped
  const variables = await prisma.variable.findMany({
    where: {
      OR: [
        { projectId, resourceId: null },
        { resourceId },
      ],
    },
    select: { name: true, type: true, value: true, expression: true, resourceId: true },
  })

  // Build a map — resource-scoped overrides project-scoped, so apply project-scoped first
  const varMap = new Map<string, string>()
  for (const v of [...variables].sort((a, b) => (a.resourceId ? 1 : 0) - (b.resourceId ? 1 : 0))) {
    varMap.set(v.name, resolveVariable(v, ctx))
  }

  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    return varMap.has(name) ? varMap.get(name)! : match
  })
}

export function extractValue(path: string, ctx: RequestCtx): unknown {
  path = path.trim()
  const hdrMatch = path.match(/^request\.headers\[["'](.+?)["']\]$/)
  if (hdrMatch) return ctx.headers[hdrMatch[1].toLowerCase()] ?? null
  const bodyMatch = path.match(/^request\.body\.(.+)$/)
  if (bodyMatch) {
    return bodyMatch[1].split('.').reduce<unknown>((o, k) => {
      if (o && typeof o === 'object') return (o as Record<string, unknown>)[k]
      return undefined
    }, ctx.body)
  }
  const queryMatch = path.match(/^request\.query\.(.+)$/)
  if (queryMatch) return ctx.query[queryMatch[1]] ?? null
  const paramMatch = path.match(/^request\.params\.(.+)$/)
  if (paramMatch) return ctx.params[paramMatch[1]] ?? null
  return null
}

export function resolveVariable(
  v: { type: string; value: string | null; expression: string | null },
  ctx: RequestCtx,
): string {
  if (v.type === 'STATIC') {
    return v.value ?? ''
  }
  if (v.type === 'DYNAMIC') {
    return String(extractValue(v.expression ?? '', ctx) ?? '')
  }
  return ''
}

// ─── Engine handler ───────────────────────────────────────────────────────────

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

// ─── Route registration ───────────────────────────────────────────────────────

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
