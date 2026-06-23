# Lookup Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow table views to add virtual lookup columns that pull a field from a related record via dotted-path projection, while keeping `_columns` strictly 1:1 with the table.

**Architecture:** Extend `TableColumnConfig` with an optional `lookup` bag and add a `QueryProjectionColumn` type for the query API. The frontend translates view columns (plain + lookup) into `{ field, as }` projections. The backend query builder validates dotted paths and emits `SELECT companyId.name AS "Company Name"`. The renderer reads aliased result keys. The column toolbar lets users add/remove lookup columns per relation. The admin view editor preserves lookup columns when re-syncing with the schema.

**Tech Stack:** TypeScript, Vue 3, Nuxt UI v4, SurrealDB, Hono, Vitest.

---

### Task 1: Extend shared types for lookup columns

**Files:**
- Modify: `packages/shared/src/index.ts:186-198`

- [ ] **Step 1: Add `TableColumnLookup` and update `TableColumnConfig`**

```ts
export interface TableColumnLookup {
  from: string   // relation column name in the current table, e.g. "companyId"
  field: string  // field name on the related table, e.g. "name"
}

export interface TableColumnConfig {
  type?: 'column' | 'lookup'
  column?: string
  lookup?: TableColumnLookup
  label?: string
  width?: 'auto' | number
  visible?: boolean
  config?: Record<string, unknown>
}
```

- [ ] **Step 2: Add `QueryProjectionColumn` for the query API**

```ts
export interface QueryProjectionColumn {
  field: string
  as?: string
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add lookup column and query projection types"
```

---

### Task 2: Update the backend query builder to project `field/as` columns

**Files:**
- Modify: `apps/api/src/routes/table-query-builder.ts`
- Test: `apps/api/src/routes/table-query-builder.test.ts`

- [ ] **Step 1: Change the `QueryBody` columns type**

Replace the import and the `columns` field:

```ts
import type { FilterCondition, FilterGroup, QueryProjectionColumn, SortSetting } from 'shared'

export interface QueryBody {
  page?: number
  pageSize?: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: QueryProjectionColumn[]
  search?: string
}
```

- [ ] **Step 2: Rewrite `buildProjection`**

```ts
function sanitizeAlias(alias: string): string {
  return alias.replace(/`/g, '')
}

function buildProjection(columns: QueryProjectionColumn[], sortFields: string[]): string {
  const items = new Set<string>()

  for (const col of columns) {
    if (!col.field) continue
    assertField(col.field, 'columns')
    if (col.as) {
      items.add(`${buildField(col.field)} AS \`${sanitizeAlias(col.as)}\``)
    } else {
      items.add(buildField(col.field))
    }
  }

  for (const name of sortFields) {
    assertField(name, 'sort')
    items.add(buildField(name))
  }

  const selected = [...items]
  if (selected.length === 0) return '*'
  return selected.includes('id') ? selected.join(', ') : `id, ${selected.join(', ')}`
}
```

- [ ] **Step 3: Update `buildTableQuery` call site**

It already passes `body.columns` to `buildProjection`; no change needed except that `buildProjection` no longer checks `visible`.

- [ ] **Step 4: Add tests for projection columns and lookups**

Append to `apps/api/src/routes/table-query-builder.test.ts`:

```ts
  it('projects field/as columns', () => {
    const { query } = buildTableQuery('members', {
      columns: [
        { field: 'email' },
        { field: 'companyId.name', as: 'Company Name' },
      ],
    })
    expect(query).toContain('SELECT id, email, companyId.name AS `Company Name` FROM members')
  })

  it('includes sort fields in the projection', () => {
    const { query } = buildTableQuery('members', {
      columns: [{ field: 'email' }],
      sort: [{ field: 'createdAt', direction: 'desc' }],
    })
    expect(query).toContain('SELECT id, email, createdAt FROM members')
    expect(query).toContain('ORDER BY createdAt DESC')
  })

  it('rejects invalid dotted paths in columns', () => {
    expect(() =>
      buildTableQuery('members', {
        columns: [{ field: 'companyId.name; DROP' }],
      })
    ).toThrow('Invalid field name')
  })

  it('falls back to SELECT * when no columns are specified', () => {
    const { query } = buildTableQuery('members', {})
    expect(query).toContain('SELECT * FROM members')
  })
