# Data Table Schema and Permission Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the hardcoded "Edit schema" and "Manage permissions" toolbar links into the dynamic `ResourceActionPlacement` system.

**Architecture:** Two new globally-registered action components render navigation links and self-gate via the admin permission composable. The shared `data-table` layer drops the special Settings dropdown and its props. Admin resource configs gain `edit_schema` and `manage_permissions` toolbar placements, and admin index pages stop passing the removed permission booleans.

**Tech Stack:** Vue 3, Nuxt 3, Nuxt UI, TypeScript, Vitest

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/admin/app/components/actions/common/EditSchema.global.vue` | Renders "Edit schema" button when `edit_schema` is granted. |
| `apps/admin/app/components/actions/common/ManagePermissions.global.vue` | Renders "Manage permissions" button when `manage_permissions` is granted. |
| `layers/data-table/components/DataToolbar.vue` | Toolbar controls only; no Settings dropdown or schema/permission props. |
| `layers/data-table/components/DataTableContainer.vue` | Loads records and renders toolbar/table; no link builders. |
| `layers/data-table/components/ViewRenderer.vue` | Resource-driven entry point; no `canEditSchema`/`canManagePermissions` props. |
| `layers/data-table/components/DataToolbarSetting.vue` | Deleted. |
| `apps/admin/app/config/resource-actions/*.ts` | Add `edit_schema` and `manage_permissions` placements. |
| `apps/admin/app/pages/*/index.vue` | Stop computing/passing `canEditSchema`/`canManagePermissions`. |
| `layers/data-table/composables/useDataToolbar.test.ts` or nearby component tests | Verify toolbar no longer renders Settings. |
| `layers/data-table/utils/view-actions.test.ts` | Verify meta-action placements resolve. |

---

### Task 1: Create `EditSchema.global.vue`

**Files:**
- Create: `apps/admin/app/components/actions/common/EditSchema.global.vue`

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import type { ActionContext } from 'shared'

const props = defineProps<{ context: ActionContext }>()

const { can } = useAdminPermission()
const allowed = ref(false)

const to = computed(() => {
  const table = encodeURIComponent(props.context.table)
  const nsdb = encodeURIComponent(props.context.nsdb)
  return `/schema/${table}?nsdb=${nsdb}`
})

onMounted(async () => {
  allowed.value = await can(props.context.resourceType as any, 'edit_schema')
})
</script>

<template>
  <UButton
    v-if="allowed"
    icon="i-lucide-table-2"
    label="Edit schema"
    size="sm"
    color="neutral"
    :to="to"
  />
</template>
```

- [ ] **Step 2: Verify the file path**

Ensure the file is at `apps/admin/app/components/actions/common/EditSchema.global.vue` and registers as `EditSchema` because `nuxt.config.ts` uses `pathPrefix: false`.

---

### Task 2: Create `ManagePermissions.global.vue`

**Files:**
- Create: `apps/admin/app/components/actions/common/ManagePermissions.global.vue`

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import type { ActionContext } from 'shared'

const props = defineProps<{ context: ActionContext }>()

const { can } = useAdminPermission()
const allowed = ref(false)

const to = computed(() => {
  const table = encodeURIComponent(props.context.table)
  const nsdb = encodeURIComponent(props.context.nsdb)
  return `/permissions/${table}?nsdb=${nsdb}`
})

onMounted(async () => {
  allowed.value = await can(props.context.resourceType as any, 'manage_permissions')
})
</script>

<template>
  <UButton
    v-if="allowed"
    icon="i-lucide-shield"
    label="Manage permissions"
    size="sm"
    color="neutral"
    :to="to"
  />
</template>
```

- [ ] **Step 2: Verify the file path**

Ensure the file is at `apps/admin/app/components/actions/common/ManagePermissions.global.vue` and registers as `ManagePermissions`.

---

### Task 3: Remove Settings from `DataToolbar.vue`

**Files:**
- Modify: `layers/data-table/components/DataToolbar.vue`

- [ ] **Step 1: Remove settings props and imports**

Remove the `DataToolbarSetting` import and keep only:

```vue
<script setup lang="ts">
import type { RuntimeViewState } from '../utils/view-state'
import type { TableSchema, ViewDefinition } from 'shared'

interface Props {
  runtime: RuntimeViewState
  dirty: boolean
  view: ViewDefinition
  schema: TableSchema
  search?: string
  canUpdateView?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ save: []; 'apply-filter': []; 'update:search': [string] }>()
```

- [ ] **Step 2: Remove `<DataToolbarSetting />` from template**

Replace this block in the template:

```vue
    <DataToolbarSetting
      :can-edit-schema="canEditSchema"
      :can-manage-permissions="canManagePermissions"
      :schema-edit-link="schemaEditLink"
      :permissions-edit-link="permissionsEditLink"
    />
    <slot name="toolbar-actions" />
