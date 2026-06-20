---
title: Tenant Permission System Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-20
updated: 2026-06-20
---

# Tenant Permission System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tenant permission framework (bitmask permission groups, graph-edge assignments, user groups) and apply it to the `company` resource type plus record-level ACLs for `user_group`.

**Architecture:** A code-first permission registry in `packages/shared` defines resource types, actions, and bit values. `packages/db` stores `permission_groups` and graph edges for assignments and user-group membership. `apps/api` resolves effective permissions per request and protects routes with `requirePermission` middleware.

**Tech Stack:** TypeScript, SurrealDB (graph edges + schemaless), Hono, Vitest, pnpm monorepo.

---

## 1. File structure

- `packages/shared/src/permissions.ts` — permission registry + bitmask helpers.
- `packages/shared/src/permissions.test.ts` — unit tests.
- `packages/db/src/schema-definitions.ts` — add `permission_groups` table.
- `packages/db/src/provision.ts` — define graph edge tables and seed default groups.
- `packages/db/test/helpers.ts` — define graph edge tables in tests.
- `packages/db/src/permissions.ts` — DB functions for permission groups, assignments, and effective permissions.
- `packages/db/test/permissions.test.ts` — DB tests.
- `packages/db/src/user-groups.ts` — DB functions for user groups, membership, and record-level default groups.
- `packages/db/test/user-groups.test.ts` — DB tests.
- `apps/api/src/types.ts` — add permission cache to `TenantScope`, narrow `role`.
- `apps/api/src/middleware/permission.ts` — `requirePermission` middleware.
- `apps/api/src/middleware/permission.test.ts` — middleware tests.
- `apps/api/src/routes/companies.ts` — provision default company groups on creation.
- `apps/api/src/routes/user-groups.ts` — CRUD + membership + record-level permission checks.
- `apps/api/src/app.ts` — register user-groups route.
- `scripts/migrate-member-permissions.ts` — one-time migration for existing members.
- `docs/50-Features/Tenant Permission System.md` — update status as work progresses.

---

## 2. Tasks

### Task 1: Permission registry in `packages/shared`

**Files:**
- Create: `packages/shared/src/permissions.ts`
- Create: `packages/shared/src/permissions.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// packages/shared/src/permissions.test.ts
import { describe, it, expect } from 'vitest'
import {
  actionValue,
  actionsToBitmask,
  bitmaskToActions,
  hasAction,
  allActionsBitmask,
  DEFAULT_GROUPS,
  RESOURCE_ACTIONS,
} from './permissions.js'

describe('permissions', () => {
  it('converts actions to values and back', () => {
    expect(actionValue('company', 'manage_settings')).toBe(2n)
    expect(actionValue('user_group', 'add_member')).toBe(8n)
  })

  it('builds and decodes a bitmask', () => {
    const mask = actionsToBitmask('user_group', ['view', 'update', 'add_member'])
    expect(mask).toBe('11')
    expect(bitmaskToActions('user_group', mask)).toEqual(['view', 'update', 'add_member'])
  })

  it('checks a single action', () => {
    const mask = actionsToBitmask('company', ['view', 'manage_user_groups'])
    expect(hasAction(mask, 'company', 'view')).toBe(true)
    expect(hasAction(mask, 'company', 'invite_member')).toBe(false)
  })

  it('returns all actions for a resource type', () => {
    const mask = allActionsBitmask('user_group')
    expect(hasAction(mask, 'user_group', 'manage_permissions')).toBe(true)
  })

  it('has default groups', () => {
    expect(DEFAULT_GROUPS.company.map((g) => g.name)).toContain('Owner')
    expect(DEFAULT_GROUPS.user_group.map((g) => g.name)).toContain('Admin')
  })
})
```

- [x] **Step 2: Run the failing test**

Run: `pnpm --filter shared test permissions.test.ts`

Expected: FAIL — module not found.

- [x] **Step 3: Implement the registry**

