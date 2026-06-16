import { resolveValue } from './expression.js'

export interface QueryOptions {
  resultType?: 'first' | 'list'
}

interface WhereResult {
  where: string
  nextIndex: number
}

export function buildSelectQuery(
  table: string,
  filter: Record<string, unknown>,
  options?: QueryOptions,
  context?: Record<string, unknown>
): { sql: string; params: Record<string, unknown> } {
  const params: Record<string, unknown> = { table }
  const { where } = buildWhere(filter, params, 0, context ?? {})

  let sql = 'SELECT * FROM type::table($table)'
  if (where) sql += ` WHERE ${where}`
  if (options?.resultType === 'first') sql += ' LIMIT 1'

  return { sql, params }
}

function buildWhere(
  filter: unknown,
  params: Record<string, unknown>,
  index: number,
  context: Record<string, unknown>
): WhereResult {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return { where: '', nextIndex: index }
  }

  const entries = Object.entries(filter as Record<string, unknown>)
  if (entries.length === 0) return { where: '', nextIndex: index }

  const clauses: string[] = []

  for (const [key, value] of entries) {
    if (key === '$and') {
      const parts: string[] = []
      for (const sub of value as unknown[]) {
        const res = buildWhere(sub, params, index, context)
        if (res.where) parts.push(res.where)
        index = res.nextIndex
      }
      if (parts.length) clauses.push(`(${parts.join(' AND ')})`)
    } else if (key === '$or') {
      const parts: string[] = []
      for (const sub of value as unknown[]) {
        const res = buildWhere(sub, params, index, context)
        if (res.where) parts.push(res.where)
        index = res.nextIndex
      }
      if (parts.length) clauses.push(`(${parts.join(' OR ')})`)
    } else if (key === '$not') {
      const res = buildWhere(value, params, index, context)
      if (res.where) clauses.push(`NOT (${res.where})`)
      index = res.nextIndex
    } else {
      const res = buildFieldClause(key, value as Record<string, unknown>, params, index, context)
      if (res.where) clauses.push(res.where)
      index = res.nextIndex
    }
  }

  return { where: clauses.join(' AND '), nextIndex: index }
}

function buildFieldClause(
  field: string,
  ops: Record<string, unknown>,
  params: Record<string, unknown>,
  index: number,
  context: Record<string, unknown>
): WhereResult {
  const clauses: string[] = []

  for (const [op, raw] of Object.entries(ops)) {
    if (op === '$exists') {
      const resolved = resolveValue(raw, context)
      clauses.push(resolved === true || resolved === 'true' ? `${field} IS NOT NONE` : `${field} IS NONE`)
      continue
    }

    const paramKey = `p${index++}`
    const value = resolveValue(raw, context)

    if (op === '$eq') {
      clauses.push(`${field} = $${paramKey}`)
    } else if (op === '$ne') {
      clauses.push(`${field} != $${paramKey}`)
    } else if (op === '$in') {
      clauses.push(`${field} IN $${paramKey}`)
    } else if (op === '$nin') {
      clauses.push(`${field} NOT IN $${paramKey}`)
    } else {
      throw new Error(`Unsupported filter operator: ${op}`)
    }

    params[paramKey] = value
  }

  const where = clauses.join(' AND ')
  return { where: where ? `(${where})` : '', nextIndex: index }
}
