import { extractValue, type RequestCtx } from './request-context.js'

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
