---
title: Dynamic Table Schema Registry — Backend Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-17
updated: 2026-06-17
---

# Dynamic Table Schema Registry — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every existing table (`companies`, `members`, `workflows`, etc.) into the new schema registry pattern (`_tables`, `_columns`, `_relations`) so the registry becomes the source of metadata for the whole system. Validate correctness and performance before any frontend work.

**Architecture:** A declarative `packages/db/src/schema-definitions.ts` file describes all platform and tenant tables, columns, relations, and system columns. `seed.ts` and `provision.ts` use it to both `DEFINE TABLE` and populate `_tables`/`_columns`/`_relations`. A new `packages/db/src/schema-registry.ts` module provides CRUD/sync helpers. API routes parse `namespace--database` from URL params. The reusable `TableQuery` UI layer is **out of scope** and will be planned separately.

**Tech Stack:** TypeScript, SurrealDB, Nuxt 4 server routes, Vitest.

---

## System table schema

Three SCHEMALESS system tables are added to every namespace/database.

### `_tables`

```surrealql
DEFINE TABLE IF NOT EXISTS _tables SCHEMALESS;
DEFINE INDEX IF NOT EXISTS idx_tables_name ON _tables FIELDS name UNIQUE;
```

Record shape:

```ts
interface _TablesRecord {
  id: string           // tables:<name>
  name: string
  label?: string
  description?: string
  hidden?: boolean
  createdAt: string
  updatedAt: string
}
```

### `_columns`

```surrealql
DEFINE TABLE IF NOT EXISTS _columns SCHEMALESS;
DEFINE INDEX IF NOT EXISTS idx_columns_table ON _columns FIELDS table;
DEFINE INDEX IF NOT EXISTS idx_columns_table_name ON _columns FIELDS table, name UNIQUE;
```

Record shape:

```ts
interface _ColumnsRecord {
  id: string           // columns:<table>:<name>
  table: string
  name: string
  label?: string
  dbType: 'string' | 'number' | 'boolean' | 'datetime' | 'object' | 'array' | 'record'
  displayType: 'text' | 'url' | 'email' | 'user' | 'select' | 'checkbox' | 'date' | 'number' | 'relation' | 'formula' | 'richText'
  config: object
  system?: boolean     // true for id, createdAt, createdBy, updatedAt, updatedBy, deletedAt, deletedBy
  unique?: boolean
  uniqueScope?: string
  optional?: boolean
  defaultValue?: unknown
  hidden?: boolean
  order?: number
  createdAt: string
  updatedAt: string
}
```

### `_relations`

```surrealql
DEFINE TABLE IF NOT EXISTS _relations SCHEMALESS;
DEFINE INDEX IF NOT EXISTS idx_relations_from ON _relations FIELDS fromTable, fromColumn;
DEFINE INDEX IF NOT EXISTS idx_relations_to ON _relations FIELDS toTable, toColumn;
DEFINE INDEX IF NOT EXISTS idx_relations_unique ON _relations FIELDS fromTable, fromColumn, toTable, toColumn UNIQUE;
```

Record shape:

```ts
interface _RelationsRecord {
  id: string           // relations:<fromTable>:<fromColumn>:<toTable>
  name?: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  linkTable?: string
  createdAt: string
  updatedAt: string
}
```

---

## Declarative existing-table schemas

A new file `packages/db/src/schema-definitions.ts` holds static schemas for all current tables. See Task 1 for the full file.

`seed.ts` and `provision.ts` iterate these arrays to:

1. `DEFINE TABLE IF NOT EXISTS <name> SCHEMALESS;`
2. `UPSERT _tables:<name>` with metadata.
3. `UPSERT _columns:<table>:<name>` for each user-defined column.
4. `UPSERT _columns:<table>:<name>` for each system column.
5. `UPSERT _relations:<from>:<col>:<to>` for each relation.

### Tenant API routing note

Tenant routes read `namespace`/`database` from query params (for GET), from the request body (for POST), or from the tenant session (`event.context.company.namespace` + `main`). Admin routes keep the explicit `namespace--database` URL segment.

### System column template

Every table automatically gets these system columns in `_columns`:

```ts
export const SYSTEM_COLUMNS: ColumnDefinition[] = [
  { name: 'id', dbType: 'record', displayType: 'text', system: true, optional: false, hidden: false },
  { name: 'createdAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'createdBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true, config: { displayType: 'relation' } },
  { name: 'updatedAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'updatedBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true, config: { displayType: 'relation' } },
  { name: 'deletedAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'deletedBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true, config: { displayType: 'relation' } },
]
```

