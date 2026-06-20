---
title: Admin Sidebar Layout Refinement Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-20
updated: 2026-06-20
---

# Admin Sidebar Layout Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-profile popover menu to the sidebar footer and a collapse toggle to the sidebar header in `apps/admin`.

**Architecture:** Modify only `apps/admin/app/layouts/default.vue`. Use the built-in `UDashboardSidebarCollapse` for the header toggle, and a `UPopover` with a `UButton` avatar trigger for the footer menu. Use the `collapsed` slot prop to adapt the footer trigger label.

**Tech Stack:** Nuxt 4, @nuxt/ui 4.x, Vue 3, TypeScript

---

### Task 1: Update sidebar header with collapse toggle

**Files:**
- Modify: `apps/admin/app/layouts/default.vue:27-31`

- [ ] **Step 1.1: Accept `collapsed` slot prop and add toggle**

Replace the `#header` block so it receives `{ collapsed }`, keeps the SuperAdmin brand on the left, and places `<UDashboardSidebarCollapse variant="subtle" />` on the right.

```vue
<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsible>
      <template #header="{ collapsed }">
        <div class="flex items-center justify-between w-full">
          <NuxtLink to="/dashboard" class="font-semibold text-lg">
            SuperAdmin
          </NuxtLink>

          <UDashboardSidebarCollapse variant="subtle" />
        </div>
      </template>
```

- [ ] **Step 1.2: Verify the change renders**

Run the admin dev server if it is not already running:

```bash
pnpm --filter admin dev
```

Open `http://localhost:3001/dashboard` and confirm:
- The SuperAdmin brand is still visible.
- A collapse/expand icon appears to the right of the brand.
- Clicking the icon collapses/expands the sidebar.

---

### Task 2: Replace footer logout button with profile popover

**Files:**
- Modify: `apps/admin/app/layouts/default.vue:35-45`

- [ ] **Step 2.1: Replace footer content with popover menu**

Replace the `#footer` block with a `UPopover` trigger and menu. The trigger shows an avatar plus name (and chevron) when expanded, and only the avatar when collapsed.

```vue
      <template #footer="{ collapsed }">
        <UPopover>
          <UButton
            color="neutral"
            variant="ghost"
            :block="!collapsed"
            :square="collapsed"
            :avatar="{
              src: 'https://api.dicebear.com/9.x/initials/svg?seed=Admin',
              alt: 'Admin User',
            }"
            :label="collapsed ? undefined : 'Admin User'"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevron-up'"
          />

          <template #content>
            <div class="flex flex-col gap-1 p-2 w-48">
              <UButton
                to="/settings"
                variant="ghost"
                color="neutral"
                icon="i-lucide-user"
                class="justify-start"
              >
                Profile
              </UButton>

              <UButton
                to="/settings"
                variant="ghost"
                color="neutral"
                icon="i-lucide-settings"
                class="justify-start"
              >
                Settings
              </UButton>

              <USeparator />

              <UButton
                variant="ghost"
                color="neutral"
                icon="i-lucide-log-out"
                class="justify-start"
                @click="logout"
              >
                Logout
              </UButton>
            </div>
          </template>
        </UPopover>
      </template>
```

- [ ] **Step 2.2: Verify the popover behavior**

With the dev server running at `http://localhost:3001/dashboard`:
- Confirm the footer shows an avatar + “Admin User” + chevron when expanded.
- Click the trigger; confirm the popover opens with Profile, Settings, and Logout items.
- Click Logout and confirm the app redirects to `/login`.
- Collapse the sidebar and confirm only the avatar remains in the footer; clicking it still opens the popover.

---

### Task 3: Final review and commit

- [ ] **Step 3.1: Run the admin type check**

```bash
pnpm --filter admin typecheck
```

Expected: no TypeScript errors in `apps/admin/app/layouts/default.vue`.

- [ ] **Step 3.2: Commit the change**

```bash
git add apps/admin/app/layouts/default.vue
git commit -m "feat(admin): add profile popover and sidebar collapse toggle"
```

---

## Plan Self-Review

- **Spec coverage:** Header toggle (Task 1), profile popover with Profile/Settings/Logout (Task 2), collapsed-state adaptation (Task 2), verification (all tasks).
- **No placeholders:** All code, commands, and expected outputs are concrete.
- **Type consistency:** Uses existing `logout()` function and `useApi()`/`useRouter()` already present in the file. No new imports are required because Nuxt UI components are auto-imported.
- **Scope check:** Only one file is modified, matching the approved design.
