import { describe, it, expect } from 'vitest'
import { GRAPH_RELATIONS, PLATFORM_TABLE_SCHEMAS, TENANT_TABLE_SCHEMAS, SYSTEM_COLUMNS } from '../src/schema-definitions.js'

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
  'json',
  'relation',
  'formula',
  'richText',
  'tag',
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

  it('workflow_instances.triggerBy has nested fields', () => {
    for (const schemas of [PLATFORM_TABLE_SCHEMAS, TENANT_TABLE_SCHEMAS]) {
      const table = schemas.find((t) => t.name === 'workflow_instances')
      expect(table).toBeDefined()
      const triggerBy = table!.columns.find((c) => c.name === 'triggerBy')
      expect(triggerBy).toBeDefined()
      expect(triggerBy!.dbType).toBe('object')
      expect(triggerBy!.fields?.map((f) => f.name)).toEqual(['type', 'startState'])
      expect(triggerBy!.fields?.[0].dbType).toBe('string')
      expect(triggerBy!.fields?.[1].dbType).toBe('string')
    }
  })

  it('workflow_designs.starts has nested item fields', () => {
    for (const schemas of [PLATFORM_TABLE_SCHEMAS, TENANT_TABLE_SCHEMAS]) {
      const table = schemas.find((t) => t.name === 'workflow_designs')
      expect(table).toBeDefined()
      const starts = table!.columns.find((c) => c.name === 'starts')
      expect(starts).toBeDefined()
      expect(starts!.dbType).toBe('array')
      expect(starts!.fields?.map((f) => f.name)).toEqual(['type', 'startState', 'options'])
      expect(starts!.fields?.[0].optional).toBe(true)
      expect(starts!.fields?.[1].optional).toBe(true)
      expect(starts!.fields?.[2].optional).toBe(true)
      expect(starts!.fields?.[2].dbType).toBe('object')
    }
  })

  it('graph relations are well-formed', () => {
    const names = new Set<string>()
    for (const relation of GRAPH_RELATIONS) {
      expect(relation.kind).toBe('graph')
      expect(relation.name).toBeTypeOf('string')
      expect(relation.fromTable).toBeTypeOf('string')
      expect(relation.toTable).toBeTypeOf('string')
      expect(relation.linkTable).toBeTypeOf('string')
      expect(relation.type).toBe('many-to-many')
      names.add(`${relation.fromTable}:${relation.linkTable}:${relation.toTable}`)
    }
    expect(names.size).toBe(GRAPH_RELATIONS.length)
  })
})