`id` is shown by default; the audit/soft-delete columns are hidden by default so UI list views stay clean.

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/db/src/schema-definitions.ts` | Static schemas for all existing platform and tenant tables plus system column template. |
| `packages/db/src/provision.ts` | Use schema definitions to create tenant tables and populate the registry. |
| `packages/db/src/seed.ts` | Use schema definitions to create platform tables and populate the registry. |
| `packages/db/src/schema-registry.ts` | Types and DB helpers for schema CRUD and sync. |
| `packages/db/src/index.ts` | Re-export schema-registry helpers. |
| `packages/db/package.json` | Add `./schema-registry` and `./schema-definitions` exports. |
| `packages/db/src/tenant.ts` | Update if any helper enumerates tables; otherwise no change. |
| `packages/db/src/workflow-actions.ts` | Update if any helper enumerates tables; otherwise no change. |
| `apps/web/server/api/tables/index.get.ts` | List user tables (resolve namespace from body/session). |
| `apps/web/server/api/tables/[table].get.ts` | Get a single table schema. |
| `apps/web/server/api/tables/[table]/sync.post.ts` | Sync schema from records. |
| `apps/web/server/api/tables/[table]/query.post.ts` | Query records with pagination. |
| `apps/web/server/api/tables/[table]/columns.post.ts` | Save column metadata. |
| `apps/web/server/utils/resolve-tenant-nsdb.ts` | Resolve tenant namespace/database from body or session. |
| `apps/admin/server/api/tables/[nsdb].get.ts` | Platform mirror of list tables. |
| `apps/admin/server/api/tables/[nsdb]/[table].get.ts` | Platform mirror of get schema. |
| `apps/admin/server/api/tables/[nsdb]/[table]/sync.post.ts` | Platform mirror of sync. |
| `apps/admin/server/api/tables/[nsdb]/[table]/query.post.ts` | Platform mirror of query. |
| `apps/admin/server/api/tables/[nsdb]/[table]/columns.post.ts` | Platform mirror of save column. |
| `apps/admin/server/utils/parse-nsdb.ts` | Parse `namespace--database` URL segment. |
| `packages/db/test/schema-definitions.test.ts` | Test that schema definitions produce expected tables/columns. |
| `packages/db/test/schema-registry.test.ts` | Unit tests for schema-registry helpers. |
| `packages/db/test/provision.test.ts` | Updated test for system tables and seeded schemas. |
| `packages/db/test/seed.test.ts` | Test for platform system tables and seeded schemas. |
| `apps/web/tests/api/tables.test.ts` | Integration tests for tenant table API. |
| `packages/db/scripts/schema-benchmark.ts` | Benchmark for sync + query performance. |
| `docs/20-Architecture/Data Model.md` | Document schema registry tables and definitions. |

---

## Tasks

### Task 1: Define declarative schemas for all existing tables

**Files:**
- Create: `packages/db/src/schema-definitions.ts`
- Test: `packages/db/test/schema-definitions.test.ts`

- [ ] **Step 1: Create schema-definitions.ts**

```ts
// packages/db/src/schema-definitions.ts

export interface ColumnDefinition {
  name: string
  label?: string
  dbType: 'string' | 'number' | 'boolean' | 'datetime' | 'object' | 'array' | 'record'
  displayType: 'text' | 'url' | 'email' | 'user' | 'select' | 'checkbox' | 'date' | 'number' | 'relation' | 'formula' | 'richText'
  config?: Record<string, unknown>
  system?: boolean
  unique?: boolean
  uniqueScope?: string
  optional?: boolean
  defaultValue?: unknown
  hidden?: boolean
  order?: number
}

export interface RelationDefinition {
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  linkTable?: string
}

export interface TableSchemaDefinition {
  name: string
  label?: string
  description?: string
  hidden?: boolean
  columns: ColumnDefinition[]
  relations?: RelationDefinition[]
}

const opts = (values: string[]) => values.map((v) => ({ label: v, value: v }))

const rel = (fromColumn: string, toTable: string, type: RelationDefinition['type'] = 'many-to-many'): RelationDefinition => ({
  fromTable: '',
  fromColumn,
  toTable,
  toColumn: 'id',
  type,
})

const table = (name: string, label: string, columns: ColumnDefinition[], relations?: RelationDefinition[]): TableSchemaDefinition => ({
  name,
  label,
  columns,
  relations: relations?.map((r) => ({ ...r, fromTable: name })),
})

const c = (
  name: string,
  dbType: ColumnDefinition['dbType'],
  displayType: ColumnDefinition['displayType'],
  extra: Partial<ColumnDefinition> = {}
): ColumnDefinition => ({ name, dbType, displayType, optional: true, ...extra })

export const SYSTEM_COLUMNS: ColumnDefinition[] = [
  { name: 'id', dbType: 'record', displayType: 'text', system: true, optional: false, hidden: false },
  { name: 'createdAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'createdBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true, config: { displayType: 'relation' } },
  { name: 'updatedAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'updatedBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true, config: { displayType: 'relation' } },
  { name: 'deletedAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'deletedBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true, config: { displayType: 'relation' } },
]

