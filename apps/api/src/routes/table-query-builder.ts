import type { FilterCondition, FilterGroup, QueryLookupProjectionColumn, QueryProjectionColumn, RelationRow, SortSetting, TableSchema } from 'shared'

export interface QueryBody {
  page?: number
  pageSize?: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: QueryProjectionColumn[]
  search?: string
}

interface BuildResult {
  query: string
  vars: Record<string, unknown>
}

const VALID_FIELD = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/

const OPERATORS: Record<FilterCondition['operator'], string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  contains: 'contains',
  startsWith: 'starts_with',
  endsWith: 'ends_with',
  in: 'IN',
  notIn: 'NOT IN',
}

const TEXT_OPERATORS = new Set<FilterCondition['operator']>(['eq', 'neq', 'contains', 'startsWith', 'endsWith'])

function assertField(name: string, context: string): void {
  if (!VALID_FIELD.test(name)) {
    throw new Error(`Invalid field name in ${context}: ${name}`)
  }
}

function buildField(name: string): string {
  // SurrealDB accepts dotted nested paths directly, e.g. address.city
  return name
}

function sanitizeAlias(alias: string): string {
  return alias.replace(/`/g, '')
}

function buildCondition(condition: FilterCondition, index: { value: number }, textFields?: Set<string>): string {
  // ponytail: ignore freshly-added conditions that have no field yet. This prevents
  // reactive UIs from firing invalid queries while the user is still editing.
  if (!condition.field) return ''
  assertField(condition.field, 'filter')
  if (!OPERATORS[condition.operator]) {
    throw new Error(`Unsupported operator: ${condition.operator}`)
  }

  const field = buildField(condition.field)
  const varName = `$v${index.value++}`
  const op = condition.operator
  const isText = textFields?.has(condition.field)

  if (isText && TEXT_OPERATORS.has(op)) {
    if (op === 'contains' || op === 'startsWith' || op === 'endsWith') {
      return `string::${OPERATORS[op]}(string::lowercase(<string> ${field}), string::lowercase(${varName}))`
    }
    return `string::lowercase(<string> ${field}) ${OPERATORS[op]} string::lowercase(${varName})`
  }

  if (op === 'contains' || op === 'startsWith' || op === 'endsWith') {
    return `string::${OPERATORS[op]}(${field}, ${varName})`
  }

  return `${field} ${OPERATORS[op]} ${varName}`
}

function buildFilter(group: FilterGroup, index: { value: number }, textFields?: Set<string>): string {
  const parts = group.conditions
    .map((item): string => {
      if ('op' in item) {
        return buildFilter(item, index, textFields)
      }
      return buildCondition(item, index, textFields)
    })
    .filter(Boolean)

  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `(${parts.join(` ${group.op.toUpperCase()} `)})`
}

function buildSort(sort: SortSetting[]): string {
  if (sort.length === 0) return ''
  return sort
    .map((s) => {
      assertField(s.field, 'sort')
      return `${buildField(s.field)} ${s.direction.toUpperCase()}`
    })
    .join(', ')
}

function isProjectionExpression(field: string): boolean {
  return field.includes('(') || field.includes('->') || field.includes('<-')
}

function resolveLookupExpression(col: QueryLookupProjectionColumn, tableName: string, schema?: TableSchema | null): string {
  if (!schema) {
    throw new Error(`Lookup column requires schema: ${col.relation}`)
  }
  const relation = schema.relations.find((r) => r.name === col.relation)
  if (!relation) {
    throw new Error(`Unknown relation in projection: ${col.relation}`)
  }

  if (relation.kind === 'reference') {
    if (!relation.fromColumn || !col.field) {
      throw new Error(`Reference lookup requires a field: ${col.relation}`)
    }
    return `${relation.fromColumn}.${col.field}`
  }

  if (relation.kind === 'graph' && relation.linkTable) {
    const isForward = relation.fromTable === tableName
    const traversal = isForward
      ? `->${relation.linkTable}->${relation.toTable}`
      : `<-${relation.linkTable}<-${relation.fromTable}`
    if (col.agg === 'count') {
      return `count(${traversal})`
    }
    if (col.field) {
      return `${traversal}.${col.field}`
    }
  }

  throw new Error(`Invalid lookup projection: ${col.relation}`)
}

function buildProjection(columns: QueryProjectionColumn[], sortFields: string[], tableName: string, schema?: TableSchema | null): string {
  const items = new Set<string>()

  for (const col of columns) {
    if ('relation' in col) {
      const expr = resolveLookupExpression(col, tableName, schema)
      const alias = col.as || col.relation
      items.add(`${expr} AS \`${sanitizeAlias(alias)}\``)
    } else if ('field' in col && col.field) {
      if (!isProjectionExpression(col.field)) {
        assertField(col.field, 'columns')
      }
      if (col.as) {
        items.add(`${buildField(col.field)} AS \`${sanitizeAlias(col.as)}\``)
      } else {
        items.add(buildField(col.field))
      }
    }
  }

  for (const name of sortFields) {
    assertField(name, 'sort')
    items.add(buildField(name))
  }

  const selected = [...items]
  if (selected.length === 0) return '*'
  return selected.includes('id') ? selected.join(', ') : `id, ${selected.join(', ')}`
}

