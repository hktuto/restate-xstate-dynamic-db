---
title: "Tenant Permission System"
type: feature
status: done
area: architecture
app:
  - web
  - admin
  - runtime
related:
  - "[[Tenant Authentication & Authorization]]"
  - "[[Data Model]]"
  - "[[40-Packages/db]]"
  - "[[Company Management]]"
created: 2026-06-19
updated: 2026-06-19
---

# Tenant Permission System

## Overview

A tenant-scoped permission layer that separates organizational **user groups** from **permission groups**, stores each group's rights as a bitwise bitmask, and uses SurrealDB graph edges for membership and assignment. Company owners keep a short-cut flag that grants full access.

This feature covers tenant permissions only; super-admin permissions are out of scope for now.

## Requirements

- Users can belong to many **user groups**.
- For each resource type or record, a user or user group can be assigned to exactly one **permission group**.
- Permissions are stored bitwise: each action maps to a power-of-two value (1, 2, 4, 8, …).
- Effective permission is the bitwise OR of the user's direct assignment and the assignments of all user groups the user belongs to.
- Use SurrealDB graph edges for user-group membership and permission-group assignment.
- Company owners bypass all checks.
- The first slice focuses on `company` (global actions) and `user_group` (record-level ACLs).

## Design

### Concepts

| Concept | Meaning |
|---------|---------|
| **Resource type** | A class of object that can be protected, e.g. `company`, `user_group`, `workflow_design`. |
| **Permission group** | A named access tier for exactly one resource type or record. Stores a bitmask. |
| **Record-level permission group** | A permission group scoped to one specific record, e.g. one `user_group` instance. |
| **User group** | An organizational group inside a company, e.g. "Finance Team". |
| **Permission assignment** | A user or user group is linked to one permission group per scope. |
| **Company owner** | A flag on the `members` record that grants every action. |

### Bitwise permissions

Each action maps to a single bit:

| Bit position | Decimal value |
|--------------|---------------|
| 0 | 1 |
| 1 | 2 |
| 2 | 4 |
| 3 | 8 |
| 4 | 16 |

Example `user_group` record actions:

| Action | Value |
|--------|-------|
| view | 1 |
| update | 2 |
| delete | 4 |
| add_member | 8 |
| remove_member | 16 |
| manage_permissions | 32 |

A permission group that allows `view`, `update`, and `add_member` stores bitmask `1 | 2 | 8 = 11`. Permission checks use bitwise AND: `(bitmask & actionValue) != 0`.

### Data model

Inside each tenant namespace:

| Table / Edge | Purpose |
|--------------|---------|
| `user_groups` | Organizational groups (name, description). |
| `user_group_memberships` | Edge: member → many user groups. |
| `permission_groups` | Access tier for a resource type or record (`resourceType`, optional `recordId`, `name`, `bitmask`, `isSystem`). |
| `permission_assignments` | Edge: member **or** user group → one permission group per scope. |

`permission_assignments` stores `resourceType` and `recordId` copied from the linked group. A unique index on `(in, resourceType, recordId)` enforces one assignment per assignee per scope.

### Permission resolution

1. If `members.role = owner`, allow.
2. Collect relevant permission groups: record-level (if a `recordId` is provided), resource-type-level, and `company`-level for global actions.
3. Load the user's direct assignment and the assignments of every user group the user belongs to.
4. Compute `effectiveBitmask = OR of all collected bitmasks`.
5. Allow if `(effectiveBitmask & actionValue) != 0`.

### Default groups

- **`company`** — Owner, Admin, Member. Actions include `manage_settings`, `manage_permissions`, `manage_user_groups`, `invite_member`, `remove_member`, `view`.
- **`user_group` record-level** — When a user group is created, auto-create Owner, Admin, Member groups scoped to that record. The creator becomes Owner.
- **Other resource types** (e.g. `workflow_design`) can start with resource-type-level groups only: Owner, Editor, Viewer.

### First slice

1. **`company`** resource type for global actions.
2. **`user_group`** resource type with record-level ACLs.

Workflow-related resources come later and can use resource-type-level groups initially.

## Frontend mapping

The API should expose the permission registry (resource type → ordered action list and values) so the UI can decode bitmasks without hard-coding bit positions. A registry endpoint such as `GET /api/permissions/actions?resourceType=user_group` is the recommended approach.

## Open questions

- Should record-level permission groups be created for resources other than `user_group` in the first slice?
- Should system default permission groups be immutable, or editable only by users with `company:manage_permissions`?
- Should permission groups support inheritance (e.g. "Admin" always includes all bits from "Member")?
- Should a user group's permission assignment ever override the user's direct assignment, or is OR always sufficient?

## Related

- [[Tenant Authentication & Authorization]]
- [[Data Model]]
- [[40-Packages/db]]
- [[Company Management]]