```ts
// packages/shared/src/permissions.ts
export const RESOURCE_ACTIONS = {
  company: ['view', 'manage_settings', 'manage_permissions', 'manage_user_groups', 'invite_member', 'remove_member'],
  user_group: ['view', 'update', 'delete', 'add_member', 'remove_member', 'manage_permissions'],
  workflow_design: ['view', 'create', 'update', 'delete', 'trigger'],
} as const

export type ResourceType = keyof typeof RESOURCE_ACTIONS
export type PermissionAction<T extends ResourceType = ResourceType> =
  (typeof RESOURCE_ACTIONS)[T][number]

export function actionValue(resourceType: ResourceType, action: PermissionAction): bigint {
  const actions = RESOURCE_ACTIONS[resourceType]
  const idx = actions.indexOf(action as (typeof RESOURCE_ACTIONS)[typeof resourceType][number])
  if (idx === -1) throw new Error(`Unknown action ${action} for ${resourceType}`)
  return 1n << BigInt(idx)
}

export function actionsToBitmask(
  resourceType: ResourceType,
  actions: PermissionAction[]
): string {
  let mask = 0n
  for (const action of actions) {
    mask |= actionValue(resourceType, action)
  }
  return mask.toString()
}

export function bitmaskToActions(
  resourceType: ResourceType,
  bitmask: string | bigint
): PermissionAction[] {
  const mask = typeof bitmask === 'string' ? BigInt(bitmask) : bitmask
  const actions = RESOURCE_ACTIONS[resourceType]
  return actions.filter((_, i) => (mask & (1n << BigInt(i))) !== 0n)
}

export function hasAction(
  bitmask: string | bigint,
  resourceType: ResourceType,
  action: PermissionAction
): boolean {
  const mask = typeof bitmask === 'string' ? BigInt(bitmask) : bitmask
  return (mask & actionValue(resourceType, action)) !== 0n
}

export function allActionsBitmask(resourceType: ResourceType): string {
  const actions = RESOURCE_ACTIONS[resourceType]
  return ((1n << BigInt(actions.length)) - 1n).toString()
}

export const DEFAULT_GROUPS: Record<
  ResourceType,
  Array<{ name: string; actions: PermissionAction[] }>
> = {
  company: [
    { name: 'Owner', actions: ['view', 'manage_settings', 'manage_permissions', 'manage_user_groups', 'invite_member', 'remove_member'] },
    { name: 'Admin', actions: ['view', 'manage_settings', 'manage_permissions', 'manage_user_groups', 'invite_member', 'remove_member'] },
    { name: 'Member', actions: ['view'] },
  ],
  user_group: [
    { name: 'Owner', actions: ['view', 'update', 'delete', 'add_member', 'remove_member', 'manage_permissions'] },
    { name: 'Admin', actions: ['view', 'update', 'add_member', 'remove_member'] },
    { name: 'Member', actions: ['view'] },
  ],
  workflow_design: [
    { name: 'Owner', actions: ['view', 'create', 'update', 'delete', 'trigger'] },
    { name: 'Editor', actions: ['view', 'create', 'update', 'trigger'] },
    { name: 'Viewer', actions: ['view'] },
  ],
}
```

- [x] **Step 4: Run the passing test**

Run: `pnpm --filter shared test permissions.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/shared/src/permissions.ts packages/shared/src/permissions.test.ts
git commit -m "feat(shared): add permission registry and bitwise helpers"
```

---

### Task 2: Database schema for permission groups and edges

**Files:**
- Modify: `packages/db/src/schema-definitions.ts`
- Modify: `packages/db/src/provision.ts`
- Modify: `packages/db/test/helpers.ts`

- [x] **Step 1: Add `permission_groups` to tenant schemas**

```ts
// packages/db/src/schema-definitions.ts
// Inside TENANT_TABLE_SCHEMAS, add:
  table('permission_groups', 'Permission Groups', [
    column('resourceType', 'string', 'text'),
    column('recordId', 'string', 'text', { optional: true }),
    column('name', 'string', 'text'),
    column('bitmask', 'string', 'text'),
    column('isSystem', 'boolean', 'checkbox'),
    column('description', 'string', 'text', { optional: true }),
  ]),
  table('user_groups', 'User Groups', [
    column('name', 'string', 'text'),
    column('description', 'string', 'text', { optional: true }),
  ]),
```