```

- [ ] **Step 5: Update existing tests to use projection columns**

Find every `columns: [{ column: '...', visible: ... }]` in `table-query-builder.test.ts` and replace with `columns: [{ field: '...' }]` (drop `visible`). For example:

```ts
// before
{ column: 'email', visible: true }
// after
{ field: 'email' }
```

- [ ] **Step 6: Run the tests**

```bash
pnpm vitest run apps/api/src/routes/table-query-builder.test.ts
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/table-query-builder.ts apps/api/src/routes/table-query-builder.test.ts
git commit -m "feat(api): support field/as projection columns and dotted lookup paths"
```

---

### Task 3: Allow lookup columns in view save validation

**Files:**
- Modify: `packages/db/src/schema-registry.ts:617-629`

- [ ] **Step 1: Build relation column set and validate lookups**

Replace the existing column validation block in `upsertView`:

```ts
    const relationColumns = new Set(
      (schema.relations ?? [])
        .filter((r) => r.fromTable === merged.table)
        .map((r) => r.fromColumn)
    )

    for (const col of merged.config?.table?.columns ?? []) {
      if (col.type === 'lookup') {
        if (!col.lookup?.from || !relationColumns.has(col.lookup.from)) {
          throw new Error(`Lookup column references unknown relation: ${col.lookup?.from}`)
        }
        if (!col.lookup.field || !/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(col.lookup.field)) {
          throw new Error(`Invalid lookup field: ${col.lookup?.field}`)
        }
        continue
      }
      if (!col.column || !columnNames.has(col.column)) {
        throw new Error(`Unknown column in view config: ${col.column}`)
      }
    }
