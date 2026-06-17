import { describe, it, expect } from 'vitest'
import { PLATFORM_TABLE_SCHEMAS, TENANT_TABLE_SCHEMAS, SYSTEM_COLUMNS } from '../src/schema-definitions.js'

describe('schema-definitions', () => {
  it('includes companies and members', () => {
    expect(PLATFORM_TABLE_SCHEMAS.some((t) => t.name === 'companies')).toBe(true)
    expect(TENANT_TABLE_SCHEMAS.some((t) => t.name === 'members')).toBe(true)
  })

  it('system columns include id and audit fields', () => {
    const names = SYSTEM_COLUMNS.map((c) => c.name)
    expect(names).toEqual(['id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'])
  })

  it('every column has dbType and displayType', () => {
    for (const table of [...PLATFORM_TABLE_SCHEMAS, ...TENANT_TABLE_SCHEMAS]) {
      for (const column of table.columns) {
        expect(column.dbType).toBeTruthy()
        expect(column.displayType).toBeTruthy()
      }
    }
  })

  it('relation columns reference existing relations', () => {
    for (const table of [...PLATFORM_TABLE_SCHEMAS, ...TENANT_TABLE_SCHEMAS]) {
      for (const column of table.columns) {
        if (column.displayType === 'relation' && column.config?.relationId) {
          const relation = table.relations?.find(
            (r) => r.fromTable === table.name && r.fromColumn === column.name
          )
          expect(relation).toBeDefined()
        }
      }
    }
  })
})
