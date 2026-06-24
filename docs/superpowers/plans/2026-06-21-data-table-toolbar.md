---
title: Data Table Toolbar Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-24
updated: 2026-06-24
---

# Data Table Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Apply the **ponytail** skill during implementation: minimal code, stdlib-first, one runnable check per non-trivial logic, no unnecessary dependencies.

**Goal:** Build a reusable data-table toolbar with filter, group, sort, and settings controls, gated by permissions, and introduce a `DataTable` container to replace the page-locked `DataTablePage`.

**Architecture:** `DataTable` loads view/schema/rows/permissions and renders `DataToolbar` + `DataTableRenderer`. `DataToolbar` combines small `v-model` based pieces. Pure runtime-state helpers live in a util file so they can be unit-tested in the existing node vitest environment.

**Tech Stack:** Vue 3, Nuxt UI, TypeScript, Vitest (node environment), `shared` workspace package.

---

## File map

| File | Responsibility |
|---|---|
| `packages/shared/src/index.ts` | Extend `ViewDefinition` with `filter`/`group`; add `FilterCondition`, `FilterGroup`, `GroupSetting`. |
| `layers/data-table/utils/view-state.ts` | Pure helpers: clone runtime state, merge back into view, dirty check. |
| `layers/data-table/utils/view-state.test.ts` | Unit tests for the helpers. |
| `layers/data-table/composables/useDataToolbar.ts` | Vue composable wrapping the helpers and managing toolbar state. |
| `layers/data-table/components/DataTable.vue` | Container: fetch data, check permissions, render toolbar + table. |
| `layers/data-table/components/DataTableRenderer.vue` | Renamed from `TableView.vue`; pure table renderer. |
| `layers/data-table/components/DataTablePage.vue` | Backward-compat wrapper around `DataTable.vue`. |
| `layers/data-table/components/DataToolbar.vue` | Toolbar shell combining small components. |
| `layers/data-table/components/DataToolbarFilter.vue` | Nested AND/OR filter builder with locked-condition support. |
| `layers/data-table/components/DataToolbarGroup.vue` | Group-by selector. |
| `layers/data-table/components/DataToolbarSort.vue` | Multi-column sort builder. |
| `layers/data-table/components/DataToolbarColumn.vue` | Column visibility/order/width. |
| `layers/data-table/components/DataToolbarSetting.vue` | Settings dropdown with schema/permissions links. |
| `docs/40-Packages/data-table-layer.md` | Update layer documentation. |

---

### Task 1: Extend shared view types

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add filter/group types and extend ViewDefinition**

Insert after the existing `SortSetting` interface:

```ts
export interface FilterCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn'
  value: unknown
}

export interface FilterGroup {
  op: 'and' | 'or'
  conditions: (FilterCondition | FilterGroup)[]
}

export interface GroupSetting {
  field: string
}
```

Update `ViewDefinition`:

```ts
export interface ViewDefinition {
  id?: string
  table: string
  type: 'table'
  name: string
  description?: string
  isDefault?: boolean
  config: ViewConfig
  filter?: FilterGroup
  group?: GroupSetting[]
  sort?: SortSetting[]
}
```

- [ ] **Step 2: Build shared package**