- [x] **Step 2: Define graph edge tables**

In `packages/db/src/provision.ts`, after the existing index definitions, add:

```ts
      DEFINE TABLE IF NOT EXISTS user_group_memberships TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_user_group_memberships_in ON user_group_memberships FIELDS in;
      DEFINE INDEX IF NOT EXISTS idx_user_group_memberships_out ON user_group_memberships FIELDS out;
      DEFINE INDEX IF NOT EXISTS idx_user_group_memberships_unique ON user_group_memberships FIELDS in, out UNIQUE;

      DEFINE TABLE IF NOT EXISTS permission_assignments TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_permission_assignments_in ON permission_assignments FIELDS in;
      DEFINE INDEX IF NOT EXISTS idx_permission_assignments_out ON permission_assignments FIELDS out;
      DEFINE INDEX IF NOT EXISTS idx_permission_assignments_resource ON permission_assignments FIELDS resourceType, recordId;
      DEFINE INDEX IF NOT EXISTS idx_permission_assignments_unique ON permission_assignments FIELDS in, resourceType, recordId UNIQUE;
```

Add the same block to `packages/db/test/helpers.ts` inside `createTenantNamespace`.

- [x] **Step 3: Type-check the db package**

Run: `pnpm --filter db typecheck`

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/db/src/schema-definitions.ts packages/db/src/provision.ts packages/db/test/helpers.ts
git commit -m "feat(db): add permission_groups, user_groups, and graph edge tables"
```

---

### Task 3: DB functions for permission groups and assignments

**Files:**
- Create: `packages/db/src/permissions.ts`
- Create: `packages/db/test/permissions.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// packages/db/test/permissions.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createPermissionGroup,
  listPermissionGroups,
  assignPermissionGroup,
  removePermissionGroup,
  getEffectivePermissions,
  provisionDefaultCompanyGroups,
} from '../src/permissions.js'
import { createMember } from '../src/tenant.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'

describe('permissions', () => {
  let namespace: string

  beforeEach(async () => {
    namespace = uniqueTenantName()
    await createTenantNamespace(namespace)
  })

  afterEach(async () => {
    await removeTenantNamespace(namespace)
  })

  it('creates a group and resolves effective permissions', async () => {
    const member = await createMember(namespace, { email: 'm@example.com', role: 'member' })
    const group = await createPermissionGroup(namespace, {
      resourceType: 'company',
      name: 'Viewer',
      bitmask: '1',
      isSystem: false,
    })
    await assignPermissionGroup(namespace, member.id, group.id)
    const mask = await getEffectivePermissions(namespace, member.id, 'company', member.role)
    expect(mask).toBe('1')
  })

  it('gives owners all permissions', async () => {
    const owner = await createMember(namespace, { email: 'o@example.com', role: 'owner' })
    const mask = await getEffectivePermissions(namespace, owner.id, 'company', owner.role)
    expect(BigInt(mask)).toBe(63n)
  })

  it('provisions default company groups', async () => {
    const owner = await createMember(namespace, { email: 'o2@example.com', role: 'owner' })
    await provisionDefaultCompanyGroups(namespace, owner.id)
    const groups = await listPermissionGroups(namespace, 'company')
    expect(groups.map((g) => g.name)).toEqual(['Owner', 'Admin', 'Member'])
  })
})
```

- [x] **Step 2: Run the failing test**

Run: `pnpm --filter db test permissions.test.ts`

Expected: FAIL — functions not found.

- [x] **Step 3: Implement the DB functions**

```ts
// packages/db/src/permissions.ts
import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import { actionsToBitmask, allActionsBitmask, type ResourceType } from 'shared'

export interface PermissionGroupRecord {
  id: string
  resourceType: string
  recordId?: string
  name: string
  bitmask: string
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
  bitmask: string
  isSystem?: boolean
  description?: string
}

