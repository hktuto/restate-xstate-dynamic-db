import type { FilterGroup, QueryLookupProjectionColumn, QueryPlainProjectionColumn, QueryProjectionColumn, SortSetting, TableColumnConfig, TableSchema } from 'shared'
import type { RuntimeViewState } from './view-state.js'

export interface QueryBody {
  page: number
  pageSize: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: QueryProjectionColumn[]
  search?: string
}

function resolveLookup(
  col: TableColumnConfig,
  schema: TableSchema,
): QueryLookupProjectionColumn | null {
  if (col.type !== 'lookup' || !col.lookup) return null

  const relation = schema.relations.find((r) => r.name === col.lookup!.relation)
  if (!relation) return null

  const projection: QueryLookupProjectionColumn = {
    relation: col.lookup.relation,
    as: col.label || col.lookup.relation,
  }

  if (relation.kind === 'reference') {
    projection.field = col.lookup.field
    return projection
  }

  if (relation.kind === 'graph') {
    projection.field = col.lookup.field
    projection.agg = col.lookup.agg
    return projection
  }

  return null
}

function toProjectionColumn(col: TableColumnConfig, schema: TableSchema): QueryProjectionColumn | null {
  if (col.type === 'lookup' && col.lookup) {
    return resolveLookup(col, schema)
  }
  if (col.column) {
    const plain: QueryPlainProjectionColumn = { field: col.column }
    return plain
  }
  return null
}

export function buildQueryBody(
  runtime: RuntimeViewState,
  schema: TableSchema,
  page: number,
  pageSize: number,
  options?: { filter?: FilterGroup; search?: string },
): QueryBody {
  const body: QueryBody = { page, pageSize }
  const effectiveFilter = options?.filter ?? runtime.filter

  if (effectiveFilter && effectiveFilter.conditions.length > 0) {
    body.filter = effectiveFilter
  }

  if (runtime.sort.length > 0) {
    body.sort = runtime.sort
  }

  const visibleColumns = runtime.columns.filter((c) => c.visible !== false)
  const projections = visibleColumns
    .map((col) => toProjectionColumn(col, schema))
    .filter((c): c is QueryProjectionColumn => c !== null)

  if (projections.length > 0) {
    body.columns = projections
  }

  if (options?.search && options.search.trim().length > 0) {
    body.search = options.search.trim()
  }

  return body
}