```

with:

```vue
    <slot name="toolbar-actions" />
```

- [ ] **Step 3: Run the data-table layer type check**

Run: `pnpm --filter data-table typecheck`
Expected: no errors related to removed props.

---

### Task 4: Remove settings wiring from `DataTableContainer.vue`

**Files:**
- Modify: `layers/data-table/components/DataTableContainer.vue`

- [ ] **Step 1: Remove settings props from interface**

```vue
<script setup lang="ts">
import type { FilterGroup, TableSchema, ViewDefinition } from 'shared'
import { buildQueryBody } from '../utils/query-body'
import { deepClone, effectiveFilter } from '../utils/view-state'
import { useDataToolbar } from '../composables/useDataToolbar'
import DataToolbar from './DataToolbar.vue'
import type { ResolvedActions } from '../utils/view-actions'
import type { ActionContext } from 'shared'

interface Props {
  resource: string
  table: string
  nsdb: string
  scope: 'admin' | 'tenant'
  schema: TableSchema
  view: ViewDefinition
  actions: ResolvedActions
  canUpdateView?: boolean
}
```

- [ ] **Step 2: Remove link builder functions**

Delete:

```ts
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

- [ ] **Step 3: Remove settings prop bindings from `<DataToolbar>`**

Replace:

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
    >
```

with:

```vue
    <DataToolbar
      v-model:search="searchQuery"
      :runtime="runtime"
      :dirty="dirty"
      :view="view"
      :schema="schema"
      :can-update-view="canUpdateView"
      @save="handleSave"
      @apply-filter="appliedFilter = buildAppliedFilter()"
    >
```

- [ ] **Step 4: Run the data-table layer type check**

Run: `pnpm --filter data-table typecheck`
Expected: no errors.

---

### Task 5: Remove settings props from `ViewRenderer.vue`

**Files:**
- Modify: `layers/data-table/components/ViewRenderer.vue`

- [ ] **Step 1: Remove props from interface**

```vue
<script setup lang="ts">
import type { ResourceActionPlacement, TableSchema, ViewActionBindings, ViewDefinition } from 'shared'
import { resolveViewActions } from '../utils/view-actions'

interface Props {
  resource: string
  view?: string | ViewDefinition
  canUpdateView?: boolean
}
```

- [ ] **Step 2: Remove prop bindings on `<DataTableContainer>`**

Replace:

```vue
    <DataTableContainer
      v-else-if="viewDefinition && schema && resourceTypeRecord"
      :resource="resource"
      :table="resourceTypeRecord.table"
      :nsdb="nsdb"
      :scope="isAdminScope() ? 'admin' : 'tenant'"
      :schema="schema"
      :view="viewDefinition"
      :actions="resolvedActions"
      :can-update-view="canUpdateView"
      :can-edit-schema="canEditSchema"
      :can-manage-permissions="canManagePermissions"
      @refresh="load"
    />
```

with:

```vue
    <DataTableContainer
      v-else-if="viewDefinition && schema && resourceTypeRecord"
      :resource="resource"
      :table="resourceTypeRecord.table"
      :nsdb="nsdb"
      :scope="isAdminScope() ? 'admin' : 'tenant'"
      :schema="schema"
      :view="viewDefinition"
      :actions="resolvedActions"
      :can-update-view="canUpdateView"
      @refresh="load"
    />
```

- [ ] **Step 3: Run the data-table layer type check**

Run: `pnpm --filter data-table typecheck`
Expected: no errors.

---

### Task 6: Delete `DataToolbarSetting.vue`

**Files:**
- Delete: `layers/data-table/components/DataToolbarSetting.vue`

- [ ] **Step 1: Delete the file**

Run: `rm layers/data-table/components/DataToolbarSetting.vue`

- [ ] **Step 2: Check for remaining references**

Run: `grep -R "DataToolbarSetting" layers/data-table/`
Expected: no matches.

---

### Task 7: Add meta-action placements to admin resource configs

**Files:**
- Modify: `apps/admin/app/config/resource-actions/admin_user.ts`
- Modify: `apps/admin/app/config/resource-actions/admin_user_group.ts`
- Modify: `apps/admin/app/config/resource-actions/company.ts`
- Modify: `apps/admin/app/config/resource-actions/workflow_design.ts`

- [ ] **Step 1: Update `admin_user.ts`**

Add to `resourceActionPlacements`:

```ts
  edit_schema: [
    { type: ['table'], location: 'toolbar', component: 'EditSchema', method: null },
  ],
  manage_permissions: [
    { type: ['table'], location: 'toolbar', component: 'ManagePermissions', method: null },
  ],
