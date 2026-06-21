---
title: permission-poc package
type: package
status: done
area: db
created: 2026-06-20
updated: 2026-06-20
package: permission-poc
related:
  - [[db package]]
  - [[Data Model]]
  - [[Testing]]
  - [[Benchmarking]]
---

# permission-poc package

## Purpose

A self-contained proof-of-concept for a permission model based on permission groups, resource hierarchies, and record-scoped grants. It connects to the isolated test SurrealDB namespace `permission_poc_test` and does not touch `apps/api` or `packages/db` permission logic.

## Location

`packages/permission-poc`

## Key modules

- `src/client.ts` — SurrealDB connection helpers for the POC namespace.
- `src/schema.ts` — SurrealQL schema and `resetPermissionPocNamespace()` for a clean test run.
- `src/model.ts` — typed seed helpers for resources, permission groups, members, user groups, and edges.
- `src/resolver.ts` — `resolveEffectivePermissions(...)` with Surreal recursive and JS traversal variants.
- `src/perf.ts` — benchmark script measuring scaling and traversal strategies.

## Schema

Namespace: `permission_poc_test`
Database: `main`

Tables:

- `resource` (`name`, `actions`, `parents`)
- `permission_group` (`name`, `isSystem`)
- `poc_member` (`name`)
- `poc_user_group` (`name`)

Edges:

- `member_of_user_group` (`poc_member` → `poc_user_group`)
- `resource_parent` (`resource` → `resource`)
- `permission_apply_to` (`permission_group` → `resource`, `bitmask`, `propagateMask`, `recordId`)
- `assign_permission_to` (`poc_member | poc_user_group` → `permission_group`)

Indexes are defined on all relation fields and common lookup fields.

## Scripts

```bash
# Run the Vitest suite against the test SurrealDB instance (port 8001)
docker compose up -d surrealdb-test
pnpm --filter permission-poc test

# Run the performance benchmark
pnpm --filter permission-poc benchmark

# Type-check the package
pnpm --filter permission-poc typecheck
```

Tests reset the `permission_poc_test` namespace before each test but leave it in place afterward so it can be inspected manually. The benchmark resets the namespace at the start of each scenario.

## Resolver behavior

`resolveEffectivePermissions(memberId, resourceId, opts?)` returns `{ bitmask, actions }` where the bitmask is aligned to the target resource's `actions` list.

1. Collect permission groups assigned directly to the member or via any user group the member belongs to.
2. OR the `bitmask` of any `permission_apply_to` edges on the target resource. If `opts.recordId` is provided, both matching record-scoped edges and type-level edges apply.
3. Collect ancestors using either SurrealDB's recursive graph idiom (`resolveSurreal`) or JS traversal (`resolveJs`).
4. Before inheriting from an ancestor, check that the member has at least `view` on that ancestor using only direct/type-level grants. Skip invisible ancestors.
5. For visible ancestors, OR `bitmask & propagateMask` into the effective mask.
6. Cycles are handled by the Surreal `+collect` algorithm and by a JS visited set.

Child resources must declare action lists that start with each parent's action list in the same order. `createResource` enforces this alignment.

## API endpoints

`src/api.ts` exposes higher-level, API-style functions on top of the resolver.

### `getMemberResourcePermissions(surreal, memberId, resourceId, opts?)`

Returns `MemberResourcePermissions`:

- `effectiveBitmask` — integer bitmask aligned to the target resource's `actions` list.
- `actions` — one entry per resource action with:
  - `action` — action name.
  - `granted` — whether the member can perform the action.
  - `sources` — every permission grant that contributes to the action.

Each source is either:

- `direct` — a `permission_apply_to` edge on the target resource itself, with `edgeId`, `groupId`, `groupName`, `bitmask`, and optional `recordId` for record-scoped grants.
- `inherited` — a `permission_apply_to` edge on an ancestor resource, with `edgeId`, `groupId`, `groupName`, `bitmask`, `propagateMask`, `fromResourceId`, and `fromResourceName`.

