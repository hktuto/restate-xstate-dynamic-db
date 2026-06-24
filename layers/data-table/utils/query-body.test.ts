import { describe, it, expect } from 'vitest'
import { buildQueryBody } from './query-body.js'
import type { RuntimeViewState } from './view-state.js'
import type { FilterGroup, TableSchema } from 'shared'

function makeSchema(overrides?: Partial<TableSchema>): TableSchema {
  return {
    table: { id: 'tables:members', name: 'members', label: 'Members' },
    columns: [],
    relations: [],
    ...overrides,
  } as TableSchema
}

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

    const body = buildQueryBody(runtime, makeSchema(), 2, 50)

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

    const body = buildQueryBody(runtime, makeSchema(), 1, 25, { search: '  Acme  ' })

    expect(body).toEqual({ page: 1, pageSize: 25, search: 'Acme' })
  })

  it('omits empty filter, sort, and columns', () => {
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [] },
      sort: [],
      group: [],
      columns: [],
    }

    const body = buildQueryBody(runtime, makeSchema(), 1, 25)

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

    const body = buildQueryBody(runtime, makeSchema(), 1, 25, { filter: appliedFilter })

    expect(body.filter).toEqual(appliedFilter)
    expect(body.filter).not.toEqual(runtime.filter)
    expect(body.columns).toEqual([{ field: 'name' }])
  })

  it('converts reference lookup columns to structured projections', () => {
    const schema = makeSchema({
      relations: [
        { id: 'rel:1', kind: 'reference', name: 'companyId', fromTable: 'members', fromColumn: 'companyId', toTable: 'companies', toColumn: 'id' },
      ],
    })
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [] },
      sort: [],
      group: [],
      columns: [
        { column: 'email', visible: true },
        { type: 'lookup', lookup: { relation: 'companyId', field: 'name' }, label: 'Company', visible: true },
        { column: 'status', visible: false },
      ],
    }

    const body = buildQueryBody(runtime, schema, 1, 25)

    expect(body.columns).toEqual([
      { field: 'email' },
      { relation: 'companyId', field: 'name', as: 'Company' },
    ])
  })

  it('converts graph list lookups to structured projections', () => {
    const schema = makeSchema({
      table: { id: 'tables:members', name: 'members', label: 'Members' },
      relations: [
        { id: 'rel:g1', kind: 'graph', name: 'members', fromTable: 'members', toTable: 'user_groups', linkTable: 'user_group_memberships' },
      ],
    })
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [] },
      sort: [],
      group: [],
      columns: [
        { type: 'lookup', lookup: { relation: 'members', field: 'name', agg: 'list' }, label: 'Groups', visible: true },
      ],
    }

    const body = buildQueryBody(runtime, schema, 1, 25)

    expect(body.columns).toEqual([
      { relation: 'members', field: 'name', agg: 'list', as: 'Groups' },
    ])
  })

  it('converts graph count lookups to structured projections', () => {
    const schema = makeSchema({
      table: { id: 'tables:user_groups', name: 'user_groups', label: 'User Groups' },
      relations: [
        { id: 'rel:g1', kind: 'graph', name: 'members', fromTable: 'members', toTable: 'user_groups', linkTable: 'user_group_memberships' },
      ],
    })
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [] },
      sort: [],
      group: [],
      columns: [
        { type: 'lookup', lookup: { relation: 'members', agg: 'count' }, label: 'Members Count', visible: true },
      ],
    }

    const body = buildQueryBody(runtime, schema, 1, 25)

    expect(body.columns).toEqual([
      { relation: 'members', agg: 'count', as: 'Members Count' },
    ])
  })

  it('omits empty filter and whitespace-only search', () => {
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [] },
      sort: [],
      group: [],
      columns: [],
    }
    const body = buildQueryBody(runtime, makeSchema(), 1, 25, { filter: runtime.filter, search: '   ' })
    expect(body.filter).toBeUndefined()
    expect(body.search).toBeUndefined()
  })
})