```

- [ ] **Step 2: Update `admin_user_group.ts`**

Add the same two entries.

- [ ] **Step 3: Update `company.ts`**

Add the same two entries.

- [ ] **Step 4: Update `workflow_design.ts`**

Add the same two entries.

- [ ] **Step 5: Verify all configs type check**

Run: `pnpm --filter admin typecheck`
Expected: no type errors.

---

### Task 8: Remove settings booleans from admin index pages

**Files:**
- Modify: `apps/admin/app/pages/users/index.vue`
- Modify: `apps/admin/app/pages/user-groups/index.vue`
- Modify: `apps/admin/app/pages/companies/index.vue`
- Modify: `apps/admin/app/pages/workflow-designs/index.vue`

- [ ] **Step 1: Update `users/index.vue`**

Replace the script and template with:

```vue
<script setup lang="ts">
usePageMeta({ title: 'Users', icon: 'i-lucide-users' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('admin_user', 'update_default_view_settings')
})
</script>

<template>
  <ViewRenderer
    resource="admin_user"
    :can-update-view="canUpdateView"
  />
</template>
```

- [ ] **Step 2: Update `user-groups/index.vue`**

Same pattern with `resource="admin_user_group"`.

- [ ] **Step 3: Update `companies/index.vue`**

Same pattern with `resource="company"`.

- [ ] **Step 4: Update `workflow-designs/index.vue`**

Same pattern with `resource="workflow_design"`.

- [ ] **Step 5: Run admin type check**

Run: `pnpm --filter admin typecheck`
Expected: no errors.

---

### Task 9: Verify no Settings remnants in the layer

**Files:**
- None (verification only)

- [ ] **Step 1: Search for Settings references**

Run: `grep -R "DataToolbarSetting\|canEditSchema\|canManagePermissions\|schemaEditLink\|permissionsEditLink" layers/data-table/`
Expected: no matches outside of this plan document.

- [ ] **Step 2: Run existing data-table unit tests**

Run: `pnpm --filter data-table test`
Expected: all existing tests pass.

---

### Task 10: Add unit test for meta-action resolution

**Files:**
- Modify: `layers/data-table/utils/view-actions.test.ts`

- [ ] **Step 1: Add placements and a test case**

```ts
const placements: Record<string, ResourceActionPlacement[]> = {
  // ... existing placements
  edit_schema: [
    { type: ['table'], location: 'toolbar', component: 'EditSchema', method: null },
  ],
  manage_permissions: [
    { type: ['table'], location: 'toolbar', component: 'ManagePermissions', method: null },
  ],
}
```

Add a test:

```ts
it('resolves meta-actions into toolbar', () => {
  const bindings: ViewActionBindings = { toolbar: ['edit_schema', 'manage_permissions'] }
  const result = resolveViewActions('table', bindings, placements)

  expect(result.toolbar).toEqual([
    { action: 'edit_schema', component: 'EditSchema', method: null },
    { action: 'manage_permissions', component: 'ManagePermissions', method: null },
  ])
})
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter data-table test`
Expected: all tests pass.

---

### Task 11: Verify end-to-end in the admin app

**Files:**
- None (manual verification)

- [ ] **Step 1: Start the API and admin dev server**

Run:
```bash
docker compose up -d
pnpm --filter api dev
pnpm --filter admin dev
```

- [ ] **Step 2: Open the Users page**

Navigate to `http://localhost:3001/users`.

- [ ] **Step 3: Confirm toolbar shows "Edit schema" and "Manage permissions" as buttons**

Expected: two neutral buttons appear in the toolbar when the logged-in admin has `edit_schema` and `manage_permissions` grants for `admin_user`.

- [ ] **Step 4: Confirm buttons navigate correctly**

Click "Edit schema". Expected URL: `/schema/platform_users?nsdb=platform--admin`.
Click "Manage permissions". Expected URL: `/permissions/platform_users?nsdb=platform--admin`.

- [ ] **Step 5: Check a page where placements are omitted**

If any resource config omits the placements, those buttons should not appear.

---

## Self-review

**Spec coverage:**
- Layer changes: covered in Tasks 3–6.
- New action components: covered in Tasks 1–2.
- Resource configs: covered in Task 7.
- Admin pages: covered in Task 8.
- Unit testing: covered in Task 10.
- Verification: covered in Tasks 9 and 11.

**Placeholder scan:**
- No TBD/TODO.
- All code blocks contain concrete code.
- All commands include expected outputs.

**Type consistency:**
- `ActionContext` prop name matches existing action components.
- `edit_schema` and `manage_permissions` action names match the resource catalog.
- Component names `EditSchema` and `ManagePermissions` match placement configs.