Run: `pnpm --filter shared build`
Expected: build succeeds, no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
# do not run git commit unless explicitly asked
```

---

### Task 2: Pure runtime-state helpers

**Files:**
- Create: `layers/data-table/utils/view-state.ts`
- Create: `layers/data-table/utils/view-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `layers/data-table/utils/view-state.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildRuntimeView, isDirty, mergeFilter } from './view-state'
import type { FilterGroup, ViewDefinition } from 'shared'

const baseView: ViewDefinition = {
  table: 'members',
  type: 'table',
  name: 'Default',
  config: { table: { columns: [{ column: 'email', visible: true, width: 'auto' }] } },
  filter: { op: 'and', conditions: [{ field: 'role', operator: 'eq', value: 'admin' }] },
  group: [{ field: 'role' }],
  sort: [{ field: 'email', direction: 'asc' }],
}

describe('buildRuntimeView', () => {
  it('clones view state deeply', () => {
    const runtime = buildRuntimeView(baseView)
    expect(runtime.filter).toEqual(baseView.filter)
    expect(runtime.filter).not.toBe(baseView.filter)
  })
})

describe('isDirty', () => {
  it('returns false when runtime matches view', () => {
    const runtime = buildRuntimeView(baseView)
    expect(isDirty(runtime, baseView, true)).toBe(false)
  })

  it('returns true when sort changes', () => {
    const runtime = buildRuntimeView(baseView)
    runtime.sort[0].direction = 'desc'
    expect(isDirty(runtime, baseView, true)).toBe(true)
  })

  it('returns false for locked view filter when user has not added conditions', () => {
    const runtime = buildRuntimeView(baseView)
    runtime.filter = { op: 'and', conditions: [] }
    expect(isDirty(runtime, baseView, false)).toBe(false)
  })
})

describe('mergeFilter', () => {
  it('combines locked and user-added conditions with AND', () => {
    const locked: FilterGroup = { op: 'and', conditions: [{ field: 'role', operator: 'eq', value: 'admin' }] }
    const added: FilterGroup = { op: 'and', conditions: [{ field: 'email', operator: 'contains', value: '@' }] }
    const merged = mergeFilter(locked, added)
    expect(merged.op).toBe('and')
    expect(merged.conditions).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run layers/data-table/utils/view-state.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

Create `layers/data-table/utils/view-state.ts`:

```ts
import type { FilterGroup, GroupSetting, SortSetting, TableColumnConfig, ViewDefinition } from 'shared'

export interface RuntimeViewState {
  filter?: FilterGroup
  group: GroupSetting[]
  sort: SortSetting[]
  columns: TableColumnConfig[]
}

export function buildRuntimeView(view: ViewDefinition): RuntimeViewState {
  return {
    filter: view.filter ? structuredClone(view.filter) : undefined,
    group: view.group ? structuredClone(view.group) : [],
    sort: view.sort ? structuredClone(view.sort) : [],
    columns: view.config.table?.columns ? structuredClone(view.config.table.columns) : [],
  }
}

export function isDirty(runtime: RuntimeViewState, view: ViewDefinition, canUpdateView: boolean): boolean {
  const effectiveFilter = canUpdateView ? runtime.filter : mergeFilter(view.filter, runtime.filter)
  return !deepEqual(effectiveFilter, view.filter) ||
    !deepEqual(runtime.group, view.group) ||
    !deepEqual(runtime.sort, view.sort) ||
    !deepEqual(runtime.columns, view.config.table?.columns)
}

export function mergeRuntimeToView(runtime: RuntimeViewState, view: ViewDefinition, canUpdateView: boolean): ViewDefinition {
  return {
    ...view,
    config: {
      ...view.config,
      table: {
        ...view.config.table,
        columns: structuredClone(runtime.columns),
      },
    },
    filter: canUpdateView
      ? (runtime.filter ? structuredClone(runtime.filter) : undefined)
      : mergeFilter(view.filter, runtime.filter),
    group: runtime.group.length ? structuredClone(runtime.group) : undefined,
    sort: runtime.sort.length ? structuredClone(runtime.sort) : undefined,
  }
}

