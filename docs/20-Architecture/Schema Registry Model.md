---
title: Schema Registry Model
type: note
status: done
area: architecture
created: 2026-06-21
updated: 2026-06-21
related:
  - "[[Data Model]]"
  - "[[Multi-tenancy]]"
  - "[[40-Packages/db|db package]]"
  - "[[40-Packages/data-table-layer|data-table-layer package]]"
  - "[[50-Features/Views]]"
---

# Schema Registry Model

This note defines the three system tables that describe every table, relation, and view in the project: `_columns`, `_relations`, and `_views`. It also explains how lookup columns connect `_views` to `_relations` without duplicating schema information.

## Overview

The schema registry lives in every SurrealDB namespace/database. It separates **what a table is** from **how we display it**.

| System table | Purpose | Answers |
|---|---|---|
| `_columns` | Physical column metadata | What fields exist on this record? |
| `_relations` | Semantic links between tables | What can this table be linked to? |
| `_views` | Display and query configuration | What do we show and how do we query it? |

## `_columns`

`_columns` stores one row per table column, including system columns and foreign-key columns.

Example row for `members.profileId`:

```ts
{
  table: 'members',
  name: 'profileId',
  dbType: 'record',
  displayType: 'relation',
  optional: true,
  config: { relationId: '_relations:⟨members:profileId:user_profiles:id⟩' }
}
```

It describes the real table structure. If a column stores a record reference, `_columns` says so, but the relation details live in `_relations`.

## `_relations`

`_relations` stores links between tables. There are two kinds.

### Reference relations

A foreign-key column on the source table points to a record in the target table.

```ts
{
  kind: 'reference',
  fromTable: 'members',
  fromColumn: 'profileId',
  toTable: 'user_profiles',
  toColumn: 'id'
}
```

### Graph relations

A separate edge table connects source and target records. Used for many-to-many or membership data.

```ts
{
  kind: 'graph',
  fromTable: 'platform_users',
  toTable: 'admin_user_groups',
  linkTable: 'admin_user_group_memberships'
}
```

Graph edge tables are also registered in `_tables` and `_columns` but are usually hidden from normal table lists.

## `_views`

`_views` stores saved table views. A view config lists which columns to show, how to filter, sort, and paginate.

A view column is either a normal column or a lookup column:

```ts
{ type: 'column', column: 'email', visible: true }

{
  type: 'lookup',
  lookup: { relation: 'profile', field: 'name' },
  label: 'Profile Name',
  visible: true
}
```

Lookup columns reference `_relations` by name, not by raw field path. This keeps the view stable when underlying column names change.

## Lookup columns bridge `_views` and `_relations`

Lookup columns are virtual. They don't exist in `_columns`. Instead they say:

> "For this row, follow the relation named `profile` and display the `name` field of the related record."

The frontend translates this into a query projection column:

```ts
{ field: 'profileId.name', as: 'Profile Name' }
```

For graph relations it becomes:

```ts
{ field: '->admin_user_group_memberships->admin_user_groups.name', as: 'Groups' }
```

The query API receives the projection column, not the view-style lookup config.

## Query translation flow

```text
_views.config.table.columns
        │
        ▼
buildQueryBody()
        │
        ▼
QueryBody.columns[]   // { field, as }
        │
        ▼
POST /tables/:table/query
        │
        ▼
table-query-builder.ts
        │
        ▼
SELECT field AS as, ... FROM table
```

Hidden view columns are omitted from the request. Sort fields are always added to the projection, even when hidden.

## Why keep three tables?

- `_columns` must stay physical. A table has real columns even if no view uses them.
- `_relations` must stay separate because graph relations don't correspond to any column.
- `_views` must stay user-facing. It should not contain query syntax like field paths or traversal arrows.

Collapsing any of these into another would force either the schema or the view config to carry information that doesn't belong there.

## Related

- [[Data Model]] — platform and tenant table overview
- [[40-Packages/db|db package]] — how the registry is provisioned and seeded
- [[40-Packages/data-table-layer|data-table-layer package]] — how lookup columns are rendered
- [[50-Features/Views]] — how views are saved and queried
