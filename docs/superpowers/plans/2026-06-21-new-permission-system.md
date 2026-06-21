---
title: New Permission System Implementation Plan
type: note
status: in-progress
area: architecture
created: 2026-06-21
updated: 2026-06-21
---

# New Permission System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard-coded `RESOURCE_ACTIONS` model with a resource-defined `bitMapping` permission system, implemented directly in `packages/db` and `apps/api`. Seed platform admin permissions, protect the admin site, and retire `packages/permission-poc`.

**Architecture:** A shared `resource-catalog.ts` becomes the single source of truth for every resource type, its compound bit-mapping, default groups, and parent relationship. Each namespace stores a `resource_types` table that mirrors the catalog and acts as the graph target for `permission_apply_to` edges. `packages/db/src/permission-resolver.ts` ports the POC's optimized Surreal traversal, using compound-bit checks `(effectiveMask & actionValue) === actionValue`. Tenant and admin API middleware consume the resolver; UI uses an effective-permissions endpoint to hide actions.

**Tech Stack:** TypeScript, SurrealDB, Hono, Nuxt 3, Vitest, pnpm monorepo.

---

## Design decisions (resolved from the draft)

1. **Record-scoped special bits:** Standalone bits `128`, `256`, and `512` live **only on type-level resources**. Record-scoped detail resources carry only the basic actions they need. This corrects the tenant `user_group_detail` entry in the draft (special bits removed; owner default becomes `63`).
2. **Default group names:** Use lowercase `owner`, `admin`, and `user` for type-level resources. Record-scoped detail resources get a single `owner` default group.
3. **Create implies edit:** Keep the per-resource mapping from the cleaned-up catalog:
   - `create = 7` when a generic `edit` action exists (`admin_user`, `admin_user_detail`, `member`, platform/tenant `workflow_design`, `workflow_design_detail`).
   - `create = 5` when only `edit_info` exists (`admin_user_group`, `company`, `company_member`, `user_group`, `user_group_detail`, tenant `workflow_design`).
4. **Tenant root resource:** The existing tenant `company` resource is replaced by the catalog's `tenant` resource. Member management moves to the `member` resource.

---

## File structure

- `packages/shared/src/resource-catalog.ts` — canonical resource catalog and bitmask helpers.
- `packages/shared/src/permissions.ts` — thin compatibility wrapper that re-exports catalog helpers under the old names.
- `packages/shared/src/permissions.test.ts` — unit tests for compound action values.
- `packages/shared/src/index.ts` — export the catalog.
- `packages/db/src/resource-types.ts` — DB helpers to upsert/seed `resource_types` and build `resource_parent` edges.
- `packages/db/src/permission-resolver.ts` — graph resolver ported from `permission-poc` (effective permissions, batch checks, explanations, member listing).
- `packages/db/src/permissions.ts` — permission group CRUD, assignment, and default group provisioning (rewritten for edge-based bitmasks).
- `packages/db/src/user-groups.ts` — update `createUserGroupWithDefaults` to use `user_group_detail`.
- `packages/db/src/schema-definitions.ts` — add `resource_types`, remove `bitmask` from `permission_groups`.
- `packages/db/src/provision.ts` — define `resource_types`, `resource_parent`, and `permission_apply_to` graph edges; seed tenant catalog.
- `packages/db/src/seed.ts` — define platform graph edges and seed platform resource types, default groups, and assign `platform_users:admin` to `platform:owner`.
- `packages/db/src/index.ts` — export `resource-types` and `permission-resolver`.
- `packages/db/test/helpers.ts` — ensure platform test setup defines `resource_types` and edges.
- `packages/db/test/permissions.test.ts` — rewrite tests for the new resolver and `tenant` resource.
- `packages/db/test/user-groups.test.ts` — rewrite tests for `user_group_detail`.
- `apps/api/src/types.ts` — add `permissions` cache to `AdminScope`.
- `apps/api/src/middleware/permission.ts` — use compound `hasAction` and the new resolver.
- `apps/api/src/middleware/admin-permission.ts` — platform permission middleware for admin routes.
- `apps/api/src/middleware/admin.ts` — resolve admin effective permissions into `AdminScope`.
- `apps/api/src/routes/permissions.ts` — return `bitMapping` from the catalog; add effective-permission endpoint.
- `apps/api/src/routes/user-groups.ts` — switch to `user_group` / `user_group_detail` actions.
- `apps/api/src/routes/users.ts` — switch from `company` to `member` actions.
- `apps/api/src/routes/workflow-designs.ts` — replace role checks with `workflow_design` / `workflow_design_detail` permission checks.
- `apps/api/src/routes/admin.ts` — guard platform admin routes.
- `apps/api/src/routes/admin-workflow-designs.ts` — guard with platform `workflow_design` permissions.
- `apps/api/src/middleware/permission.test.ts` — update middleware tests for compound values.
- `apps/api/src/routes/permissions.test.ts` — update action endpoint tests.
- `apps/api/tests/e2e/fixtures.ts` — query new default group names and resource types.
- `apps/admin/app/composables/useAdminPermission.ts` — fetch and cache effective admin permissions.
- `apps/admin/app/pages/users/index.vue` — hide add/delete actions when not permitted.
- `apps/admin/app/pages/user-groups/index.vue` — hide add/delete actions when not permitted.
- `apps/admin/app/pages/workflow-designs/index.vue` — hide "New workflow design" when not permitted.
- `docs/40-Packages/db.md` — document resolver and `resource_types`.
- `docs/40-Packages/shared.md` — document resource catalog.
- `docs/20-Architecture/Decision Log/ADR-005 compound-bitmask-permissions.md` — ADR for the new model.
- `docs/40-Packages/permission-poc.md` — replace with migration/retirement note.

---

## Phase 1 — Shared resource catalog

### Task 1.1: Create `packages/shared/src/resource-catalog.ts`

**Files:**
- Create: `packages/shared/src/resource-catalog.ts`

- [ ] **Step 1: Write the catalog file**

```ts
export interface BitMappingEntry {
  bit: number
  name: string
  description?: string
}

export interface DefaultGroup {
  name: string
  bitmask: number
  propagateMask: number
}

export interface ResourceTypeDefinition {
  name: string
  table: string | 'none'
  hasRecordId: boolean
  bitMapping: BitMappingEntry[]
  defaultGroups: DefaultGroup[]
  parentResourceType?: string
  isSystem: boolean
  scope: 'platform' | 'tenant'
}

const fullMask = (...values: number[]) => values.reduce((m, v) => m | v, 0)

const specialBits = {
  updateDefaultViewSettings: 128,
  editSchema: 256,
  managePermissions: 512,
} as const

const compound = {
  view: 1,
  edit: 3,       // view + bit 2
  editInfo: 3,   // alias for the same value
  createImpliesEdit: 7,
  create: 5,
  delete: 9,
  addMember: 19,
  removeMember: 35,
  manageGroups: 17,
  impersonate: 33,
  publish: 19,
}

export const PLATFORM_RESOURCE_TYPES: ResourceTypeDefinition[] = [
  {
    name: 'platform',
    table: 'none',
    hasRecordId: false,
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 897, propagateMask: 897 },
      { name: 'admin', bitmask: 897, propagateMask: 897 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'admin_user',
    table: 'platform_users',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.manageGroups, name: 'manage_groups' },
      { bit: compound.impersonate, name: 'impersonate' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 959, propagateMask: 959 },
      { name: 'admin', bitmask: 959, propagateMask: 959 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'admin_user_detail',
    table: 'platform_users',
    hasRecordId: true,
    parentResourceType: 'admin_user',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.manageGroups, name: 'manage_groups' },
      { bit: compound.impersonate, name: 'impersonate' },
    ],
    defaultGroups: [{ name: 'owner', bitmask: 63, propagateMask: 63 }],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'admin_user_group',
    table: 'admin_user_groups',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'add_member' },
      { bit: compound.removeMember, name: 'remove_member' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 959, propagateMask: 959 },
      { name: 'admin', bitmask: 959, propagateMask: 959 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'admin_user_group_detail',
    table: 'admin_user_groups',
    hasRecordId: true,
    parentResourceType: 'admin_user_group',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'add_member' },
      { bit: compound.removeMember, name: 'remove_member' },
    ],
    defaultGroups: [{ name: 'owner', bitmask: 63, propagateMask: 63 }],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'company',
    table: 'companies',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'add_member' },
      { bit: compound.removeMember, name: 'remove_member' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 959, propagateMask: 959 },
      { name: 'admin', bitmask: 959, propagateMask: 959 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'company_member',
    table: 'user_profiles',
    hasRecordId: false,
    parentResourceType: 'company',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'assign_company' },
      { bit: compound.removeMember, name: 'remove_company' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 959, propagateMask: 959 },
      { name: 'admin', bitmask: 959, propagateMask: 959 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'workflow_design',
    table: 'workflow_designs',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.publish, name: 'publish' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 927, propagateMask: 927 },
      { name: 'admin', bitmask: 927, propagateMask: 927 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'workflow_design_detail',
    table: 'workflow_designs',
    hasRecordId: true,
    parentResourceType: 'workflow_design',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.publish, name: 'publish' },
    ],
    defaultGroups: [{ name: 'owner', bitmask: 31, propagateMask: 31 }],
    isSystem: true,
    scope: 'platform',
  },
]

export const TENANT_RESOURCE_TYPES: ResourceTypeDefinition[] = [
  {
    name: 'tenant',
    table: 'none',
    hasRecordId: false,
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 911, propagateMask: 911 },
      { name: 'admin', bitmask: 911, propagateMask: 911 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'tenant',
  },
  {
    name: 'member',
    table: 'members',
    hasRecordId: false,
    parentResourceType: 'tenant',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 911, propagateMask: 911 },
      { name: 'admin', bitmask: 911, propagateMask: 911 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'tenant',
  },
  {
    name: 'user_group',
    table: 'user_groups',
    hasRecordId: false,
    parentResourceType: 'tenant',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'add_member' },
      { bit: compound.removeMember, name: 'remove_member' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 959, propagateMask: 959 },
      { name: 'admin', bitmask: 959, propagateMask: 959 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'tenant',
  },
  {
    name: 'user_group_detail',
    table: 'user_groups',
    hasRecordId: true,
    parentResourceType: 'user_group',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'add_member' },
      { bit: compound.removeMember, name: 'remove_member' },
    ],
    defaultGroups: [{ name: 'owner', bitmask: 63, propagateMask: 63 }],
    isSystem: true,
    scope: 'tenant',
  },
  {
    name: 'workflow_design',
    table: 'workflow_designs',
    hasRecordId: false,
    parentResourceType: 'tenant',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 911, propagateMask: 911 },
      { name: 'admin', bitmask: 911, propagateMask: 911 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'tenant',
  },
  {
    name: 'workflow_design_detail',
    table: 'workflow_designs',
    hasRecordId: true,
    parentResourceType: 'workflow_design',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
    ],
    defaultGroups: [{ name: 'owner', bitmask: 15, propagateMask: 15 }],
    isSystem: true,
    scope: 'tenant',
  },
]

export const RESOURCE_CATALOG: Record<string, ResourceTypeDefinition> = Object.fromEntries(
  [...PLATFORM_RESOURCE_TYPES, ...TENANT_RESOURCE_TYPES].map((r) => [r.name, r])
)

export type ResourceType = keyof typeof RESOURCE_CATALOG
export type PermissionAction<T extends ResourceType = ResourceType> =
  Extract<(typeof RESOURCE_CATALOG)[T]['bitMapping'][number]['name'], string>

export function resourceType(name: ResourceType): ResourceTypeDefinition {
  const def = RESOURCE_CATALOG[name]
  if (!def) throw new Error(`Unknown resource type: ${String(name)}`)
  return def
}

export function actionValue(name: ResourceType, action: string): number {
  const def = resourceType(name)
  const entry = def.bitMapping.find((b) => b.name === action)
  if (!entry) throw new Error(`Unknown action ${action} for ${String(name)}`)
  return entry.bit
}

export function actionsToBitmask(name: ResourceType, actions: string[]): string {
  const mask = actions.reduce((m, action) => m | actionValue(name, action), 0)
  return mask.toString()
}

export function bitmaskToActions(name: ResourceType, bitmask: string | number): string[] {
  const mask = typeof bitmask === 'string' ? Number(bitmask) : bitmask
  const def = resourceType(name)
  return def.bitMapping.filter((b) => (mask & b.bit) === b.bit).map((b) => b.name)
}

export function hasAction(bitmask: string | number, name: ResourceType, action: string): boolean {
  const mask = typeof bitmask === 'string' ? Number(bitmask) : bitmask
  const required = actionValue(name, action)
  return (mask & required) === required
}

export function allActionsBitmask(name: ResourceType): string {
  const def = resourceType(name)
  return def.bitMapping.reduce((m, b) => m | b.bit, 0).toString()
}

export function defaultGroups(name: ResourceType): DefaultGroup[] {
  return resourceType(name).defaultGroups
}
```