export const PLATFORM_TABLE_SCHEMAS: TableSchemaDefinition[] = [
  table('companies', 'Companies', [
    c('name', 'string', 'text'),
    c('slug', 'string', 'text', { unique: true }),
    c('namespace', 'string', 'text'),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['active', 'inactive']) } }),
  ]),
  table('platform_users', 'Platform Users', [
    c('email', 'string', 'email', { unique: true }),
    c('password', 'string', 'text', { hidden: true }),
  ]),
  table('accounts', 'Accounts', [
    c('provider', 'string', 'select', { config: { displayType: 'select', options: opts(['email', 'oauth_google', 'oauth_github', 'phone']) } }),
    c('providerKey', 'string', 'text'),
    c('credential', 'string', 'text', { hidden: true }),
    c('profileId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:accounts:profileId:user_profiles' } }),
  ], [rel('profileId', 'user_profiles')]),
  table('user_profiles', 'User Profiles', [
    c('name', 'string', 'text'),
    c('gender', 'string', 'select', { config: { displayType: 'select', options: opts(['male', 'female', 'other', 'prefer_not_to_say']) } }),
    c('birthday', 'datetime', 'date'),
    c('preferences', 'object', 'text'),
  ]),
  table('workflows', 'Workflows', [
    c('name', 'string', 'text'),
    c('xstateConfig', 'object', 'text'),
  ]),
  table('triggers', 'Triggers', [
    c('tableName', 'string', 'text'),
    c('event', 'string', 'select', { config: { displayType: 'select', options: opts(['insert', 'update', 'delete']) } }),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:triggers:workflowId:workflows' } }),
  ], [rel('workflowId', 'workflows')]),
  table('workflow_instances', 'Workflow Instances', [
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_instances:workflowId:workflows' } }),
    c('tableName', 'string', 'text'),
    c('recordId', 'record', 'relation'),
    c('namespace', 'string', 'text'),
    c('companyId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_instances:companyId:companies' } }),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['pending', 'running', 'waiting', 'done', 'error']) } }),
    c('context', 'object', 'text'),
  ], [rel('workflowId', 'workflows'), rel('companyId', 'companies')]),
  table('user_tasks', 'User Tasks', [
    c('instanceId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:user_tasks:instanceId:workflow_instances' } }),
    c('type', 'string', 'select', { config: { displayType: 'select', options: opts(['approval', 'review', 'manual']) } }),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['pending', 'completed', 'cancelled', 'rejected']) } }),
    c('tableName', 'string', 'text'),
    c('recordId', 'record', 'relation'),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:user_tasks:workflowId:workflows' } }),
    c('resolvedAt', 'datetime', 'date'),
  ], [rel('instanceId', 'workflow_instances'), rel('workflowId', 'workflows')]),
  table('workflow_actions', 'Workflow Actions', [
    c('instanceId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_actions:instanceId:workflow_instances' } }),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_actions:workflowId:workflows' } }),
    c('stateId', 'string', 'text'),
    c('action', 'string', 'text'),
    c('params', 'object', 'text'),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['started', 'completed', 'failed']) } }),
    c('inputContext', 'object', 'text'),
    c('outputContext', 'object', 'text'),
    c('outputData', 'object', 'text'),
    c('resultEvent', 'string', 'select', { config: { displayType: 'select', options: opts(['ok', 'error', 'true', 'false']) } }),
    c('errorMessage', 'string', 'text'),
    c('startedAt', 'datetime', 'date'),
    c('completedAt', 'datetime', 'date'),
  ], [rel('instanceId', 'workflow_instances'), rel('workflowId', 'workflows')]),
  table('health_checks', 'Health Checks', [
    c('service', 'string', 'text'),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['healthy', 'unhealthy']) } }),
    c('checkedAt', 'datetime', 'date'),
    c('responseTimeMs', 'number', 'number'),
    c('message', 'string', 'text'),
    c('details', 'object', 'text'),
  ]),
]

export const TENANT_TABLE_SCHEMAS: TableSchemaDefinition[] = [
  table('members', 'Members', [
    c('profileId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:members:profileId:user_profiles' } }),
    c('email', 'string', 'email'),
    c('role', 'string', 'select', { config: { displayType: 'select', options: opts(['owner', 'admin', 'member']) } }),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['pending', 'active', 'inactive']) } }),
    c('inviteCode', 'string', 'text', { unique: true }),
    c('joinedAt', 'datetime', 'date'),
    c('invitedBy', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:members:invitedBy:members' } }),
  ], [rel('profileId', 'user_profiles'), rel('invitedBy', 'members', 'one-to-many')]),
  table('workflows', 'Workflows', [
    c('name', 'string', 'text'),
    c('xstateConfig', 'object', 'text'),
  ]),
  table('triggers', 'Triggers', [
    c('tableName', 'string', 'text'),
    c('event', 'string', 'select', { config: { displayType: 'select', options: opts(['insert', 'update', 'delete']) } }),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:triggers:workflowId:workflows' } }),
  ], [rel('workflowId', 'workflows')]),
  table('workflow_instances', 'Workflow Instances', [
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_instances:workflowId:workflows' } }),
    c('tableName', 'string', 'text'),
    c('recordId', 'record', 'relation'),
    c('namespace', 'string', 'text'),
    c('companyId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_instances:companyId:companies' } }),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['pending', 'running', 'waiting', 'done', 'error']) } }),
    c('context', 'object', 'text'),
  ], [rel('workflowId', 'workflows'), rel('companyId', 'companies')]),
  table('user_tasks', 'User Tasks', [
    c('instanceId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:user_tasks:instanceId:workflow_instances' } }),
    c('type', 'string', 'select', { config: { displayType: 'select', options: opts(['approval', 'review', 'manual']) } }),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['pending', 'completed', 'cancelled', 'rejected']) } }),
    c('tableName', 'string', 'text'),
    c('recordId', 'record', 'relation'),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:user_tasks:workflowId:workflows' } }),
    c('resolvedAt', 'datetime', 'date'),
  ], [rel('instanceId', 'workflow_instances'), rel('workflowId', 'workflows')]),
  table('workflow_actions', 'Workflow Actions', [
    c('instanceId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_actions:instanceId:workflow_instances' } }),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_actions:workflowId:workflows' } }),
    c('stateId', 'string', 'text'),
    c('action', 'string', 'text'),
    c('params', 'object', 'text'),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['started', 'completed', 'failed']) } }),
    c('inputContext', 'object', 'text'),
    c('outputContext', 'object', 'text'),
    c('outputData', 'object', 'text'),
    c('resultEvent', 'string', 'select', { config: { displayType: 'select', options: opts(['ok', 'error', 'true', 'false']) } }),
    c('errorMessage', 'string', 'text'),
    c('startedAt', 'datetime', 'date'),
    c('completedAt', 'datetime', 'date'),
  ], [rel('instanceId', 'workflow_instances'), rel('workflowId', 'workflows')]),
]
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/db/test/schema-definitions.test.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter db test -- packages/db/test/schema-definitions.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter db test -- packages/db/test/schema-definitions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema-definitions.ts packages/db/test/schema-definitions.test.ts
git commit -m "feat(db): add declarative schemas for existing platform and tenant tables"
```

---

### Task 2: Create schema-registry DB helpers

**Files:**
- Create: `packages/db/src/schema-registry.ts`
- Test: `packages/db/test/schema-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/db/test/schema-registry.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { provisionCompanyNamespace } from '../src/provision.js'
import {
  listTables,
  listUserTables,
  upsertTable,
  getTableSchema,
  syncTableSchemaFromRecords,
} from '../src/schema-registry.js'
import { getSurreal, closeSurreal } from '../src/client.js'

