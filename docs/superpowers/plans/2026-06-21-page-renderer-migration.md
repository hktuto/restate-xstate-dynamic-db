# PageRenderer migration implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all admin list pages off the legacy `DataTablePage`/`DataTable` components onto a JSON-config-driven `PageRenderer` that renders `ViewRenderer`, while centralizing the dashboard chrome in the layout via `usePageMeta`.

**Architecture:** A new `usePageMeta` composable feeds title/icon to the `default` layout. `PageRenderer` accepts a JSON config and delegates to `ViewRenderer`. `DataTableContainer` gains the full `DataToolbar` (search/filter/sort/columns/save) and view-saving logic. Legacy components and the unused `/tables/[table]` page are deleted after migration.

**Tech Stack:** Nuxt 3, Vue 3, TypeScript, Nuxt UI, `layers/data-table`, `shared` resource catalog.

---

## Task 1: Create `usePageMeta` composable

**Files:**
- Create: `apps/admin/app/composables/usePageMeta.ts`

- [ ] **Step 1: Write the composable**

```ts
import { onScopeDispose, readonly, toRef, watch, type MaybeRef } from 'vue'

export interface PageMeta {
  title?: string
  icon?: string
}

export function usePageMeta(meta: MaybeRef<PageMeta>) {
  const state = useState<PageMeta>('pageMeta', () => ({}))
  const consumers = useState<number>('pageMetaConsumers', () => 0)
  const metaRef = toRef(meta)

  consumers.value++

  watch(
    metaRef,
    (value) => {
      state.value = { ...value }
    },
    { immediate: true, deep: true },
  )

  onScopeDispose(() => {
    consumers.value = Math.max(0, consumers.value - 1)
    if (consumers.value === 0) {
      state.value = {}
    }
  })

  return { pageMeta: readonly(state) }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter admin typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/composables/usePageMeta.ts
git commit -m "feat(admin): add usePageMeta composable for layout title/icon"
```

---

## Task 2: Centralize dashboard chrome in `default.vue` layout

**Files:**
- Modify: `apps/admin/app/layouts/default.vue`

- [ ] **Step 1: Read current layout**

Already reviewed: it renders `UDashboardSidebar` and `<slot />` inside `UDashboardGroup`.

- [ ] **Step 2: Wrap slot with `UDashboardPanel`/`UDashboardNavbar` reading `pageMeta`**

Replace `<slot />` with:

```vue
<script setup lang="ts">
// ... existing imports and setup ...

const pageMeta = useState<PageMeta>('pageMeta')
const title = computed(() => pageMeta.value.title ?? '')
const icon = computed(() => pageMeta.value.icon ?? 'i-lucide-table')
</script>

<template>
  <UDashboardGroup unit="rem">
    <!-- sidebar unchanged -->
    <UDashboardSidebar ...>
      ...
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar :title="title" :icon="icon">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
```

Keep the existing sidebar, footer, and menu items exactly as-is.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter admin typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/layouts/default.vue
git commit -m "feat(admin): render dashboard panel/navbar from usePageMeta in layout"
```

---

## Task 3: Add data toolbar to `DataTableContainer.vue`

**Files:**
- Modify: `layers/data-table/components/DataTableContainer.vue`

- [ ] **Step 1: Add imports and new props**

Add to `<script setup>`:

```ts
import { deepClone, effectiveFilter } from '../utils/view-state'
import { useDataToolbar } from '../composables/useDataToolbar'
import DataToolbar from './DataToolbar.vue'

interface Props {
  resource: string
  table: string
  nsdb: string
  scope: 'admin' | 'tenant'
  schema: TableSchema
  view: ViewDefinition
  actions: ResolvedActions
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
}
```

- [ ] **Step 2: Add toolbar state and helpers**

After props:

```ts
const { runtime, dirty, save: buildSaveView } = useDataToolbar(toRef(props, 'view'), toRef(props, 'canUpdateView'))

const appliedFilter = ref<FilterGroup>({ op: 'and', conditions: [] })
const searchQuery = ref('')
const saveError = ref('')
const fetchReady = ref(false)

function buildAppliedFilter(): FilterGroup {
  const filter = effectiveFilter(runtime.value, props.view, props.canUpdateView)
  return filter ? deepClone(filter) : { op: 'and', conditions: [] }
}

function viewBasePath(): string {
  return props.scope === 'admin' ? `/api/admin/views/${props.nsdb}` : '/api/views'
}

