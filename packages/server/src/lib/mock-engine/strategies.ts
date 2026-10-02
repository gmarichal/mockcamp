import { evalExpression } from './expressions.js'
import type { RequestCtx } from './request-context.js'

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

export function pickConditional(
  responses: DbResponse[],
  conditions: DbCondition[],
  ctx: RequestCtx,
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
