// packages/db/src/schema-registry.ts
import { Surreal } from 'surrealdb';
import { getSurreal, closeSurreal } from './client.js';
import { SYSTEM_COLUMNS, type ColumnDefinition } from './schema-definitions.js';

export interface TableInput {
  name: string;
  label?: string;
  description?: string;
  hidden?: boolean;
}

export interface ColumnInput {
  table: string;
  name: string;
  label?: string;
  dbType: string;
  displayType: string;
  config?: Record<string, unknown>;
  system?: boolean;
  unique?: boolean;
  uniqueScope?: string;
  optional?: boolean;
  defaultValue?: unknown;
  hidden?: boolean;
  order?: number;
}

export interface RelationInput {
  name?: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  linkTable?: string;
}

async function ensureRegistryTables(surreal: Surreal) {
  await surreal.query(`
    DEFINE TABLE IF NOT EXISTS _tables SCHEMALESS;
    DEFINE TABLE IF NOT EXISTS _columns SCHEMALESS;
    DEFINE TABLE IF NOT EXISTS _relations SCHEMALESS;
  `);
}

export async function listTables(namespace: string, database: string) {
  const surreal = await getSurreal(namespace, database);
  try {
    await ensureRegistryTables(surreal);
    const [rows] = (await surreal.query('SELECT * FROM _tables ORDER BY name')) as [any[]];
    return rows ?? [];
  } finally {
    await closeSurreal(surreal);
  }
}

export async function listUserTables(namespace: string, database: string) {
  const all = await listTables(namespace, database);
  return all.filter((t) => !t.name.startsWith('_'));
}

export async function upsertTable(namespace: string, database: string, input: TableInput) {
  const surreal = await getSurreal(namespace, database);
  try {
    const id = `_tables:${input.name}`;
    const now = new Date().toISOString();
    await surreal.query(
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
    );
    return { id };
  } finally {
    await closeSurreal(surreal);
  }
}

export async function upsertColumn(namespace: string, database: string, input: ColumnInput) {
  const surreal = await getSurreal(namespace, database);
  try {
    const id = `_columns:⟨${input.table}:${input.name}⟩`;
    const now = new Date().toISOString();
    await surreal.query(
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
    );
    return { id };
  } finally {
    await closeSurreal(surreal);
  }
}

export async function upsertRelation(namespace: string, database: string, input: RelationInput) {
  const surreal = await getSurreal(namespace, database);
  try {
    const id = `_relations:⟨${input.fromTable}:${input.fromColumn}:${input.toTable}⟩`;
    const now = new Date().toISOString();
    await surreal.query(
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
    );
    return { id };
  } finally {
    await closeSurreal(surreal);
  }
}

export async function getTableSchema(namespace: string, database: string, tableName: string) {
  const surreal = await getSurreal(namespace, database);
  try {
    await ensureRegistryTables(surreal);
    const [[table], columns, relations] = (await surreal.query(
      `
      SELECT * FROM _tables WHERE name = $tableName;
      SELECT * FROM _columns WHERE table = $tableName ORDER BY order, name;
      SELECT * FROM _relations WHERE fromTable = $tableName OR toTable = $tableName;
      `,
      { tableName }
    )) as [any[], any[], any[]];

    const mergedColumns = new Map<string, ColumnDefinition & { table?: string }>();
    for (const col of SYSTEM_COLUMNS) {
      mergedColumns.set(col.name, { ...col });
    }
    for (const col of columns ?? []) {
      mergedColumns.set(col.name, col);
    }

    return {
      table: table ?? { id: `_tables:${tableName}`, name: tableName },
      columns: Array.from(mergedColumns.values()),
      relations: relations ?? [],
    };
  } finally {
    await closeSurreal(surreal);
  }
}

function inferTypes(value: unknown): { dbType: string; displayType: string; relation?: RelationInput } {
  if (typeof value === 'boolean') return { dbType: 'boolean', displayType: 'checkbox' };
  if (typeof value === 'number') return { dbType: 'number', displayType: 'number' };
  if (Array.isArray(value)) return { dbType: 'array', displayType: 'text' };
  if (value !== null && typeof value === 'object') return { dbType: 'object', displayType: 'text' };
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return { dbType: 'datetime', displayType: 'date' };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { dbType: 'string', displayType: 'email' };
    if (/^https?:\/\//.test(value)) return { dbType: 'string', displayType: 'url' };
    const recordMatch = value.match(/^([^:]+):([^:]+)$/);
    if (recordMatch) {
      const toTable = recordMatch[1];
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
      };
    }
    return { dbType: 'string', displayType: 'text' };
  }
  return { dbType: 'string', displayType: 'text' };
}

export async function syncTableSchemaFromRecords(
  namespace: string,
  database: string,
  tableName: string,
  sampleSize = 100
) {
  if (tableName.startsWith('_')) {
    throw new Error(`Cannot sync system table: ${tableName}`);
  }
  const surreal = await getSurreal(namespace, database);
  try {
    await upsertTable(namespace, database, { name: tableName });
    const [records] = (await surreal.query(
      `SELECT * FROM ${tableName} LIMIT $sampleSize`,
      { sampleSize }
    )) as [any[]];

    const columnMap = new Map<string, ColumnInput>();

    for (const record of records ?? []) {
      for (const [name, value] of Object.entries(record)) {
        if (['id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'].includes(name)) continue;
        const { dbType, displayType, relation } = inferTypes(value);
        const existing = columnMap.get(name);
        if (!existing) {
          columnMap.set(name, {
            table: tableName,
            name,
            dbType,
            displayType,
            config: displayType === 'select' ? { displayType: 'select', options: [] } : {},
            optional: true,
          });
        }
        if (relation && displayType === 'relation') {
          await upsertRelation(namespace, database, {
            ...relation,
            fromTable: tableName,
            fromColumn: name,
            type: 'many-to-many',
          });
          const existing = columnMap.get(name);
          if (existing) {
            existing.config = {
              displayType: 'relation',
              relationId: `_relations:⟨${tableName}:${name}:${relation.toTable}⟩`,
            };
          }
        }
      }
    }

    for (const column of columnMap.values()) {
      await upsertColumn(namespace, database, column);
    }

    return { tableName, columnsDiscovered: columnMap.size };
  } finally {
    await closeSurreal(surreal);
  }
}