export async function createPermissionGroup(
  namespace: string,
  input: PermissionGroupInput
): Promise<PermissionGroupRecord> {
  const surreal = await getSurreal(namespace, 'main')
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
  resourceType: string,
  recordId?: string
): Promise<PermissionGroupRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const query = recordId
      ? 'SELECT * FROM permission_groups WHERE resourceType = $resourceType AND recordId = $recordId ORDER BY name'
      : 'SELECT * FROM permission_groups WHERE resourceType = $resourceType AND recordId IS NONE ORDER BY name'
    const [groups] = await surreal.query<[PermissionGroupRecord[]]>(query, { resourceType, recordId })
    return normalizeIds(groups)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPermissionGroupById(
  namespace: string,
  id: string
): Promise<PermissionGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
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
  id: string,
  input: Partial<PermissionGroupInput>
): Promise<PermissionGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
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

export async function deletePermissionGroup(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE type::record($id)', { id })
    await surreal.query('DELETE permission_assignments WHERE out = type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export async function assignPermissionGroup(
  namespace: string,
  assigneeId: string,
  groupId: string
): Promise<void> {
  const group = await getPermissionGroupById(namespace, groupId)
  if (!group) throw new Error(`Permission group not found: ${groupId}`)

  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query(
      'RELATE type::record($assigneeId)->permission_assignments->type::record($groupId) SET resourceType = $resourceType, recordId = $recordId',
      { assigneeId, groupId, resourceType: group.resourceType, recordId: group.recordId ?? null }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function removePermissionGroup(
  namespace: string,
  assigneeId: string,
  groupId: string
): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
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
  assigneeId: string
): Promise<PermissionGroupRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<
      Array<{ out: PermissionGroupRecord }>
    >(
      'SELECT out.* AS out FROM permission_assignments WHERE in = type::record($assigneeId)',
      { assigneeId }
    )
    return normalizeIds(rows.map((r) => r.out))
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getEffectivePermissions(
  namespace: string,
  memberId: string,
  resourceType: ResourceType,
  role?: string,
  recordId?: string
): Promise<string> {
  if (role === 'owner') {
    return allActionsBitmask(resourceType)
  }

  const memberGroups = await getMemberUserGroups(namespace, memberId)
  let mask = 0n

  const directGroups = await listPermissionAssignments(namespace, memberId)
  for (const group of directGroups) {
    if (group.resourceType === resourceType && group.recordId === recordId) {
      mask |= BigInt(group.bitmask)
    }
  }

  for (const userGroup of memberGroups) {
    const groupAssignments = await listPermissionAssignments(namespace, userGroup.id)
    for (const group of groupAssignments) {
      if (group.resourceType === resourceType && group.recordId === recordId) {
        mask |= BigInt(group.bitmask)
      }
    }
  }

  return mask.toString()
}

async function getMemberUserGroups(
  namespace: string,
  memberId: string
): Promise<Array<{ id: string }>> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<
      Array<{ out: { id: string } }>
    >(
      'SELECT out.id AS id FROM user_group_memberships WHERE in = type::record($memberId)',
      { memberId }
    )
    return rows.map((r) => ({ id: String(r.out.id) }))
  } finally {
    await closeSurreal(surreal)
  }
}

export async function provisionDefaultCompanyGroups(
  namespace: string,
  ownerMemberId: string
): Promise<void> {
  const { DEFAULT_GROUPS } = await import('shared')
  for (const group of DEFAULT_GROUPS.company) {
    const created = await createPermissionGroup(namespace, {
      resourceType: 'company',
      name: group.name,
      bitmask: actionsToBitmask('company', group.actions),
      isSystem: true,
    })
    if (group.name === 'Owner') {
      await assignPermissionGroup(namespace, ownerMemberId, created.id)
    }
  }
}
```

- [x] **Step 4: Run the passing test**

Run: `pnpm --filter db test permissions.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/db/src/permissions.ts packages/db/test/permissions.test.ts
git commit -m "feat(db): add permission group and assignment helpers"
```

---

### Task 4: DB functions for user groups

**Files:**
- Create: `packages/db/src/user-groups.ts`
- Create: `packages/db/test/user-groups.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// packages/db/test/user-groups.test.ts
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
    const member = await createMember(namespace, { email: 'o@example.com', role: 'owner' })
    const group = await createUserGroupWithDefaults(namespace, { name: 'Engineering' }, member.id)
    expect(group.id).toMatch(/^user_groups:/)

    const groups = await listUserGroups(namespace)
    expect(groups).toHaveLength(1)

    const mask = await getEffectivePermissions(namespace, member.id, 'user_group', member.role, group.id)
    expect(BigInt(mask)).toBe(63n)
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

