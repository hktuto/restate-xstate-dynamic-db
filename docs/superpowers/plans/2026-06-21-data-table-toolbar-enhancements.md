---
title: Data Table Toolbar Enhancements — Filter Apply & Draggable Column Reorder
type: note
status: in-progress
area: docs
created: 2026-06-24
updated: 2026-06-24
---

# Data Table Toolbar Enhancements — Filter Apply & Draggable Column Reorder

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit **Apply** button to the filter popover (so filter edits do not refresh records until applied) and make the Columns popover draggable to reorder columns.

**Architecture:** `DataTable.vue` keeps `runtime.filter` as the toolbar draft and adds a separate `appliedFilter` ref that drives `loadRecords()`. Sort and columns stay reactive. `DataToolbarFilter.vue` emits `apply`. `DataToolbarColumn.vue` uses `@vueuse/sortable` on a local column list.

**Tech Stack:** Nuxt 4.4.8, Vue 3.5.38, TypeScript, Nuxt UI v4, Vitest, `@vueuse/sortable`, `sortablejs`.

---

## Files changed

- `layers/data-table/package.json` — add `@vueuse/sortable` and `sortablejs`
- `layers/data-table/utils/query-body.ts` — support optional `filter` override
- `layers/data-table/utils/query-body.test.ts` — test the override
- `layers/data-table/components/DataToolbarFilter.vue` — add Apply emit + button
- `layers/data-table/components/DataTable.vue` — add `appliedFilter` and split watchers
- `layers/data-table/components/DataToolbarColumn.vue` — add drag-to-reorder

---

### Task 1: Add dependencies

**Files:**
- Modify: `layers/data-table/package.json`
- Test: `pnpm install`

- [ ] **Step 1: Add packages to `layers/data-table/package.json`**

```json
{
  "name": "data-table-layer",
  "type": "module",
  "dependencies": {
    "@vueuse/integrations": "^14.0.0",
    "shared": "workspace:*",
    "sortablejs": "^1.15.0"
  },
  "devDependencies": {
    "@types/sortablejs": "^1.15.0",
    "nuxt": "^4.4.8",
    "typescript": "^5.8.3",
    "vue": "^3.5.35"
  }
}
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: lockfile updated, no errors.

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/package.json pnpm-lock.yaml
git commit -m "chore(data-table): add @vueuse/sortable and sortablejs"
```

---

### Task 2: Update `buildQueryBody` to accept an applied-filter override