export function buildTableQuery(table: string, body: QueryBody, validFields?: Set<string>, textFields?: Set<string>, schema?: TableSchema | null): BuildResult {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table name: ${table}`)
  }

  const limit = body.pageSize ?? 25
  const start = ((body.page ?? 1) - 1) * limit
  const vars: Record<string, unknown> = { limit, start }

  const index = { value: 0 }
  const whereClause = body.filter && body.filter.conditions.length > 0
    ? buildFilter(body.filter, index, textFields)
    : ''

  const searchClause = body.search && textFields && textFields.size > 0
    ? `(${[...textFields].map((f) => `string::contains(string::lowercase(<string> ${buildField(f)}), string::lowercase($search))`).join(' OR ')})`
    : ''

  const combinedClauses = [whereClause, searchClause].filter(Boolean)
  const combinedWhere = combinedClauses.length > 0
    ? combinedClauses.length === 1 ? combinedClauses[0] : `(${combinedClauses.join(' AND ')})`
    : ''

  const sortSettings = body.sort?.filter((s) => !validFields || validFields.has(s.field)) ?? []
  const orderBy = sortSettings.length > 0 ? buildSort(sortSettings) : ''
  const projection = body.columns && body.columns.length > 0
    ? buildProjection(body.columns, sortSettings.map((s) => s.field), table, schema)
    : sortSettings.length > 0
      ? buildProjection([], sortSettings.map((s) => s.field), table, schema)
      : '*'

  const whereSql = combinedWhere ? `WHERE ${combinedWhere}` : ''
  const orderSql = orderBy ? `ORDER BY ${orderBy}` : ''

  // ponytail: two queries share the same binding names; keep value indices in sync.
  const recordsQuery = [
    `SELECT ${projection} FROM ${table}`,
    whereSql,
    orderSql,
    'LIMIT $limit START $start',
  ]
    .filter(Boolean)
    .join(' ')

  const countQuery = combinedWhere
    ? `SELECT count() AS total FROM ${table} WHERE ${combinedWhere} GROUP ALL`
    : `SELECT count() AS total FROM ${table} GROUP ALL`

  const query = `${recordsQuery}\n;\n${countQuery}`

  // Collect bindings from filter conditions after the query string is built.
  // Re-walking the tree is simpler than threading a binding map through buildFilter.
  collectBindings(body.filter, vars)

  if (body.search && textFields && textFields.size > 0) {
    vars.search = body.search
  }

  return { query, vars }
}

function collectBindings(group: FilterGroup | undefined, vars: Record<string, unknown>): void {
  if (!group || group.conditions.length === 0) return

  let index = 0
  function walk(item: FilterCondition | FilterGroup): void {
    if ('op' in item) {
      item.conditions.forEach(walk)
      return
    }
    if (!item.field) return
    vars[`v${index++}`] = item.value
  }
  group.conditions.forEach(walk)
}