describe('schema-registry', () => {
  const testNs = `test_schema_${Date.now()}`

  beforeAll(async () => {
    await provisionCompanyNamespace(testNs)
    const surreal = await getSurreal(testNs, 'main')
    await surreal.query(`
      UPSERT contacts:test SET name = 'Alice', age = 30, active = true, createdAt = time::now()
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

  it('listUserTables excludes system tables', async () => {
    const tables = await listUserTables(testNs, 'main')
    expect(tables.some((t) => t.name.startsWith('_'))).toBe(false)
  })

  it('syncs schema from records', async () => {
    await syncTableSchemaFromRecords(testNs, 'main', 'contacts')
    const schema = await getTableSchema(testNs, 'main', 'contacts')
    const names = schema.columns.map((c) => c.name).sort()
    expect(names).toContain('name')
    expect(names).toContain('age')
    expect(names).toContain('active')
    expect(names).toContain('id')
    expect(names).toContain('createdAt')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter db test -- packages/db/test/schema-registry.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement schema-registry.ts**

```ts
// packages/db/src/schema-registry.ts
import { getSurreal, closeSurreal } from './client.js'

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
  dbType: string
  displayType: string
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

export async function listTables(namespace: string, database: string) {
  const surreal = await getSurreal(namespace, database)
  try {
    const [rows] = (await surreal.query('SELECT * FROM _tables ORDER BY name')) as [any[]]
    return rows ?? []
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listUserTables(namespace: string, database: string) {
  const all = await listTables(namespace, database)
  return all.filter((t) => !t.name.startsWith('_'))
}

export async function upsertTable(namespace: string, database: string, input: TableInput) {
  const surreal = await getSurreal(namespace, database)
  try {
    const id = `tables:${input.name}`
    const now = new Date().toISOString()
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
    )
    return { id }
  } finally {
    await closeSurreal(surreal)
  }
}

export async function upsertColumn(namespace: string, database: string, input: ColumnInput) {
  const surreal = await getSurreal(namespace, database)
  try {
    const id = `columns:${input.table}:${input.name}`
    const now = new Date().toISOString()
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
    )
    return { id }
  } finally {
    await closeSurreal(surreal)
  }
}

export async function upsertRelation(namespace: string, database: string, input: RelationInput) {
  const surreal = await getSurreal(namespace, database)
  try {
    const id = `relations:${input.fromTable}:${input.fromColumn}:${input.toTable}`
    const now = new Date().toISOString()
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
    )
    return { id }
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getTableSchema(namespace: string, database: string, tableName: string) {
  const surreal = await getSurreal(namespace, database)
  try {
    const [[table], columns, relations] = (await surreal.query(
      `
      SELECT * FROM _tables WHERE name = $tableName;
      SELECT * FROM _columns WHERE table = $tableName ORDER BY order, name;
      SELECT * FROM _relations WHERE fromTable = $tableName OR toTable = $tableName;
      `,
      { tableName }
    )) as [any[], any[], any[]]
    return {
      table: table?.[0] ?? { id: `tables:${tableName}`, name: tableName },
      columns: columns ?? [],
      relations: relations ?? [],
    }
  } finally {
    await closeSurreal(surreal)
  }
}

function inferTypes(value: unknown): { dbType: string; displayType: string; relation?: RelationInput } {
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
) {
  if (tableName.startsWith('_')) {
    throw new Error(`Cannot sync system table: ${tableName}`)
  }
  const surreal = await getSurreal(namespace, database)
  try {
    await upsertTable(namespace, database, { name: tableName })
    const [records] = (await surreal.query(
      `SELECT * FROM ${tableName} LIMIT $sampleSize`,
      { sampleSize }
    )) as [any[]]

    const columnMap = new Map<string, ColumnInput>()

    for (const record of records ?? []) {
      for (const [name, value] of Object.entries(record)) {
        if (['id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'].includes(name)) continue
        const { dbType, displayType, relation } = inferTypes(value)
        const existing = columnMap.get(name)
        if (!existing) {
          columnMap.set(name, {
            table: tableName,
            name,
            dbType,
            displayType,
            config: displayType === 'select' ? { displayType: 'select', options: [] } : {},
            optional: true,
          })
        }
        if (relation && displayType === 'relation') {
          await upsertRelation(namespace, database, {
            ...relation,
            fromTable: tableName,
            fromColumn: name,
            type: 'many-to-many',
          })
        }
      }
    }

    for (const column of columnMap.values()) {
      if (column.displayType === 'relation') {
        column.config = { displayType: 'relation', relationId: `relations:${tableName}:${column.name}` }
      }
      await upsertColumn(namespace, database, column)
    }

    return { tableName, columnsDiscovered: columnMap.size }
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter db test -- packages/db/test/schema-registry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema-registry.ts packages/db/test/schema-registry.test.ts
git commit -m "feat(db): add schema-registry helpers for _tables _columns _relations"
```

---

### Task 3: Update tenant provisioning to use declarative schemas

**Files:**
- Modify: `packages/db/src/provision.ts`
- Test: `packages/db/test/provision.test.ts`

- [ ] **Step 1: Update the test to verify seeded registry rows**

```ts
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
    const result = await surreal.query(`
      SELECT * FROM information::tables() WHERE name IN ['_tables', '_columns', '_relations']
    `)
    await closeSurreal(surreal)
    const tables = result.flat()
    expect(tables.map((t: any) => t.name).sort()).toEqual(['_columns', '_relations', '_tables'])
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter db test -- packages/db/test/provision.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Rewrite provision.ts to use schema definitions**

```ts
// packages/db/src/provision.ts
import { getSurreal, closeSurreal } from './client.js'
import { TENANT_TABLE_SCHEMAS, SYSTEM_COLUMNS } from './schema-definitions.js'
import { upsertColumn, upsertRelation, upsertTable } from './schema-registry.js'

export async function provisionCompanyNamespace(namespace: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(namespace)) {
    throw new Error(`Invalid namespace name: ${namespace}. Namespace must match /^[a-z_][a-z0-9_]*$/`)
  }
  const surreal = await getSurreal()
  try {
    const tableDefinitions = TENANT_TABLE_SCHEMAS.map((t) => `DEFINE TABLE IF NOT EXISTS ${t.name} SCHEMALESS;`).join('\n')

    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS ${namespace};
      USE NS ${namespace} DB main;
      DEFINE DATABASE IF NOT EXISTS main;
      USE NS ${namespace} DB main;

      ${tableDefinitions}

      DEFINE TABLE IF NOT EXISTS _tables SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_tables_name ON _tables FIELDS name UNIQUE;

      DEFINE TABLE IF NOT EXISTS _columns SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_columns_table ON _columns FIELDS table;
      DEFINE INDEX IF NOT EXISTS idx_columns_table_name ON _columns FIELDS table, name UNIQUE;

      DEFINE TABLE IF NOT EXISTS _relations SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_relations_from ON _relations FIELDS fromTable, fromColumn;
      DEFINE INDEX IF NOT EXISTS idx_relations_to ON _relations FIELDS toTable, toColumn;
      DEFINE INDEX IF NOT EXISTS idx_relations_unique ON _relations FIELDS fromTable, fromColumn, toTable, toColumn UNIQUE;

      DEFINE INDEX IF NOT EXISTS idx_members_profileId ON members FIELDS profileId;
      DEFINE INDEX IF NOT EXISTS idx_members_inviteCode ON members FIELDS inviteCode UNIQUE;
    `)

    for (const table of TENANT_TABLE_SCHEMAS) {
      await upsertTable(namespace, 'main', { name: table.name, label: table.label })
      for (const column of table.columns) {
        await upsertColumn(namespace, 'main', { ...column, table: table.name })
      }
      for (const column of SYSTEM_COLUMNS) {
        await upsertColumn(namespace, 'main', { ...column, table: table.name })
      }
      for (const relation of table.relations ?? []) {
        await upsertRelation(namespace, 'main', relation)
      }
    }

    return { ok: true, namespace }
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter db test -- packages/db/test/provision.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/provision.ts packages/db/test/provision.test.ts
git commit -m "feat(db): provision tenant tables from declarative schema definitions"
```

---

### Task 4: Update platform seeding to use declarative schemas

**Files:**
- Modify: `packages/db/src/seed.ts`
- Test: `packages/db/test/seed.test.ts`

- [ ] **Step 1: Update the test**

```ts
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
    const result = await surreal.query(`
      SELECT * FROM information::tables() WHERE name IN ['_tables', '_columns', '_relations']
    `)
    await closeSurreal(surreal)
    const tables = result.flat()
    expect(tables.map((t: any) => t.name).sort()).toEqual(['_columns', '_relations', '_tables'])
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
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter db test -- packages/db/test/seed.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Rewrite seed.ts to use schema definitions**

```ts
// packages/db/src/seed.ts
import { hashPassword } from 'shared'
import { getSurreal, closeSurreal } from './client.js'
import { PLATFORM_TABLE_SCHEMAS, SYSTEM_COLUMNS } from './schema-definitions.js'
import { upsertColumn, upsertRelation, upsertTable } from './schema-registry.js'

export async function seed() {
  const surreal = await getSurreal()
  try {
    const passwordHash = await hashPassword('admin')
    const tableDefinitions = PLATFORM_TABLE_SCHEMAS.map((t) => `DEFINE TABLE IF NOT EXISTS ${t.name} SCHEMALESS;`).join('\n')

    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS platform;
      USE NS platform DB admin;
      DEFINE DATABASE IF NOT EXISTS admin;
      USE NS platform DB admin;

      ${tableDefinitions}

      DEFINE TABLE IF NOT EXISTS _tables SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_tables_name ON _tables FIELDS name UNIQUE;

      DEFINE TABLE IF NOT EXISTS _columns SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_columns_table ON _columns FIELDS table;
      DEFINE INDEX IF NOT EXISTS idx_columns_table_name ON _columns FIELDS table, name UNIQUE;

      DEFINE TABLE IF NOT EXISTS _relations SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_relations_from ON _relations FIELDS fromTable, fromColumn;
      DEFINE INDEX IF NOT EXISTS idx_relations_to ON _relations FIELDS toTable, toColumn;
      DEFINE INDEX IF NOT EXISTS idx_relations_unique ON _relations FIELDS fromTable, fromColumn, toTable, toColumn UNIQUE;

      DEFINE INDEX IF NOT EXISTS idx_health_checks_checkedAt ON health_checks FIELDS checkedAt;
      DEFINE INDEX IF NOT EXISTS idx_health_checks_service_checkedAt ON health_checks FIELDS service, checkedAt;
      DEFINE INDEX IF NOT EXISTS idx_companies_slug ON companies FIELDS slug UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_accounts_provider_key ON accounts FIELDS provider, providerKey UNIQUE;

      UPSERT platform_users:admin SET email = 'admin@example.com', password = $password;
    `, { password: passwordHash })

    for (const table of PLATFORM_TABLE_SCHEMAS) {
      await upsertTable('platform', 'admin', { name: table.name, label: table.label })
      for (const column of table.columns) {
        await upsertColumn('platform', 'admin', { ...column, table: table.name })
      }
      for (const column of SYSTEM_COLUMNS) {
        await upsertColumn('platform', 'admin', { ...column, table: table.name })
      }
      for (const relation of table.relations ?? []) {
        await upsertRelation('platform', 'admin', relation)
      }
    }

    console.log('Platform namespace seeded')
  } finally {
    await closeSurreal(surreal)
  }
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter db test -- packages/db/test/seed.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed.ts packages/db/test/seed.test.ts
git commit -m "feat(db): seed platform tables from declarative schema definitions"
```

---

### Task 5: Export schema-registry and schema-definitions from db package

**Files:**
- Modify: `packages/db/package.json`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add export entries**

```json
// packages/db/package.json
{
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./client": { "types": "./src/client.ts", "default": "./src/client.ts" },
    "./platform": { "types": "./src/platform.ts", "default": "./src/platform.ts" },
    "./provision": { "types": "./src/provision.ts", "default": "./src/provision.ts" },
    "./schema-definitions": { "types": "./src/schema-definitions.ts", "default": "./src/schema-definitions.ts" },
    "./schema-registry": { "types": "./src/schema-registry.ts", "default": "./src/schema-registry.ts" },
    "./seed": { "types": "./src/seed.ts", "default": "./src/seed.ts" },
    "./tenant": { "types": "./src/tenant.ts", "default": "./src/tenant.ts" },
    "./health-checks": { "types": "./src/health-checks.ts", "default": "./src/health-checks.ts" },
    "./workflow-actions": { "types": "./src/workflow-actions.ts", "default": "./src/workflow-actions.ts" },
    "./normalize": { "types": "./src/normalize.ts", "default": "./src/normalize.ts" }
  }
}
```

- [ ] **Step 2: Re-export from index.ts**

```ts
// packages/db/src/index.ts
export { getSurreal, closeSurreal } from './client.js'
export * from './tenant.js'
export * from './schema-registry.js'
export * from './schema-definitions.js'
```

- [ ] **Step 3: Verify import works**

```bash
pnpm --filter db typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/package.json packages/db/src/index.ts
git commit -m "feat(db): export schema-registry and schema-definitions modules"
```

---

### Task 6: Update existing DB helpers to ignore system tables

**Files:**
- Modify: `packages/db/src/tenant.ts`
- Modify: `packages/db/src/workflow-actions.ts`

- [ ] **Step 1: Audit generic table enumeration**

Search for any query that lists all records from a table or iterates over tables:

```bash
grep -R "SELECT \* FROM" packages/db/src
grep -R "DEFINE TABLE" packages/db/src
```

Most existing helpers target specific tables and do not need changes.

- [ ] **Step 2: Confirm tenant.ts and workflow-actions.ts only touch specific tables**

No change needed if helpers like `listMembers`, `createMember`, etc. only query the `members` or `workflow_actions` tables directly.

- [ ] **Step 3: Add safety guard in syncTableSchemaFromRecords**

Already included:

```ts
if (tableName.startsWith('_')) {
  throw new Error(`Cannot sync system table: ${tableName}`)
}
```

- [ ] **Step 4: Run all db tests**

```bash
pnpm --filter db test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(db): confirm helpers ignore system tables"
```

---

### Task 7: Add tenant API routes

**Files:**
- Create: `apps/web/server/api/tables/index.get.ts`
- Create: `apps/web/server/api/tables/[table].get.ts`
- Create: `apps/web/server/api/tables/[table]/sync.post.ts`
- Create: `apps/web/server/api/tables/[table]/query.post.ts`
- Create: `apps/web/server/api/tables/[table]/columns.post.ts`
- Create: `apps/web/server/utils/resolve-tenant-nsdb.ts`

- [x] **Step 1: Create resolve-tenant-nsdb helper**

```ts
// apps/web/server/utils/resolve-tenant-nsdb.ts
import { getQuery, type H3Event } from 'h3'

export interface TenantNsDb {
  namespace: string
  database: string
}

export function resolveTenantNsDb(event: H3Event, body?: Record<string, unknown>): TenantNsDb {
  const query = getQuery(event)
  if (query.namespace && query.database) {
    return { namespace: String(query.namespace), database: String(query.database) }
  }
  if (body?.namespace && body?.database) {
    return { namespace: String(body.namespace), database: String(body.database) }
  }
  const company = event.context.company
  if (company?.namespace) {
    return { namespace: company.namespace, database: 'main' }
  }
  throw new Error('Missing tenant namespace/database: provide in query, body, or session')
}
```

- [x] **Step 2: Implement routes**

`index.get.ts`:

```ts
import { listUserTables } from 'db/schema-registry'
import { resolveTenantNsDb } from '../../utils/resolve-tenant-nsdb.js'

export default defineEventHandler(async (event) => {
  const { namespace, database } = resolveTenantNsDb(event)
  return listUserTables(namespace, database)
})
```

`[table].get.ts`:

```ts
import { getTableSchema } from 'db/schema-registry'
import { resolveTenantNsDb } from '../../../utils/resolve-tenant-nsdb.js'

export default defineEventHandler(async (event) => {
  const { namespace, database } = resolveTenantNsDb(event)
  const table = getRouterParam(event, 'table')!
  return getTableSchema(namespace, database, table)
})
```

`[table]/sync.post.ts`:

```ts
import { syncTableSchemaFromRecords } from 'db/schema-registry'
import { resolveTenantNsDb } from '../../../../utils/resolve-tenant-nsdb.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { namespace, database } = resolveTenantNsDb(event, body)
  const table = getRouterParam(event, 'table')!
  return syncTableSchemaFromRecords(namespace, database, table)
})
```

`[table]/query.post.ts`:

```ts
import { getSurreal, closeSurreal } from 'db/client'
import { resolveTenantNsDb } from '../../../../utils/resolve-tenant-nsdb.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { namespace, database } = resolveTenantNsDb(event, body)
  const table = getRouterParam(event, 'table')!

  const surreal = await getSurreal(namespace, database)
  try {
    const limit = body.pageSize ?? 25
    const start = ((body.page ?? 1) - 1) * limit
    const [records, totalResult] = await surreal.query(
      `
      SELECT * FROM ${table}
      LIMIT $limit START $start
      ;
      SELECT count() AS total FROM ${table} GROUP ALL
      `,
      { limit, start }
    )
    const total = (totalResult as any[])[0]?.total ?? 0
    return { records, total }
  } finally {
    await closeSurreal(surreal)
  }
})
```

`[table]/columns.post.ts`:

```ts
import { upsertColumn } from 'db/schema-registry'
import type { ColumnInput } from 'db/schema-registry'
import { resolveTenantNsDb } from '../../../../utils/resolve-tenant-nsdb.js'

