// packages/db/src/schema-registry.ts
import { Surreal } from 'surrealdb'
import { getSurreal, closeSurreal } from './client.js'
import {
  SYSTEM_COLUMNS,
  type ColumnDefinition,
  type ViewDefinition,
} from './schema-definitions.js'
import {
  type ColumnRow,
  type RelationRow,
  type TableRow,
  type TableSchema,
} from 'shared'
import { normalizeId } from './normalize.js'

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
  fields?: ColumnDefinition[]
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

export interface SyncResult {
  tableName: string
  columnsDiscovered: number
}

export interface ViewInput extends Omit<Partial<ViewDefinition>, 'group' | 'filter'> {
  group?: unknown
  filter?: unknown
}

export interface ViewRow extends Omit<ViewDefinition, 'group' | 'filter'> {
  id: string
  createdAt?: string
  updatedAt?: string
  group?: unknown
  filter?: unknown
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
    DEFINE TABLE IF NOT EXISTS _views SCHEMALESS;
    DEFINE INDEX IF NOT EXISTS idx_tables_name ON _tables FIELDS name UNIQUE;
    DEFINE INDEX IF NOT EXISTS idx_columns_table ON _columns FIELDS table;
    DEFINE INDEX IF NOT EXISTS idx_columns_table_name ON _columns FIELDS table, name UNIQUE;
    DEFINE INDEX IF NOT EXISTS idx_relations_from ON _relations FIELDS fromTable, fromColumn;
    DEFINE INDEX IF NOT EXISTS idx_relations_to ON _relations FIELDS toTable, toColumn;
    DEFINE INDEX IF NOT EXISTS idx_relations_unique ON _relations FIELDS fromTable, fromColumn, toTable, toColumn UNIQUE;
    DEFINE INDEX IF NOT EXISTS idx_views_table ON _views FIELDS table;
    DEFINE INDEX IF NOT EXISTS idx_views_table_name ON _views FIELDS table, name UNIQUE;
    DEFINE INDEX IF NOT EXISTS idx_views_default ON _views FIELDS table, isDefault;
  `)
}

async function releaseConnection(surreal: Surreal, shared: boolean): Promise<void> {
  if (!shared) {
    await closeSurreal(surreal)
  }
}

export async function listTables(namespace: string, database: string, surreal?: Surreal) {
  const managed = surreal ?? (await getSurreal(namespace, database))
  try {
    await ensureRegistryTables(managed)
    const [rows] = (await managed.query('SELECT * FROM _tables ORDER BY name')) as [TableRow[]]
    return rows ?? []
  } finally {
    await releaseConnection(managed, !!surreal)
  }
}

export async function listUserTables(namespace: string, database: string, surreal?: Surreal) {
  const all = await listTables(namespace, database, surreal)
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

function validateColumnFields(fields: ColumnDefinition[] | undefined, path: string[] = []): void {
  if (!fields || fields.length === 0) return

  const seen = new Set<string>()

  for (const field of fields) {
    const fieldPath = [...path, field.name]
    const pathStr = fieldPath.join('.')

    if (!isValidIdentifier(field.name)) {
      throw new Error(`Invalid nested field name: ${pathStr}`)
    }
    if (seen.has(field.name)) {
      throw new Error(`Duplicate nested field name: ${pathStr}`)
    }
    seen.add(field.name)

    if (field.system === true) {
      throw new Error(`Nested field cannot be a system column: ${pathStr}`)
    }
    if (field.unique === true) {
      throw new Error(`Nested field cannot be unique: ${pathStr}`)
    }
    if (field.uniqueScope !== undefined) {
      throw new Error(`Nested field cannot have a uniqueScope: ${pathStr}`)
    }
    if (field.order !== undefined) {
      throw new Error(`Nested field cannot have an order: ${pathStr}`)
    }

    if (field.fields && field.fields.length > 0) {
      if (field.dbType !== 'object' && field.dbType !== 'array') {
        throw new Error(`Nested fields are only allowed on object or array columns, found '${field.dbType}' at ${pathStr}`)
      }
      validateColumnFields(field.fields, fieldPath)
    }
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
  if (input.system === true && input.fields !== undefined) {
    throw new Error(`System column ${input.name} cannot have nested fields`)
  }
  if (input.fields !== undefined && input.fields.length > 0 && input.dbType !== 'object' && input.dbType !== 'array') {
    throw new Error(`Nested fields are only allowed on object or array columns`)
  }
  if (input.system === true) {
    const canonical = SYSTEM_COLUMNS.find((c) => c.name === input.name)
    if (!canonical) {
      throw new Error(`Unknown system column: ${input.name}`)
    }
    if (
      input.dbType !== canonical.dbType ||
      input.displayType !== canonical.displayType ||
      input.optional !== canonical.optional ||
      input.hidden !== canonical.hidden
    ) {
      throw new Error(`Cannot upsert system column ${input.name} with non-canonical definition`)
    }
    if (input.config !== undefined && JSON.stringify(input.config) !== JSON.stringify(canonical.config)) {
      throw new Error(`Cannot upsert system column ${input.name} with non-canonical config`)
    }
  }
  validateColumnFields(input.fields)
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
        fields = $fields,
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
      { ...input, config: input.config ?? {}, system: input.system ?? false, fields: input.fields ?? null, now }
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
): Promise<TableSchema | null> {
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

    if (!table) {
      return null
    }

    const mergedColumns = new Map<string, ColumnRow>()
    for (const col of SYSTEM_COLUMNS) {
      mergedColumns.set(col.name, { ...col, table: tableName })
    }
    for (const col of columns ?? []) {
      mergedColumns.set(col.name, col)
    }

    return {
      table,
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
  relation?: Omit<RelationInput, 'fromTable' | 'fromColumn'>
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
    if (recordMatch && recordMatch[1] ) {
      const toTable = recordMatch[1]
      return {
        dbType: 'record',
        displayType: 'relation',
        relation: {
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

export async function listViews(
  namespace: string,
  database: string,
  tableName?: string,
  surreal?: Surreal
): Promise<ViewRow[]> {
  const managed = surreal ?? (await getSurreal(namespace, database))
  try {
    await ensureRegistryTables(managed)
    const query = tableName
      ? 'SELECT * FROM _views WHERE table = $tableName ORDER BY name'
      : 'SELECT * FROM _views ORDER BY name'
    const [rows] = (await managed.query(query, tableName ? { tableName } : undefined)) as [ViewRow[]]
    return rows ?? []
  } finally {
    await releaseConnection(managed, !!surreal)
  }
}

export async function getView(
  namespace: string,
  database: string,
  viewId: string
): Promise<ViewRow | null> {
  const surreal = await getSurreal(namespace, database)
  try {
    await ensureRegistryTables(surreal)
    const [rows] = (await surreal.query(
      'SELECT * FROM type::record($viewId)',
      { viewId }
    )) as [ViewRow[]]
    return normalizeId(rows?.[0]) ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getDefaultView(
  namespace: string,
  database: string,
  tableName: string
): Promise<ViewRow | null> {
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }
  const surreal = await getSurreal(namespace, database)
  try {
    await ensureRegistryTables(surreal)
    const [rows] = (await surreal.query(
      'SELECT * FROM _views WHERE table = $tableName AND isDefault = true LIMIT 1',
      { tableName }
    )) as [ViewRow[]]
    return rows?.[0] ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export async function generateDefaultView(
  namespace: string,
  database: string,
  tableName: string,
  surreal?: Surreal
): Promise<ViewRow> {
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }
  const managed = surreal ?? (await getSurreal(namespace, database))
  const shouldRelease = !surreal
  try {
    await ensureRegistryTables(managed)
    const schema = await getTableSchema(namespace, database, tableName)
    if (!schema) {
      throw new Error(`Table not found: ${tableName}`)
    }

    const columns = schema.columns
      .filter((col: ColumnRow) => !col.hidden)
      .sort((a: ColumnRow, b: ColumnRow) => (a.order ?? Infinity) - (b.order ?? Infinity))
      .map((col: ColumnRow) => ({
        column: col.name,
        label: col.label,
        width: 'auto' as const,
        visible: true,
      }))

    const data = {
      table: tableName,
      type: 'table' as const,
      name: 'Default',
      description: `Default table view for ${tableName}`,
      isDefault: true,
      config: { table: { columns } },
    }

    const [existing] = (await managed.query(
      'SELECT * FROM _views WHERE table = $tableName AND isDefault = true LIMIT 1',
      { tableName }
    )) as [ViewRow[]]

    const now = new Date().toISOString()

    if (existing?.[0]) {
      const existingId = normalizeId(existing[0])!.id
      const [updated] = (await managed.query(
        'UPDATE type::record($id) MERGE $data',
        { id: existingId, data: { ...data, updatedAt: now } }
      )) as [ViewRow[]]
      return normalizeId(updated[0])!
    }

    const [created] = (await managed.query(
      'CREATE _views CONTENT $data',
      { data: { ...data, createdAt: now, updatedAt: now } }
    )) as [ViewRow[]]
    return normalizeId(created[0])!
  } finally {
    if (shouldRelease) {
      await closeSurreal(managed)
    }
  }
}

export async function upsertView(
  namespace: string,
  database: string,
  input: ViewInput,
  surreal?: Surreal
): Promise<ViewRow> {
  const managed = surreal ?? (await getSurreal(namespace, database))
  const shouldRelease = !surreal
  try {
    await ensureRegistryTables(managed)

    let merged = { ...input } as ViewInput
    if (input.id) {
      const [existing] = (await managed.query(
        'SELECT * FROM type::record($viewId)',
        { viewId: input.id }
      )) as [ViewRow[]]
      if (!existing?.[0]) {
        throw new Error(`View not found: ${input.id}`)
      }
      merged = { ...normalizeId(existing[0]), ...input }
    }

    if (!merged.table || !isValidIdentifier(merged.table)) {
      throw new Error(`Invalid table name: ${merged.table}`)
    }
    if (!merged.name || merged.name.trim().length === 0) {
      throw new Error('View name is required')
    }
    if (merged.type !== 'table') {
      throw new Error(`Unsupported view type: ${merged.type}`)
    }

    const [[tableRow]] = (await managed.query('SELECT * FROM _tables WHERE name = $tableName', {
      tableName: merged.table,
    })) as [[TableRow | undefined]]
    if (!tableRow) {
      throw new Error(`Table not found: ${merged.table}`)
    }

    const [columns] = (await managed.query('SELECT * FROM _columns WHERE table = $tableName', {
      tableName: merged.table,
    })) as [ColumnRow[]]
    const columnNames = new Set(SYSTEM_COLUMNS.map((c) => c.name))
    for (const col of columns ?? []) {
      columnNames.add(col.name)
    }

    for (const col of merged.config?.table?.columns ?? []) {
      if (!columnNames.has(col.column)) {
        throw new Error(`Unknown column in view config: ${col.column}`)
      }
    }

    const data = {
      table: merged.table,
      type: merged.type,
      name: merged.name,
      description: merged.description ?? null,
      isDefault: merged.isDefault ?? false,
      config: merged.config ?? {},
      group: merged.group ?? null,
      filter: merged.filter ?? null,
      sort: merged.sort ?? null,
    }

    if (data.isDefault) {
      await managed.query(
        'UPDATE _views SET isDefault = false WHERE table = $tableName AND isDefault = true',
        { tableName: merged.table }
      )
    }

    const now = new Date().toISOString()

    if (merged.id) {
      const [updated] = (await managed.query(
        'UPDATE type::record($id) MERGE $data',
        { id: merged.id, data: { ...data, updatedAt: now } }
      )) as [ViewRow[]]
      return normalizeId(updated[0])!
    }

    const [created] = (await managed.query(
      'CREATE _views CONTENT $data',
      { data: { ...data, createdAt: now, updatedAt: now } }
    )) as [ViewRow[]]
    return normalizeId(created[0])!
  } finally {
    if (shouldRelease) {
      await closeSurreal(managed)
    }
  }
}

export async function deleteView(
  namespace: string,
  database: string,
  viewId: string,
  surreal?: Surreal
): Promise<{ id: string }> {
  const managed = surreal ?? (await getSurreal(namespace, database))
  const shouldRelease = !surreal
  try {
    await ensureRegistryTables(managed)
    await managed.query('DELETE type::record($viewId)', { viewId })
    return { id: viewId }
  } finally {
    if (shouldRelease) {
      await closeSurreal(managed)
    }
  }
}