- [ ] **Step 2: Update `packages/shared/src/index.ts`**

Add to the end:

```ts
export * from './resource-catalog.js'
```

- [ ] **Step 3: Rewrite `packages/shared/src/permissions.ts` as a re-export wrapper**

```ts
export {
  RESOURCE_CATALOG,
  resourceType,
  actionValue,
  actionsToBitmask,
  bitmaskToActions,
  hasAction,
  allActionsBitmask,
  defaultGroups,
  type ResourceType,
  type PermissionAction,
  type ResourceTypeDefinition,
  type BitMappingEntry,
  type DefaultGroup,
} from './resource-catalog.js'
```

- [ ] **Step 4: Update `packages/shared/src/permissions.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  actionValue,
  actionsToBitmask,
  bitmaskToActions,
  hasAction,
  allActionsBitmask,
  defaultGroups,
} from './permissions.js'

describe('permissions', () => {
  it('returns compound action values from the catalog', () => {
    expect(actionValue('member', 'edit')).toBe(3)
    expect(actionValue('company', 'add_member')).toBe(19)
  })

  it('builds and decodes a bitmask using compound values', () => {
    const mask = actionsToBitmask('user_group', ['view', 'edit_info', 'add_member'])
    expect(mask).toBe('19')
    expect(bitmaskToActions('user_group', mask)).toEqual(['view', 'edit_info', 'add_member'])
  })

  it('checks a single action with compound masks', () => {
    const mask = actionsToBitmask('company', ['view', 'add_member'])
    expect(hasAction(mask, 'company', 'view')).toBe(true)
    expect(hasAction(mask, 'company', 'remove_member')).toBe(false)
    expect(hasAction(mask, 'company', 'edit_info')).toBe(true)
  })

  it('returns all actions for a resource type', () => {
    const mask = allActionsBitmask('member')
    expect(hasAction(mask, 'member', 'manage_permissions')).toBe(true)
  })

  it('has default groups', () => {
    expect(defaultGroups('company').map((g) => g.name)).toContain('owner')
    expect(defaultGroups('user_group').map((g) => g.name)).toContain('admin')
  })
})
```

- [ ] **Step 5: Run the shared tests**

Run: `pnpm --filter shared test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/resource-catalog.ts packages/shared/src/permissions.ts packages/shared/src/permissions.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add resource catalog with compound bit mappings"
```

---

## Phase 2 — `resource_types` table and seeding

### Task 2.1: Create `packages/db/src/resource-types.ts`

**Files:**
- Create: `packages/db/src/resource-types.ts`

- [ ] **Step 1: Write the file**

```ts
import { StringRecordId } from 'surrealdb'
import { RESOURCE_CATALOG, type ResourceTypeDefinition } from 'shared'
import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'

export interface ResourceTypeRecord extends ResourceTypeDefinition {
  id: string
}

export function resourceTypeRecordId(name: string): string {
  return `resource_types:⟨${name}⟩`
}

export async function upsertResourceType(
  namespace: string,
  database: string,
  def: ResourceTypeDefinition
): Promise<ResourceTypeRecord> {
  const surreal = await getSurreal(namespace, database)
  try {
    const now = new Date().toISOString()
    const id = resourceTypeRecordId(def.name)
    const [rows] = await surreal.query<[ResourceTypeRecord[]]>(
      `UPSERT ${id} SET
        name = $name,
        table = $table,
        hasRecordId = $hasRecordId,
        bitMapping = $bitMapping,
        defaultGroups = $defaultGroups,
        parentResourceType = $parentResourceType,
        isSystem = $isSystem,
        scope = $scope,
        updatedAt = $now,
        createdAt = IF missing THEN $now ELSE createdAt END
      RETURN *`,
      { ...def, now }
    )
    return normalizeId(rows[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function seedResourceTypes(
  namespace: string,
  database: string,
  scope: 'platform' | 'tenant'
): Promise<void> {
  const defs = Object.values(RESOURCE_CATALOG).filter((r) => r.scope === scope)
  for (const def of defs) {
    await upsertResourceType(namespace, database, def)
  }
  for (const def of defs) {
    if (def.parentResourceType) {
      await createResourceParentEdge(namespace, database, def.name, def.parentResourceType)
    }
  }
}

export async function createResourceParentEdge(
  namespace: string,
  database: string,
  childName: string,
  parentName: string
): Promise<void> {
  const surreal = await getSurreal(namespace, database)
  try {
    await surreal.query(
      'RELATE $child->resource_parent->$parent',
      {
        child: new StringRecordId(resourceTypeRecordId(childName)),
        parent: new StringRecordId(resourceTypeRecordId(parentName)),
      }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listResourceTypes(
  namespace: string,
  database: string
): Promise<ResourceTypeRecord[]> {
  const surreal = await getSurreal(namespace, database)
  try {
    const [rows] = await surreal.query<[ResourceTypeRecord[]]>('SELECT * FROM resource_types ORDER BY name')
    return normalizeIds(rows)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getResourceType(
  namespace: string,
  database: string,
  name: string
): Promise<ResourceTypeRecord | undefined> {
  const surreal = await getSurreal(namespace, database)
  try {
    const [rows] = await surreal.query<[ResourceTypeRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id: resourceTypeRecordId(name) }
    )
    return normalizeId(rows[0])
  } finally {
    await closeSurreal(surreal)
  }
}
```

### Task 2.2: Add `resource_types` to `packages/db/src/schema-definitions.ts`

**Files:**
- Modify: `packages/db/src/schema-definitions.ts`

- [ ] **Step 1: Add the `resource_types` table to platform schemas**

After the `admin_user_groups` table in `PLATFORM_TABLE_SCHEMAS`, add:

```ts
  table('resource_types', 'Resource Types', [
    column('name', 'string', 'text'),
    column('table', 'string', 'text'),
    column('hasRecordId', 'boolean', 'checkbox'),
    column('bitMapping', 'array', 'json'),
    column('defaultGroups', 'array', 'json'),
    column('parentResourceType', 'string', 'text', { optional: true }),
    column('isSystem', 'boolean', 'checkbox'),
    column('scope', 'string', 'text'),
  ]),
```

- [ ] **Step 2: Add the `resource_types` table to tenant schemas**

After the `permission_groups` table in `TENANT_TABLE_SCHEMAS`, add:

```ts
  table('resource_types', 'Resource Types', [
    column('name', 'string', 'text'),
    column('table', 'string', 'text'),
    column('hasRecordId', 'boolean', 'checkbox'),
    column('bitMapping', 'array', 'json'),
    column('defaultGroups', 'array', 'json'),
    column('parentResourceType', 'string', 'text', { optional: true }),
    column('isSystem', 'boolean', 'checkbox'),
    column('scope', 'string', 'text'),
  ]),
```

- [ ] **Step 3: Remove the `bitmask` column from the tenant `permission_groups` table**

Change the tenant `permission_groups` entry to:

```ts
  table('permission_groups', 'Permission Groups', [
    column('resourceType', 'string', 'text'),
    column('recordId', 'string', 'text', { optional: true }),
    column('name', 'string', 'text'),
    column('isSystem', 'boolean', 'checkbox'),
    column('description', 'string', 'text', { optional: true }),
  ]),
```

### Task 2.3: Update `packages/db/src/provision.ts`

**Files:**
- Modify: `packages/db/src/provision.ts`

- [ ] **Step 1: Add graph-edge definitions for tenant namespaces**

After the `permission_assignments` block, add:

