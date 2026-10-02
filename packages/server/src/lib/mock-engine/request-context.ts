export type RequestCtx = {
  body: Record<string, unknown>
  headers: Record<string, string>
  query: Record<string, string>
  params: Record<string, string>
}

// Resolves a dotted accessor like `request.body.user.id`, `request.headers["x-key"]`,
// `request.query.page` or `request.params.id` against the current request context.
// Shared by the condition expression evaluator and DYNAMIC variable resolution.
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