- [x] **Step 2: Run the failing test**

Run: `pnpm --filter db test user-groups.test.ts`

Expected: FAIL — functions not found.

- [x] **Step 3: Implement the DB functions**

```ts
// packages/db/src/user-groups.ts
import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import { actionsToBitmask, DEFAULT_GROUPS } from 'shared'
import { createPermissionGroup, assignPermissionGroup, listPermissionGroups } from './permissions.js'

export interface UserGroupRecord {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface UserGroupInput {
  name: string
  description?: string
}

export async function createUserGroup(
  namespace: string,
  input: UserGroupInput
): Promise<UserGroupRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const now = new Date().toISOString()
    const data = { ...input, createdAt: now, updatedAt: now }
    const [created] = await surreal.query<[UserGroupRecord[]]>(
      'CREATE user_groups CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listUserGroups(namespace: string): Promise<UserGroupRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [groups] = await surreal.query<[UserGroupRecord[]]>('SELECT * FROM user_groups ORDER BY name')
    return normalizeIds(groups)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getUserGroupById(
  namespace: string,
  id: string
): Promise<UserGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[UserGroupRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateUserGroup(
  namespace: string,
  id: string,
  input: Partial<UserGroupInput>
): Promise<UserGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = { ...input, updatedAt: new Date().toISOString() }
    const [updated] = await surreal.query<[UserGroupRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteUserGroup(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE user_group_memberships WHERE out = type::record($id)', { id })
    const groups = await listPermissionGroups(namespace, 'user_group', id)
    for (const group of groups) {
      await surreal.query('DELETE permission_assignments WHERE out = type::record($id)', { id: group.id })
      await surreal.query('DELETE type::record($id)', { id: group.id })
    }
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export async function addUserGroupMember(
  namespace: string,
  memberId: string,
  userGroupId: string
): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query(
      'RELATE type::record($memberId)->user_group_memberships->type::record($userGroupId)',
      { memberId, userGroupId }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function removeUserGroupMember(
  namespace: string,
  memberId: string,
  userGroupId: string
): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query(
      'DELETE user_group_memberships WHERE in = type::record($memberId) AND out = type::record($userGroupId)',
      { memberId, userGroupId }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listUserGroupMembers(
  namespace: string,
  userGroupId: string
): Promise<Array<{ id: string }>> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<
      Array<{ in: { id: string } }>
    >(
      'SELECT in.id AS id FROM user_group_memberships WHERE out = type::record($userGroupId)',
      { userGroupId }
    )
    return rows.map((r) => ({ id: String(r.in.id) }))
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createUserGroupWithDefaults(
  namespace: string,
  input: UserGroupInput,
  creatorMemberId: string
): Promise<UserGroupRecord> {
  const group = await createUserGroup(namespace, input)
  for (const defaultGroup of DEFAULT_GROUPS.user_group) {
    const created = await createPermissionGroup(namespace, {
      resourceType: 'user_group',
      recordId: group.id,
      name: defaultGroup.name,
      bitmask: actionsToBitmask('user_group', defaultGroup.actions),
      isSystem: true,
    })
    if (defaultGroup.name === 'Owner') {
      await assignPermissionGroup(namespace, creatorMemberId, created.id)
    }
  }
  return group
}
```

- [x] **Step 4: Run the passing test**

Run: `pnpm --filter db test user-groups.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/db/src/user-groups.ts packages/db/test/user-groups.test.ts
git commit -m "feat(db): add user groups with record-level default permission groups"
```

---