If multiple sources grant the same action, all are listed. Invisible ancestors are skipped using the same view-gate logic as the resolver.

### `batchCheckPermissions(surreal, memberId, resourceId, actions[], opts?)`

Returns `Record<string, boolean>`. Each requested action is resolved against the effective bitmask. Unknown actions resolve to `false`.

### `explainPermission(surreal, memberId, resourceId, action, opts?)`

Returns `PermissionExplanation`:

- `granted` — boolean result.
- `sources` — sources when granted.
- `deniedReason` — either `'unknown action'` or `'no matching permission grant'` when not granted.

### `listResourceMembers(surreal, resourceId, opts?)`

Reverse lookup: returns members who are directly assigned to any permission group linked to the resource. For the POC, only direct member assignments are returned; user-group membership is not exploded recursively.

Each result contains `memberId`, `memberName`, `effectiveBitmask`, and `actions[]`. The bitmask is the OR of all matching `permission_apply_to` bitmasks on the resource for that member's assigned groups.

### `hasPermission(surreal, memberId, resourceId, action, opts?)`

Re-exported from `src/resolver.ts` for API symmetry.

## Benchmarks

The benchmark script measures:

- Resource chain depth: 10 → 10,000 resources.
- Assigned permission groups: 1 → 1,000 groups.
- User group membership: 1 → 500 user groups.
- DAG complexity: 2 → 20 parent folders.
- `resolveSurreal` vs `resolveJs` on a 50-level chain.
- Surreal recursive ancestor collection latency.
- Edge lookup vs array-field lookup for parents.

## Related

- [[db package]]
- [[Data Model]]

## Resource Table

since the resource may not map to a single database table, and we need to also list what table it maps to. and it include the recordId or not. folllowing are list of all resource and their bitmask permissions, default permission groups, and table mappings.

remark, in admin 128 is special, update_view, is the permission to update the _view settings, since we have parentResourceType, so all inherited permission must use same bit to store.
also platform are special resource, it is the root resource of the admin site, and it is not mapped to a database table. and all other resoures inherit from it.

### admin site (platform)
- platform
  - table : none
  - has recordId : no
  - permissions: 128 update_view
  - default group:
    - owner : bitmask 128 (all), propagateMask: 128(all)
    - admin : bitmask 128 (all), propagateMask: 128(all)
- admin_user
  - table : platform_user
  - has recordId : no
  - permissions: 1 view, 3 edit, 5 create, 9 delete
  - parentResourceType: platform
  - default group:
    - owner : bitmask 15 (all), propagateMask: 15(all)
    - admin : bitmask 15 (all), propagateMask: 15(all)
    - user : bitmask 1 (view), propagateMask: 0
- admin_user_details
  - table : platform_user_details
  - has recordId : yes
  - permissions: 1 view, 3 edit, 5 create, 9 delete
  - parentResourceType: admin_user
  - default group:
    - owner : bitmask 15 (all), propagateMask: 15(all)
- admin_user_groups
  - table : platform_user_groups
  - has recordId : no
  - permissions: 1 view, 3 edit_info, 5 create, 9 delete, 19 add_member (view + edit_info), 35 remove_member (view + edit_info)
  - parentResourceType: platform
  - default group:
    - owner : bitmask 63 (all), propagateMask: 63(all)
    - admin : bitmask 63 (all), propagateMask: 63(all)
    - user : bitmask 1 (view), propagateMask: 0
- admin_user_group_details
  - table : platform_user_groups
  - has recordId : yes
  - permissions: 1 view, 3 edit, 5 create, 9 delete,  19 add_member (view + edit_info), 35 remove_member (view + edit_info)
  - parentResourceType: admin_user_groups
  - default group:
    - owner : bitmask 63 (all), propagateMask: 63(all),
