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
