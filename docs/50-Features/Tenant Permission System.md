---
title: Tenant Permission System
type: feature
status: done
area: workflow
created: 2026-06-19
updated: 2026-06-21
app:
  - admin
  - web
related:
  - [[Tenant Authentication & Authorization]]
  - [[Data Model]]
  - [[40-Packages/db]]
  - [[40-Packages/shared]]
  - [[Company Management]]
  - [[20-Architecture/Decision Log/ADR-005 compound-bitmask-permissions]]
---

# Tenant Permission System

## Overview

A unified permission layer for tenant and admin scopes. Resource types are declared in a shared catalog with compound bit mappings. `permission_groups` are named containers, while actual grants are stored on `permission_apply_to` graph edges so the same resolver can evaluate access for platform administrators and tenant members.

## Requirements

- Resource types, actions, default groups, and parent relationships are declared once in `packages/shared/src/resource-catalog.ts`.
- `permission_groups` are named containers with no bitmask of their own.
- Grants move to `permission_apply_to` edges carrying `bitmask`, `propagateMask`, optional `recordId`, and future `conditions`.
- Membership is modelled through `user_group_memberships` edges for tenant members and `admin_user_group_memberships` edges for platform administrators.
- Permission assignments (`permission_assignments` edges) link a member or group to a permission group.
- Effective permission uses compound-bit checks: `(effectiveMask & actionValue) === actionValue`.

## Design

### Concepts

| Concept | Meaning |
|---------|---------|
| **Resource type** | A class of object that can be protected, e.g. `tenant`, `member`, `user_group`, `user_group_detail`, `workflow_design`, `workflow_design_detail`. |
| **Permission group** | A named access tier for one resource type. Stores no bitmask; rights are held on linked `permission_apply_to` edges. |
| **Permission grant** | An edge from a permission group to a resource type (and optional record) defining the allowed bitmask and propagation mask. |
| **User group** | An organizational group inside a company, e.g. "Finance Team". |
| **Permission assignment** | A member or user group is linked to one permission group. |
| **Compound bitmask** | Each action is an integer mask; actions like `edit` combine `view` with a high bit so checks are `(effectiveMask & actionValue) === actionValue`. |

### Resource catalog

Resource types are declared in `packages/shared/src/resource-catalog.ts` with:

- `bitMapping` — action name to integer mask.
- `parentResourceType` — the singular parent resource type this resource inherits from (rendered as the `resource_parent` graph edge).
- `defaultGroups` — lowercase group names such as `owner`, `admin`, `user` with optional grants and propagation masks.

Example default group names are lowercase: `owner`, `admin`, `user`.

### Effective permission resolution

1. Load the resource type and its ancestors from the `resource_parent` graph.
2. Collect the member's direct assignments and assignments of every user group the member belongs to.
3. For each assignment, read the linked permission group's `permission_apply_to` edges, applying `propagateMask` when walking up to parent resource types.
4. Compute `effectiveMask = OR of all collected bitmasks`.
5. Allow if `(effectiveMask & actionValue) === actionValue`.

The same resolver serves tenant and admin scopes by parameterizing the membership edge (`user_group_memberships` for tenants, `admin_user_group_memberships` for platform administrators) and table names.

### Tenant root and member management

- The tenant root resource is `tenant`.
- Member management uses the `member` resource type.
- Record-scoped detail resources (for example `user_group_detail`) carry only basic actions and inherit from their parent resource type.

### Data model

Inside each tenant namespace:

| Table / Edge | Purpose |
|--------------|---------|
| `members` | Tenant members, including an `owner` flag for full access. |
| `user_group_memberships` | Edge: tenant member → many user groups. |
| `permission_groups` | Named access tier for a resource type (`resourceType`, `name`, `isSystem`). |
| `permission_assignments` | Edge: member **or** user group → one permission group. |
| `permission_apply_to` | Edge: permission group → resource type (or record) with `bitmask`, `propagateMask`, optional `recordId`, and future `conditions`. |
| `resource_types` | Upserted from the shared catalog. |
| `resource_parent` | Edge: child resource type → parent resource type. |

### Default groups

- `tenant` — `owner`, `admin`, `user`.
- `member` — `owner`, `admin`, `user`.
- `user_group` — resource-type and record-level groups for `owner`, `admin`, `user`.
- `workflow_design` — resource-type groups for `owner`, `admin`, `user`.
- `workflow_design_detail` — record-scoped detail resource carrying only basic actions inherited from `workflow_design`.
- Record-scoped detail resources such as `user_group_detail` carry only basic actions inherited from their parent.

## Related

- [[Tenant Authentication & Authorization]]
- [[Data Model]]
- [[40-Packages/db]]
- [[40-Packages/shared]]
- [[Company Management]]
- [[20-Architecture/Decision Log/ADR-005 compound-bitmask-permissions|ADR-005]]
