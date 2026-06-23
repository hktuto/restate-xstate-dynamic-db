import { describe, it, expect } from 'vitest'
import { buildQueryBody } from './query-body.js'
import type { RuntimeViewState } from './view-state.js'
import type { FilterGroup } from 'shared'

describe('buildQueryBody', () => {
  it('includes pagination, filter, sort, and columns', () => {
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [{ field: 'status', operator: 'eq', value: 'active' }] },
      sort: [{ field: 'name', direction: 'asc' }],
      group: [{ field: 'role' }],
      columns: [
        { column: 'name', visible: true },
        { column: 'email', visible: false },
      ],
    }

    const body = buildQueryBody(runtime, 2, 50)

    expect(body).toEqual({
      page: 2,
      pageSize: 50,
      filter: runtime.filter,
      sort: runtime.sort,
      columns: runtime.columns,
    })
  })

  it('omits empty filter, sort, and columns', () => {
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [] },
      sort: [],
      group: [],
      columns: [],
    }

    const body = buildQueryBody(runtime, 1, 25)

    expect(body).toEqual({
      page: 1,
      pageSize: 25,
    })
  })

  it('uses provided applied filter instead of runtime.filter', () => {
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [{ field: 'status', operator: 'eq', value: 'draft' }] },
      sort: [{ field: 'name', direction: 'asc' }],
      group: [],
      columns: [{ column: 'name', visible: true }],
    }
    const appliedFilter: FilterGroup = { op: 'and', conditions: [{ field: 'status', operator: 'eq', value: 'active' }] }

    const body = buildQueryBody(runtime, 1, 25, { filter: appliedFilter })

    expect(body.filter).toEqual(appliedFilter)
    expect(body.filter).not.toEqual(runtime.filter)
  })
})