export function mergeFilter(locked: FilterGroup | undefined, added: FilterGroup | undefined): FilterGroup | undefined {
  if (!locked && !added) return undefined
  if (!locked) return added ? structuredClone(added) : undefined
  if (!added || added.conditions.length === 0) return structuredClone(locked)
  if (locked.op === 'and' && added.op === 'and') {
    return {
      op: 'and',
      conditions: [...structuredClone(locked.conditions), ...structuredClone(added.conditions)],
    }
  }
  return {
    op: 'and',
    conditions: [structuredClone(locked), structuredClone(added)],
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run layers/data-table/utils/view-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add layers/data-table/utils/view-state.ts layers/data-table/utils/view-state.test.ts
```

---

### Task 3: Rename TableView to DataTableRenderer

**Files:**
- Rename: `layers/data-table/components/TableView.vue` → `layers/data-table/components/DataTableRenderer.vue`
- Modify: `layers/data-table/components/DataTablePage.vue`

- [ ] **Step 1: Rename file and update internal references**

Rename the file. The component has no self-reference, so no internal changes needed.

- [ ] **Step 2: Update DataTablePage import**

In `layers/data-table/components/DataTablePage.vue`, replace:

```ts
import type { TableSchema, ViewDefinition } from 'shared'
```

with:

```ts
import type { TableSchema, ViewDefinition } from 'shared'
```

and in the template replace `<TableView` with `<DataTableRenderer`.

- [ ] **Step 3: Verify admin build**

Run: `pnpm --filter admin build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add layers/data-table/components/DataTableRenderer.vue layers/data-table/components/DataTablePage.vue
```

---

### Task 4: Create useDataToolbar composable

**Files:**
- Create: `layers/data-table/composables/useDataToolbar.ts`

- [ ] **Step 1: Write the composable**

Create `layers/data-table/composables/useDataToolbar.ts`:

```ts
import { computed, ref, toRef, watch } from 'vue'
import type { MaybeRef } from 'vue'
import type { ViewDefinition } from 'shared'
import { buildRuntimeView, isDirty, mergeRuntimeToView, type RuntimeViewState } from '../utils/view-state'

export function useDataToolbar(view: Ref<ViewDefinition>, canUpdateView: MaybeRef<boolean> = false) {
  const canUpdate = toRef(canUpdateView)

  function buildRuntime(): RuntimeViewState {
    const state = buildRuntimeView(view.value)
    if (!canUpdate.value) {
      state.filter = { op: 'and', conditions: [] }
    }
    return state
  }

  const runtime = ref<RuntimeViewState>(buildRuntime())

  watch([view, canUpdate], () => {
    runtime.value = buildRuntime()
  }, { immediate: false })

  const dirty = computed(() => isDirty(runtime.value, view.value, canUpdate.value))

  function save(): ViewDefinition {
    return mergeRuntimeToView(runtime.value, view.value, canUpdate.value)
  }

  return {
    runtime,
    dirty,
    save,
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter admin build`
Expected: build succeeds (the composable is auto-imported by Nuxt).

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/composables/useDataToolbar.ts
```

---

### Task 5: Create DataTable container

**Files:**
- Create: `layers/data-table/components/DataTable.vue`

- [ ] **Step 1: Write the container component**

Create `layers/data-table/components/DataTable.vue`:

```vue
<script setup lang="ts">
import type { TableSchema, ViewDefinition } from 'shared'

interface Props {
  table: string
  nsdb?: string
  title?: string
  icon?: string
  newLink?: string
  newLabel?: string
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'i-lucide-table',
})

const api = useApi()

const view = ref<ViewDefinition | null>(null)
const schema = ref<TableSchema | null>(null)
const rows = ref<Record<string, unknown>[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const saveError = ref('')

function viewBasePath(): string {
  return props.nsdb ? `/api/admin/views/${props.nsdb}` : '/api/views'
}

function tableBasePath(): string {
  return props.nsdb ? `/api/admin/tables/${props.nsdb}` : '/api/tables'
}

async function load() {
  loading.value = true
  error.value = ''
  saveError.value = ''
  try {
    const { view: loadedView, schema: loadedSchema } = await api.fetch<{ view: ViewDefinition; schema: TableSchema }>(
      `${viewBasePath()}/default/${props.table}`
    )
    view.value = loadedView
    schema.value = loadedSchema
    const result = await api.fetch<{ records: Record<string, unknown>[]; total: number }>(
      `${tableBasePath()}/${props.table}/query`,
      { method: 'POST', body: JSON.stringify({ page: 1, pageSize: 25 }) }
    )
    rows.value = result.records
    total.value = result.total
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load data'
  } finally {
    loading.value = false
  }
}

async function handleSave(updated: ViewDefinition) {
  saveError.value = ''
  if (!updated.id) return
  try {
    await api.fetch(`${viewBasePath()}/${updated.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updated),
    })
    await load()
  } catch (err: any) {
    saveError.value = err?.message ?? 'Failed to save view'
  }
}

