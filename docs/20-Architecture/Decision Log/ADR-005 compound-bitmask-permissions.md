---
title: ADR-005 Compound bitmask permissions
type: adr
status: done
area: architecture
created: 2026-06-21
updated: 2026-06-21
related:
  - [[Tenant Permission System]]
  - [[Data Model]]
  - [[40-Packages/db]]
  - [[40-Packages/shared]]
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
