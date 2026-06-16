export function resolveValue(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('$context.')) {
    const path = value.slice('$context.'.length)
    return path.split('.').reduce((obj: any, key) => obj?.[key], context)
  }
  return value
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

export function evaluateExpression(
  expression: unknown,
  context: Record<string, unknown>
): boolean {
  if (expression === null || expression === undefined) return true

  if (Array.isArray(expression)) {
    return expression.every((item) => evaluateExpression(item, context))
  }

  if (typeof expression !== 'object') {
    return Boolean(expression)
  }

  const expr = expression as Record<string, unknown>
  const keys = Object.keys(expr)
  if (keys.length === 0) return true

  if ('$and' in expr) {
    const clauses = expr['$and'] as unknown[]
    return clauses.every((clause) => evaluateExpression(clause, context))
  }

  if ('$or' in expr) {
    const clauses = expr['$or'] as unknown[]
    return clauses.some((clause) => evaluateExpression(clause, context))
  }

  if ('$not' in expr) {
    return !evaluateExpression(expr['$not'], context)
  }

  if ('$eq' in expr) {
    const [left, right] = (expr['$eq'] as unknown[]).map((v) => resolveValue(v, context))
    return left === right
  }

  if ('$ne' in expr) {
    const [left, right] = (expr['$ne'] as unknown[]).map((v) => resolveValue(v, context))
    return left !== right
  }

  if ('$exists' in expr) {
    const value = resolveValue(expr['$exists'], context)
    return !isEmpty(value)
  }

  if ('$in' in expr) {
    const [left, list] = (expr['$in'] as unknown[]).map((v) => resolveValue(v, context))
    return Array.isArray(list) && list.includes(left)
  }

  if ('$nin' in expr) {
    const [left, list] = (expr['$nin'] as unknown[]).map((v) => resolveValue(v, context))
    return Array.isArray(list) && !list.includes(left)
  }

  throw new Error(`Unsupported expression operator: ${JSON.stringify(expr)}`)
}
