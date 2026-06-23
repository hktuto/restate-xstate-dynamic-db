import { describe, it, expect } from 'vitest'
import { buildQueryBody } from './query-body.js'
import type { RuntimeViewState } from './view-state.js'
import type { FilterGroup } from 'shared'

describe('buildQueryBody', () => {
  it('includes pagination, filter, sort, and visible columns', () => {
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
      columns: [{ field: 'name' }],
    })
  })

  it('includes search when provided', () => {
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [] },
      sort: [],
      group: [],
      columns: [],
    }

    const body = buildQueryBody(runtime, 1, 25, { search: '  Acme  ' })

    expect(body).toEqual({ page: 1, pageSize: 25, search: 'Acme' })
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
    expect(body.columns).toEqual([{ field: 'name' }])
  })

  it('converts lookup columns to field/as projections', () => {
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [] },
      sort: [],
      group: [],
      columns: [
        { column: 'email', visible: true },
        { type: 'lookup', lookup: { from: 'companyId', field: 'name' }, label: 'Company', visible: true },
        { column: 'status', visible: false },
      ],
    }

    const body = buildQueryBody(runtime, 1, 25)

    expect(body.columns).toEqual([
      { field: 'email' },
      { field: 'companyId.name', as: 'Company' },
    ])
  })
})
