import { describe, it, expect } from 'vitest'
import { buildSelectQuery } from '../src/runtime/query-builder.js'

describe('buildSelectQuery', () => {
  it('builds a simple equality query', () => {
    const { sql, params } = buildSelectQuery('members', { status: { $eq: 'active' } })
    expect(sql).toContain('FROM type::table($table)')
    expect(sql).toContain('status = $p0')
    expect(params).toEqual({ table: 'members', p0: 'active' })
  })

  it('builds a list query with limit 1 for first', () => {
    const { sql } = buildSelectQuery('members', { status: { $eq: 'active' } }, { resultType: 'first' })
    expect(sql).toContain('LIMIT 1')
  })

  it('supports $ne, $exists, $in, $nin', () => {
    const { sql, params } = buildSelectQuery('members', {
      status: { $ne: 'deleted' },
      role: { $exists: true },
      tier: { $in: ['free', 'pro'] },
      group: { $nin: ['blocked'] }
    })
    expect(sql).toContain('status != $p0')
    expect(sql).toContain('role IS NOT NONE')
    expect(sql).toContain('tier IN $p1')
    expect(sql).toContain('group NOT IN $p2')
    expect(params).toMatchObject({ p0: 'deleted', p1: ['free', 'pro'], p2: ['blocked'] })
  })

  it('supports $and and $or', () => {
    const { sql } = buildSelectQuery('members', {
      $and: [
        { status: { $eq: 'active' } },
        { $or: [{ role: { $eq: 'owner' } }, { role: { $eq: 'admin' } }] }
      ]
    })
    expect(sql).toContain('(status = $p0)')
    expect(sql).toContain('((role = $p1) OR (role = $p2))')
  })

  it('resolves $context values', () => {
    const { params } = buildSelectQuery('members', { ownerId: { $eq: '$context.record.id' } }, undefined, {
      record: { id: 'rec-123' }
    })
    expect(params.p0).toBe('rec-123')
  })

  it('supports $not', () => {
    const { sql } = buildSelectQuery('members', {
      $not: { status: { $eq: 'archived' } }
    })
    expect(sql).toContain('NOT ((status = $p0))')
  })

  it('resolves $context values inside $exists', () => {
    const { sql } = buildSelectQuery(
      'members',
      { role: { $exists: '$context.includeRole' } },
      undefined,
      { includeRole: true }
    )
    expect(sql).toContain('role IS NOT NONE')
  })

  it('rejects unsafe field names', () => {
    expect(() => buildSelectQuery('members', { 'status; DROP TABLE members': { $eq: 'active' } })).toThrow(
      'Invalid field identifier: status; DROP TABLE members'
    )
    expect(() => buildSelectQuery('members', { 'status--': { $eq: 'active' } })).toThrow(
      'Invalid field identifier: status--'
    )
  })

  it('produces no WHERE for an empty filter', () => {
    const { sql } = buildSelectQuery('members', {})
    expect(sql).toBe('SELECT * FROM type::table($table)')
  })

  it('throws when $and value is not an array', () => {
    expect(() => buildSelectQuery('members', { $and: { status: { $eq: 'active' } } })).toThrow(
      'Expected $and to be an array'
    )
  })

  it('throws when $or value is not an array', () => {
    expect(() => buildSelectQuery('members', { $or: { status: { $eq: 'active' } } })).toThrow(
      'Expected $or to be an array'
    )
  })

  it('matches exact SQL for simple equality', () => {
    const { sql, params } = buildSelectQuery('members', { status: { $eq: 'active' } })
    expect(sql).toBe('SELECT * FROM type::table($table) WHERE (status = $p0)')
    expect(params).toEqual({ table: 'members', p0: 'active' })
  })
})