### Task 5: Provision default company groups on company creation

**Files:**
- Modify: `apps/api/src/routes/companies.ts`

- [x] **Step 1: Import the provisioning helper**

```ts
// apps/api/src/routes/companies.ts
import { provisionDefaultCompanyGroups } from 'db/permissions'
```

- [x] **Step 2: Assign owner and provision groups**

Replace the existing `createMember` call with:

```ts
    const ownerMember = await createMember(company.namespace, {
      email: '',
      profileId: scope.profileId,
      role: 'owner',
      status: 'active',
      inviteCode: null,
    })

    await provisionDefaultCompanyGroups(company.namespace, ownerMember.id)
```

- [x] **Step 3: Run the db provision test**

Run: `pnpm --filter db test provision.test.ts`

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add apps/api/src/routes/companies.ts
git commit -m "feat(api): provision default company permission groups for new companies"
```

---

### Task 6: Permission middleware

**Files:**
- Modify: `apps/api/src/types.ts`
- Create: `apps/api/src/middleware/permission.ts`
- Create: `apps/api/src/middleware/permission.test.ts`

- [x] **Step 1: Update `TenantScope`**

```ts
// apps/api/src/types.ts
export interface TenantScope {
  type: 'tenant'
  namespace: string
  database: string
  accountId: string
  profileId: string
  memberId: string
  role: 'owner' | 'member'
  permissions?: Record<string, string>
}
```

- [x] **Step 2: Write the failing middleware test**

```ts
// apps/api/src/middleware/permission.test.ts
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
        permissions: bitmask ? { company: bitmask } : undefined,
      } satisfies TenantScope)
      await next()
    })
    app.get('/settings', requirePermission('company', 'manage_settings'), (c) => c.json({ ok: true }))
    return app
  }

  it('allows the action when the bit is set', async () => {
    const app = buildApp('3', 'member') // view + manage_settings
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

- [x] **Step 3: Run the failing test**

Run: `pnpm --filter api test src/middleware/permission.test.ts`

Expected: FAIL — middleware not found.

- [x] **Step 4: Implement the middleware**

```ts
// apps/api/src/middleware/permission.ts
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
    return scope.permissions[key]
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

- [x] **Step 5: Run the passing test**

Run: `pnpm --filter api test src/middleware/permission.test.ts`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/api/src/types.ts apps/api/src/middleware/permission.ts apps/api/src/middleware/permission.test.ts
git commit -m "feat(api): add requirePermission middleware with record-level support"
```

---

### Task 7: User group API routes

**Files:**
- Create: `apps/api/src/routes/user-groups.ts`
- Modify: `apps/api/src/app.ts`

- [x] **Step 1: Create the user group routes**

```ts
// apps/api/src/routes/user-groups.ts
import { Hono } from 'hono'
import {
  createUserGroupWithDefaults,
  listUserGroups,
  getUserGroupById,
  updateUserGroup,
  deleteUserGroup,
  addUserGroupMember,
  removeUserGroupMember,
  listUserGroupMembers,
} from 'db/user-groups'
import { tenantAuth } from '../middleware/tenant.js'
import { requirePermission } from '../middleware/permission.js'
import type { TenantScope } from '../types.js'

export function userGroupsRoutes() {
  const app = new Hono()
  app.use(tenantAuth)

  app.get('/', requirePermission('company', 'manage_user_groups'), async (c) => {
    const scope = c.get('scope') as TenantScope
    return c.json(await listUserGroups(scope.namespace))
  })

  app.post('/', requirePermission('company', 'manage_user_groups'), async (c) => {
    const scope = c.get('scope') as TenantScope
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const name = body.name
    if (!name || typeof name !== 'string') {
      return c.json({ error: 'Name required' }, 400)
    }
    const group = await createUserGroupWithDefaults(
      scope.namespace,
      { name, description: typeof body.description === 'string' ? body.description : undefined },
      scope.memberId
    )
    return c.json(group)
  })

  app.get('/:id', requirePermission('user_group', 'view', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    const group = await getUserGroupById(scope.namespace, c.req.param('id'))
    if (!group) return c.json({ error: 'Not found' }, 404)
    return c.json(group)
  })

  app.patch('/:id', requirePermission('user_group', 'update', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    const id = c.req.param('id')
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const update: { name?: string; description?: string } = {}
    if (typeof body.name === 'string') update.name = body.name
    if (typeof body.description === 'string') update.description = body.description
    return c.json(await updateUserGroup(scope.namespace, id, update))
  })

  app.delete('/:id', requirePermission('user_group', 'delete', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    await deleteUserGroup(scope.namespace, c.req.param('id'))
    return c.json({ ok: true })
  })

  app.get('/:id/members', requirePermission('user_group', 'view', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    return c.json(await listUserGroupMembers(scope.namespace, c.req.param('id')))
  })

  app.post('/:id/members', requirePermission('user_group', 'add_member', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const memberId = body.memberId
    if (!memberId || typeof memberId !== 'string') {
      return c.json({ error: 'memberId required' }, 400)
    }
    await addUserGroupMember(scope.namespace, memberId, c.req.param('id'))
    return c.json({ ok: true })
  })

  app.delete('/:id/members/:memberId', requirePermission('user_group', 'remove_member', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    await removeUserGroupMember(scope.namespace, c.req.param('memberId'), c.req.param('id'))
    return c.json({ ok: true })
  })

  return app
}
```

- [x] **Step 2: Register the route in `app.ts`**

```ts
// apps/api/src/app.ts
import { userGroupsRoutes } from './routes/user-groups.js'

// inside createApp(), add:
app.route('/api/user-groups', userGroupsRoutes())
```

- [x] **Step 3: Type-check the API package**

Run: `pnpm --filter api typecheck`

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add apps/api/src/routes/user-groups.ts apps/api/src/app.ts
git commit -m "feat(api): add user group routes with permission checks"
```

---

### Task 8: Apply company permissions to member routes

**Files:**
- Modify: `apps/api/src/routes/users.ts`

- [x] **Step 1: Replace role checks with permission checks**

Remove the local `requireRole` helper and use `requirePermission('company', ...)`.

```ts
// apps/api/src/routes/users.ts
import { requirePermission } from '../middleware/permission.js'

// Replace existing role checks:
// GET /   -> requirePermission('company', 'view')
// POST /  -> requirePermission('company', 'invite_member')
// PATCH /:id role/status -> requirePermission('company', 'manage_permissions')
// DELETE /:id -> requirePermission('company', 'remove_member')
```

For example, the `POST /` handler should start with:

```ts
  app.post('/', requirePermission('company', 'invite_member'), async (c) => {
    // existing body, but remove the role === 'owner' guard for inviting owners
  })
```

Owner-specific guards (e.g. "Only owners can invite owners") can remain as an extra check using `scope.role === 'owner'`.

Also update the local `VALID_ROLES` set and invite role validation:

```ts
const VALID_ROLES = new Set(['owner', 'member'])
```

And when validating the invited role, reject `'admin'`:

```ts
const validRoles: Array<'owner' | 'member'> = ['owner', 'member']
```

- [x] **Step 2: Update `MemberRecord` and `MemberInput` role types**

In `packages/db/src/tenant.ts`, change:

```ts
export interface MemberRecord {
  // ...
  role: 'owner' | 'member'
  // ...
}

export interface MemberInput {
  // ...
  role: 'owner' | 'member'
  // ...
}
```

- [x] **Step 3: Update existing tests that use the old `admin` role**

In `packages/db/test/tenant.test.ts`, replace any `role: 'admin'` with `role: 'member'` or `role: 'owner'` as appropriate for the test.

- [x] **Step 4: Type-check and run tests**

Run:

```bash
pnpm --filter db typecheck
pnpm --filter api typecheck
pnpm --filter db test tenant.test.ts
pnpm --filter api test
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/routes/users.ts packages/db/src/tenant.ts packages/db/test/tenant.test.ts
git commit -m "feat(api): protect member routes with company permissions"
```

---

### Task 9: Migration script for existing members

**Status:** Skipped — the database is new and there are no legacy members to migrate.

**Files:**
- ~~Create: `scripts/migrate-member-permissions.ts`~~

- [x] **Step 1: Write the migration script** — not required for a fresh DB.

- [x] **Step 2: Run the migration locally** — not required for a fresh DB.

- [x] **Step 3: Commit** — nothing to commit.

---

### Task 10: Permission registry endpoint

**Files:**
- Create: `apps/api/src/routes/permissions.ts`
- Modify: `apps/api/src/app.ts`

- [x] **Step 1: Create the registry route**

```ts
// apps/api/src/routes/permissions.ts
import { Hono } from 'hono'
import { RESOURCE_ACTIONS } from 'shared'

export function permissionsRoutes() {
  const app = new Hono()

  app.get('/actions', (c) => {
    const resourceType = c.req.query('resourceType')
    if (!resourceType || !(resourceType in RESOURCE_ACTIONS)) {
      return c.json({ error: 'Invalid or missing resourceType' }, 400)
    }
    const actions = RESOURCE_ACTIONS[resourceType as keyof typeof RESOURCE_ACTIONS]
    const result = actions.map((action, i) => ({
      action,
      value: Number(1n << BigInt(i)),
    }))
    return c.json({ resourceType, actions: result })
  })

  return app
}
```

- [x] **Step 2: Register the route**

```ts
// apps/api/src/app.ts
import { permissionsRoutes } from './routes/permissions.js'

// inside createApp(), add:
app.route('/api/permissions', permissionsRoutes())
```

- [x] **Step 3: Test the endpoint**

Run: `pnpm --filter api dev` and request `GET /api/permissions/actions?resourceType=company`.

Expected: JSON with action names and power-of-two values.

- [x] **Step 4: Commit**

```bash
git add apps/api/src/routes/permissions.ts apps/api/src/app.ts
git commit -m "feat(api): expose permission action registry for frontend"
```

---

### Task 11: Documentation and verification

**Files:**
- Modify: `docs/50-Features/Tenant Permission System.md`

- [x] **Step 1: Update the feature note status**

Change the frontmatter status from `planned` to `in-progress` while work is ongoing, then to `done` when complete.

- [x] **Step 2: Run the full test suites**

```bash
pnpm install
pnpm -r build
pnpm --filter shared test
pnpm --filter db test
pnpm --filter api test
```

Expected: all suites pass.

- [x] **Step 3: Manual smoke test**

```bash
docker compose up -d
pnpm --filter db seed
pnpm --filter api dev
```

- Create a company; the creator should be a company owner.
- As owner, create a user group.
- Invite a member and assign them to the user group.
- Verify a non-owner without `company:manage_user_groups` cannot create user groups.
- Verify a non-member of a user group cannot view it without the record-level `user_group:view` permission.

- [x] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: tenant permission system smoke-test fixes"
```

---

## 3. Self-review

### 3.1 Spec coverage

| Requirement | Task |
|-------------|------|
| User groups separate from permission groups | Task 4 |
| Multiple user-group membership | Task 4 (`user_group_memberships`) |
| One permission group per resource/record per assignee | Task 3 (`permission_assignments` unique index) |
| Bitwise bitmask storage | Task 1 + Task 3 (`bitmask` column) |
| Graph edges for membership and assignment | Task 2 + Task 3 + Task 4 |
| Company owner short-cut | Task 3 (`getEffectivePermissions`), Task 6 (middleware) |
| `company` resource type first | Task 3 + Task 5 + Task 8 |
| `user_group` record-level ACLs | Task 4 + Task 7 |
| Frontend action mapping | Task 10 |

### 3.2 Placeholder scan

- No `TBD`, `TODO`, or vague "implement X" steps remain.
- Every code step includes actual file content or exact command.
- Type names (`ResourceType`, `PermissionAction`, `TenantScope`, etc.) are consistent across tasks.

### 3.3 Known gaps / follow-ups

- `workflow_design` and other workflow resources still use the old role checks.
- UI screens for group management are not covered.
- System default group editability policy is left as an open product decision.
