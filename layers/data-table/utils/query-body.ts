import type { FilterGroup, QueryProjectionColumn, SortSetting, TableColumnConfig } from 'shared'
import type { RuntimeViewState } from './view-state.js'

export interface QueryBody {
  page: number
  pageSize: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: QueryProjectionColumn[]
  search?: string
}

function toProjectionColumn(col: TableColumnConfig): QueryProjectionColumn | null {
  if (col.type === 'lookup' && col.lookup) {
    return {
      field: `${col.lookup.from}.${col.lookup.field}`,
      as: col.label || `${col.lookup.from}.${col.lookup.field}`,
    }
  }
  if (col.column) {
    return { field: col.column }
  }
  return null
}

export function buildQueryBody(
  runtime: RuntimeViewState,
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
    .map(toProjectionColumn)
    .filter((c): c is QueryProjectionColumn => c !== null)

  if (projections.length > 0) {
    body.columns = projections
  }

  if (options?.search && options.search.trim().length > 0) {
    body.search = options.search.trim()
  }

  return body
}
