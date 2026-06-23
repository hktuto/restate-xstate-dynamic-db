import { describe, it, expect } from 'vitest'
import { buildTableQuery } from './table-query-builder.js'

describe('buildTableQuery', () => {
  it('builds a query with pagination only', () => {
    const { query, vars } = buildTableQuery('members', { page: 2, pageSize: 10 })
    expect(query).toContain('SELECT * FROM members')
    expect(query).toContain('LIMIT $limit START $start')
    expect(query).toContain('SELECT count() AS total FROM members GROUP ALL')
    expect(vars.limit).toBe(10)
    expect(vars.start).toBe(10)
  })

  it('applies a single filter condition', () => {
    const { query, vars } = buildTableQuery('members', {
      filter: { op: 'and', conditions: [{ field: 'status', operator: 'eq', value: 'active' }] },
    })
    expect(query).toContain('WHERE status = $v0')
    expect(query).toContain('SELECT count() AS total FROM members WHERE status = $v0 GROUP ALL')
    expect(vars.v0).toBe('active')
  })

  it('applies nested AND/OR filter groups', () => {
    const { query } = buildTableQuery('members', {
      filter: {
        op: 'and',
        conditions: [
          { field: 'status', operator: 'eq', value: 'active' },
          {
            op: 'or',
            conditions: [
              { field: 'role', operator: 'eq', value: 'admin' },
              { field: 'role', operator: 'eq', value: 'owner' },
            ],
          },
        ],
      },
    })
    expect(query).toContain('WHERE (status = $v0 AND (role = $v1 OR role = $v2))')
  })

  it('supports all filter operators', () => {
    const { query, vars } = buildTableQuery('members', {
      filter: {
        op: 'and',
        conditions: [
          { field: 'a', operator: 'eq', value: 1 },
          { field: 'b', operator: 'neq', value: 2 },
          { field: 'c', operator: 'gt', value: 3 },
          { field: 'd', operator: 'gte', value: 4 },
          { field: 'e', operator: 'lt', value: 5 },
          { field: 'f', operator: 'lte', value: 6 },
          { field: 'g', operator: 'contains', value: 'x' },
          { field: 'h', operator: 'startsWith', value: 'y' },
          { field: 'i', operator: 'endsWith', value: 'z' },
          { field: 'j', operator: 'in', value: [1, 2] },
          { field: 'k', operator: 'notIn', value: [3, 4] },
        ],
      },
    })
    expect(query).toContain('a = $v0')
    expect(query).toContain('b != $v1')
    expect(query).toContain('c > $v2')
    expect(query).toContain('d >= $v3')
    expect(query).toContain('e < $v4')
    expect(query).toContain('f <= $v5')
    expect(query).toContain('string::contains(g, $v6)')
    expect(query).toContain('string::starts_with(h, $v7)')
    expect(query).toContain('string::ends_with(i, $v8)')
    expect(query).toContain('j IN $v9')
    expect(query).toContain('k NOT IN $v10')
    expect(Object.keys(vars)).toHaveLength(13) // 11 values + limit + start
  })

  it('ignores filter conditions with an empty field', () => {
    const { query, vars } = buildTableQuery('members', {
      filter: {
        op: 'and',
        conditions: [
          { field: 'status', operator: 'eq', value: 'active' },
          { field: '', operator: 'eq', value: '' },
        ],
      },
    })
    expect(query).toContain('WHERE status = $v0')
    expect(query).not.toContain('AND')
    expect(vars.v0).toBe('active')
    expect(vars.v1).toBeUndefined()
  })

  it('applies sort settings', () => {
    const { query } = buildTableQuery('members', {
      sort: [
        { field: 'createdAt', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ],
    })
    expect(query).toContain('ORDER BY createdAt DESC, name ASC')
  })

  it('skips sort fields that are not in the schema', () => {
    const { query } = buildTableQuery(
      'members',
      {
        sort: [
          { field: 'createdAt', direction: 'desc' },
          { field: 'name', direction: 'asc' },
        ],
      },
      new Set(['name'])
    )
    expect(query).toContain('ORDER BY name ASC')
    expect(query).not.toContain('createdAt')
  })

  it('omits ORDER BY when all sort fields are missing from schema', () => {
    const { query } = buildTableQuery(
      'members',
      {
        sort: [{ field: 'createdAt', direction: 'desc' }],
      },
      new Set(['name'])
    )
    expect(query).not.toContain('ORDER BY')
  })

  it('projects visible columns', () => {
    const { query } = buildTableQuery('members', {
      columns: [
        { column: 'email', visible: true },
        { column: 'role', visible: false },
        { column: 'status', visible: true },
      ],
    })
    expect(query).toContain('SELECT id, email, status FROM members')
  })

  it('deduplicates id in projection', () => {
    const { query } = buildTableQuery('members', {
      columns: [
        { column: 'id', visible: true },
        { column: 'email', visible: true },
      ],
    })
    expect(query).toContain('SELECT id, email FROM members')
    expect(query).not.toContain('SELECT id, id,')
  })

  it('includes sort fields in the projection', () => {
    const { query } = buildTableQuery('members', {
      columns: [{ column: 'email', visible: true }],
      sort: [{ field: 'createdAt', direction: 'desc' }],
    })
    expect(query).toContain('SELECT id, email, createdAt FROM members')
    expect(query).toContain('ORDER BY createdAt DESC')
  })

  it('falls back to SELECT * when no visible columns are specified', () => {
    const { query } = buildTableQuery('members', {
      columns: [{ column: 'email', visible: false }],
    })
    expect(query).toContain('SELECT * FROM members')
  })

  it('rejects invalid field names in filters', () => {
    expect(() =>
      buildTableQuery('members', {
        filter: { op: 'and', conditions: [{ field: 'status; DROP', operator: 'eq', value: 'x' }] },
      })
    ).toThrow('Invalid field name')
  })

  it('rejects invalid field names in sort', () => {
    expect(() =>
      buildTableQuery('members', {
        sort: [{ field: 'name; DROP', direction: 'asc' }],
      })
    ).toThrow('Invalid field name')
  })

  it('rejects invalid field names in columns', () => {
    expect(() =>
      buildTableQuery('members', {
        columns: [{ column: 'email; DROP', visible: true }],
      })
    ).toThrow('Invalid field name')
  })

  it('makes text field filters case-insensitive', () => {
    const { query, vars } = buildTableQuery(
      'members',
      {
        filter: {
          op: 'and',
          conditions: [
            { field: 'name', operator: 'eq', value: 'Alice' },
            { field: 'email', operator: 'contains', value: 'TEST' },
            { field: 'age', operator: 'eq', value: 30 },
          ],
        },
      },
      new Set(['name', 'email', 'age']),
      new Set(['name', 'email'])
    )
    expect(query).toContain('string::lowercase(name) = string::lowercase($v0)')
    expect(query).toContain('string::contains(string::lowercase(email), string::lowercase($v1))')
    expect(query).toContain('age = $v2')
    expect(vars.v0).toBe('Alice')
    expect(vars.v1).toBe('TEST')
    expect(vars.v2).toBe(30)
  })

  it('rejects unsupported operators', () => {
    expect(() =>
      buildTableQuery('members', {
        filter: { op: 'and', conditions: [{ field: 'status', operator: 'invalid' as any, value: 'x' }] },
      })
    ).toThrow('Unsupported operator')
  })
})
