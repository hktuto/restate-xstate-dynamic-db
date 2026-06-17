import { describe, it, expect } from 'vitest'
import { PLATFORM_TABLE_SCHEMAS, TENANT_TABLE_SCHEMAS, SYSTEM_COLUMNS } from '../src/schema-definitions.js'

const VALID_DB_TYPES = [
  'string',
  'number',
  'boolean',
  'datetime',
  'object',
  'array',
  'record',
] as const

const VALID_DISPLAY_TYPES = [
  'text',
  'url',
  'email',
  'user',
  'select',
  'checkbox',
  'date',
  'number',
  'relation',
  'formula',
  'richText',
] as const

describe('schema-definitions', () => {
  it('includes companies and members', () => {
    expect(PLATFORM_TABLE_SCHEMAS.some((t) => t.name === 'companies')).toBe(true)
    expect(TENANT_TABLE_SCHEMAS.some((t) => t.name === 'members')).toBe(true)
  })

  it('system columns include id and audit fields', () => {
    const names = SYSTEM_COLUMNS.map((c) => c.name)
    expect(names).toEqual(['id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'])
  })

  it('every column has a valid dbType and displayType', () => {
    for (const table of [...PLATFORM_TABLE_SCHEMAS, ...TENANT_TABLE_SCHEMAS]) {
      for (const column of table.columns) {
        expect(VALID_DB_TYPES).toContain(column.dbType)
        expect(VALID_DISPLAY_TYPES).toContain(column.displayType)
      }
    }
  })

  it('relation columns reference existing relations and follow naming conventions', () => {
    for (const table of [...PLATFORM_TABLE_SCHEMAS, ...TENANT_TABLE_SCHEMAS]) {
      for (const column of table.columns) {
        if (column.displayType !== 'relation') continue

        const relation = table.relations?.find(
          (r) => r.fromTable === table.name && r.fromColumn === column.name
        )
        expect(relation).toBeDefined()
        expect(relation!.toColumn).toBe('id')

        expect(column.config?.relationId).toBeTypeOf('string')
        expect(column.config!.relationId).toBe(
          `_relations:⟨${table.name}:${column.name}:${relation!.toTable}:${relation!.toColumn}⟩`
        )
      }
    }
  })

  it('every declared relation has a matching relation column', () => {
    for (const table of [...PLATFORM_TABLE_SCHEMAS, ...TENANT_TABLE_SCHEMAS]) {
      for (const relation of table.relations ?? []) {
        const column = table.columns.find((c) => c.name === relation.fromColumn)
        expect(column).toBeDefined()
        expect(column!.displayType).toBe('relation')
      }
    }
  })

  it('has no duplicate column names within a table', () => {
    for (const table of [...PLATFORM_TABLE_SCHEMAS, ...TENANT_TABLE_SCHEMAS]) {
      const names = table.columns.map((c) => c.name)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('has no duplicate table names within each schema registry', () => {
    const platformNames = PLATFORM_TABLE_SCHEMAS.map((t) => t.name)
    expect(new Set(platformNames).size).toBe(platformNames.length)

    const tenantNames = TENANT_TABLE_SCHEMAS.map((t) => t.name)
    expect(new Set(tenantNames).size).toBe(tenantNames.length)
  })

  it('has no duplicate relations within a table', () => {
    for (const table of [...PLATFORM_TABLE_SCHEMAS, ...TENANT_TABLE_SCHEMAS]) {
      const keys = (table.relations ?? []).map((r) => `${r.fromColumn}:${r.toTable}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})