```

- [ ] **Step 2: Add a test for lookup column validation**

Append to `packages/db/test/schema-registry.test.ts` (find the `upsertView` test group):

```ts
  it('accepts lookup columns that reference a relation', async () => {
    const view = await upsertView(namespace, database, {
      table: 'members',
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
    expect(view.config.table.columns).toHaveLength(2)
    expect(view.config.table.columns[1].lookup.field).toBe('name')
  })

  it('rejects lookup columns on non-relation fields', async () => {
    await expect(
      upsertView(namespace, database, {
        table: 'members',
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
```

- [ ] **Step 3: Run the db tests**

```bash
pnpm --filter db test
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema-registry.ts packages/db/test/schema-registry.test.ts
git commit -m "feat(db): validate lookup columns in view upserts"
```

---

### Task 4: Convert runtime view columns to query projections

**Files:**
- Modify: `layers/data-table/utils/query-body.ts`
- Test: `layers/data-table/utils/query-body.test.ts`

- [ ] **Step 1: Update the `QueryBody` interface and `buildQueryBody`**

```ts
import type { FilterGroup, QueryProjectionColumn, SortSetting, TableColumnConfig } from 'shared'
import type { RuntimeViewState } from './view-state.js'

export interface QueryBody {
  page: number
  pageSize: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: QueryProjectionColumn[]
  search?: string
}

function toProjectionColumn(col: TableColumnConfig): QueryProjectionColumn | null {
  if (col.type === 'lookup' && col.lookup) {
    return {
      field: `${col.lookup.from}.${col.lookup.field}`,
      as: col.label || `${col.lookup.from}.${col.lookup.field}`,
    }
  }
  if (col.column) {
    return { field: col.column }
  }
  return null
}

export function buildQueryBody(
  runtime: RuntimeViewState,
  page: number,
  pageSize: number,
  options?: { filter?: FilterGroup; search?: string },
): QueryBody {
  const body: QueryBody = { page, pageSize }
  const effectiveFilter = options?.filter ?? runtime.filter

  if (effectiveFilter && effectiveFilter.conditions.length > 0) {
    body.filter = effectiveFilter
  }

  if (runtime.sort.length > 0) {
    body.sort = runtime.sort
  }

  const visibleColumns = runtime.columns.filter((c) => c.visible !== false)
  const projections = visibleColumns
    .map(toProjectionColumn)
    .filter((c): c is QueryProjectionColumn => c !== null)

  if (projections.length > 0) {
    body.columns = projections
  }

  if (options?.search && options.search.trim().length > 0) {
    body.search = options.search.trim()
  }

  return body
}
```

- [ ] **Step 2: Update `query-body.test.ts` expectations**

Existing tests assert `columns: runtime.columns`. Change to expect projection columns. For example:

```ts
const body = buildQueryBody(runtime, 2, 50)
expect(body.columns).toEqual([
  { field: 'name' },
])
```

- [ ] **Step 3: Add a lookup conversion test**

```ts
  it('converts lookup columns to field/as projections', () => {
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [] },
      sort: [],
      group: [],
      columns: [
        { column: 'email', visible: true },
        { type: 'lookup', lookup: { from: 'companyId', field: 'name' }, label: 'Company', visible: true },
        { column: 'status', visible: false },
      ],
    }

    const body = buildQueryBody(runtime, 1, 25)

    expect(body.columns).toEqual([
      { field: 'email' },
      { field: 'companyId.name', as: 'Company' },
    ])
  })
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run layers/data-table/utils/query-body.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add layers/data-table/utils/query-body.ts layers/data-table/utils/query-body.test.ts
git commit -m "feat(data-table): translate view columns to query projection columns"
```

---

### Task 5: Render lookup columns in `DataTableRenderer.vue`

**Files:**
- Modify: `layers/data-table/components/DataTableRenderer.vue`

- [ ] **Step 1: Compute visible columns and result keys**

Replace `visibleColumns` with:

```ts
const visibleColumns = computed(() => {
  const configs = props.columns ?? props.view.config?.table?.columns ?? []
  const result = []
  for (const config of configs) {
    if (config.visible === false) continue

    if (config.type === 'lookup' && config.lookup) {
      const fieldPath = `${config.lookup.from}.${config.lookup.field}`
      const alias = config.label || fieldPath
      result.push({
        key: fieldPath,
        config,
        label: config.label || fieldPath,
        displayType: 'text' as const,
        value: (row: Record<string, unknown>) => row[alias] ?? row[fieldPath],
      })
      continue
    }

    if (!config.column) continue
    const column = columnMap.value.get(config.column)
    if (!column) continue
    result.push({
      key: config.column,
      config,
      column,
      label: config.label ?? column.label ?? column.name,
      displayType: column.displayType,
      value: (row: Record<string, unknown>) => row[config.column!],
    })
  }
  return result
})
```

- [ ] **Step 2: Update the template to use `key`, `label`, `value(row)`, and `displayType`**

Header:

```vue
<th
  v-for="{ config, label, key } in visibleColumns"
  :key="key"
  ...
>
  {{ label }}
</th>
```

Cells:

```vue
<td
  v-for="{ config, column, key, displayType, value } in visibleColumns"
  :key="key"
  ...
>
  <template v-if="displayType === 'email' && typeof value(row) === 'string'">
    <a :href="`mailto:${value(row)}`" class="text-blue-600 hover:underline">
      {{ value(row) }}
    </a>
  </template>
  <template v-else-if="displayType === 'tag'">
    <span
      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      :class="tagClasses(value(row), column?.config)"
    >
      {{ formatValue(value(row), 'text') }}
    </span>
  </template>
  <template v-else>
    {{ formatValue(value(row), displayType) }}
  </template>
</td>
```

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/components/DataTableRenderer.vue
git commit -m "feat(data-table): render lookup columns from aliased query results"
```

---

### Task 6: Add lookup column controls to `DataToolbarColumn.vue`

**Files:**
- Modify: `layers/data-table/components/DataToolbarColumn.vue`

- [ ] **Step 1: Build relation options and lookup form state**

After `schemaColumns`:

```ts
const relationColumns = computed(() =>
  props.schema.relations
    .filter((r) => r.fromTable === props.schema.table.name)
    .map((r) => r.fromColumn)
)

const relationOptions = computed(() =>
  relationColumns.value.map((name) => ({ label: labelFor(name), value: name }))
)

const lookupFrom = ref<string>('')
const lookupField = ref('name')
```

- [ ] **Step 2: Add `addLookup` helper**

```ts
function addLookup() {
  if (!lookupFrom.value || !lookupField.value) return
  const from = lookupFrom.value
  const field = lookupField.value.trim()
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) return

  visibleColumns.value.push({
    type: 'lookup',
    lookup: { from, field },
    label: `${labelFor(from)} ${field}`,
    width: 'auto',
    visible: true,
  })
  emitColumns()
  lookupField.value = 'name'
}
```

- [ ] **Step 3: Update labels and keys for lookup rows**

In the template, replace `:key="col.column"` with `:key="col.type === 'lookup' ? `${col.lookup?.from}.${col.lookup?.field}` : col.column"` in both lists.

Replace `{{ col.label ?? labelFor(col.column) }}` with a helper:

```ts
function displayLabel(col: TableColumnConfig): string {
  if (col.label) return col.label
  if (col.type === 'lookup' && col.lookup) return `${col.lookup.from}.${col.lookup.field}`
  return labelFor(col.column ?? '')
}
```

Use `displayLabel(col)` in both lists.

- [ ] **Step 4: Add the lookup form in the popover**

After the hidden list and before `</template>`:

```vue
<UDivider />
<div>
  <div class="text-xs font-medium text-gray-500 mb-1">Add lookup</div>
  <div class="space-y-2">
    <USelect v-model="lookupFrom" :options="relationOptions" placeholder="Relation" size="xs" />
    <UInput v-model="lookupField" placeholder="Field (e.g. name)" size="xs" />
    <UButton size="xs" color="neutral" :disabled="!lookupFrom || !lookupField" @click="addLookup">
      Add
    </UButton>
  </div>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add layers/data-table/components/DataToolbarColumn.vue
git commit -m "feat(data-table): add lookup column UI to column picker"
```

---

### Task 7: Preserve and edit lookup columns in the admin view editor

**Files:**
- Modify: `apps/admin/app/pages/views/[id].vue`

- [ ] **Step 1: Preserve lookup columns when syncing**

Replace `syncColumns` with:

```ts
function syncColumns() {
  if (!schema.value) return
  const existing = new Map(
    view.value.config?.table?.columns
      ?.filter((c) => c.type === 'lookup')
      ?.map((c) => [`${c.lookup!.from}.${c.lookup!.field}`, c]) ?? []
  )

  const columns: TableColumnConfig[] = schema.value.columns
    .filter((col: ColumnRow) => !col.hidden)
    .sort((a: ColumnRow, b: ColumnRow) => (a.order ?? Infinity) - (b.order ?? Infinity))
    .map((col: ColumnRow) => ({
      column: col.name,
      label: existing.get(col.name)?.label ?? col.label,
      width: existing.get(col.name)?.width ?? 'auto',
      visible: existing.get(col.name)?.visible ?? true,
    }))

  const lookups = view.value.config?.table?.columns?.filter((c) => c.type === 'lookup') ?? []
  view.value.config = { table: { columns: [...columns, ...lookups] } }
}
```

- [ ] **Step 2: Fix rendering keys and labels for lookup rows**

Change `:key="col.column"` to `:key="col.type === 'lookup' ? `${col.lookup?.from}.${col.lookup?.field}` : col.column"`.

Change the displayed column name from `{{ col.column }}` to:

```vue
<div class="font-medium">{{ col.type === 'lookup' ? `${col.lookup?.from}.${col.lookup?.field}` : col.column }}</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/pages/views/[id].vue
git commit -m "feat(admin): preserve lookup columns in view editor"
```

---

### Task 8: Update documentation

**Files:**
- Modify: `docs/40-Packages/data-table-layer.md`
- Modify: `docs/50-Features/Views.md`

- [ ] **Step 1: Document lookup columns in `data-table-layer.md`**

After the "Full-text search" section add:

```markdown
## Lookup columns

Lookup columns are virtual view columns that fetch a field from a related record. They are stored in the view config, not in `_columns`, so the schema stays 1:1 with the table.

```ts
interface TableColumnConfig {
  type?: 'column' | 'lookup'
  column?: string
  lookup?: { from: string; field: string }
  label?: string
  width?: 'auto' | number
  visible?: boolean
  config?: Record<string, unknown>
}
```

The frontend translates a lookup column into a query projection column:

```ts
{ field: 'companyId.name', as: 'Company' }
```

The backend query builder emits `SELECT companyId.name AS \`Company\``. Results are rendered using the alias as the result key.
```

- [ ] **Step 2: Update `Views.md` data model and query body**

Update `TableColumnConfig` in the data-model block to the new shape. Update the `QueryBody` block to use `QueryProjectionColumn[]`:

```ts
interface QueryBody {
  page?: number
  pageSize?: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: QueryProjectionColumn[]
}

interface QueryProjectionColumn {
  field: string
  as?: string
}
```

- [ ] **Step 3: Commit**

```bash
git add docs/40-Packages/data-table-layer.md docs/50-Features/Views.md
git commit -m "docs: lookup columns and query projection columns"
```

---

### Task 9: Verify typechecking, build, and tests

- [ ] **Step 1: Run typechecks**

```bash
pnpm --filter shared typecheck
pnpm --filter db typecheck
pnpm --filter api typecheck
pnpm --filter admin typecheck
```

Expected: no errors.

- [ ] **Step 2: Run focused tests**

```bash
pnpm vitest run apps/api/src/routes/table-query-builder.test.ts
pnpm vitest run layers/data-table/utils/query-body.test.ts
pnpm --filter db test
```

Expected: all pass.

- [ ] **Step 3: Build the admin app**

```bash
pnpm --filter admin build
```

Expected: success.

- [ ] **Step 4: Commit any fixes and finish**

```bash
git add -A
git commit -m "chore: typecheck and test fixes for lookup columns"
```

---

## Self-review

- **Spec coverage:**
  - Lookup column type in view config → Task 1.
  - Query projection separate from `_columns` → Tasks 1, 4.
  - Backend dotted-path projection → Task 2.
  - View save validation allows lookups → Task 3.
  - Renderer displays lookup values → Task 5.
  - UI to add/reorder lookup columns → Task 6.
  - Admin view editor preserves lookups → Task 7.
  - Docs updated → Task 8.
  - Verification → Task 9.

- **Placeholder scan:** no TBD/TODO; every step has code, paths, and commands.

- **Type consistency:** `TableColumnConfig.type` defaults to `'column'`; lookup columns use `type: 'lookup'` with `lookup.from`/`lookup.field`. Query API uses `QueryProjectionColumn` `{ field, as }` everywhere after Task 2.

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-lookup-columns.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

**Which approach?**
