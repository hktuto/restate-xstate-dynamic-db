// packages/db/test/provision.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { provisionCompanyNamespace } from '../src/provision.js'
import { getSurreal, closeSurreal } from '../src/client.js'

describe('provisionCompanyNamespace', () => {
  const testNs = `test_prov_${Date.now()}`

  beforeAll(async () => {
    await provisionCompanyNamespace(testNs)
  })

  afterAll(async () => {
    const surreal = await getSurreal(testNs, 'main')
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${testNs}`)
    await closeSurreal(surreal)
  })

  it('creates _tables, _columns, and _relations system tables', async () => {
    const surreal = await getSurreal(testNs, 'main')
    const [info] = (await surreal.query('INFO FOR DB')) as [any]
    await closeSurreal(surreal)
    const tables = Object.keys(info.tables).filter((name: string) =>
      ['_tables', '_columns', '_relations'].includes(name)
    )
    expect(tables.sort()).toEqual(['_columns', '_relations', '_tables'])
  })

  it('seeds registry rows for tenant tables and system columns', async () => {
    const surreal = await getSurreal(testNs, 'main')
    const [tables, columns, relations] = (await surreal.query(`
      SELECT * FROM _tables;
      SELECT * FROM _columns;
      SELECT * FROM _relations;
    `)) as [any[], any[], any[]]
    await closeSurreal(surreal)

    expect(tables.some((t) => t.name === 'members')).toBe(true)
    expect(columns.some((c) => c.table === 'members' && c.name === 'email')).toBe(true)
    expect(columns.some((c) => c.table === 'members' && c.name === 'createdAt' && c.system === true)).toBe(true)
    expect(relations.some((r) => r.fromTable === 'members' && r.toTable === 'user_profiles')).toBe(true)
  })
})
