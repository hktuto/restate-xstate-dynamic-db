# Data Table Toolbar Actions Slot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render resource actions such as **Create** inside the `DataToolbar` row via a single Vue slot, without changing the action-component contract.

**Architecture:** Add a `<slot name="toolbar-actions" />` to `DataToolbar.vue` between Settings and Save view; move the existing `actions.toolbar` render loop from `DataTableContainer.vue` into that slot. Built-in toolbar controls keep their fixed order and existing permission gates.

**Tech Stack:** Vue 3, Nuxt 4, `@nuxt/ui`, TypeScript, Vitest.

---

## Files

| File | Responsibility |
|---|---|
| `layers/data-table/components/DataToolbar.vue` | Toolbar wrapper; receives slotted actions. |
| `layers/data-table/components/DataTableContainer.vue` | Loads records and passes resolved toolbar actions into `DataToolbar`. |

---

### Task 1: Add the `toolbar-actions` slot to `DataToolbar.vue`

**Files:**
- Modify: `layers/data-table/components/DataToolbar.vue`

- [ ] **Step 1: Read the current file**

```bash
cat layers/data-table/components/DataToolbar.vue
```

- [ ] **Step 2: Insert the slot between `DataToolbarSetting` and the Save button**

Replace this block in `layers/data-table/components/DataToolbar.vue`:

```vue
    <DataToolbarSetting
      :can-edit-schema="canEditSchema"
      :can-manage-permissions="canManagePermissions"
      :schema-edit-link="schemaEditLink"
      :permissions-edit-link="permissionsEditLink"
    />
    <UButton
```

With:

```vue
    <DataToolbarSetting
      :can-edit-schema="canEditSchema"
      :can-manage-permissions="canManagePermissions"
      :schema-edit-link="schemaEditLink"
      :permissions-edit-link="permissionsEditLink"
    />
    <slot name="toolbar-actions" />
    <UButton
```

- [ ] **Step 3: Verify the template is still valid**

Run:

```bash
pnpm --filter admin typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add layers/data-table/components/DataToolbar.vue
git commit -m "feat(data-table): add toolbar-actions slot to DataToolbar"
```

---

### Task 2: Move toolbar actions into the slot in `DataTableContainer.vue`

**Files:**
- Modify: `layers/data-table/components/DataTableContainer.vue`

- [ ] **Step 1: Read the current file**

```bash
cat layers/data-table/components/DataTableContainer.vue
```

- [ ] **Step 2: Wrap `DataToolbar` with the slot and remove the separate actions row**

Replace the existing `DataToolbar` usage:

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
```

With:

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
      <template #toolbar-actions>
        <component
          v-for="action in actions.toolbar"
          :key="action.component"
          :is="action.component"
          :context="buildActionContext(action.action)"
        />
      </template>
    </DataToolbar>
```

Then remove the separate actions block that currently sits below `DataToolbar`:

```vue
    <div v-if="actions.toolbar.length" class="flex items-center gap-2">
      <component
        v-for="action in actions.toolbar"
        :key="action.component"
        :is="action.component"
        :context="buildActionContext(action.action)"
      />
    </div>
```

- [ ] **Step 3: Confirm `buildActionContext` is still defined and used only in the slot**

The helper at lines 59-70 must remain:

```ts
function buildActionContext(action: string, record?: Record<string, unknown>): ActionContext {
  return {
    resourceType: props.resource,
    action,
    table: props.table,
    nsdb: props.nsdb,
    schema: props.schema,
    view: props.view,
    record,
    refresh: () => emit('refresh'),
  }
}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add layers/data-table/components/DataTableContainer.vue
git commit -m "feat(data-table): render toolbar actions inside DataToolbar slot"
```

---

### Task 3: Verify the change in the running admin app

**Files:** none

- [ ] **Step 1: Confirm the admin dev server is running**

The admin dev server should already be running at http://localhost:3001 from the previous session. If it is not, start it:

```bash
pnpm --filter admin dev
```

- [ ] **Step 2: Open a page that has a create action in the toolbar**

Navigate to http://localhost:3001/user-groups (or any admin page using `PageRenderer` with a resource that has a toolbar `create` placement).

- [ ] **Step 3: Inspect the toolbar visually**

Expected result: the **Create** button appears in the same row as Search / Filter / Group / Sort / Column / Settings / Save view, positioned between Settings and Save view.

- [ ] **Step 4: Confirm the separate actions row below the toolbar is gone**

There should no longer be a second row of buttons directly under the toolbar.

- [ ] **Step 5: Smoke-test the create action**

Click the **Create** button and confirm the create modal/form still opens and behaves as before.

---

### Task 4: Run the existing automated checks

**Files:** none

- [ ] **Step 1: Run data-table layer unit tests**

```bash
pnpm --filter data-table-layer exec vitest run
```

Expected: all tests pass (currently 30 tests across view-actions, view-state, query-body, and useDataToolbar).

- [ ] **Step 2: Run admin typecheck**

```bash
pnpm --filter admin typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run admin build**

```bash
pnpm --filter admin build
```

Expected: build completes successfully.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore(data-table): verify toolbar actions slot"
```

---

## Self-review

- **Spec coverage:** The spec’s “Target state” and “Design” sections map directly to Task 1 (slot) and Task 2 (move actions). Task 3 covers visual verification; Task 4 covers regression checks.
- **Placeholder scan:** No TBD/TODO. All code blocks are complete and use current file paths.
- **Type consistency:** Uses existing `actions.toolbar`, `ResolvedActionPlacement`, `ActionContext`, and `buildActionContext` exactly as defined today.