export default defineEventHandler(async (event) => {
  const body = await readBody<ColumnInput>(event)
  const { namespace, database } = resolveTenantNsDb(event, body)
  const table = getRouterParam(event, 'table')!
  return upsertColumn(namespace, database, { ...body, table })
})
```

- [x] **Step 3: Verify dev server starts**

```bash
pnpm --filter web dev
```

Expected: server starts without errors.

- [x] **Step 4: Commit**

```bash
git add apps/web/server/api/tables apps/web/server/utils/resolve-tenant-nsdb.ts
git commit -m "feat(web): add tenant table schema API routes"
```

---

### Task 8: Add admin API routes

**Files:**
- Create: `apps/admin/server/api/tables/[nsdb].get.ts`
- Create: `apps/admin/server/api/tables/[nsdb]/[table].get.ts`
- Create: `apps/admin/server/api/tables/[nsdb]/[table]/sync.post.ts`
- Create: `apps/admin/server/api/tables/[nsdb]/[table]/query.post.ts`
- Create: `apps/admin/server/api/tables/[nsdb]/[table]/columns.post.ts`
- Create: `apps/admin/server/utils/parse-nsdb.ts`

- [x] **Step 1: Copy the parse-nsdb helper**

```ts
// apps/admin/server/utils/parse-nsdb.ts
export function parseNsdb(nsdb: string) {
  const parts = nsdb.split('--')
  if (parts.length !== 2) {
    throw new Error(`Invalid namespace--database key: ${nsdb}`)
  }
  const [namespace, database] = parts
  return { namespace, database }
}
```

- [x] **Step 2: Mirror the five web routes**

Use the same route bodies as Task 7, adjusting the relative import paths to `../../../../utils/parse-nsdb.js`.

- [x] **Step 3: Verify admin dev server starts**

```bash
pnpm --filter admin dev
```

Expected: server starts without errors.

- [x] **Step 4: Commit**

```bash
git add apps/admin/server/api/tables apps/admin/server/utils/parse-nsdb.ts
git commit -m "feat(admin): add platform table schema API routes"
```

---

### Task 9: Add API integration tests

**Files:**
- Create: `apps/web/tests/api/tables.test.ts`

- [ ] **Step 1: Create integration test**

```ts
// apps/web/tests/api/tables.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { provisionCompanyNamespace } from 'db/provision'
import { syncTableSchemaFromRecords } from 'db/schema-registry'
import { getSurreal, closeSurreal } from 'db/client'

