import { prisma } from '../prisma.js'
import { extractValue, type RequestCtx } from './request-context.js'

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

export async function interpolateVariables(
  template: string,
  projectId: string,
  resourceId: string,
  ctx: RequestCtx,
): Promise<string> {
  // Only resolve variables the template actually references, not every variable
  // defined on the project/resource.
  const names = [...new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]
  if (names.length === 0) return template

  // Load variables: resource-scoped first (higher priority), then project-scoped
  const variables = await prisma.variable.findMany({
    where: {
      name: { in: names },
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