```ts
      DEFINE TABLE IF NOT EXISTS resource_types SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_resource_types_name ON resource_types FIELDS name UNIQUE;

      DEFINE TABLE IF NOT EXISTS resource_parent TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_resource_parent_in ON resource_parent FIELDS in;
      DEFINE INDEX IF NOT EXISTS idx_resource_parent_out ON resource_parent FIELDS out;

      DEFINE TABLE IF NOT EXISTS permission_apply_to TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_permission_apply_to_out_in ON permission_apply_to FIELDS out, in;
      DEFINE INDEX IF NOT EXISTS idx_permission_apply_to_recordId ON permission_apply_to FIELDS recordId;
```

- [ ] **Step 2: Import and call the tenant catalog seeder**

At the top of the file, add:

```ts
import { seedResourceTypes } from './resource-types.js'
```

At the end of `provisionCompanyNamespace`, before `return { ok: true, namespace }`, add:

```ts
    await seedResourceTypes(namespace, 'main', 'tenant')
```

### Task 2.4: Update `packages/db/src/seed.ts`

**Files:**
- Modify: `packages/db/src/seed.ts`

- [ ] **Step 1: Add platform graph-edge definitions**

After the existing index definitions and before the `UPSERT` statements, add:

```ts
      DEFINE TABLE IF NOT EXISTS resource_types SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_resource_types_name ON resource_types FIELDS name UNIQUE;

      DEFINE TABLE IF NOT EXISTS resource_parent TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_resource_parent_in ON resource_parent FIELDS in;
      DEFINE INDEX IF NOT EXISTS idx_resource_parent_out ON resource_parent FIELDS out;

      DEFINE TABLE IF NOT EXISTS permission_apply_to TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_permission_apply_to_out_in ON permission_apply_to FIELDS out, in;
      DEFINE INDEX IF NOT EXISTS idx_permission_apply_to_recordId ON permission_apply_to FIELDS recordId;
```

- [ ] **Step 2: Import the platform seeder**

At the top of the file, add:

```ts
import { seedResourceTypes } from './resource-types.js'
import { createPermissionGroup, assignPermissionGroup, applyPermissionToResource } from './permissions.js'
import { defaultGroups, actionValue } from 'shared'
```

- [ ] **Step 3: Seed platform resource types and default groups**

Replace the existing platform user/group seed block:

```ts
      UPSERT platform_users:admin SET email = 'admin@example.com', password = $password;
```

with:

```ts
      UPSERT platform_users:admin SET email = 'admin@example.com', password = $password;
      UPSERT admin_user_groups:superadmin SET name = 'Super Admin', description = 'Full platform access';
      DELETE admin_user_group_memberships WHERE in = type::record('platform_users:admin') AND out = type::record('admin_user_groups:superadmin');
      RELATE platform_users:admin->admin_user_group_memberships->admin_user_groups:superadmin;
```

Then, after the schema-registry loop that populates `_tables`, `_columns`, `_relations`, `_views`, add:

```ts
    await seedResourceTypes('platform', 'admin', 'platform')
    await seedPlatformDefaultGroups()
```

- [ ] **Step 4: Add `seedPlatformDefaultGroups`**

Append this helper to `seed.ts`:

```ts
async function seedPlatformDefaultGroups(): Promise<void> {
  const platformOwnerGroup = await createPermissionGroup('platform', 'admin', {
    resourceType: 'platform',
    name: 'owner',
    isSystem: true,
    description: 'Full platform access',
  })
  await applyPermissionToResource('platform', 'admin', {
    groupId: platformOwnerGroup.id,
    resourceType: 'platform',
    bitmask: 897,
    propagateMask: 897,
  })
  await assignPermissionGroup('platform', 'admin', 'platform_users:admin', platformOwnerGroup.id)

  for (const resourceName of ['admin_user', 'admin_user_group', 'company', 'company_member', 'workflow_design']) {
    const groups = defaultGroups(resourceName as any)
    for (const groupDef of groups) {
      const group = await createPermissionGroup('platform', 'admin', {
        resourceType: resourceName,
        name: groupDef.name,
        isSystem: true,
      })
      await applyPermissionToResource('platform', 'admin', {
        groupId: group.id,
        resourceType: resourceName,
        bitmask: groupDef.bitmask,
        propagateMask: groupDef.propagateMask,
      })
      if (groupDef.name === 'owner') {
        await assignPermissionGroup('platform', 'admin', 'platform_users:admin', group.id)
      }
    }
  }
}
```

Note: `createPermissionGroup` signature is updated in Phase 3. Until then this step cannot run; implement Phase 2 and Phase 3 before running `pnpm --filter db seed`.

- [ ] **Step 5: Run the platform seed (after Phase 3)**

Run:

```bash
docker compose up -d
pnpm --filter db seed
```

Expected: seed completes without errors and `resource_types` records exist in `platform/admin`.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/resource-types.ts packages/db/src/schema-definitions.ts packages/db/src/provision.ts packages/db/src/seed.ts
git commit -m "feat(db): add resource_types table and seed platform/tenant catalogs"
```

---

## Phase 3 — Port the graph resolver to `packages/db`

### Task 3.1: Create `packages/db/src/permission-resolver.ts`

**Files:**
- Create: `packages/db/src/permission-resolver.ts`

- [ ] **Step 1: Write the resolver**

```ts
import type { Surreal } from 'surrealdb'
import { getSurreal, closeSurreal } from './client.js'
import { resourceTypeRecordId } from './resource-types.js'
import { allActionsBitmask, bitmaskToActions, hasAction, resourceType, type ResourceType } from 'shared'

export interface ResolveOptions {
  recordId?: string
  database?: string
  membershipEdge?: string
  userGroupTable?: string
}

export const TENANT_RESOLVER_OPTS: Required<Pick<ResolveOptions, 'membershipEdge' | 'userGroupTable'>> = {
  membershipEdge: 'user_group_memberships',
  userGroupTable: 'user_groups',
}

export const PLATFORM_RESOLVER_OPTS: Required<Pick<ResolveOptions, 'membershipEdge' | 'userGroupTable'>> = {
  membershipEdge: 'admin_user_group_memberships',
  userGroupTable: 'admin_user_groups',
}

export interface EffectivePermissions {
  bitmask: number
  actions: string[]
}

export interface PermissionSourceBase {
  edgeId: string
  groupId: string
  groupName: string
  bitmask: number
}

export interface DirectPermissionSource extends PermissionSourceBase {
  type: 'direct'
  recordId?: string
}

export interface InheritedPermissionSource extends PermissionSourceBase {
  type: 'inherited'
  propagateMask: number
  fromResourceId: string
  fromResourceName: string
}

export type PermissionSource = DirectPermissionSource | InheritedPermissionSource

export interface ActionPermission {
  action: string
  granted: boolean
  sources: PermissionSource[]
}

export interface MemberResourcePermissions {
  effectiveBitmask: number
  actions: ActionPermission[]
}

export interface PermissionExplanation {
  granted: boolean
  sources: PermissionSource[]
  deniedReason?: string
}

export interface ResourceMember {
  memberId: string
  memberName: string
  effectiveBitmask: number
  actions: string[]
}

interface RawEdge {
  id: unknown
  groupId: unknown
  groupName: string
  resourceId: unknown
  resourceName: string
  bitmask: number
  recordId?: string
  propagateMask?: number
}

function toStringId(value: unknown): string {
  return String(value)
}

