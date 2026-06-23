import type { FilterGroup, SortSetting, TableColumnConfig } from 'shared'
import type { RuntimeViewState } from './view-state.js'

export interface QueryBody {
  page: number
  pageSize: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: TableColumnConfig[]
}

export function buildQueryBody(
  runtime: RuntimeViewState,
  page: number,
  pageSize: number,
  options?: { filter?: FilterGroup },
): QueryBody {
  const body: QueryBody = { page, pageSize }
  const effectiveFilter = options?.filter ?? runtime.filter

  if (effectiveFilter && effectiveFilter.conditions.length > 0) {
    body.filter = effectiveFilter
  }

  if (runtime.sort.length > 0) {
    body.sort = runtime.sort
  }

  if (runtime.columns.length > 0) {
    body.columns = runtime.columns
  }

  return body
}