function schemaEditLink(): string {
  return props.scope === 'admin'
    ? `/schema/${encodeURIComponent(props.table)}?nsdb=${encodeURIComponent(props.nsdb)}`
    : `/schema/${encodeURIComponent(props.table)}`
}

function permissionsEditLink(): string {
  return props.scope === 'admin'
    ? `/permissions/${encodeURIComponent(props.table)}?nsdb=${encodeURIComponent(props.nsdb)}`
    : `/permissions/${encodeURIComponent(props.table)}`
}
```

- [ ] **Step 3: Update `loadRecords` to use filter/search/runtime columns**

Replace `loadRecords` body:

```ts
async function loadRecords(force = false) {
  loading.value = true
  error.value = ''
  try {
    if (!schema.value) return
    const body = buildQueryBody(runtime.value, props.schema, 1, 25, { filter: appliedFilter.value, search: searchQuery.value })
    const result = await api.fetch<{ records: Record<string, unknown>[]; total: number }>(
      `${queryBasePath()}/${props.table}/query`,
      { method: 'POST', body: JSON.stringify(body) },
    )
    rows.value = result.records
    total.value = result.total
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load records'
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 4: Add view save handler**

```ts
async function handleSave() {
  saveError.value = ''
  const updated = buildSaveView()
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
```

- [ ] **Step 5: Replace `onMounted` load with watchers**

Remove `onMounted(() => loadRecords())`.
Add:

```ts
watch(
  () => [props.view, props.schema],
  () => {
    if (props.view && props.schema) {
      appliedFilter.value = buildAppliedFilter()
      loadRecords()
    }
  },
  { immediate: true },
)

let fetchTimeout: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(fetchTimeout))

watch(
  [appliedFilter, () => runtime.value.sort, () => runtime.value.columns, searchQuery],
  () => {
    clearTimeout(fetchTimeout)
    fetchTimeout = setTimeout(() => loadRecords(), 300)
  },
  { deep: true },
)
```

- [ ] **Step 6: Render `DataToolbar`**

Insert before the action toolbar:

```vue
<DataToolbar
  v-model:search="searchQuery"
  :runtime="runtime"
  :dirty="dirty"
  :view="view"
  :schema="schema"
  :can-update-view="canUpdateView"
  :can-edit-schema="canEditSchema"
  :can-manage-permissions="canManagePermissions"
  :schema-edit-link="schemaEditLink()"
  :permissions-edit-link="permissionsEditLink()"
  @save="handleSave"
  @apply-filter="appliedFilter = buildAppliedFilter()"
/>
<div v-if="saveError" class="text-sm text-red-600">{{ saveError }}</div>
```

Pass `runtime.columns` to `DataTableRenderer`:

```vue
<DataTableRenderer
  :view="view"
  :rows="rows"
  :schema="schema"
  :columns="runtime.columns"
  @row-double-click="handleRowDoubleClick"
>
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter admin typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add layers/data-table/components/DataTableContainer.vue
git commit -m "feat(data-table): add DataToolbar and view save to DataTableContainer"
```

---

## Task 4: Update `ViewRenderer.vue` to forward capability props

**Files:**
- Modify: `layers/data-table/components/ViewRenderer.vue`

- [ ] **Step 1: Add props and forward them**

Add to `interface Props`:

```ts
canUpdateView?: boolean
canEditSchema?: boolean
canManagePermissions?: boolean
```

Pass them to `DataTableContainer`:

```vue
<DataTableContainer
  ...
  :can-update-view="canUpdateView"
  :can-edit-schema="canEditSchema"
  :can-manage-permissions="canManagePermissions"
/>
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm --filter admin typecheck`
Expected: PASS

```bash
git add layers/data-table/components/ViewRenderer.vue
git commit -m "feat(data-table): forward capability props through ViewRenderer"
```

---

## Task 5: Create `PageRenderer.vue`

**Files:**
- Create: `apps/admin/app/components/PageRenderer.vue`

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import type { ViewDefinition } from 'shared'

interface PageConfig {
  resource: string
  view?: string | ViewDefinition
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
}

interface Props {
  config: PageConfig
}

const props = defineProps<Props>()
</script>

<template>
  <ViewRenderer
    :resource="props.config.resource"
    :view="props.config.view"
    :can-update-view="props.config.canUpdateView"
    :can-edit-schema="props.config.canEditSchema"
    :can-manage-permissions="props.config.canManagePermissions"
  />
</template>
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm --filter admin typecheck`
Expected: PASS

```bash
git add apps/admin/app/components/PageRenderer.vue
git commit -m "feat(admin): add PageRenderer component"
```

---

## Task 6: Create resource action config and components for `company`

**Files:**
- Create: `apps/admin/app/config/resource-actions/company.ts`
- Create: `apps/admin/app/components/actions/company/CreateCompanyButton.vue`
- Create: `apps/admin/app/components/actions/company/EditCompanyAction.vue`
- Create: `apps/admin/app/components/actions/company/DeleteCompanyAction.vue`

- [ ] **Step 1: Write placement config**

```ts
import type { ResourceActionPlacement } from 'shared'

export const resourceActionPlacements: Record<string, ResourceActionPlacement[]> = {
  create: [
    { type: ['table'], location: 'toolbar', component: 'CreateCompanyButton', method: null },
  ],
  edit_info: [
    { type: ['table'], location: 'item-contextMenu', component: 'EditCompanyAction', method: 'open' },
    { type: ['table'], location: 'item-rowDoubleClick', component: 'EditCompanyAction', method: 'open' },
  ],
  delete: [
    { type: ['table'], location: 'item-contextMenu', component: 'DeleteCompanyAction', method: 'open' },
  ],
}
```

- [ ] **Step 2: Write components**

`CreateCompanyButton.vue`:

```vue
<script setup lang="ts">
import type { ActionContext } from '../types'

const props = defineProps<{ context: ActionContext }>()
const { can } = useAdminPermission()
const allowed = ref(false)

onMounted(async () => {
  allowed.value = await can(props.context.resourceType as any, 'create')
})
</script>

<template>
  <UButton
    v-if="allowed"
    icon="i-lucide-plus"
    label="New company"
    size="sm"
    to="/companies/new"
  />
</template>
```

`EditCompanyAction.vue`:

```vue
<script setup lang="ts">
import type { ActionContext } from '../types'

const props = defineProps<{ context: ActionContext }>()
const { can } = useAdminPermission()
const allowed = ref(false)

onMounted(async () => {
  allowed.value = await can(props.context.resourceType as any, 'edit_info', props.context.record?.id as string | undefined)
})

function open(ctx?: ActionContext) {
  const context = ctx && 'record' in ctx ? ctx : props.context
  if (!context.record?.id) return
  navigateTo(`/companies/${context.record.id}`)
}

defineExpose({ open })
</script>

<template>
  <div
    v-if="allowed"
    class="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
    @click="open()"
  >
    <UIcon name="i-lucide-pencil" class="size-4" />
    <span>Edit</span>
  </div>
</template>
```

`DeleteCompanyAction.vue`:

```vue
<script setup lang="ts">
import type { ActionContext } from '../types'

const props = defineProps<{ context: ActionContext }>()
const emit = defineEmits(['success'])
const { can } = useAdminPermission()
const allowed = ref(false)
const loading = ref(false)

onMounted(async () => {
  allowed.value = await can(props.context.resourceType as any, 'delete', props.context.record?.id as string | undefined)
})

async function open() {
  if (!props.context.record?.id) return
  const confirmed = confirm('Are you sure you want to delete this company?')
  if (!confirmed) return

  loading.value = true
  try {
    const api = useApi()
    await api.fetch(`/api/admin/companies/${props.context.record.id}`, { method: 'DELETE' })
    emit('success')
  } catch (err: any) {
    alert(err?.message ?? 'Failed to delete company')
  } finally {
    loading.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <div
    v-if="allowed"
    class="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
    @click="open"
  >
    <UIcon name="i-lucide-trash" class="size-4" />
    <span>Delete</span>
  </div>
</template>
```

- [ ] **Step 3: Register in loader**

Modify `apps/admin/app/composables/useResourceActionPlacements.ts`:

```ts
const loaders: Record<string, () => Promise<{ resourceActionPlacements?: Record<string, ResourceActionPlacement[]> }>> = {
  admin_user_group: () => import('../config/resource-actions/admin_user_group'),
  company: () => import('../config/resource-actions/company'),
}
```

- [ ] **Step 4: Typecheck and commit**

Run: `pnpm --filter admin typecheck`
Expected: PASS

```bash
git add apps/admin/app/config/resource-actions/company.ts apps/admin/app/components/actions/company apps/admin/app/composables/useResourceActionPlacements.ts
git commit -m "feat(admin): add company resource actions"
```

---

## Task 7: Migrate `/companies/index.vue`

**Files:**
- Modify: `apps/admin/app/pages/companies/index.vue`

- [ ] **Step 1: Replace page content**

```vue
<script setup lang="ts">
usePageMeta({ title: 'Companies', icon: 'i-lucide-building-2' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('company', 'update_default_view_settings')
  canEditSchema.value = await can('company', 'edit_schema')
  canManagePermissions.value = await can('company', 'manage_permissions')
})

const config = computed(() => ({
  resource: 'company',
  canUpdateView: canUpdateView.value,
  canEditSchema: canEditSchema.value,
  canManagePermissions: canManagePermissions.value,
}))
</script>

<template>
  <PageRenderer :config="config" />
</template>
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/companies`.
Expected: table loads, toolbar search/filter/sort/columns work, New company button appears, row Edit/Delete work.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/pages/companies/index.vue
git commit -m "feat(admin): migrate companies page to PageRenderer"
```

---

## Task 8: Create resource action config and components for `admin_user`

**Files:**
- Create: `apps/admin/app/config/resource-actions/admin_user.ts`
- Create: `apps/admin/app/components/actions/admin_user/CreateUserButton.vue`
- Create: `apps/admin/app/components/actions/admin_user/EditUserAction.vue`
- Create: `apps/admin/app/components/actions/admin_user/DeleteUserAction.vue`

- [ ] **Step 1: Write placement config**

```ts
import type { ResourceActionPlacement } from 'shared'

export const resourceActionPlacements: Record<string, ResourceActionPlacement[]> = {
  create: [
    { type: ['table'], location: 'toolbar', component: 'CreateUserButton', method: null },
  ],
  edit: [
    { type: ['table'], location: 'item-contextMenu', component: 'EditUserAction', method: 'open' },
    { type: ['table'], location: 'item-rowDoubleClick', component: 'EditUserAction', method: 'open' },
  ],
  delete: [
    { type: ['table'], location: 'item-contextMenu', component: 'DeleteUserAction', method: 'open' },
  ],
}
```

- [ ] **Step 2: Write components**

Pattern is identical to `company` components but with:
- `CreateUserButton` label "Add user", `to="/users/new"`
- `EditUserAction` navigates to `/users/${id}`
- `DeleteUserAction` calls `DELETE /api/admin/users/${id}`
- Permission action for edit is `'edit'` (not `edit_info`)

- [ ] **Step 3: Register loader**

Add to `useResourceActionPlacements.ts`:

```ts
admin_user: () => import('../config/resource-actions/admin_user'),
```

- [ ] **Step 4: Typecheck and commit**

Run: `pnpm --filter admin typecheck`
Expected: PASS

```bash
git add apps/admin/app/config/resource-actions/admin_user.ts apps/admin/app/components/actions/admin_user apps/admin/app/composables/useResourceActionPlacements.ts
git commit -m "feat(admin): add admin_user resource actions"
```

---

## Task 9: Migrate `/users/index.vue`

**Files:**
- Modify: `apps/admin/app/pages/users/index.vue`

- [ ] **Step 1: Replace page content**

```vue
<script setup lang="ts">
usePageMeta({ title: 'Users', icon: 'i-lucide-users' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('admin_user', 'update_default_view_settings')
  canEditSchema.value = await can('admin_user', 'edit_schema')
  canManagePermissions.value = await can('admin_user', 'manage_permissions')
})

const config = computed(() => ({
  resource: 'admin_user',
  canUpdateView: canUpdateView.value,
  canEditSchema: canEditSchema.value,
  canManagePermissions: canManagePermissions.value,
}))
</script>

<template>
  <PageRenderer :config="config" />
</template>
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/users`.
Expected: table loads with toolbar and actions.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/pages/users/index.vue
git commit -m "feat(admin): migrate users page to PageRenderer"
```

---

## Task 10: Create resource action config and components for `workflow_design`

**Files:**
- Create: `apps/admin/app/config/resource-actions/workflow_design.ts`
- Create: `apps/admin/app/components/actions/workflow_design/CreateWorkflowDesignButton.vue`
- Create: `apps/admin/app/components/actions/workflow_design/EditWorkflowDesignAction.vue`
- Create: `apps/admin/app/components/actions/workflow_design/DeleteWorkflowDesignAction.vue`

- [ ] **Step 1: Write placement config**

```ts
import type { ResourceActionPlacement } from 'shared'

export const resourceActionPlacements: Record<string, ResourceActionPlacement[]> = {
  create: [
    { type: ['table'], location: 'toolbar', component: 'CreateWorkflowDesignButton', method: null },
  ],
  edit: [
    { type: ['table'], location: 'item-contextMenu', component: 'EditWorkflowDesignAction', method: 'open' },
    { type: ['table'], location: 'item-rowDoubleClick', component: 'EditWorkflowDesignAction', method: 'open' },
  ],
  delete: [
    { type: ['table'], location: 'item-contextMenu', component: 'DeleteWorkflowDesignAction', method: 'open' },
  ],
}
```

- [ ] **Step 2: Write components**

Pattern identical to `company` but with:
- `CreateWorkflowDesignButton` label "New workflow design", `to="/workflow-designs/new"`
- `EditWorkflowDesignAction` navigates to `/workflow-designs/${id}`
- `DeleteWorkflowDesignAction` calls `DELETE /api/admin/workflow-designs/${id}`
- Permission action for edit is `'edit'`

- [ ] **Step 3: Register loader**

Add to `useResourceActionPlacements.ts`:

```ts
workflow_design: () => import('../config/resource-actions/workflow_design'),
```

- [ ] **Step 4: Typecheck and commit**

Run: `pnpm --filter admin typecheck`
Expected: PASS

```bash
git add apps/admin/app/config/resource-actions/workflow_design.ts apps/admin/app/components/actions/workflow_design apps/admin/app/composables/useResourceActionPlacements.ts
git commit -m "feat(admin): add workflow_design resource actions"
```

---

## Task 11: Migrate `/workflow-designs/index.vue`

**Files:**
- Modify: `apps/admin/app/pages/workflow-designs/index.vue`

- [ ] **Step 1: Replace page content**

```vue
<script setup lang="ts">
usePageMeta({ title: 'Workflow Designs', icon: 'i-lucide-workflow' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('workflow_design', 'update_default_view_settings')
  canEditSchema.value = await can('workflow_design', 'edit_schema')
  canManagePermissions.value = await can('workflow_design', 'manage_permissions')
})

const config = computed(() => ({
  resource: 'workflow_design',
  canUpdateView: canUpdateView.value,
  canEditSchema: canEditSchema.value,
  canManagePermissions: canManagePermissions.value,
}))
</script>

<template>
  <PageRenderer :config="config" />
</template>
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/workflow-designs`.
Expected: table loads with toolbar and actions.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/pages/workflow-designs/index.vue
git commit -m "feat(admin): migrate workflow-designs page to PageRenderer"
```

---

## Task 12: Refactor remaining admin pages to use `usePageMeta`

**Files:**
- Modify all pages that currently contain `UDashboardPanel`/`UDashboardNavbar`:
  - `apps/admin/app/pages/dashboard/index.vue`
  - `apps/admin/app/pages/settings/index.vue`
  - `apps/admin/app/pages/health.vue`
  - `apps/admin/app/pages/views/index.vue`
  - `apps/admin/app/pages/views/[id].vue`
  - `apps/admin/app/pages/user-groups/new.vue`
  - `apps/admin/app/pages/user-groups/[id].vue`
  - `apps/admin/app/pages/users/new.vue`
  - `apps/admin/app/pages/users/[id].vue`
  - `apps/admin/app/pages/companies/[id].vue`
  - `apps/admin/app/pages/workflow-designs/new.vue`
  - `apps/admin/app/pages/workflow-designs/[id].vue`
  - `apps/admin/app/pages/permissions/[table].vue`
  - `apps/admin/app/pages/schema/[table].vue`

- [ ] **Step 1: Generic refactor pattern**

For each page:
1. Add `usePageMeta({ title: '...', icon: '...' })` at top of `<script setup>`. For dynamic titles use a computed, e.g.:

```ts
const table = useRoute().params.table as string
usePageMeta({ title: `Schema: ${table}`, icon: 'i-lucide-table-2' })
```

2. Remove the outer `<UDashboardPanel>` and `<UDashboardNavbar>` wrappers.
3. Keep the `#body` content (or just the inner content) as the page template.

Example transformation for `dashboard/index.vue`:

Before:
```vue
<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Dashboard" icon="i-lucide-layout-dashboard">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      ...content...
    </template>
  </UDashboardPanel>
</template>
```

After:
```vue
<script setup lang="ts">
usePageMeta({ title: 'Dashboard', icon: 'i-lucide-layout-dashboard' })
</script>

<template>
  ...content...
</template>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter admin typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/pages
git commit -m "refactor(admin): move dashboard chrome to layout via usePageMeta"
```

---

## Task 13: Delete legacy files

**Files:**
- Delete: `apps/admin/app/pages/tables/[table].vue`
- Delete: `layers/data-table/components/DataTable.vue`
- Delete: `layers/data-table/components/DataTablePage.vue`

- [ ] **Step 1: Delete files**

```bash
rm apps/admin/app/pages/tables/[table].vue
rm layers/data-table/components/DataTable.vue
rm layers/data-table/components/DataTablePage.vue
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm --filter admin typecheck`
Expected: PASS

```bash
git add -A
git commit -m "chore(admin): remove DataTable, DataTablePage and unused tables/[table] page"
```

---

## Task 14: Add tests

**Files:**
- Modify: `layers/data-table/utils/query-body.test.ts`

- [ ] **Step 1: Add tests for filter/search options in `buildQueryBody`**

```ts
import { describe, expect, it } from 'vitest'
import type { FilterGroup, TableSchema } from 'shared'
import { buildQueryBody } from './query-body.js'

const schema: TableSchema = {
  name: 'companies',
  columns: [
    { name: 'id', type: 'string', displayType: 'text', label: 'ID', nullable: false },
    { name: 'name', type: 'string', displayType: 'text', label: 'Name', nullable: false },
  ],
  relations: [],
}

const runtime = {
  columns: [{ column: 'id', visible: true }, { column: 'name', visible: true }],
  sort: [],
  group: [],
  filter: { op: 'and', conditions: [] } as FilterGroup,
}

describe('buildQueryBody options', () => {
  it('includes applied filter', () => {
    const filter: FilterGroup = { op: 'and', conditions: [{ field: 'name', operator: 'eq', value: 'Acme' }] }
    const body = buildQueryBody(runtime as any, schema, 1, 25, { filter })
    expect(body.filter).toEqual(filter)
  })

  it('includes search string', () => {
    const body = buildQueryBody(runtime as any, schema, 1, 25, { search: 'acme' })
    expect(body.search).toBe('acme')
  })

  it('omits empty filter and search', () => {
    const body = buildQueryBody(runtime as any, schema, 1, 25, { filter: { op: 'and', conditions: [] }, search: '' })
    expect(body.filter).toBeUndefined()
    expect(body.search).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run layers/data-table/utils/query-body.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add layers/data-table/utils/query-body.test.ts
git commit -m "test(data-table): cover filter/search query body options"
```

---

## Task 15: Update documentation

**Files:**
- Modify: `docs/40-Packages/data-table-layer.md`
- Modify: `docs/50-Features/Views.md`
- Modify: `docs/30-Apps/Admin App/Overview.md`

- [ ] **Step 1: Update `data-table-layer.md`**

- Remove `DataTable.vue` and `DataTablePage.vue` sections.
- Add `PageRenderer` is app-specific; mention `usePageMeta` layout integration.
- Update usage examples to show `PageRenderer` + `usePageMeta`.

- [ ] **Step 2: Update `Views.md`**

- Update UI section to list current components and remove legacy references.
- Add `usePageMeta` note if relevant.

- [ ] **Step 3: Update `Admin App Overview.md`**

- Replace DataTablePage mentions with `PageRenderer`.
- List migrated pages.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: update data-table and admin docs for PageRenderer migration"
```

---

## Final verification

- [ ] Run `pnpm --filter admin typecheck` — PASS
- [ ] Run `pnpm --filter shared typecheck` — PASS
- [ ] Run `pnpm vitest run layers/data-table/utils/view-actions.test.ts layers/data-table/utils/query-body.test.ts` — PASS
- [ ] Browser smoke test: `/companies`, `/users`, `/workflow-designs`, `/user-groups`, `/dashboard`, `/settings`, one detail page.

## Spec coverage self-check

- `usePageMeta` composable: Task 1
- Layout chrome centralization: Task 2
- Data toolbar in `DataTableContainer`: Task 3
- Capability prop forwarding: Task 4
- `PageRenderer` component: Task 5
- Resource action configs/components for `company`, `admin_user`, `workflow_design`: Tasks 6, 8, 10
- Page migrations: Tasks 7, 9, 11
- Other page refactor: Task 12
- Legacy deletion: Task 13
- Tests: Task 14
- Docs: Task 15

No placeholders; each task contains file paths and code/command examples.