const TEST_NS = `test_web_tables_${Date.now()}`

describe('/api/tables', () => {
  beforeAll(async () => {
    await provisionCompanyNamespace(TEST_NS)
    const surreal = await getSurreal(TEST_NS, 'main')
    await surreal.query(`UPSERT contacts:one SET name = 'Test', active = true`)
    await closeSurreal(surreal)
    await syncTableSchemaFromRecords(TEST_NS, 'main', 'contacts')
  })

  afterAll(async () => {
    const surreal = await getSurreal(TEST_NS, 'main')
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${TEST_NS}`)
    await closeSurreal(surreal)
  })

  it('lists user tables', async () => {
    const res = await fetch(`http://localhost:3000/api/tables?namespace=${TEST_NS}&database=main`)
    expect(res.ok).toBe(true)
    const tables = await res.json()
    expect(tables.some((t: any) => t.name === 'contacts')).toBe(true)
    expect(tables.some((t: any) => t.name.startsWith('_'))).toBe(false)
  })

  it('gets a table schema', async () => {
    const res = await fetch(`http://localhost:3000/api/tables/contacts?namespace=${TEST_NS}&database=main`)
    expect(res.ok).toBe(true)
    const schema = await res.json()
    expect(schema.columns.some((c: any) => c.name === 'name')).toBe(true)
    expect(schema.columns.some((c: any) => c.name === 'createdAt' && c.system === true)).toBe(true)
  })

  it('queries records', async () => {
    const res = await fetch(`http://localhost:3000/api/tables/contacts/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namespace: TEST_NS, database: 'main', page: 1, pageSize: 10 }),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.records).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run integration tests**

```bash
pnpm --filter web test
```

Expected: PASS (requires web dev server or test server; adjust base URL if needed).

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/api/tables.test.ts
git commit -m "test(web): add table schema API integration tests"
```

---

### Task 10: Add a performance benchmark for sync + query

**Files:**
- Create: `packages/db/scripts/schema-benchmark.ts`

- [ ] **Step 1: Create benchmark script**

```ts
// packages/db/scripts/schema-benchmark.ts
import { provisionCompanyNamespace } from '../src/provision.js'
import { syncTableSchemaFromRecords, listUserTables, getTableSchema } from '../src/schema-registry.js'
import { getSurreal, closeSurreal } from '../src/client.js'

const TEST_NS = `bench_schema_${Date.now()}`
const ROWS = 1000

async function main() {
  await provisionCompanyNamespace(TEST_NS)
  const surreal = await getSurreal(TEST_NS, 'main')

  console.log(`Seeding ${ROWS} records...`)
  const startSeed = performance.now()
  for (let i = 0; i < ROWS; i++) {
    await surreal.query(
      `UPSERT contacts:${i} SET name = $name, age = $age, active = $active`,
      { name: `User ${i}`, age: i % 100, active: i % 2 === 0 }
    )
  }
  console.log(`Seeded in ${(performance.now() - startSeed).toFixed(2)}ms`)

  console.log('Syncing schema...')
  const startSync = performance.now()
  await syncTableSchemaFromRecords(TEST_NS, 'main', 'contacts', 100)
  console.log(`Synced in ${(performance.now() - startSync).toFixed(2)}ms`)

  console.log('Listing tables...')
  const startList = performance.now()
  await listUserTables(TEST_NS, 'main')
  console.log(`Listed in ${(performance.now() - startList).toFixed(2)}ms`)

  console.log('Getting schema...')
  const startSchema = performance.now()
  await getTableSchema(TEST_NS, 'main', 'contacts')
  console.log(`Got schema in ${(performance.now() - startSchema).toFixed(2)}ms`)

  await closeSurreal(surreal)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Add script to package.json**

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "seed": "tsx src/seed.ts",
  "seed:workflows": "tsx src/seed-workflows.ts",
  "benchmark:schema": "tsx scripts/schema-benchmark.ts",
  "test": "vitest run",
  "benchmark": "tsx scripts/benchmark.ts"
}
```

- [ ] **Step 3: Run benchmark**

```bash
docker compose up -d
pnpm --filter db seed
pnpm --filter db benchmark:schema
```

Expected: output with seed/sync/list/schema timings.

- [ ] **Step 4: Commit**

```bash
git add packages/db/scripts/schema-benchmark.ts packages/db/package.json
git commit -m "chore(db): add schema sync benchmark"
```

---

### Task 11: Update documentation

**Files:**
- Modify: `docs/20-Architecture/Data Model.md`

- [ ] **Step 1: Add schema registry section**

Insert a new section after the platform/tenant overview:

```markdown
## Schema registry

Every namespace/database contains three system tables that describe its own schema:

- `_tables` — one row per table (name, label, hidden).
- `_columns` — one row per column (name, dbType, displayType, config, system, unique, optional, etc.).
- `_relations` — one row per relation between tables (fromTable, fromColumn, toTable, toColumn, type).

Existing platform and tenant tables (`companies`, `members`, `workflows`, etc.) are described declaratively in `packages/db/src/schema-definitions.ts`. `seed.ts` and `provision.ts` use this file to both `DEFINE TABLE` and populate `_tables`, `_columns`, and `_relations`. Every table also receives a standard set of system columns (`id`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy`) via `SYSTEM_COLUMNS`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/20-Architecture/Data\ Model.md
git commit -m "docs: document schema registry and declarative table schemas"
```

---

## Verification checklist

- [ ] `pnpm --filter db test` passes.
- [ ] `pnpm --filter db seed` runs successfully and populates `platform/admin` `_tables`/`_columns`/`_relations`.
- [ ] `pnpm --filter db benchmark:schema` runs and reports timings.
- [ ] `pnpm --filter web dev` starts and API routes respond.
- [ ] `pnpm --filter admin dev` starts and API routes respond.
- [ ] `pnpm -r build` succeeds.

---

## Spec coverage self-review

| Spec requirement | Implementing task |
|------------------|-------------------|
| Declarative schemas for all existing tables | Task 1 |
| System column template | Task 1 |
| `_tables`, `_columns`, `_relations` helpers | Task 2 |
| Tenant provisioning uses declarative schemas | Task 3 |
| Platform seeding uses declarative schemas | Task 4 |
| Export schema modules from db package | Task 5 |
| Existing DB helpers ignore system tables | Task 6 |
| Tenant API routes with `namespace--database` | Task 7 |
| Admin API routes | Task 8 |
| API integration tests | Task 9 |
| Performance benchmark | Task 10 |
| Documentation | Task 11 |

## Placeholder scan

- No `TBD`, `TODO`, or vague steps remain.
- Each code step includes concrete file contents or exact commands.
- Type and function names are consistent across tasks.