**Files:**
- Modify: `layers/data-table/utils/query-body.ts`
- Modify: `layers/data-table/utils/query-body.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `layers/data-table/utils/query-body.test.ts`:

```ts
  it('uses provided applied filter instead of runtime.filter', () => {
    const runtime: RuntimeViewState = {
      filter: { op: 'and', conditions: [{ field: 'status', operator: 'eq', value: 'draft' }] },
      sort: [{ field: 'name', direction: 'asc' }],
      group: [],
      columns: [{ column: 'name', visible: true }],
    }
    const appliedFilter = { op: 'and' as const, conditions: [{ field: 'status', operator: 'eq', value: 'active' }] }

    const body = buildQueryBody(runtime, 1, 25, { filter: appliedFilter })

    expect(body.filter).toEqual(appliedFilter)
    expect(body.filter).not.toEqual(runtime.filter)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test layers/data-table/utils/query-body.test.ts`
Expected: FAIL — `buildQueryBody` does not accept a third argument.

- [ ] **Step 3: Implement the override in `query-body.ts`**

Replace the contents of `layers/data-table/utils/query-body.ts` with:

```ts
import type { FilterGroup, SortSetting, TableColumnConfig } from 'shared'
import type { RuntimeViewState } from './view-state.js'

export interface QueryBody {
  page: number
  pageSize: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: TableColumnConfig[]
}

export function buildQueryBody(
  runtime: RuntimeViewState,
  page: number,
  pageSize: number,
  options?: { filter?: FilterGroup },
): QueryBody {
  const body: QueryBody = { page, pageSize }
  const effectiveFilter = options?.filter ?? runtime.filter

  if (effectiveFilter && effectiveFilter.conditions.length > 0) {
    body.filter = effectiveFilter
  }

  if (runtime.sort.length > 0) {
    body.sort = runtime.sort
  }

  if (runtime.columns.length > 0) {
    body.columns = runtime.columns
  }

  return body
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test layers/data-table/utils/query-body.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add layers/data-table/utils/query-body.ts layers/data-table/utils/query-body.test.ts
git commit -m "feat(data-table): support applied-filter override in buildQueryBody"
```

---

### Task 3: Add Apply button to `DataToolbarFilter.vue`

**Files:**
- Modify: `layers/data-table/components/DataToolbarFilter.vue`

- [ ] **Step 1: Add the `apply` emit and Apply button**

Replace the `<script setup>` block of `layers/data-table/components/DataToolbarFilter.vue` with:

```ts
<script setup lang="ts">
import type { FilterGroup, TableSchema } from 'shared'

interface Props {
  modelValue?: FilterGroup
  schema: TableSchema
  lockedFilter?: FilterGroup
  canUpdateView?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [FilterGroup]; apply: [] }>()

const filter = computed({
  get: () => props.modelValue ?? { op: 'and', conditions: [] },
  set: (val) => emit('update:modelValue', val),
})
</script>
```

- [ ] **Step 2: Add the Apply button to the popover content**

Replace the `#content` template of `layers/data-table/components/DataToolbarFilter.vue` with:

```vue
    <template #content>
      <div class="p-3 w-96 space-y-2">
        <template v-if="!canUpdateView">
          <div class="text-sm font-medium text-gray-500">Locked filter</div>
          <div v-if="!lockedFilter || lockedFilter.conditions.length === 0" class="text-sm text-gray-400">
            None
          </div>
          <DataToolbarFilterBuilder
            v-else
            :model-value="lockedFilter"
            :schema="schema"
            disabled
          />
          <UDivider />
        </template>
        <div class="text-sm font-medium text-gray-500">{{ canUpdateView ? 'Filter' : 'Added conditions' }}</div>
        <DataToolbarFilterBuilder v-model="filter" :schema="schema" />
        <div class="pt-2 flex justify-end">
          <UButton color="primary" size="xs" icon="i-lucide-check" @click="emit('apply')">
            Apply
          </UButton>
        </div>
      </div>
    </template>
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter admin typecheck`
Expected: no errors (the layer is consumed by admin).

- [ ] **Step 4: Commit**

```bash
git add layers/data-table/components/DataToolbarFilter.vue
git commit -m "feat(data-table): add Apply button to filter popover"
```

---

### Task 4: Split filter draft from applied filter in `DataTable.vue`

**Files:**
- Modify: `layers/data-table/components/DataTable.vue`

- [ ] **Step 1: Import `FilterGroup` and add `appliedFilter` state**

At the top of `layers/data-table/components/DataTable.vue`:

```ts
import type { FilterGroup, TableSchema, ViewDefinition } from 'shared'
```

Add after the other refs:

```ts
const appliedFilter = ref<FilterGroup>({ op: 'and', conditions: [] })
```

- [ ] **Step 2: Initialize `appliedFilter` when the view loads**

Modify `loadViewAndSchema` to:

```ts
async function loadViewAndSchema() {
  const { view: loadedView, schema: loadedSchema } = await api.fetch<{ view: ViewDefinition; schema: TableSchema }>(
    `${viewBasePath()}/default/${props.table}`,
  )
  view.value = loadedView
  schema.value = loadedSchema
  appliedFilter.value = runtime.value.filter
    ? { ...runtime.value.filter, conditions: [...runtime.value.filter.conditions] }
    : { op: 'and', conditions: [] }
}
```

- [ ] **Step 3: Update `loadRecords` to use `appliedFilter`**

Modify `loadRecords` to:

```ts
async function loadRecords() {
  if (!view.value) return
  refreshing.value = true
  error.value = ''
  try {
    const body = buildQueryBody(runtime.value, 1, 25, { filter: appliedFilter.value })
    const result = await api.fetch<{ records: Record<string, unknown>[]; total: number }>(
      `${tableBasePath()}/${props.table}/query`,
      { method: 'POST', body: JSON.stringify(body) },
    )
    rows.value = result.records
    total.value = result.total
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load records'
  } finally {
    refreshing.value = false
  }
}
```

- [ ] **Step 4: Replace the single `watch(runtime, ...)` with targeted watchers**

Remove:

```ts
watch(runtime, loadRecords, { deep: true })
```

Add:

```ts
watch(appliedFilter, loadRecords, { deep: true })
watch(() => runtime.value.sort, loadRecords, { deep: true })
watch(() => runtime.value.columns, loadRecords, { deep: true })
watch(() => runtime.value.group, loadRecords, { deep: true })
```

- [ ] **Step 5: Wire the `apply` event**

Modify the `DataToolbar` usage to:

```vue
        <DataToolbar
          :runtime="runtime"
          :dirty="dirty"
          :view="view"
          :schema="schema"
          :can-update-view="canUpdateView"
          :can-edit-schema="canEditSchema"
          :can-manage-permissions="canManagePermissions"
          :schema-edit-link="schemaEditLink"
          :permissions-edit-link="permissionsEditLink"
          @save="handleSave"
          @apply-filter="appliedFilter = runtime.filter ? { ...runtime.filter, conditions: [...runtime.filter.conditions] } : { op: 'and', conditions: [] }"
        />
```

> **Note:** If `DataToolbar.vue` does not currently forward emits from `DataToolbarFilter`, also add `@apply-filter="emit('apply-filter')"` inside `DataToolbar.vue` on the `<DataToolbarFilter>` element (see Task 3.5 below).

- [ ] **Step 3.5 (conditional): Forward `apply-filter` through `DataToolbar.vue`**

Only if `DataToolbar.vue` does not already forward the event. Modify `layers/data-table/components/DataToolbar.vue`:

```ts
const emit = defineEmits<{ save: []; 'apply-filter': [] }>()
```

And on `<DataToolbarFilter>`:

```vue
    <DataToolbarFilter
      v-model="runtime.filter"
      :schema="schema"
      :locked-filter="view.filter"
      :can-update-view="canUpdateView"
      @apply="emit('apply-filter')"
    />
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter admin typecheck`
Expected: no errors (the layer is consumed by admin).

- [ ] **Step 7: Commit**

```bash
git add layers/data-table/components/DataTable.vue layers/data-table/components/DataToolbar.vue
git commit -m "feat(data-table): apply filter only on explicit Apply"
```

---

### Task 5: Make columns draggable in `DataToolbarColumn.vue`

**Files:**
- Modify: `layers/data-table/components/DataToolbarColumn.vue`

- [ ] **Step 1: Add imports and local draggable state**

Replace the `<script setup>` block of `layers/data-table/components/DataToolbarColumn.vue` with:

```ts
<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'
import type { TableColumnConfig, TableSchema } from 'shared'

interface Props {
  modelValue: TableColumnConfig[]
  schema: TableSchema
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [TableColumnConfig[]] }>()

const listEl = ref<HTMLElement | null>(null)
const localColumns = ref<TableColumnConfig[]>([])

watch(() => props.modelValue, (val) => {
  localColumns.value = val.map((c) => ({ ...c }))
}, { immediate: true, deep: true })

watch(localColumns, (val) => {
  emit('update:modelValue', val.map((c) => ({ ...c })))
}, { deep: true })

useSortable(listEl, localColumns, {
  animation: 150,
  ghostClass: 'bg-blue-50',
})

const schemaColumns = computed(() =>
  props.schema.columns.map((c) => ({ label: c.label ?? c.name, value: c.name })),
)

function toggle(index: number) {
  const col = localColumns.value[index]
  if (!col) return
  col.visible = col.visible === false ? true : false
}
</script>
```

- [ ] **Step 2: Wrap the list in the sortable element**

Replace the `#content` template of `layers/data-table/components/DataToolbarColumn.vue` with:

```vue
    <template #content>
      <div ref="listEl" class="p-3 w-56 space-y-1">
        <div
          v-for="(col, i) in localColumns"
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
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter admin typecheck`
Expected: no errors (the layer is consumed by admin).

- [ ] **Step 4: Commit**

```bash
git add layers/data-table/components/DataToolbarColumn.vue
git commit -m "feat(data-table): drag-to-reorder columns"
```

---

### Task 6: Run verification

**Files:** all of the above

- [ ] **Step 1: Run unit tests**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 2: Run admin typecheck**

Run: `pnpm --filter admin typecheck`
Expected: no errors (the layer is consumed by admin).

- [ ] **Step 3: Build consuming apps**

Run:
```bash
pnpm --filter admin build
pnpm --filter web build
```
Expected: both builds succeed.

- [ ] **Step 4: Manual browser check (if dev servers are running)**

1. Open the admin table page.
2. Open the Filter popover, add a condition, do **not** click Apply — verify the table does **not** refresh.
3. Click Apply — verify the table refreshes and the popover stays open.
4. Open the Sort popover, add a sort — verify the table refreshes immediately.
5. Open the Columns popover, drag a column to a new position — verify the table columns reorder.

- [ ] **Step 5: Final commit or finish**

If all checks pass, the feature branch is ready for review.

---

## Self-review checklist

- [ ] Spec coverage: Filter Apply mechanism → Tasks 2, 3, 4. Draggable columns → Task 5.
- [ ] Placeholders: no `TBD`, `TODO`, or vague steps.
- [ ] Type consistency: `FilterGroup`, `RuntimeViewState`, and `TableColumnConfig` names match the shared package and existing code.
- [ ] No component test framework is installed, so verification relies on unit tests + typecheck + build + manual browser check.