function recordScopeCondition(recordId?: string): { sql: string; params: Record<string, unknown> } {
  if (recordId) {
    return {
      sql: 'AND (recordId = $recordId OR recordId IS NONE)',
      params: { recordId },
    }
  }
  return {
    sql: 'AND recordId IS NONE',
    params: {},
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export async function collectAncestors(
  surreal: Surreal,
  resourceId: string
): Promise<string[]> {
  const [result] = await surreal.query<[unknown]>(
    'SELECT VALUE id FROM type::record($resourceId).{..+collect}(->resource_parent->resource_types)',
    { resourceId }
  )
  if (!Array.isArray(result)) return []
  return result.map((id) => toStringId(id)).filter((id) => id && id !== resourceId)
}

interface BatchedEdges {
  directEdges: RawEdge[]
  ancestorEdges: RawEdge[]
}

export async function queryBatchedEdges(
  surreal: Surreal,
  memberId: string,
  resourceId: string,
  ancestorIds: string[],
  opts?: ResolveOptions
): Promise<{ directEdges: RawEdge[]; ancestorEdges: RawEdge[] }> {
  const scope = recordScopeCondition(opts?.recordId)
  const membershipEdge = opts?.membershipEdge ?? TENANT_RESOLVER_OPTS.membershipEdge
  const userGroupTable = opts?.userGroupTable ?? TENANT_RESOLVER_OPTS.userGroupTable

  const query = `
    LET $member = type::record($memberId);
    LET $resource = type::record($resourceId);
    LET $ancestors = array::map($ancestorIds, |$id| type::record($id));
    LET $directViaMember = (
      SELECT id, in AS groupId, in.name AS groupName, out AS resourceId, out.name AS resourceName, bitmask, recordId
      FROM $member->permission_assignments->permission_groups->permission_apply_to
      WHERE out = $resource ${scope.sql}
    );
    LET $directViaUserGroup = (
      SELECT id, in AS groupId, in.name AS groupName, out AS resourceId, out.name AS resourceName, bitmask, recordId
      FROM $member->${membershipEdge}->${userGroupTable}->permission_assignments->permission_groups->permission_apply_to
      WHERE out = $resource ${scope.sql}
    );
    LET $ancestorViaMember = (
      SELECT id, in AS groupId, in.name AS groupName, out AS resourceId, out.name AS resourceName, bitmask, propagateMask
      FROM $member->permission_assignments->permission_groups->permission_apply_to
      WHERE out IN $ancestors AND recordId IS NONE
    );
    LET $ancestorViaUserGroup = (
      SELECT id, in AS groupId, in.name AS groupName, out AS resourceId, out.name AS resourceName, bitmask, propagateMask
      FROM $member->${membershipEdge}->${userGroupTable}->permission_assignments->permission_groups->permission_apply_to
      WHERE out IN $ancestors AND recordId IS NONE
    );
    RETURN {
      directEdges: array::union($directViaMember, $directViaUserGroup),
      ancestorEdges: array::union($ancestorViaMember, $ancestorViaUserGroup)
    };
  `

  const params: Record<string, unknown> = { memberId, resourceId, ancestorIds, ...scope.params }
  const results = await surreal.query<[unknown]>(query, params)
  const last = Array.isArray(results) ? results[results.length - 1] : results
  const payload = (Array.isArray(last) ? last[0] : last) as BatchedEdges | undefined

  const directEdges = (payload?.directEdges ?? []).map((edge) => ({
    ...edge,
    id: toStringId(edge.id),
    groupId: toStringId(edge.groupId),
    resourceId: toStringId(edge.resourceId),
  }))
  const ancestorEdges = (payload?.ancestorEdges ?? []).map((edge) => ({
    ...edge,
    id: toStringId(edge.id),
    groupId: toStringId(edge.groupId),
    resourceId: toStringId(edge.resourceId),
  }))

  return {
    directEdges: uniqueById(directEdges),
    ancestorEdges: uniqueById(ancestorEdges),
  }
}

export function computeMaskFromEdges(
  edges: { directEdges: RawEdge[]; ancestorEdges: RawEdge[] },
  resourceId: string
): number {
  let mask = 0
  for (const edge of edges.directEdges) {
    mask |= edge.bitmask
  }

  const byAncestor = new Map<string, RawEdge[]>()
  for (const edge of edges.ancestorEdges) {
    const ancestorId = edge.resourceId
    if (ancestorId === resourceId) continue
    const list = byAncestor.get(ancestorId) ?? []
    list.push(edge)
    byAncestor.set(ancestorId, list)
  }

  for (const [, list] of byAncestor) {
    const visible = list.some((edge) => (edge.bitmask & 1) !== 0)
    if (!visible) continue
    for (const edge of list) {
      mask |= edge.bitmask & (edge.propagateMask ?? 0)
    }
  }

  return mask
}

export async function getEffectivePermissions(
  namespace: string,
  memberId: string,
  resourceName: ResourceType,
  role?: string,
  recordId?: string,
  opts?: ResolveOptions
): Promise<string> {
  if (role === 'owner') {
    return allActionsBitmask(resourceName)
  }

  const database = opts?.database ?? 'main'
  const surreal = await getSurreal(namespace, database)
  try {
    const resourceId = resourceTypeRecordId(resourceName)
    const ancestors = await collectAncestors(surreal, resourceId)
    const edges = await queryBatchedEdges(surreal, memberId, resourceId, ancestors, {
      ...opts,
      recordId,
    })
    const mask = computeMaskFromEdges(edges, resourceId)
    return mask.toString()
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getMemberResourcePermissions(
  namespace: string,
  memberId: string,
  resourceName: ResourceType,
  opts?: ResolveOptions
): Promise<MemberResourcePermissions> {
  const database = opts?.database ?? 'main'
  const surreal = await getSurreal(namespace, database)
  try {
    const def = resourceType(resourceName)
    const resourceId = resourceTypeRecordId(resourceName)
    const ancestors = await collectAncestors(surreal, resourceId)
    const edges = await queryBatchedEdges(surreal, memberId, resourceId, ancestors, opts)
    const effectiveBitmask = computeMaskFromEdges(edges, resourceId)

    const byAncestor = new Map<string, RawEdge[]>()
    for (const edge of edges.ancestorEdges) {
      if (edge.resourceId === resourceId) continue
      const list = byAncestor.get(edge.resourceId) ?? []
      list.push(edge)
      byAncestor.set(edge.resourceId, list)
    }

    const actions: ActionPermission[] = def.bitMapping.map((entry) => {
      const granted = hasAction(effectiveBitmask, resourceName, entry.name)
      const sources: PermissionSource[] = []
      if (granted) {
        for (const edge of edges.directEdges) {
          if ((edge.bitmask & entry.bit) === entry.bit) {
            sources.push({
              type: 'direct',
              edgeId: edge.id,
              groupId: edge.groupId,
              groupName: edge.groupName,
              bitmask: edge.bitmask,
              recordId: edge.recordId,
            })
          }
        }
        for (const [ancestorId, ancestorEdges] of byAncestor) {
          const visible = ancestorEdges.some((edge) => (edge.bitmask & 1) !== 0)
          if (!visible) continue
          for (const edge of ancestorEdges) {
            const propagateMask = edge.propagateMask ?? 0
            if ((edge.bitmask & propagateMask & entry.bit) === entry.bit) {
              sources.push({
                type: 'inherited',
                edgeId: edge.id,
                groupId: edge.groupId,
                groupName: edge.groupName,
                bitmask: edge.bitmask,
                propagateMask,
                fromResourceId: ancestorId,
                fromResourceName: edge.resourceName,
              })
            }
          }
        }
      }
      return { action: entry.name, granted, sources }
    })

    return { effectiveBitmask, actions }
  } finally {
    await closeSurreal(surreal)
  }
}

export async function batchCheckPermissions(
  namespace: string,
  memberId: string,
  resourceName: ResourceType,
  actions: string[],
  opts?: ResolveOptions
): Promise<Record<string, boolean>> {
  const full = await getMemberResourcePermissions(namespace, memberId, resourceName, opts)
  const result: Record<string, boolean> = {}
  for (const action of actions) {
    const actionPerm = full.actions.find((a) => a.action === action)
    result[action] = actionPerm?.granted ?? false
  }
  return result
}

export async function explainPermission(
  namespace: string,
  memberId: string,
  resourceName: ResourceType,
  action: string,
  opts?: ResolveOptions
): Promise<PermissionExplanation> {
  const def = resourceType(resourceName)
  if (!def.bitMapping.some((b) => b.name === action)) {
    return { granted: false, sources: [], deniedReason: 'unknown action' }
  }
  const full = await getMemberResourcePermissions(namespace, memberId, resourceName, opts)
  const actionPerm = full.actions.find((a) => a.action === action)
  if (!actionPerm?.granted) {
    return { granted: false, sources: [], deniedReason: 'no matching permission grant' }
  }
  return { granted: true, sources: actionPerm.sources }
}

export async function listResourceMembers(
  namespace: string,
  resourceName: ResourceType,
  opts?: ResolveOptions
): Promise<ResourceMember[]> {
  const database = opts?.database ?? 'main'
  const surreal = await getSurreal(namespace, database)
  try {
    const def = resourceType(resourceName)
    const resourceId = resourceTypeRecordId(resourceName)

    const query = `
      LET $resource = type::record($resourceId);
      LET $groupBitmasks = (
        SELECT in AS groupId, bitmask FROM permission_apply_to WHERE out = $resource
      );
      LET $members = (
        SELECT in AS memberId, in.name AS memberName, array::group(out) AS groupIds
        FROM $resource<-permission_apply_to<-permission_groups<-permission_assignments
        WHERE meta::tb(in) != $userGroupTable
        GROUP BY in
      );
      RETURN { groupBitmasks: $groupBitmasks, members: $members };
    `

    const results = await surreal.query<[unknown]>(query, {
      resourceId,
      userGroupTable: opts?.userGroupTable ?? TENANT_RESOLVER_OPTS.userGroupTable,
    })
    const last = Array.isArray(results) ? results[results.length - 1] : results
    const payload = (Array.isArray(last) ? last[0] : last) as
      | { groupBitmasks: Array<{ groupId: unknown; bitmask: number }>; members: Array<{ memberId: unknown; memberName: string | string[]; groupIds: unknown[] }> }
      | undefined

    const groupMask = new Map<string, number>()
    for (const gb of payload?.groupBitmasks ?? []) {
      groupMask.set(toStringId(gb.groupId), gb.bitmask)
    }

    return (payload?.members ?? []).map((member) => {
      const memberId = toStringId(member.memberId)
      const memberName = Array.isArray(member.memberName)
        ? String(member.memberName[0])
        : String(member.memberName)
      const bitmask = (member.groupIds ?? []).reduce<number>(
        (mask, groupId) => mask | (groupMask.get(toStringId(groupId)) ?? 0),
        0
      )
      return {
        memberId,
        memberName,
        effectiveBitmask: bitmask,
        actions: bitmaskToActions(resourceName, bitmask),
      }
    })
  } finally {
    await closeSurreal(surreal)
  }
}
```

### Task 3.2: Rewrite `packages/db/src/permissions.ts`

**Files:**
- Modify: `packages/db/src/permissions.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { StringRecordId } from 'surrealdb'
import { defaultGroups, type ResourceType } from 'shared'
import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import { resourceTypeRecordId } from './resource-types.js'
import * as resolver from './permission-resolver.js'

export {
  getEffectivePermissions,
  getMemberResourcePermissions,
  batchCheckPermissions,
  explainPermission,
  listResourceMembers,
} from './permission-resolver.js'

export interface PermissionGroupRecord {
  id: string
  resourceType: string
  recordId?: string
  name: string
  isSystem: boolean
  description?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface PermissionGroupInput {
  resourceType: string
  recordId?: string
  name: string
  isSystem?: boolean
  description?: string
}

export async function createPermissionGroup(
  namespace: string,
  database: string,
  input: PermissionGroupInput
): Promise<PermissionGroupRecord> {
  const surreal = await getSurreal(namespace, database)
  try {
    const now = new Date().toISOString()
    const data = {
      ...input,
      isSystem: input.isSystem ?? false,
      createdAt: now,
      updatedAt: now,
    }
    const [created] = await surreal.query<[PermissionGroupRecord[]]>(
      'CREATE permission_groups CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listPermissionGroups(
  namespace: string,
  database: string,
  resourceType: string,
  recordId?: string
): Promise<PermissionGroupRecord[]> {
  const surreal = await getSurreal(namespace, database)
  try {
    const query = recordId
      ? 'SELECT * FROM permission_groups WHERE resourceType = $resourceType AND recordId = $recordId ORDER BY createdAt'
      : 'SELECT * FROM permission_groups WHERE resourceType = $resourceType AND recordId IS NONE ORDER BY createdAt'
    const [groups] = await surreal.query<[PermissionGroupRecord[]]>(query, { resourceType, recordId })
    return normalizeIds(groups)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPermissionGroupById(
  namespace: string,
  database: string,
  id: string
): Promise<PermissionGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, database)
  try {
    const [result] = await surreal.query<[PermissionGroupRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePermissionGroup(
  namespace: string,
  database: string,
  id: string,
  input: Partial<PermissionGroupInput>
): Promise<PermissionGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, database)
  try {
    const data = { ...input, updatedAt: new Date().toISOString() }
    const [updated] = await surreal.query<[PermissionGroupRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deletePermissionGroup(namespace: string, database: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, database)
  try {
    await surreal.query('DELETE permission_assignments WHERE out = type::record($id)', { id })
    await surreal.query('DELETE permission_apply_to WHERE in = type::record($id)', { id })
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export async function assignPermissionGroup(
  namespace: string,
  database: string,
  assigneeId: string,
  groupId: string
): Promise<void> {
  const group = await getPermissionGroupById(namespace, database, groupId)
  if (!group) throw new Error(`Permission group not found: ${groupId}`)

  const surreal = await getSurreal(namespace, database)
  try {
    await surreal.query(
      'RELATE $assigneeId->permission_assignments->$groupId SET resourceType = $resourceType, recordId = $recordId',
      {
        assigneeId: new StringRecordId(assigneeId),
        groupId: new StringRecordId(groupId),
        resourceType: group.resourceType,
        recordId: group.recordId ?? null,
      }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function removePermissionGroup(
  namespace: string,
  database: string,
  assigneeId: string,
  groupId: string
): Promise<void> {
  const surreal = await getSurreal(namespace, database)
  try {
    await surreal.query(
      'DELETE permission_assignments WHERE in = type::record($assigneeId) AND out = type::record($groupId)',
      { assigneeId, groupId }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listPermissionAssignments(
  namespace: string,
  database: string,
  assigneeId: string
): Promise<PermissionGroupRecord[]> {
  const surreal = await getSurreal(namespace, database)
  try {
    const [rows] = await surreal.query<
      [Array<{ out: PermissionGroupRecord }>]
    >(
      'SELECT out.* AS out FROM permission_assignments WHERE in = type::record($assigneeId)',
      { assigneeId }
    )
    return normalizeIds(rows.map((r) => r.out))
  } finally {
    await closeSurreal(surreal)
  }
}

export interface ApplyPermissionInput {
  groupId: string
  resourceType: string
  bitmask: number
  propagateMask?: number
  recordId?: string
  conditions?: Record<string, unknown>
}

export async function applyPermissionToResource(
  namespace: string,
  database: string,
  input: ApplyPermissionInput
): Promise<void> {
  const { groupId, resourceType: resourceName, bitmask, propagateMask = 0, recordId, conditions } = input
  const surreal = await getSurreal(namespace, database)
  try {
    const resourceId = resourceTypeRecordId(resourceName)
    const data: Record<string, unknown> = { bitmask, propagateMask }
    if (recordId) data.recordId = recordId
    if (conditions) data.conditions = conditions
    await surreal.query(
      'RELATE $groupId->permission_apply_to->$resourceId CONTENT $data',
      {
        groupId: new StringRecordId(groupId),
        resourceId: new StringRecordId(resourceId),
        data,
      }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function provisionDefaultCompanyGroups(
  namespace: string,
  ownerMemberId: string
): Promise<void> {
  for (const resourceName of ['tenant', 'member'] as ResourceType[]) {
    const groups = defaultGroups(resourceName)
    for (const groupDef of groups) {
      const group = await createPermissionGroup(namespace, 'main', {
        resourceType: resourceName,
        name: groupDef.name,
        isSystem: true,
      })
      await applyPermissionToResource(namespace, 'main', {
        groupId: group.id,
        resourceType: resourceName,
        bitmask: groupDef.bitmask,
        propagateMask: groupDef.propagateMask,
      })
      if (groupDef.name === 'owner') {
        await assignPermissionGroup(namespace, 'main', ownerMemberId, group.id)
      }
    }
  }
}
```

### Task 3.3: Update `packages/db/src/user-groups.ts`

**Files:**
- Modify: `packages/db/src/user-groups.ts`

- [ ] **Step 1: Update imports and `deleteUserGroup`**

Change the import block to:

```ts
import { StringRecordId } from 'surrealdb'
import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import { defaultGroups, type ResourceType } from 'shared'
import {
  createPermissionGroup,
  assignPermissionGroup,
  listPermissionGroups,
  applyPermissionToResource,
} from './permissions.js'
```

In `deleteUserGroup`, change the resource type used for cleanup:

```ts
    const groups = await listPermissionGroups(namespace, 'main', 'user_group_detail', id)
```

- [ ] **Step 2: Rewrite `createUserGroupWithDefaults`**

```ts
export async function createUserGroupWithDefaults(
  namespace: string,
  input: UserGroupInput,
  creatorMemberId: string
): Promise<UserGroupRecord> {
  const group = await createUserGroup(namespace, input)
  const groups = defaultGroups('user_group_detail' as ResourceType)
  for (const groupDef of groups) {
    const created = await createPermissionGroup(namespace, 'main', {
      resourceType: 'user_group_detail',
      recordId: group.id,
      name: groupDef.name,
      isSystem: true,
    })
    await applyPermissionToResource(namespace, 'main', {
      groupId: created.id,
      resourceType: 'user_group_detail',
      bitmask: groupDef.bitmask,
      propagateMask: groupDef.propagateMask,
    })
    if (groupDef.name === 'owner') {
      await assignPermissionGroup(namespace, 'main', creatorMemberId, created.id)
    }
  }
  return group
}
```

### Task 3.4: Update `packages/db/src/index.ts`

**Files:**
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add exports**

```ts
export * from './resource-types.js'
export * from './permission-resolver.js'
```

### Task 3.5: Update DB tests

**Files:**
- Modify: `packages/db/test/permissions.test.ts`
- Modify: `packages/db/test/user-groups.test.ts`
- Modify: `packages/db/test/helpers.ts`

- [ ] **Step 1: Rewrite `packages/db/test/permissions.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createPermissionGroup,
  listPermissionGroups,
  assignPermissionGroup,
  removePermissionGroup,
  getEffectivePermissions,
  provisionDefaultCompanyGroups,
  applyPermissionToResource,
} from '../src/permissions.js'
import { createUserGroup } from '../src/user-groups.js'
import { createMember } from '../src/tenant.js'
import { getSurreal, closeSurreal } from '../src/client.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'

async function addUserGroupMember(namespace: string, memberId: string, userGroupId: string) {
  const { StringRecordId } = await import('surrealdb')
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query(
      'RELATE $memberId->user_group_memberships->$userGroupId',
      {
        memberId: new StringRecordId(memberId),
        userGroupId: new StringRecordId(userGroupId),
      }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

describe('permissions', () => {
  let namespace: string

  beforeEach(async () => {
    namespace = uniqueTenantName()
    await createTenantNamespace(namespace)
  })

  afterEach(async () => {
    await removeTenantNamespace(namespace)
  })

  it('creates a group and applies a bitmask via permission_apply_to', async () => {
    const member = await createMember(namespace, { email: 'm@example.com', role: 'member' })
    const group = await createPermissionGroup(namespace, 'main', {
      resourceType: 'tenant',
      name: 'viewer',
      isSystem: false,
    })
    await applyPermissionToResource(namespace, 'main', {
      groupId: group.id,
      resourceType: 'tenant',
      bitmask: 1,
      propagateMask: 0,
    })
    await assignPermissionGroup(namespace, 'main', member.id, group.id)
    const mask = await getEffectivePermissions(namespace, member.id, 'tenant', member.role)
    expect(mask).toBe('1')
  })

  it('gives owners all tenant permissions', async () => {
    const owner = await createMember(namespace, { email: 'o@example.com', role: 'owner' })
    const mask = await getEffectivePermissions(namespace, owner.id, 'tenant', owner.role)
    expect(mask).toBe('911')
  })

  it('provisions default tenant groups', async () => {
    const owner = await createMember(namespace, { email: 'o2@example.com', role: 'owner' })
    await provisionDefaultCompanyGroups(namespace, owner.id)
    const groups = await listPermissionGroups(namespace, 'main', 'tenant')
    expect(groups.map((g) => g.name)).toEqual(['owner', 'admin', 'user'])
  })

  it('inherits permissions from user-group membership', async () => {
    const member = await createMember(namespace, { email: 'group-member@example.com', role: 'member' })
    const userGroup = await createUserGroup(namespace, { name: 'Engineering' })
    await addUserGroupMember(namespace, member.id, userGroup.id)

    const group = await createPermissionGroup(namespace, 'main', {
      resourceType: 'tenant',
      name: 'group viewer',
      isSystem: false,
    })
    await applyPermissionToResource(namespace, 'main', {
      groupId: group.id,
      resourceType: 'tenant',
      bitmask: 3,
      propagateMask: 0,
    })
    await assignPermissionGroup(namespace, 'main', userGroup.id, group.id)

    const mask = await getEffectivePermissions(namespace, member.id, 'tenant', member.role)
    expect(mask).toBe('3')
  })

  it('applies type-level permission groups when resolving a specific record', async () => {
    const member = await createMember(namespace, { email: 'record-member@example.com', role: 'member' })

    const typeGroup = await createPermissionGroup(namespace, 'main', {
      resourceType: 'member',
      name: 'type viewer',
      isSystem: false,
    })
    await applyPermissionToResource(namespace, 'main', {
      groupId: typeGroup.id,
      resourceType: 'member',
      bitmask: 7,
      propagateMask: 0,
    })
    const recordGroup = await createPermissionGroup(namespace, 'main', {
      resourceType: 'member',
      recordId: 'members:rec1',
      name: 'record editor',
      isSystem: false,
    })
    await applyPermissionToResource(namespace, 'main', {
      groupId: recordGroup.id,
      resourceType: 'member',
      bitmask: 1,
      propagateMask: 0,
      recordId: 'members:rec1',
    })

    await assignPermissionGroup(namespace, 'main', member.id, typeGroup.id)
    await assignPermissionGroup(namespace, 'main', member.id, recordGroup.id)

    const typeOnlyMask = await getEffectivePermissions(namespace, member.id, 'member', member.role)
    expect(typeOnlyMask).toBe('7')

    const recordMask = await getEffectivePermissions(
      namespace,
      member.id,
      'member',
      member.role,
      'members:rec1'
    )
    expect(recordMask).toBe('7')
  })
})
```

- [ ] **Step 2: Update `packages/db/test/user-groups.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createUserGroup,
  listUserGroups,
  getUserGroupById,
  addUserGroupMember,
  removeUserGroupMember,
  listUserGroupMembers,
  createUserGroupWithDefaults,
} from '../src/user-groups.js'
import { createMember } from '../src/tenant.js'
import { getEffectivePermissions } from '../src/permissions.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'

describe('user groups', () => {
  let namespace: string

  beforeEach(async () => {
    namespace = uniqueTenantName()
    await createTenantNamespace(namespace)
  })

  afterEach(async () => {
    await removeTenantNamespace(namespace)
  })

  it('creates a user group with default record-level permission groups', async () => {
    const member = await createMember(namespace, { email: 'm@example.com', role: 'member' })
    const group = await createUserGroupWithDefaults(namespace, { name: 'Engineering' }, member.id)
    expect(group.id).toMatch(/^user_groups:/)

    const groups = await listUserGroups(namespace)
    expect(groups).toHaveLength(1)

    const mask = await getEffectivePermissions(namespace, member.id, 'user_group_detail', member.role, group.id)
    expect(mask).toBe('63')
  })

  it('adds and removes members from a user group', async () => {
    const owner = await createMember(namespace, { email: 'o2@example.com', role: 'owner' })
    const member = await createMember(namespace, { email: 'm@example.com', role: 'member' })
    const group = await createUserGroup(namespace, { name: 'Ops' })

    await addUserGroupMember(namespace, member.id, group.id)
    let members = await listUserGroupMembers(namespace, group.id)
    expect(members).toHaveLength(1)

    await removeUserGroupMember(namespace, member.id, group.id)
    members = await listUserGroupMembers(namespace, group.id)
    expect(members).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Update `packages/db/test/helpers.ts`**

No changes are required because `provisionCompanyNamespace` now seeds the catalog and edges.

- [ ] **Step 4: Run the DB tests**

```bash
docker compose up -d surrealdb-test
pnpm --filter db test
```

Expected: PASS (5 permission tests, 2 user-group tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/permission-resolver.ts packages/db/src/permissions.ts packages/db/src/user-groups.ts packages/db/src/index.ts packages/db/test/permissions.test.ts packages/db/test/user-groups.test.ts
git commit -m "feat(db): port graph resolver and move bitmasks to permission_apply_to edges"
```

---

----

## Phase 3.5 — Update seed scripts and E2E fixtures

### Task 3.5.1: Update `packages/db/scripts/seed-company.ts`

**Files:**
- Modify: `packages/db/scripts/seed-company.ts`

- [ ] **Step 1: Update `seedMembers` to use `member` default groups**

Replace:

```ts
  const groups = await listPermissionGroups(namespace, 'company')
  const adminGroup = groups.find((g) => g.name === 'Admin')!
  const memberGroup = groups.find((g) => g.name === 'Member')!
```

with:

```ts
  const groups = await listPermissionGroups(namespace, 'main', 'member')
  const adminGroup = groups.find((g) => g.name === 'admin')!
  const memberGroup = groups.find((g) => g.name === 'user')!
```

Add `'main'` as the second argument to both `assignPermissionGroup` calls in `seedMembers`:

```ts
    await assignPermissionGroup(namespace, 'main', member.id, group.id)
```

- [ ] **Step 2: Update `seedUserGroups` to use `user_group_detail`**

Replace:

```ts
    const recordGroups = await listPermissionGroups(namespace, 'user_group', group.id)
    const ownerGroup = recordGroups.find((g) => g.name === 'Owner')!
```

with:

```ts
    const recordGroups = await listPermissionGroups(namespace, 'main', 'user_group_detail', group.id)
    const ownerGroup = recordGroups.find((g) => g.name === 'owner')!
```

Add `'main'` to the `assignPermissionGroup` call inside `seedUserGroups`:

```ts
        await assignPermissionGroup(namespace, 'main', member.id, ownerGroup.id)
```

- [ ] **Step 3: Run the seed company script**

```bash
docker compose up -d
pnpm --filter db seed-company
```

Expected: company seeded and summary printed with owner/admin/member logins.

- [ ] **Step 4: Commit**

```bash
git add packages/db/scripts/seed-company.ts
git commit -m "chore(seed): adapt seed-company to new permission resources"
```

### Task 3.5.2: Update `packages/db/test/seed-company.test.ts`

**Files:**
- Modify: `packages/db/test/seed-company.test.ts`

- [ ] **Step 1: Update assertions**

Replace `company` resource type with `tenant` and `member`, and `user_group` record-level with `user_group_detail`. Update expected group names to lowercase.

For example, change:

```ts
const companyGroups = await listPermissionGroups('company_seedco_test', 'company')
```

to:

```ts
const tenantGroups = await listPermissionGroups('company_seedco_test', 'main', 'tenant')
const memberGroups = await listPermissionGroups('company_seedco_test', 'main', 'member')
```

and expect `['owner', 'admin']` and `['owner', 'admin', 'user']` respectively.

For the engineering group record-level check, change `user_group` to `user_group_detail` and `Owner` to `owner`.

- [ ] **Step 2: Run the test**

```bash
pnpm --filter db test seed-company.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/db/test/seed-company.test.ts
git commit -m "test(db): update seed-company test for new resource catalog"
```

### Task 3.5.3: Update `apps/api/tests/e2e/fixtures.ts`

**Files:**
- Modify: `apps/api/tests/e2e/fixtures.ts`

- [ ] **Step 1: Fix default group lookup for the admin member**

Replace:

```ts
      const [permRows] = await tenantSurreal.query<[{ id: string }[]]>(
        'SELECT id FROM permission_groups WHERE name = $name AND resourceType = $resourceType LIMIT 1',
        { name: 'Admin', resourceType: 'company' }
      )
```

with:

```ts
      const [permRows] = await tenantSurreal.query<[{ id: string }[]]>(
        'SELECT id FROM permission_groups WHERE name = $name AND resourceType = $resourceType LIMIT 1',
        { name: 'admin', resourceType: 'member' }
      )
```

Add `'main'` to the `assignPermissionGroup` call:

```ts
      await assignPermissionGroup(company.namespace, 'main', admin.memberId, adminPermissionGroupId)
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/tests/e2e/fixtures.ts
git commit -m "test(api): update e2e fixtures for member admin group"
```

----

## Phase 4 — Tenant API middleware and routes

### Task 4.1: Update `apps/api/src/middleware/permission.ts`

**Files:**
- Modify: `apps/api/src/middleware/permission.ts`

- [ ] **Step 1: Replace the file**

```ts
import { createMiddleware } from 'hono/factory'
import { getEffectivePermissions } from 'db/permissions'
import { hasAction, type ResourceType, type PermissionAction } from 'shared'
import type { TenantScope } from '../types.js'

export function requirePermission<T extends ResourceType>(
  resourceType: T,
  action: PermissionAction<T>,
  recordIdParam?: string
) {
  return createMiddleware(async (c, next) => {
    const scope = c.get('scope') as TenantScope | undefined
    if (!scope || scope.type !== 'tenant') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    if (scope.role === 'owner') {
      return next()
    }

    const recordId = recordIdParam ? c.req.param(recordIdParam) : undefined
    const mask = await resolvePermissions(scope, resourceType, recordId)
    if (!hasAction(mask, resourceType, action)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  })
}

async function resolvePermissions(
  scope: TenantScope,
  resourceType: ResourceType,
  recordId?: string
): Promise<string> {
  scope.permissions ??= {}
  const key = recordId ? `${resourceType}:${recordId}` : resourceType
  if (scope.permissions[key]) {
    return scope.permissions[key]!
  }
  const mask = await getEffectivePermissions(
    scope.namespace,
    scope.memberId,
    resourceType,
    scope.role,
    recordId
  )
  scope.permissions[key] = mask
  return mask
}
```

### Task 4.2: Update `apps/api/src/routes/users.ts`

**Files:**
- Modify: `apps/api/src/routes/users.ts`

- [ ] **Step 1: Replace permission resource/action names**

Change the four `requirePermission` calls:

```ts
  app.get('/', tenantAuth, requirePermission('member', 'view'), async (c) => { ... })

  app.post('/', tenantAuth, requirePermission('member', 'create'), async (c) => { ... })

  app.patch('/:id', tenantAuth, requirePermission('member', 'manage_permissions'), async (c) => { ... })

  app.delete('/:id', tenantAuth, requirePermission('member', 'delete'), async (c) => { ... })
```

Keep the existing owner-only guards inside the handlers unchanged.

### Task 4.3: Update `apps/api/src/routes/user-groups.ts`

**Files:**
- Modify: `apps/api/src/routes/user-groups.ts`

- [ ] **Step 1: Replace the route guards**

```ts
  app.get('/', requirePermission('user_group', 'view'), async (c) => { ... })

  app.post('/', requirePermission('user_group', 'create'), async (c) => { ... })

  app.get('/:id', requirePermission('user_group_detail', 'view', 'id'), async (c) => { ... })

  app.patch('/:id', requirePermission('user_group_detail', 'edit_info', 'id'), async (c) => { ... })

  app.delete('/:id', requirePermission('user_group_detail', 'delete', 'id'), async (c) => { ... })

  app.get('/:id/members', requirePermission('user_group_detail', 'view', 'id'), async (c) => { ... })

  app.post('/:id/members', requirePermission('user_group_detail', 'add_member', 'id'), async (c) => { ... })

  app.delete('/:id/members/:memberId', requirePermission('user_group_detail', 'remove_member', 'id'), async (c) => { ... })
```

### Task 4.4: Update `apps/api/src/routes/workflow-designs.ts`

**Files:**
- Modify: `apps/api/src/routes/workflow-designs.ts`

- [ ] **Step 1: Replace the `requireRole` helper with permission middleware**

Remove the local `requireRole` helper entirely. Add the import:

```ts
import { requirePermission } from '../middleware/permission.js'
```

Then update each route:

```ts
  app.get('/', requirePermission('workflow_design', 'view'), async (c) => { ... })

  app.post('/', requirePermission('workflow_design', 'create'), async (c) => { ... })

  app.get('/:id', requirePermission('workflow_design_detail', 'view', 'id'), async (c) => { ... })

  app.patch('/:id', requirePermission('workflow_design_detail', 'edit', 'id'), async (c) => { ... })

  app.delete('/:id', requirePermission('workflow_design_detail', 'delete', 'id'), async (c) => { ... })
```

### Task 4.5: Update `apps/api/src/routes/permissions.ts`

**Files:**
- Modify: `apps/api/src/routes/permissions.ts`

- [ ] **Step 1: Replace the file**

```ts
import { Hono } from 'hono'
import { RESOURCE_CATALOG } from 'shared'

export function permissionsRoutes() {
  const app = new Hono()

  app.get('/actions', (c) => {
    const resourceType = c.req.query('resourceType')
    if (!resourceType || !(resourceType in RESOURCE_CATALOG)) {
      return c.json({ error: 'Invalid or missing resourceType' }, 400)
    }
    const def = RESOURCE_CATALOG[resourceType]
    const result = def.bitMapping.map((entry) => ({
      action: entry.name,
      value: entry.bit,
    }))
    return c.json({ resourceType, actions: result })
  })

  return app
}
```

### Task 4.6: Update API unit tests

**Files:**
- Modify: `apps/api/src/middleware/permission.test.ts`
- Modify: `apps/api/src/routes/permissions.test.ts`

- [ ] **Step 1: Update `apps/api/src/middleware/permission.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requirePermission } from './permission.js'
import type { TenantScope } from '../types.js'

describe('requirePermission', () => {
  function buildApp(bitmask: string | undefined, role: 'owner' | 'member') {
    const app = new Hono()
    app.use(async (c, next) => {
      c.set('scope', {
        type: 'tenant',
        namespace: 'company_test',
        database: 'main',
        accountId: 'accounts:1',
        profileId: 'user_profiles:1',
        memberId: 'members:1',
        role,
        permissions: bitmask ? { member: bitmask } : undefined,
        session: {
          sessionId: 'sessions:1',
          accountId: 'accounts:1',
          profileId: 'user_profiles:1',
          companyId: 'companies:1',
          type: 'user',
        },
      } satisfies TenantScope)
      await next()
    })
    app.get('/settings', requirePermission('member', 'edit'), (c) => c.json({ ok: true }))
    return app
  }

  it('allows the action when the compound bit is set', async () => {
    const app = buildApp('3', 'member') // view + edit
    const res = await app.request('/settings')
    expect(res.status).toBe(200)
  })

  it('blocks the action when the bit is missing', async () => {
    const app = buildApp('1', 'member') // view only
    const res = await app.request('/settings')
    expect(res.status).toBe(403)
  })

  it('allows owners automatically', async () => {
    const app = buildApp(undefined, 'owner')
    const res = await app.request('/settings')
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Update `apps/api/src/routes/permissions.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { permissionsRoutes } from './permissions.js'

const app = permissionsRoutes()

describe('GET /actions', () => {
  it('returns compound action values for a valid resourceType', async () => {
    const res = await app.request('/actions?resourceType=user_group')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      resourceType: string
      actions: Array<{ action: string; value: number }>
    }
    expect(body.resourceType).toBe('user_group')
    expect(body.actions.map((a) => a.action)).toEqual([
      'view',
      'edit_info',
      'create',
      'delete',
      'add_member',
      'remove_member',
      'update_default_view_settings',
      'edit_schema',
      'manage_permissions',
    ])
    expect(body.actions.find((a) => a.action === 'create')?.value).toBe(5)
    expect(body.actions.find((a) => a.action === 'add_member')?.value).toBe(19)
  })

  it('returns 400 for an invalid resourceType', async () => {
    const res = await app.request('/actions?resourceType=not_a_resource')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Invalid or missing resourceType')
  })

  it('returns 400 when resourceType is missing', async () => {
    const res = await app.request('/actions')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Invalid or missing resourceType')
  })
})
```

### Task 4.7: Run unit tests

```bash
pnpm --filter api test
```

Expected: PASS.

### Task 4.8: Commit

```bash
git add apps/api/src/middleware/permission.ts apps/api/src/routes/users.ts apps/api/src/routes/user-groups.ts apps/api/src/routes/workflow-designs.ts apps/api/src/routes/permissions.ts apps/api/src/middleware/permission.test.ts apps/api/src/routes/permissions.test.ts
git commit -m "feat(api): apply compound permission checks to tenant routes"
```

---

## Phase 5 — Admin API permissions

### Task 5.1: Update `apps/api/src/types.ts`

**Files:**
- Modify: `apps/api/src/types.ts`

- [ ] **Step 1: Add permissions cache to `AdminScope`**

```ts
export interface AdminScope {
  type: 'admin'
  namespace: string
  database: string
  userId: string
  email: string
  session: import('./lib/session.js').AdminSession
  permissions?: Record<string, string>
}
```

### Task 5.2: Create `apps/api/src/middleware/admin-permission.ts`

**Files:**
- Create: `apps/api/src/middleware/admin-permission.ts`

- [ ] **Step 1: Write the middleware**

```ts
import { createMiddleware } from 'hono/factory'
import { getEffectivePermissions } from 'db/permissions'
import { PLATFORM_RESOLVER_OPTS } from 'db/permission-resolver'
import { hasAction, type ResourceType, type PermissionAction } from 'shared'
import type { AdminScope } from '../types.js'

export function requireAdminPermission<T extends ResourceType>(
  resourceType: T,
  action: PermissionAction<T>,
  recordIdParam?: string
) {
  return createMiddleware(async (c, next) => {
    const scope = c.get('scope') as AdminScope | undefined
    if (!scope || scope.type !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const recordId = recordIdParam ? c.req.param(recordIdParam) : undefined
    const mask = await resolveAdminPermissions(scope, resourceType, recordId)
    if (!hasAction(mask, resourceType, action)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  })
}

async function resolveAdminPermissions(
  scope: AdminScope,
  resourceType: ResourceType,
  recordId?: string
): Promise<string> {
  scope.permissions ??= {}
  const key = recordId ? `${resourceType}:${recordId}` : resourceType
  if (scope.permissions[key]) {
    return scope.permissions[key]!
  }
  const mask = await getEffectivePermissions(
    scope.namespace,
    scope.userId,
    resourceType,
    undefined,
    recordId,
    { ...PLATFORM_RESOLVER_OPTS, database: scope.database }
  )
  scope.permissions[key] = mask
  return mask
}
```

### Task 5.3: Update `apps/api/src/middleware/admin.ts`

**Files:**
- Modify: `apps/api/src/middleware/admin.ts`

- [ ] **Step 1: Resolve admin effective permissions into scope**

No change is required for the middleware itself; `requireAdminPermission` resolves permissions lazily per route. Keep the existing `adminAuth` behavior.

### Task 5.4: Guard `apps/api/src/routes/admin.ts`

**Files:**
- Modify: `apps/api/src/routes/admin.ts`

- [ ] **Step 1: Add the permission middleware import and guards**

Add import:

```ts
import { requireAdminPermission } from '../middleware/admin-permission.js'
```

Apply guards:

```ts
  app.get('/health-checks', requireAdminPermission('platform', 'view'), async (c) => { ... })
  app.get('/health-checks/history', requireAdminPermission('platform', 'view'), async (c) => { ... })

  app.get('/dashboard', requireAdminPermission('platform', 'view'), async (c) => { ... })

  app.get('/platform-users', requireAdminPermission('admin_user', 'view'), async (c) => { ... })
  app.get('/platform-users/:id', requireAdminPermission('admin_user', 'view'), async (c) => { ... })
  app.post('/platform-users', requireAdminPermission('admin_user', 'create'), async (c) => { ... })
  app.patch('/platform-users/:id', requireAdminPermission('admin_user', 'edit'), async (c) => { ... })
  app.delete('/platform-users/:id', requireAdminPermission('admin_user', 'delete'), async (c) => { ... })

  app.get('/admin-user-groups', requireAdminPermission('admin_user_group', 'view'), async (c) => { ... })
  app.get('/admin-user-groups/:id', requireAdminPermission('admin_user_group', 'view'), async (c) => { ... })
  app.post('/admin-user-groups', requireAdminPermission('admin_user_group', 'create'), async (c) => { ... })
  app.patch('/admin-user-groups/:id', requireAdminPermission('admin_user_group', 'edit_info'), async (c) => { ... })
  app.delete('/admin-user-groups/:id', requireAdminPermission('admin_user_group', 'delete'), async (c) => { ... })
```

### Task 5.5: Guard `apps/api/src/routes/admin-workflow-designs.ts`

**Files:**
- Modify: `apps/api/src/routes/admin-workflow-designs.ts`

- [ ] **Step 1: Add permission guards**

Add import:

```ts
import { requireAdminPermission } from '../middleware/admin-permission.js'
```

Apply guards:

```ts
  app.get('/', requireAdminPermission('workflow_design', 'view'), async (c) => { ... })
  app.post('/', requireAdminPermission('workflow_design', 'create'), async (c) => { ... })
  app.get('/:id', requireAdminPermission('workflow_design_detail', 'view', 'id'), async (c) => { ... })
  app.patch('/:id', requireAdminPermission('workflow_design_detail', 'edit', 'id'), async (c) => { ... })
  app.delete('/:id', requireAdminPermission('workflow_design_detail', 'delete', 'id'), async (c) => { ... })
```

### Task 5.6: Add an admin effective-permissions endpoint

**Files:**
- Modify: `apps/api/src/routes/admin.ts`

- [ ] **Step 1: Add endpoint**

Append before `return app`:

```ts
  app.get('/permissions/effective', requireAdminPermission('platform', 'view'), async (c) => {
    const scope = c.get('scope') as AdminScope
    const resourceType = c.req.query('resourceType')
    const recordId = c.req.query('recordId') ?? undefined
    if (!resourceType) {
      return c.json({ error: 'resourceType required' }, 400)
    }
    const mask = await resolveAdminPermissions(scope, resourceType as ResourceType, recordId)
    return c.json({ resourceType, recordId, bitmask: mask })
  })
```

Add the import for `resolveAdminPermissions` at the top:

```ts
import { resolveAdminPermissions } from '../middleware/admin-permission.js'
import type { ResourceType } from 'shared'
```

Export `resolveAdminPermissions` from `apps/api/src/middleware/admin-permission.ts` by removing the `function` keyword? It is currently not exported. Change the declaration to:

```ts
export async function resolveAdminPermissions(...)
```

### Task 5.7: Run typecheck

```bash
pnpm --filter api typecheck
```

Expected: no errors.

### Task 5.8: Commit

```bash
git add apps/api/src/types.ts apps/api/src/middleware/admin-permission.ts apps/api/src/routes/admin.ts apps/api/src/routes/admin-workflow-designs.ts
git commit -m "feat(api): add platform permission middleware and guard admin routes"
```

---

## Phase 6 — Admin UI conditional rendering

### Task 6.1: Create `apps/admin/app/composables/useAdminPermission.ts`

**Files:**
- Create: `apps/admin/app/composables/useAdminPermission.ts`

- [ ] **Step 1: Write the composable**

```ts
import { useApi } from './useApi'
import { hasAction, type ResourceType, type PermissionAction } from 'shared'

export function useAdminPermission() {
  const api = useApi()
  const cache = useState<Record<string, string | undefined>>('adminPermissions', () => ({}))

  async function can<T extends ResourceType>(
    resourceType: T,
    action: PermissionAction<T>,
    recordId?: string
  ): Promise<boolean> {
    const key = recordId ? `${resourceType}:${recordId}` : resourceType
    let mask = cache.value[key]
    if (mask === undefined) {
      try {
        const result = await api.fetch<{ bitmask: string }>(
          `/api/admin/permissions/effective?resourceType=${encodeURIComponent(resourceType)}${recordId ? `&recordId=${encodeURIComponent(recordId)}` : ''}`
        )
        mask = result.bitmask
        cache.value[key] = mask
      } catch (err) {
        console.error('Failed to load admin permissions:', err)
        return false
      }
    }
    return hasAction(mask, resourceType, action)
  }

  return { can }
}
```

### Task 6.2: Update `apps/admin/app/pages/users/index.vue`

**Files:**
- Modify: `apps/admin/app/pages/users/index.vue`

- [ ] **Step 1: Hide the Add user button and delete action**

Add to `<script setup>`:

```ts
const { can } = useAdminPermission()
const canCreate = ref(false)
const canDelete = ref(false)
onMounted(async () => {
  canCreate.value = await can('admin_user', 'create')
  canDelete.value = await can('admin_user', 'delete')
})
```

Wrap the Add user button:

```vue
<template #right>
  <UButton v-if="canCreate" to="/users/new" icon="i-lucide-plus">
    Add user
  </UButton>
</template>
```

Wrap the delete button:

```vue
<UButton
  v-if="canDelete"
  color="error"
  variant="ghost"
  icon="i-lucide-trash"
  @click="remove(user.id)"
/>
```

### Task 6.3: Update `apps/admin/app/pages/user-groups/index.vue`

**Files:**
- Modify: `apps/admin/app/pages/user-groups/index.vue`

- [ ] **Step 1: Gate the new-link prop**

This page uses `<DataTablePage>`, which does not expose row-level delete actions. Gate only the Add group link by setting `config.newLink` to `undefined` when the user lacks `admin_user_group.create`.

Use `can('admin_user_group', 'create')` for the Add group link.

### Task 6.4: Update `apps/admin/app/pages/workflow-designs/index.vue`

**Files:**
- Modify: `apps/admin/app/pages/workflow-designs/index.vue`

- [ ] **Step 1: Gate the new-link prop**

Change the config to:

```ts
const config = ref<{
  title: string
  icon: string
  table: string
  nsdb: string
  newLink?: string
  newLabel: string
}>({
  title: 'Workflow Designs',
  icon: 'i-lucide-workflow',
  table: 'workflow_designs',
  nsdb: 'platform--admin',
  newLink: undefined,
  newLabel: 'New workflow design',
})

const { can } = useAdminPermission()
onMounted(async () => {
  if (await can('workflow_design', 'create')) {
    config.value.newLink = '/workflow-designs/new'
  }
})
```

### Task 6.5: Run admin typecheck

```bash
pnpm --filter admin typecheck
```

Expected: no errors.

### Task 6.6: Commit

```bash
git add apps/admin/app/composables/useAdminPermission.ts apps/admin/app/pages/users/index.vue apps/admin/app/pages/user-groups/index.vue apps/admin/app/pages/workflow-designs/index.vue
git commit -m "feat(admin): conditionally render actions based on platform permissions"
```

---

## Phase 7 — Retire `packages/permission-poc`

### Task 9.1: Delete the package

**Files:**
- Delete: `packages/permission-poc`

- [ ] **Step 1: Remove the directory**

```bash
rm -rf packages/permission-poc
```

`pnpm-workspace.yaml` uses `packages/*`, so no workspace change is needed.

### Task 9.2: Replace `docs/40-Packages/permission-poc.md`

**Files:**
- Modify: `docs/40-Packages/permission-poc.md`

- [ ] **Step 1: Replace contents**

```markdown
---
title: permission-poc package (retired)
type: note
status: done
area: db
created: 2026-06-20
updated: 2026-06-21
package: permission-poc
related:
  - [[db package]]
  - [[20-Architecture/Decision Log/ADR-005 compound-bitmask-permissions]]
---

# permission-poc package (retired)

The proof-of-concept logic has been ported into `packages/db/src/permission-resolver.ts` and `packages/shared/src/resource-catalog.ts`. The `packages/permission-poc` directory has been removed.

For the current design, see [[20-Architecture/Decision Log/ADR-005 compound-bitmask-permissions|ADR-005]] and [[db package]].
```

### Task 9.3: Commit

```bash
git rm -r packages/permission-poc
git add docs/40-Packages/permission-poc.md
git commit -m "chore: retire permission-poc package"
```

---

## Phase 8 — Documentation

### Task 8.1: Update `docs/40-Packages/db.md`

**Files:**
- Modify: `docs/40-Packages/db.md`

- [ ] **Step 1: Add a Permission resolver section**

After the **Key modules** section, add:

```markdown
### Permission resolver

- `src/resource-types.ts` — upserts `resource_types` records from the shared catalog and builds `resource_parent` edges.
- `src/permission-resolver.ts` — resolves effective permissions by traversing `permission_assignments` and `permission_apply_to` graph edges, including ancestor propagation. Uses compound-bit checks: `(effectiveMask & actionValue) === actionValue`.
- `src/permissions.ts` — permission group CRUD, assignment, and default group provisioning.
```

Update the `updated:` frontmatter date to `2026-06-21`.

### Task 8.2: Update `docs/40-Packages/shared.md`

**Files:**
- Modify: `docs/40-Packages/shared.md`

- [ ] **Step 1: Add resource catalog note**

Add under **Key modules**:

```markdown
- `src/resource-catalog.ts` — canonical resource type catalog with compound bit mappings, default groups, and parent relationships for both platform and tenant scopes.
```

Update `updated:` to `2026-06-21`.

### Task 8.3: Create ADR-005

**Files:**
- Create: `docs/20-Architecture/Decision Log/ADR-005 compound-bitmask-permissions.md`

- [ ] **Step 1: Write the ADR**

```markdown
---
title: ADR-005 Compound bitmask permissions
type: adr
status: done
area: architecture
created: 2026-06-21
updated: 2026-06-21
---

# ADR-005 Compound bitmask permissions

## Context

The previous permission model stored a power-of-two bit per action per resource type. Adding new actions required re-indexing existing bitmasks and hard-coded action lists lived in `packages/shared/src/permissions.ts`.

## Decision

Adopt a resource-defined `bitMapping` catalog where each action is an integer mask. Compound actions include `view` plus a high bit (e.g., `edit = 3`, `create = 5` or `7`). Permission checks use `(effectiveMask & actionValue) === actionValue`.

## Consequences

- Resource types, default groups, and parent relationships are declared once in `packages/shared/src/resource-catalog.ts`.
- `permission_groups` become named containers; grants move to `permission_apply_to` edges with `bitmask`, `propagateMask`, optional `recordId`, and future `conditions`.
- The same resolver serves tenant and admin scopes by parameterizing the user-group membership edge and table.
- `packages/permission-poc` is retired.
```

### Task 8.4: Commit

```bash
git add docs/40-Packages/db.md docs/40-Packages/shared.md docs/20-Architecture/Decision\ Log/ADR-005\ compound-bitmask-permissions.md
git commit -m "docs: update permission system docs and add ADR-005"
```

---

## Phase 9 — Final verification

### Task 9.1: Run the full test suite

```bash
docker compose up -d surrealdb-test
pnpm -r test
```

Expected: all shared, db, and api unit tests pass. E2E tests may require the dev services.

### Task 9.2: Typecheck the monorepo

```bash
pnpm -r typecheck
```

Expected: no TypeScript errors.

### Task 9.3: Manual smoke test

```bash
docker compose up -d
pnpm --filter db seed
pnpm --filter api dev
pnpm --filter admin dev
```

Verify:
- Admin login works and the seeded `platform_users:admin` can access dashboard, users, user groups, and workflow designs.
- Tenant API routes (users, user-groups, workflow-designs) return 200 for permitted actions and 403 for forbidden actions.

### Task 9.4: Commit any final fixes

```bash
git add -A
git commit -m "fix: address test/typecheck findings for new permission system"
```

---

## Self-review

- [x] **Spec coverage:** Every requirement in `new_permission.md` maps to a task above.
  - Compound bit mappings → Task 1.1
  - `resource_types` table and seeding → Phase 2
  - `permission_apply_to` edges → Phase 3
  - Tenant API middleware updates → Phase 4
  - Admin site permissions → Phases 5 and 6
  - Retire `permission-poc` → Phase 7
  - Documentation → Phase 8
- [x] **Out of scope (per user):** Tenant web app UI and old-data migration are excluded; we will clean and re-seed.
- [x] **Placeholder scan:** No `TBD`, `TODO`, or "add appropriate error handling" placeholders remain.
- [x] **Type consistency:** All signatures use `ResourceType` from the catalog, `bitmask: number` on edges, and `string` for resolved masks.
- [x] **One correction applied:** Removed standalone special bits from the tenant `user_group_detail` resource per the resolved decision that record-scoped resources do not carry them.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-21-new-permission-system.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach would you like?
