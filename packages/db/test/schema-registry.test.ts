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
  listViews,
  getView,
  getDefaultView,
  upsertView,
  deleteView,
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
      kind: 'reference',
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
        kind: 'reference',
        fromTable: 'bad-table',
        fromColumn: 'companyId',
        toTable: 'companies',
        toColumn: 'id',
        type: 'many-to-many',
      })
    ).rejects.toThrow('Invalid fromTable')
    await expect(
      upsertRelation(testNs, 'main', {
        kind: 'reference',
        fromTable: 'contacts',
        fromColumn: 'bad-col',
        toTable: 'companies',
        toColumn: 'id',
        type: 'many-to-many',
      })
    ).rejects.toThrow('Invalid fromColumn')
    await expect(
      upsertRelation(testNs, 'main', {
        kind: 'reference',
        fromTable: 'contacts',
        fromColumn: 'companyId',
        toTable: 'bad-table',
        toColumn: 'id',
        type: 'many-to-many',
      })
    ).rejects.toThrow('Invalid toTable')
    await expect(
      upsertRelation(testNs, 'main', {
        kind: 'reference',
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

  it('upserts and retrieves nested object fields', async () => {
    await upsertColumn(testNs, 'main', {
      table: 'contacts',
      name: 'address',
      dbType: 'object',
      displayType: 'json',
      optional: true,
      fields: [
        { name: 'street', dbType: 'string', displayType: 'text' },
        { name: 'city', dbType: 'string', displayType: 'text' },
      ],
    })
    const schema = await getTableSchema(testNs, 'main', 'contacts')
    const address = schema!.columns.find((c) => c.name === 'address')
    expect(address?.fields).toHaveLength(2)
    expect(address?.fields?.map((f) => f.name)).toEqual(['street', 'city'])
    const street = address?.fields?.find((f) => f.name === 'street')
    expect(street?.dbType).toBe('string')
    expect(street?.displayType).toBe('text')
  })

  it('upserts and retrieves array-of-object fields', async () => {
    await upsertColumn(testNs, 'main', {
      table: 'contacts',
      name: 'invoiceLines',
      dbType: 'array',
      displayType: 'json',
      optional: true,
      fields: [
        { name: 'id', dbType: 'string', displayType: 'text' },
        { name: 'date', dbType: 'datetime', displayType: 'date' },
        { name: 'item', dbType: 'string', displayType: 'text' },
        { name: 'total', dbType: 'number', displayType: 'number' },
      ],
    })
    const schema = await getTableSchema(testNs, 'main', 'contacts')
    const lines = schema!.columns.find((c) => c.name === 'invoiceLines')
    expect(lines?.fields).toHaveLength(4)
    expect(lines?.fields?.map((f) => f.name)).toEqual(['id', 'date', 'item', 'total'])
    const total = lines?.fields?.find((f) => f.name === 'total')
    expect(total?.dbType).toBe('number')
    expect(total?.displayType).toBe('number')
  })

  it('upserts and retrieves deeply nested object fields', async () => {
    await upsertColumn(testNs, 'main', {
      table: 'contacts',
      name: 'organization',
      dbType: 'object',
      displayType: 'json',
      optional: true,
      fields: [
        {
          name: 'address',
          dbType: 'object',
          displayType: 'json',
          fields: [
            { name: 'street', dbType: 'string', displayType: 'text' },
            { name: 'zip', dbType: 'string', displayType: 'text' },
          ],
        },
      ],
    })
    const schema = await getTableSchema(testNs, 'main', 'contacts')
    const organization = schema!.columns.find((c) => c.name === 'organization')
    expect(organization?.fields).toHaveLength(1)
    const address = organization?.fields?.find((f) => f.name === 'address')
    expect(address?.dbType).toBe('object')
    expect(address?.displayType).toBe('json')
    expect(address?.fields?.map((f) => f.name)).toEqual(['street', 'zip'])
    const zip = address?.fields?.find((f) => f.name === 'zip')
    expect(zip?.dbType).toBe('string')
    expect(zip?.displayType).toBe('text')
  })

  it('rejects invalid nested field identifiers', async () => {
    await expect(
      upsertColumn(testNs, 'main', {
        table: 'contacts',
        name: 'badNestedIdentifier',
        dbType: 'object',
        displayType: 'json',
        fields: [{ name: 'bad-name', dbType: 'string', displayType: 'text' }],
      })
    ).rejects.toThrow('Invalid nested field name')
  })

  it('rejects nested fields on primitive dbTypes', async () => {
    await expect(
      upsertColumn(testNs, 'main', {
        table: 'contacts',
        name: 'badPrimitive',
        dbType: 'string',
        displayType: 'text',
        fields: [{ name: 'x', dbType: 'string', displayType: 'text' }],
      })
    ).rejects.toThrow("only allowed on object or array")
  })

  it('rejects duplicate nested field names', async () => {
    await expect(
      upsertColumn(testNs, 'main', {
        table: 'contacts',
        name: 'badDuplicate',
        dbType: 'object',
        displayType: 'json',
        fields: [
          { name: 'x', dbType: 'string', displayType: 'text' },
          { name: 'x', dbType: 'number', displayType: 'number' },
        ],
      })
    ).rejects.toThrow('Duplicate nested field name')
  })

  it('rejects system flag on nested fields', async () => {
    await expect(
      upsertColumn(testNs, 'main', {
        table: 'contacts',
        name: 'badSystemField',
        dbType: 'object',
        displayType: 'json',
        fields: [{ name: 'x', dbType: 'string', displayType: 'text', system: true }],
      })
    ).rejects.toThrow('Nested field cannot be a system column')
  })

  it('rejects unique flag on nested fields', async () => {
    await expect(
      upsertColumn(testNs, 'main', {
        table: 'contacts',
        name: 'badUniqueField',
        dbType: 'object',
        displayType: 'json',
        fields: [{ name: 'x', dbType: 'string', displayType: 'text', unique: true }],
      })
    ).rejects.toThrow('Nested field cannot be unique')
  })

  it('rejects uniqueScope on nested fields', async () => {
    await expect(
      upsertColumn(testNs, 'main', {
        table: 'contacts',
        name: 'badUniqueScopeField',
        dbType: 'object',
        displayType: 'json',
        fields: [{ name: 'x', dbType: 'string', displayType: 'text', uniqueScope: 'foo' }],
      })
    ).rejects.toThrow('Nested field cannot have a uniqueScope')
  })

  it('rejects order on nested fields', async () => {
    await expect(
      upsertColumn(testNs, 'main', {
        table: 'contacts',
        name: 'badOrderField',
        dbType: 'object',
        displayType: 'json',
        fields: [{ name: 'x', dbType: 'string', displayType: 'text', order: 1 }],
      })
    ).rejects.toThrow('Nested field cannot have an order')
  })

  it('rejects fields on system columns', async () => {
    await expect(
      upsertColumn(testNs, 'main', {
        table: 'contacts',
        name: 'id',
        dbType: 'record',
        displayType: 'text',
        system: true,
        fields: [{ name: 'x', dbType: 'string', displayType: 'text' }],
      })
    ).rejects.toThrow('cannot have nested fields')
  })

  describe('views', () => {
    it('lists default views seeded during provision', async () => {
      const views = await listViews(testNs, 'main')
      expect(views.length).toBeGreaterThan(0)
      const membersView = views.find((v) => v.table === 'members' && v.isDefault)
      expect(membersView).toBeDefined()
    })

    it('gets default view by table', async () => {
      const view = await getDefaultView(testNs, 'main', 'members')
      expect(view).not.toBeNull()
      expect(view!.table).toBe('members')
      expect(view!.isDefault).toBe(true)
      expect(view!.config.table?.columns.length).toBeGreaterThan(0)
    })

    it('creates and retrieves a custom view', async () => {
      const created = await upsertView(testNs, 'main', {
        table: 'members',
        type: 'table',
        name: 'Custom Members',
        config: {
          table: {
            columns: [
              { column: 'email', visible: true, width: 'auto' },
              { column: 'role', visible: false },
            ],
          },
        },
      })
      expect(created.id).toBeDefined()

      const view = await getView(testNs, 'main', created.id)
      expect(view).not.toBeNull()
      expect(view!.name).toBe('Custom Members')
      expect(view!.config.table?.columns).toHaveLength(2)
    })

    it('lists views filtered by table', async () => {
      const views = await listViews(testNs, 'main', 'members')
      expect(views.every((v) => v.table === 'members')).toBe(true)
    })

    it('rejects unknown columns in view config', async () => {
      await expect(
        upsertView(testNs, 'main', {
          table: 'members',
          type: 'table',
          name: 'Bad View',
          config: {
            table: {
              columns: [{ column: 'does_not_exist', visible: true }],
            },
          },
        })
      ).rejects.toThrow('Unknown column in view config')
    })

    it('rejects views for unknown tables', async () => {
      await expect(
        upsertView(testNs, 'main', {
          table: 'unknown_table_xyz',
          type: 'table',
          name: 'Bad View',
          config: { table: { columns: [] } },
        })
      ).rejects.toThrow('Table not found')
    })

    it('updates an existing view', async () => {
      const created = await upsertView(testNs, 'main', {
        table: 'members',
        type: 'table',
        name: 'Update Test',
        config: { table: { columns: [{ column: 'email', visible: true }] } },
      })
      const updated = await upsertView(testNs, 'main', {
        id: created.id,
        name: 'Updated Name',
        config: { table: { columns: [{ column: 'email', visible: false }] } },
      })
      expect(updated.id).toBe(created.id)
      expect(updated.name).toBe('Updated Name')
      expect(updated.config.table?.columns[0]?.visible).toBe(false)
    })

    it('deletes a view', async () => {
      const created = await upsertView(testNs, 'main', {
        table: 'members',
        type: 'table',
        name: 'To Delete',
        config: { table: { columns: [{ column: 'email', visible: true }] } },
      })
      await deleteView(testNs, 'main', created.id)
      const view = await getView(testNs, 'main', created.id)
      expect(view).toBeNull()
    })

    it('accepts lookup columns that reference a relation', async () => {
      const view = await upsertView(testNs, 'main', {
        table: 'members',
        type: 'table',
        name: 'With lookup',
        config: {
          table: {
            columns: [
              { column: 'email', visible: true },
              { type: 'lookup', lookup: { from: 'profileId', field: 'name' }, label: 'Profile Name', visible: true },
            ],
          },
        },
      })
      expect(view.config.table?.columns).toHaveLength(2)
      expect(view.config.table?.columns[1]?.lookup?.field).toBe('name')
    })

    it('rejects lookup columns on non-relation fields', async () => {
      await expect(
        upsertView(testNs, 'main', {
          table: 'members',
          type: 'table',
          name: 'Bad lookup',
          config: {
            table: {
              columns: [
                { type: 'lookup', lookup: { from: 'email', field: 'name' }, visible: true },
              ],
            },
          },
        })
      ).rejects.toThrow('unknown relation')
    })
  })
})
