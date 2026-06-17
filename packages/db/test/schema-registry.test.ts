import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { provisionCompanyNamespace } from '../src/provision.js'
import {
  listTables,
  listUserTables,
  upsertTable,
  upsertColumn,
  upsertRelation,
  getTableSchema,
  syncTableSchemaFromRecords,
} from '../src/schema-registry.js'
import { getSurreal, closeSurreal } from '../src/client.js'
import { SYSTEM_COLUMNS } from '../src/schema-definitions.js'
import { uniqueTenantName } from './helpers.js'

describe('schema-registry', () => {
  const testNs = uniqueTenantName()

  beforeAll(async () => {
    await provisionCompanyNamespace(testNs)
    const surreal = await getSurreal(testNs, 'main')
    await surreal.query(`
      UPSERT contacts:test SET name = 'Alice', age = 30, active = true, createdAt = time::now();
    `)
    await closeSurreal(surreal)
  })

  afterAll(async () => {
    const surreal = await getSurreal(testNs, 'main')
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${testNs}`)
    await closeSurreal(surreal)
  })

  it('upserts and lists a table', async () => {
    await upsertTable(testNs, 'main', { name: 'contacts', label: 'Contacts' })
    const tables = await listTables(testNs, 'main')
    expect(tables.some((t) => t.name === 'contacts')).toBe(true)
  })

  it('listUserTables excludes system tables and includes user tables', async () => {
    const tables = await listUserTables(testNs, 'main')
    expect(tables.some((t) => t.name.startsWith('_'))).toBe(false)
    expect(tables.some((t) => t.name === 'contacts')).toBe(true)
  })

  it('upserts a column', async () => {
    const result = await upsertColumn(testNs, 'main', {
      table: 'contacts',
      name: 'email',
      dbType: 'string',
      displayType: 'email',
      optional: true,
    })
    expect(result.id).toBe('_columns:⟨contacts:email⟩')
    const schema = await getTableSchema(testNs, 'main', 'contacts')
    expect(schema).not.toBeNull()
    const email = schema!.columns.find((c) => c.name === 'email')
    expect(email).toBeDefined()
    expect(email?.dbType).toBe('string')
    expect(email?.displayType).toBe('email')
  })

  it('upserts a relation', async () => {
    const result = await upsertRelation(testNs, 'main', {
      name: 'contacts_to_companies',
      fromTable: 'contacts',
      fromColumn: 'companyId',
      toTable: 'companies',
      toColumn: 'id',
      type: 'many-to-many',
    })
    expect(result.id).toBe('_relations:⟨contacts:companyId:companies:id⟩')
    const schema = await getTableSchema(testNs, 'main', 'contacts')
    expect(schema).not.toBeNull()
    expect(schema!.relations.some((r) => r.toTable === 'companies')).toBe(true)
  })

  it('syncs schema from records and infers types', async () => {
    await syncTableSchemaFromRecords(testNs, 'main', 'contacts')
    const schema = await getTableSchema(testNs, 'main', 'contacts')
    expect(schema).not.toBeNull()
    expect(schema!.table.name).toBe('contacts')
    const names = schema!.columns.map((c) => c.name).sort()
    expect(names).toContain('name')
    expect(names).toContain('age')
    expect(names).toContain('active')
    expect(names).toContain('id')
    expect(names).toContain('createdAt')

    const age = schema!.columns.find((c) => c.name === 'age')
    expect(age?.dbType).toBe('number')
    expect(age?.displayType).toBe('number')

    const active = schema!.columns.find((c) => c.name === 'active')
    expect(active?.dbType).toBe('boolean')
    expect(active?.displayType).toBe('checkbox')

    const name = schema!.columns.find((c) => c.name === 'name')
    expect(name?.dbType).toBe('string')
    expect(name?.displayType).toBe('text')
  })

  it('rejects syncing system tables', async () => {
    await expect(syncTableSchemaFromRecords(testNs, 'main', '_tables')).rejects.toThrow('Cannot sync system table')
    await expect(syncTableSchemaFromRecords(testNs, 'main', '_columns')).rejects.toThrow('Cannot sync system table')
    await expect(syncTableSchemaFromRecords(testNs, 'main', '_relations')).rejects.toThrow('Cannot sync system table')
  })

  it('rejects invalid table names', async () => {
    await expect(syncTableSchemaFromRecords(testNs, 'main', 'contacts-table')).rejects.toThrow('Invalid table name')
    await expect(syncTableSchemaFromRecords(testNs, 'main', '123contacts')).rejects.toThrow('Invalid table name')
  })

  it('upsertTable rejects invalid identifiers', async () => {
    await expect(upsertTable(testNs, 'main', { name: 'bad-name' })).rejects.toThrow('Invalid table name')
    await expect(upsertTable(testNs, 'main', { name: '123bad' })).rejects.toThrow('Invalid table name')
    await expect(upsertTable(testNs, 'main', { name: 'bad.name' })).rejects.toThrow('Invalid table name')
  })

  it('upsertColumn rejects invalid identifiers', async () => {
    await expect(
      upsertColumn(testNs, 'main', { table: 'bad-table', name: 'email', dbType: 'string', displayType: 'email' })
    ).rejects.toThrow('Invalid table name')
    await expect(
      upsertColumn(testNs, 'main', { table: 'contacts', name: 'bad-name', dbType: 'string', displayType: 'email' })
    ).rejects.toThrow('Invalid column name')
    await expect(
      upsertColumn(testNs, 'main', { table: 'contacts', name: '123bad', dbType: 'string', displayType: 'email' })
    ).rejects.toThrow('Invalid column name')
  })

  it('upsertRelation rejects invalid identifiers', async () => {
    await expect(
      upsertRelation(testNs, 'main', {
        fromTable: 'bad-table',
        fromColumn: 'companyId',
        toTable: 'companies',
        toColumn: 'id',
        type: 'many-to-many',
      })
    ).rejects.toThrow('Invalid fromTable')
    await expect(
      upsertRelation(testNs, 'main', {
        fromTable: 'contacts',
        fromColumn: 'bad-col',
        toTable: 'companies',
        toColumn: 'id',
        type: 'many-to-many',
      })
    ).rejects.toThrow('Invalid fromColumn')
    await expect(
      upsertRelation(testNs, 'main', {
        fromTable: 'contacts',
        fromColumn: 'companyId',
        toTable: 'bad-table',
        toColumn: 'id',
        type: 'many-to-many',
      })
    ).rejects.toThrow('Invalid toTable')
    await expect(
      upsertRelation(testNs, 'main', {
        fromTable: 'contacts',
        fromColumn: 'companyId',
        toTable: 'companies',
        toColumn: 'bad-col',
        type: 'many-to-many',
      })
    ).rejects.toThrow('Invalid toColumn')
  })

  it('syncs relation column config with four-part relation IDs', async () => {
    const surreal = await getSurreal(testNs, 'main')
    try {
      await surreal.query(`UPSERT leads:test SET name = 'Lead', accountId = 'accounts:acc1';`)
    } finally {
      await closeSurreal(surreal)
    }
    await syncTableSchemaFromRecords(testNs, 'main', 'leads')
    const schema = await getTableSchema(testNs, 'main', 'leads')
    expect(schema).not.toBeNull()
    const accountId = schema!.columns.find((c) => c.name === 'accountId')
    expect(accountId).toBeDefined()
    expect(accountId?.displayType).toBe('relation')
    expect(accountId?.config?.relationId).toBe('_relations:⟨leads:accountId:accounts:id⟩')
  })

  it('upsertColumn cannot overwrite a system column without system: true', async () => {
    await expect(
      upsertColumn(testNs, 'main', { table: 'contacts', name: 'id', dbType: 'string', displayType: 'text' })
    ).rejects.toThrow('system column')
    const idColumn = SYSTEM_COLUMNS.find((c) => c.name === 'id')!
    await expect(
      upsertColumn(testNs, 'main', {
        table: 'contacts',
        ...idColumn,
      })
    ).resolves.toBeDefined()
  })

  it('upsertColumn rejects a non-canonical system column definition', async () => {
    await expect(
      upsertColumn(testNs, 'main', {
        table: 'contacts',
        name: 'id',
        dbType: 'record',
        displayType: 'text',
        system: true,
      })
    ).rejects.toThrow('non-canonical')
  })

  it('getTableSchema returns null when the table row is missing', async () => {
    const schema = await getTableSchema(testNs, 'main', 'non_existent_table_xyz')
    expect(schema).toBeNull()
  })

  it('getTableSchema rejects invalid tableName', async () => {
    await expect(getTableSchema(testNs, 'main', 'bad-name')).rejects.toThrow('Invalid table name')
    await expect(getTableSchema(testNs, 'main', '123bad')).rejects.toThrow('Invalid table name')
  })
})
