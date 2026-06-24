// packages/db/test/seed.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getSurreal, closeSurreal } from '../src/client.js'

describe('platform seed', () => {
  beforeAll(async () => {
    const { seed } = await import('../src/seed.js')
    await seed()
  })

  afterAll(async () => {
    const surreal = await getSurreal('platform', 'admin')
    await surreal.query(`REMOVE NAMESPACE IF EXISTS platform`)
    await closeSurreal(surreal)
  })

  it('creates system tables in platform/admin', async () => {
    const surreal = await getSurreal('platform', 'admin')
    const [info] = (await surreal.query('INFO FOR DB')) as [any]
    await closeSurreal(surreal)
    const tables = Object.keys(info.tables).filter((name: string) =>
      ['_tables', '_columns', '_relations', '_views'].includes(name)
    )
    expect(tables.sort()).toEqual(['_columns', '_relations', '_tables', '_views'])
  })

  it('seeds registry rows for platform tables and system columns', async () => {
    const surreal = await getSurreal('platform', 'admin')
    const [tables, columns, relations] = (await surreal.query(`
      SELECT * FROM _tables;
      SELECT * FROM _columns WHERE table = 'companies';
      SELECT * FROM _relations;
    `)) as [any[], any[], any[]]
    await closeSurreal(surreal)

    expect(tables.some((t) => t.name === 'companies')).toBe(true)
    expect(columns.some((c) => c.name === 'slug')).toBe(true)
    expect(columns.some((c) => c.name === 'createdAt' && c.system === true)).toBe(true)
    expect(relations.some((r) => r.fromTable === 'accounts' && r.toTable === 'user_profiles')).toBe(true)
  })

  it('seeds default views for platform tables', async () => {
    const surreal = await getSurreal('platform', 'admin')
    const [views] = (await surreal.query(
      'SELECT * FROM _views WHERE table = $tableName AND isDefault = true',
      { tableName: 'companies' }
    )) as [any[]]
    await closeSurreal(surreal)
    expect(views.length).toBeGreaterThan(0)
    expect(views[0].name).toBe('Default')
    expect(views[0].resourceType).toBe('company')
    expect(views[0].config.table.columns.length).toBeGreaterThan(0)
  })
})