- companies
  - table : companies
  - has recordId : no
  - permissions: 1 view, 3 edit, 5 create, 9 delete, 19 add_member (view + edit_info), 35 remove_member (view + edit_info)
  - parentResourceType: platform
  - default group:
    - owner : bitmask 63 (all), propagateMask: 63(all)
    - admin : bitmask 63 (all), propagateMask: 63(all)
    - user : bitmask 1 (view), propagateMask: 0
- company_members
  - table : user_profiles
  - has recordId : no
  - permissions: 1 view, 3 edit, 5 create, 9 delete, 19 assign_company (view + edit_info), 35 remove_company (view + edit_info)
  - parentResourceType: companies
  - default group:
    - owner : bitmask 63 (all), propagateMask: 63(all)
    - admin : bitmask 63 (all), propagateMask: 63(all)
    - user : bitmask 1 (view), propagateMask: 0
- workflow_design
  - table : workflow_design
  - has recordId : no
  - permissions: 1 view, 3 edit, 7 create(view + edit), 9 delete, 19 publish (view + edit)
  - default group:
    - owner : bitmask 63 (all), propagateMask: 63(all)
    - admin : bitmask 63 (all), propagateMask: 63(all)
    - user : bitmask 1 (view), propagateMask: 0
- workflow_design_details
  - table : workflow_design_details
  - has recordId : yes
  - permissions: 1 view, 3 edit, 7 create(view + edit), 9 delete, 19 publish (view + edit)
  - parentResourceType: workflow_design
  - default group:
    - owner : bitmask 63 (all), propagateMask: 63(all)

### Web (tenent site)

same as platform "platform" resource, tenent has a tenent resource for overall tenent control, and all other tenent resources are inherited from this resource. like the platform resource, bit 128 is used to update the default view settings.

- tenent
  - table: none
  - has recordId: no
  - permissions: 1 view, 3 edit, 7 create(view + edit), 9 delete, 129 update_default_view_settings
  - default group:
    - owner : bitmask 143 (all), propagateMask: 143(all)
    - admin : bitmask 143 (all), propagateMask: 143(all)
- member
  - table: members
  - has recordId: no
  - permissions: 1 view, 3 edit, 7 create(view + edit), 9 delete (view)
  - - parentResourceType: tenent
  - default group:
    - owner : bitmask 15(all), propagateMask: 15(all)
    - admin : bitmask 15(all), propagateMask: 15(all)
- user_groups
  - table : user_groups
  - has recordId : no
  - permissions: 1 view, 3 edit_info, 5 create, 9 delete, 19 add_member (view + edit_info), 35 remove_member (view + edit_info)
  - parentResourceType: platform
  - default group:
    - owner : bitmask 63 (all), propagateMask: 63(all)
    - admin : bitmask 63 (all), propagateMask: 63(all)
    - user : bitmask 1 (view), propagateMask: 0
- user_group_details
  - table : user_groups
  - has recordId : yes
  - permissions: 1 view, 3 edit, 5 create, 9 delete,  19 add_member (view + edit_info), 35 remove_member (view + edit_info), 128 update_default_view_settings, 256 manage_permissions
  - parentResourceType: admin_user_groups
  - default group:
    - owner : bitmask 63 (all), propagateMask: 63(all),
- workflow_design
  - table: workflow_designs
  - has recordId: no
  - permissions: 1 view, 3 edit, 5 create, 9 delete, 128 update_default_view_settings, 256 manage_permissions
  - parentResourceType: tenent
  - default group:
    - owner : bitmask 143 (all), propagateMask: 143(all)
    - admin : bitmask 143 (all), propagateMask: 143(all)
    - user : bitmask 1 (view), propagateMask: 0
- workflow_design_details
  - table: workflow_designs
  - has recordId: yes
  - permissions: 1 view, 3 edit, 5 create, 9 delete, 128 update_default_view_settings, 256 manage_permissions
  - parentResourceType: admin_workflow_designs
  - default group:
    - owner : bitmask 15 (all), propagateMask: 15(all)