await load()
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="title ?? table" :icon="icon">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="error" class="p-4 text-red-600 bg-red-50 rounded">
        {{ error }}
      </div>
      <div v-else-if="loading" class="p-4 text-gray-500">
        Loading...
      </div>
      <div v-else-if="view && schema" class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">{{ view.name }}</h1>
            <p v-if="view.description" class="text-sm text-gray-500">{{ view.description }}</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-sm text-gray-500">
              {{ total }} records
            </div>
            <NuxtLink
              v-if="newLink"
              :to="newLink"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {{ newLabel ?? 'New' }}
            </NuxtLink>
          </div>
        </div>
        <DataToolbar
          :view="view"
          :schema="schema"
          :can-update-view="canUpdateView"
          :can-edit-schema="canEditSchema"
          :can-manage-permissions="canManagePermissions"
          @save="handleSave"
        />
        <div v-if="saveError" class="text-sm text-red-600">{{ saveError }}</div>
        <DataTableRenderer :view="view" :schema="schema" :rows="rows" />
      </div>
    </template>
  </UDashboardPanel>
</template>
```

- [ ] **Step 2: Verify admin build**

Run: `pnpm --filter admin build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/components/DataTable.vue
```

---

### Task 6: Create DataToolbar wrapper

**Files:**
- Create: `layers/data-table/components/DataToolbar.vue`

- [ ] **Step 1: Write the toolbar wrapper**

Create `layers/data-table/components/DataToolbar.vue`:

```vue
<script setup lang="ts">
import type { TableSchema, ViewDefinition } from 'shared'

interface Props {
  view: ViewDefinition
  schema: TableSchema
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ save: [view: ViewDefinition] }>()

const { runtime, dirty, save: buildSaveView } = useDataToolbar(toRef(props, 'view'), toRef(props, 'canUpdateView'))

