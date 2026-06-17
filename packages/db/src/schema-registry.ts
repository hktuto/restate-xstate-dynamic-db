// packages/db/src/schema-registry.ts
import { Surreal } from 'surrealdb'
import { getSurreal, closeSurreal } from './client.js'
import { SYSTEM_COLUMNS, type ColumnDefinition } from './schema-definitions.js'

export interface TableInput {
  name: string
  label?: string
  description?: string
  hidden?: boolean
}

export interface ColumnInput {
  table: string
  name: string
  label?: string
  dbType: ColumnDefinition['dbType']
  displayType: ColumnDefinition['displayType']
  config?: Record<string, unknown>
  system?: boolean
  unique?: boolean
  uniqueScope?: string
  optional?: boolean
  defaultValue?: unknown
  hidden?: boolean
  order?: number
}

export interface RelationInput {
  name?: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  linkTable?: string
}

export interface TableRow {
  id: string
  name: string
  label?: string
  description?: string
  hidden?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ColumnRow extends ColumnDefinition {
  table: string
}

export interface RelationRow {
  id: string
  name?: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  linkTable?: string
  createdAt?: string
  updatedAt?: string
}

export interface TableSchema {
  table: TableRow
  columns: ColumnRow[]
  relations: RelationRow[]
}

export interface SyncResult {
  tableName: string
  columnsDiscovered: number
}

const SYSTEM_COLUMN_NAMES = SYSTEM_COLUMNS.map((c) => c.name)

export function isValidIdentifier(value: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(value)
}

async function ensureRegistryTables(surreal: Surreal) {
  await surreal.query(`
    DEFINE TABLE IF NOT EXISTS _tables SCHEMALESS;
    DEFINE TABLE IF NOT EXISTS _columns SCHEMALESS;
    DEFINE TABLE IF NOT EXISTS _relations SCHEMALESS;
    DEFINE INDEX IF NOT EXISTS idx_tables_name ON _tables FIELDS name UNIQUE;
    DEFINE INDEX IF NOT EXISTS idx_columns_table ON _columns FIELDS table;
    DEFINE INDEX IF NOT EXISTS idx_columns_table_name ON _columns FIELDS table, name UNIQUE;
    DEFINE INDEX IF NOT EXISTS idx_relations_from ON _relations FIELDS fromTable, fromColumn;
    DEFINE INDEX IF NOT EXISTS idx_relations_to ON _relations FIELDS toTable, toColumn;
    DEFINE INDEX IF NOT EXISTS idx_relations_unique ON _relations FIELDS fromTable, fromColumn, toTable, toColumn UNIQUE;
  `)
}

function releaseConnection(surreal: Surreal, shared: boolean) {
  if (!shared) {
    return closeSurreal(surreal)
  }
  return Promise.resolve()
}

export async function listTables(namespace: string, database: string) {
  const surreal = await getSurreal(namespace, database)
  try {
    await ensureRegistryTables(surreal)
    const [rows] = (await surreal.query('SELECT * FROM _tables ORDER BY name')) as [TableRow[]]
    return rows ?? []
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listUserTables(namespace: string, database: string) {
  const all = await listTables(namespace, database)
  return all.filter((t) => !t.name.startsWith('_'))
}

export async function upsertTable(
  namespace: string,
  database: string,
  input: TableInput,
  surreal?: Surreal
) {
  if (!isValidIdentifier(input.name)) {
    throw new Error(`Invalid table name: ${input.name}`)
  }
  const managed = surreal ?? (await getSurreal(namespace, database))
  try {
    await ensureRegistryTables(managed)
    const id = `_tables:⟨${input.name}⟩`
    const now = new Date().toISOString()
    await managed.query(
      `
      UPSERT ${id} SET
        name = $name,
        label = $label,
        description = $description,
        hidden = $hidden,
        updatedAt = $now,
        createdAt = IF missing THEN $now ELSE createdAt END
      `,
      { ...input, now }
    )
    return { id }
  } finally {
    await releaseConnection(managed, !!surreal)
  }
}

export async function upsertColumn(
  namespace: string,
  database: string,
  input: ColumnInput,
  surreal?: Surreal
) {
  if (!isValidIdentifier(input.table)) {
    throw new Error(`Invalid table name: ${input.table}`)
  }
  if (!isValidIdentifier(input.name)) {
    throw new Error(`Invalid column name: ${input.name}`)
  }
  if (SYSTEM_COLUMN_NAMES.includes(input.name) && input.system !== true) {
    throw new Error(`Cannot upsert system column ${input.name} without system: true`)
  }
  const managed = surreal ?? (await getSurreal(namespace, database))
  try {
    await ensureRegistryTables(managed)
    const id = `_columns:⟨${input.table}:${input.name}⟩`
    const now = new Date().toISOString()
    await managed.query(
      `
      UPSERT ${id} SET
        table = $table,
        name = $name,
        label = $label,
        dbType = $dbType,
        displayType = $displayType,
        config = $config,
        system = $system,
        unique = $unique,
        uniqueScope = $uniqueScope,
        optional = $optional,
        defaultValue = $defaultValue,
        hidden = $hidden,
        order = $order,
        updatedAt = $now,
        createdAt = IF missing THEN $now ELSE createdAt END
      `,
      { ...input, config: input.config ?? {}, system: input.system ?? false, now }
    )
    return { id }
  } finally {
    await releaseConnection(managed, !!surreal)
  }
}

export async function upsertRelation(
  namespace: string,
  database: string,
  input: RelationInput,
  surreal?: Surreal
) {
  for (const [key, value] of [
    ['fromTable', input.fromTable],
    ['fromColumn', input.fromColumn],
    ['toTable', input.toTable],
    ['toColumn', input.toColumn],
  ] as const) {
    if (!isValidIdentifier(value)) {
      throw new Error(`Invalid ${key}: ${value}`)
    }
  }
  const managed = surreal ?? (await getSurreal(namespace, database))
  try {
    await ensureRegistryTables(managed)
    const id = `_relations:⟨${input.fromTable}:${input.fromColumn}:${input.toTable}:${input.toColumn}⟩`
    const now = new Date().toISOString()
    await managed.query(
      `
      UPSERT ${id} SET
        name = $name,
        fromTable = $fromTable,
        fromColumn = $fromColumn,
        toTable = $toTable,
        toColumn = $toColumn,
        type = $type,
        linkTable = $linkTable,
        updatedAt = $now,
        createdAt = IF missing THEN $now ELSE createdAt END
      `,
      { ...input, now }
    )
    return { id }
  } finally {
    await releaseConnection(managed, !!surreal)
  }
}

export async function getTableSchema(
  namespace: string,
  database: string,
  tableName: string
): Promise<TableSchema> {
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }
  const surreal = await getSurreal(namespace, database)
  try {
    await ensureRegistryTables(surreal)
    const [[table], columns, relations] = (await surreal.query(
      `
      SELECT * FROM _tables WHERE name = $tableName;
      SELECT * FROM _columns WHERE table = $tableName ORDER BY order, name;
      SELECT * FROM _relations WHERE fromTable = $tableName OR toTable = $tableName;
      `,
      { tableName }
    )) as [TableRow[], ColumnRow[], RelationRow[]]

    const mergedColumns = new Map<string, ColumnRow>()
    for (const col of SYSTEM_COLUMNS) {
      mergedColumns.set(col.name, { ...col, table: tableName })
    }
    for (const col of columns ?? []) {
      mergedColumns.set(col.name, col)
    }

    return {
      table: table ?? { id: `_tables:⟨${tableName}⟩`, name: tableName },
      columns: Array.from(mergedColumns.values()),
      relations: relations ?? [],
    }
  } finally {
    await closeSurreal(surreal)
  }
}

type InferResult = {
  dbType: ColumnDefinition['dbType']
  displayType: ColumnDefinition['displayType']
  relation?: RelationInput
}

function inferTypes(value: unknown): InferResult {
  if (typeof value === 'boolean') return { dbType: 'boolean', displayType: 'checkbox' }
  if (typeof value === 'number') return { dbType: 'number', displayType: 'number' }
  if (Array.isArray(value)) return { dbType: 'array', displayType: 'text' }
  if (value !== null && typeof value === 'object') return { dbType: 'object', displayType: 'text' }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return { dbType: 'datetime', displayType: 'date' }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { dbType: 'string', displayType: 'email' }
    if (/^https?:\/\//.test(value)) return { dbType: 'string', displayType: 'url' }
    const recordMatch = value.match(/^([^:]+):([^:]+)$/)
    if (recordMatch) {
      const toTable = recordMatch[1]
      return {
        dbType: 'record',
        displayType: 'relation',
        relation: {
          fromTable: '',
          fromColumn: '',
          toTable,
          toColumn: 'id',
          type: 'many-to-many',
        },
      }
    }
    return { dbType: 'string', displayType: 'text' }
  }
  return { dbType: 'string', displayType: 'text' }
}

export async function syncTableSchemaFromRecords(
  namespace: string,
  database: string,
  tableName: string,
  sampleSize = 100
): Promise<SyncResult> {
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }
  if (tableName.startsWith('_')) {
    throw new Error(`Cannot sync system table: ${tableName}`)
  }
  const surreal = await getSurreal(namespace, database)
  try {
    await ensureRegistryTables(surreal)
    await upsertTable(namespace, database, { name: tableName }, surreal)
    const [records] = (await surreal.query(
      `SELECT * FROM ${tableName} LIMIT $sampleSize`,
      { sampleSize }
    )) as [Record<string, unknown>[]]

    const columnMap = new Map<string, ColumnInput>()
    const upsertedRelations = new Set<string>()

    for (const record of records ?? []) {
      for (const [name, value] of Object.entries(record)) {
        if (SYSTEM_COLUMN_NAMES.includes(name)) continue
        if (!isValidIdentifier(name)) {
          throw new Error(`Invalid column name: ${name}`)
        }
        const { dbType, displayType, relation } = inferTypes(value)
        const existing = columnMap.get(name)
        if (!existing) {
          columnMap.set(name, {
            table: tableName,
            name,
            dbType,
            displayType,
            config: {},
            optional: true,
          })
        }
        if (relation && displayType === 'relation') {
          const relationId = `_relations:⟨${tableName}:${name}:${relation.toTable}:id⟩`
          if (!upsertedRelations.has(relationId)) {
            await upsertRelation(
              namespace,
              database,
              {
                ...relation,
                fromTable: tableName,
                fromColumn: name,
                type: 'many-to-many',
              },
              surreal
            )
            upsertedRelations.add(relationId)
          }
          const column = columnMap.get(name)
          if (column) {
            column.config = {
              displayType: 'relation',
              relationId,
            }
          }
        }
      }
    }

    for (const column of columnMap.values()) {
      await upsertColumn(namespace, database, column, surreal)
    }

    return { tableName, columnsDiscovered: columnMap.size }
  } finally {
    await closeSurreal(surreal)
  }
}