function onSave() {
  emit('save', buildSaveView())
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 p-2 border border-gray-200 rounded bg-white">
    <DataToolbarFilter
      v-model="runtime.filter"
      :schema="schema"
      :locked-filter="view.filter"
      :can-update-view="canUpdateView"
    />
    <DataToolbarGroup v-model="runtime.group" :schema="schema" />
    <DataToolbarSort v-model="runtime.sort" :schema="schema" />
    <DataToolbarColumn v-model="runtime.columns" :schema="schema" />
    <DataToolbarSetting
      :can-edit-schema="canEditSchema"
      :can-manage-permissions="canManagePermissions"
    />
    <UButton
      v-if="canUpdateView && dirty"
      color="primary"
      size="sm"
      @click="onSave"
    >
      Save view
    </UButton>
  </div>
</template>
```

- [ ] **Step 2: Verify admin build**

Run: `pnpm --filter admin build`
Expected: build succeeds (stub components will be created next).

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/components/DataToolbar.vue
```

---

### Task 7: Create DataToolbarFilter

**Files:**
- Create: `layers/data-table/components/DataToolbarFilter.vue`

- [ ] **Step 1: Write the filter builder**

Create `layers/data-table/components/DataToolbarFilter.vue`:

```vue
<script setup lang="ts">
import type { FilterCondition, FilterGroup, TableSchema } from 'shared'

interface Props {
  modelValue?: FilterGroup
  schema: TableSchema
  lockedFilter?: FilterGroup
  canUpdateView?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [FilterGroup] }>()

const filter = computed({
  get: () => props.modelValue ?? { op: 'and', conditions: [] },
  set: (val) => emit('update:modelValue', val),
})

const displayedConditions = computed<FilterCondition[]>(() => filter.value.conditions as FilterCondition[])

const operators = [
  { label: '=', value: 'eq' },
  { label: '≠', value: 'neq' },
  { label: '>', value: 'gt' },
  { label: '≥', value: 'gte' },
  { label: '<', value: 'lt' },
  { label: '≤', value: 'lte' },
  { label: 'contains', value: 'contains' },
]

function addCondition() {
  filter.value.conditions.push({ field: '', operator: 'eq', value: '' })
}

function removeCondition(index: number) {
  filter.value.conditions.splice(index, 1)
}
</script>

<template>
  <UPopover>
    <UButton color="neutral" size="sm" icon="i-lucide-filter" trailing-icon="i-lucide-chevron-down">
      Filter
    </UButton>
    <template #panel>
      <div class="p-3 w-80 space-y-2">
        <template v-if="!canUpdateView">
          <div class="text-sm font-medium text-gray-500">Locked filter</div>
          <div v-if="!lockedFilter || lockedFilter.conditions.length === 0" class="text-sm text-gray-400">
            None
          </div>
          <div v-for="(cond, i) in lockedFilter?.conditions ?? []" :key="`locked-${i}`" class="flex gap-2 text-sm text-gray-500">
            <span class="flex-1">{{ cond.field }} {{ cond.operator }} {{ cond.value }}</span>
          </div>
          <UDivider />
        </template>
        <div class="text-sm font-medium text-gray-500">{{ canUpdateView ? 'Filter' : 'Added conditions' }}</div>
        <div v-for="(cond, i) in displayedConditions" :key="i" class="flex gap-2 items-center">
          <USelect v-model="cond.field" :items="schema.columns.map(c => ({ label: c.label ?? c.name, value: c.name }))" size="xs" class="flex-1" />
          <USelect v-model="cond.operator" :items="operators" size="xs" class="w-24" />
          <UInput v-model="cond.value" size="xs" class="flex-1" />
          <UButton color="error" size="xs" icon="i-lucide-x" @click="removeCondition(i)" />
        </div>
        <UButton color="neutral" size="xs" icon="i-lucide-plus" @click="addCondition">
          Add condition
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
```

- [ ] **Step 2: Verify admin build**

Run: `pnpm --filter admin build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/components/DataToolbarFilter.vue
```

---

### Task 8: Create DataToolbarGroup

**Files:**
- Create: `layers/data-table/components/DataToolbarGroup.vue`

- [ ] **Step 1: Write the group selector**

Create `layers/data-table/components/DataToolbarGroup.vue`:

```vue
<script setup lang="ts">
import type { GroupSetting, TableSchema } from 'shared'

interface Props {
  modelValue: GroupSetting[]
  schema: TableSchema
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [GroupSetting[]] }>()

const group = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const fieldOptions = computed(() =>
  props.schema.columns.map((c) => ({ label: c.label ?? c.name, value: c.name }))
)

function addGroup() {
  group.value.push({ field: '' })
}

function removeGroup(index: number) {
  group.value.splice(index, 1)
}
</script>

<template>
  <UPopover>
    <UButton color="neutral" size="sm" icon="i-lucide-layers" trailing-icon="i-lucide-chevron-down">
      Group
    </UButton>
    <template #panel>
      <div class="p-3 w-64 space-y-2">
        <div v-for="(g, i) in group" :key="i" class="flex gap-2 items-center">
          <USelect v-model="g.field" :items="fieldOptions" size="xs" class="flex-1" />
          <UButton color="error" size="xs" icon="i-lucide-x" @click="removeGroup(i)" />
        </div>
        <UButton color="neutral" size="xs" icon="i-lucide-plus" @click="addGroup">
          Add group
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
```

- [ ] **Step 2: Verify admin build**

Run: `pnpm --filter admin build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/components/DataToolbarGroup.vue
```

---

### Task 9: Create DataToolbarSort

**Files:**
- Create: `layers/data-table/components/DataToolbarSort.vue`

- [ ] **Step 1: Write the sort builder**

Create `layers/data-table/components/DataToolbarSort.vue`:

```vue
<script setup lang="ts">
import type { SortSetting, TableSchema } from 'shared'

interface Props {
  modelValue: SortSetting[]
  schema: TableSchema
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [SortSetting[]] }>()

const sort = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const fieldOptions = computed(() =>
  props.schema.columns.map((c) => ({ label: c.label ?? c.name, value: c.name }))
)

function addSort() {
  sort.value.push({ field: '', direction: 'asc' })
}

function removeSort(index: number) {
  sort.value.splice(index, 1)
}
</script>

<template>
  <UPopover>
    <UButton color="neutral" size="sm" icon="i-lucide-arrow-up-down" trailing-icon="i-lucide-chevron-down">
      Sort
    </UButton>
    <template #panel>
      <div class="p-3 w-72 space-y-2">
        <div v-for="(s, i) in sort" :key="i" class="flex gap-2 items-center">
          <USelect v-model="s.field" :items="fieldOptions" size="xs" class="flex-1" />
          <USelect v-model="s.direction" :items="[{ label: 'Asc', value: 'asc' }, { label: 'Desc', value: 'desc' }]" size="xs" class="w-24" />
          <UButton color="error" size="xs" icon="i-lucide-x" @click="removeSort(i)" />
        </div>
        <UButton color="neutral" size="xs" icon="i-lucide-plus" @click="addSort">
          Add sort
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
```

- [ ] **Step 2: Verify admin build**

Run: `pnpm --filter admin build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/components/DataToolbarSort.vue
```

---

### Task 10: Create DataToolbarColumn

**Files:**
- Create: `layers/data-table/components/DataToolbarColumn.vue`

- [ ] **Step 1: Write the column config popover**

Create `layers/data-table/components/DataToolbarColumn.vue`:

```vue
<script setup lang="ts">
import type { TableColumnConfig, TableSchema } from 'shared'

interface Props {
  modelValue: TableColumnConfig[]
  schema: TableSchema
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [TableColumnConfig[]] }>()

const columns = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const schemaColumns = computed(() =>
  props.schema.columns.map((c) => ({ label: c.label ?? c.name, value: c.name }))
)

function toggle(index: number) {
  const col = columns.value[index]
  col.visible = col.visible === false ? true : false
}
</script>

<template>
  <UPopover>
    <UButton color="neutral" size="sm" icon="i-lucide-columns-3" trailing-icon="i-lucide-chevron-down">
      Columns
    </UButton>
    <template #panel>
      <div class="p-3 w-56 space-y-1">
        <div
          v-for="(col, i) in columns"
          :key="col.column"
          class="flex items-center justify-between p-1 hover:bg-gray-50 rounded cursor-pointer"
          @click="toggle(i)"
        >
          <span class="text-sm">{{ col.label ?? schemaColumns.find(s => s.value === col.column)?.label ?? col.column }}</span>
          <UIcon v-if="col.visible !== false" name="i-lucide-eye" class="text-gray-500" />
          <UIcon v-else name="i-lucide-eye-off" class="text-gray-400" />
        </div>
      </div>
    </template>
  </UPopover>
</template>
```

- [ ] **Step 2: Verify admin build**

Run: `pnpm --filter admin build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/components/DataToolbarColumn.vue
```

---

### Task 11: Create DataToolbarSetting

**Files:**
- Create: `layers/data-table/components/DataToolbarSetting.vue`

- [ ] **Step 1: Write the settings dropdown**

Create `layers/data-table/components/DataToolbarSetting.vue`:

```vue
<script setup lang="ts">
interface Props {
  canEditSchema?: boolean
  canManagePermissions?: boolean
  schemaEditLink?: string
  permissionsEditLink?: string
}

const props = defineProps<Props>()
</script>

<template>
  <UDropdownMenu
    v-if="canEditSchema || canManagePermissions"
    :items="[
      ...(canEditSchema && schemaEditLink ? [{ label: 'Edit schema', to: schemaEditLink, icon: 'i-lucide-table-2' }] : []),
      ...(canManagePermissions && permissionsEditLink ? [{ label: 'Manage permissions', to: permissionsEditLink, icon: 'i-lucide-shield' }] : []),
    ]"
  >
    <UButton color="neutral" size="sm" icon="i-lucide-settings" trailing-icon="i-lucide-chevron-down">
      Settings
    </UButton>
  </UDropdownMenu>
</template>
```

- [ ] **Step 2: Verify admin build**

Run: `pnpm --filter admin build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/components/DataToolbarSetting.vue
```

---

### Task 12: Update DataTablePage backward-compat wrapper

**Files:**
- Modify: `layers/data-table/components/DataTablePage.vue`

- [ ] **Step 1: Replace implementation with wrapper**

Replace the entire `<script>` and `<template>` with:

```vue
<script setup lang="ts">
interface Props {
  title: string
  icon?: string
  table: string
  nsdb?: string
  newLink?: string
  newLabel?: string
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
}

withDefaults(defineProps<Props>(), {
  icon: 'i-lucide-table',
})
</script>

<template>
  <DataTable
    :table="table"
    :nsdb="nsdb"
    :title="title"
    :icon="icon"
    :new-link="newLink"
    :new-label="newLabel"
    :can-update-view="canUpdateView"
    :can-edit-schema="canEditSchema"
    :can-manage-permissions="canManagePermissions"
  />
</template>
```

- [ ] **Step 2: Verify admin build**

Run: `pnpm --filter admin build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/components/DataTablePage.vue
```

---

### Task 13: Update data-table layer documentation

**Files:**
- Modify: `docs/40-Packages/data-table-layer.md`

- [ ] **Step 1: Add toolbar and container sections**

Append to `docs/40-Packages/data-table-layer.md`:

```markdown
## Components

- `DataTable` — container that loads a table's view, schema, and records, then renders the toolbar and table. Permission booleans are passed as props.
- `DataTableRenderer` — pure table renderer.
- `DataTablePage` — deprecated backward-compat wrapper around `DataTable`.
- `DataToolbar` — combines filter, group, sort, column, and settings controls.
- `DataToolbarFilter`, `DataToolbarGroup`, `DataToolbarSort`, `DataToolbarColumn`, `DataToolbarSetting` — individual toolbar pieces.

## Permissions

- `update_default_view_settings` — allows saving view changes.
- `edit_schema` — shows the "Edit schema" settings link.
- `manage_permissions` — shows the "Manage permissions" settings link.
```

- [ ] **Step 2: Commit**

```bash
git add docs/40-Packages/data-table-layer.md
```

---

## Self-review

**Spec coverage:**
- Filter/group/sort/column controls: Tasks 7–10.
- Settings dropdown with schema/permissions links: Task 11.
- Permission gating: Tasks 5 and 11.
- DataTable container and DataTablePage backward-compat: Tasks 5 and 12.
- Shared type extensions: Task 1.
- Saving flow and dirty detection: Tasks 2, 4, 5, 6.
- Error handling: Task 5.
- Testing: Task 2.
- Documentation: Task 13.

**Placeholder scan:** No TBD/TODO/fill-in-details found.

**Type consistency:** `FilterGroup`, `GroupSetting`, `RuntimeViewState`, `ViewDefinition`, `TableColumnConfig`, and `SortSetting` are used consistently across tasks.
