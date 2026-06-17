---
title: SurrealDB Conventions
type: runbook
status: in-progress
area: docs
created: 2026-06-16
updated: 2026-06-16
related:
  - [[Getting Started]]
  - [[DB Package]]
---

# SurrealDB Conventions

This note collects small but important conventions for querying SurrealDB in this project.

## Fetching a record by its full record ID

When a function receives a full record id string (for example `workflows:abc`, `members:xyz`, or `user_profiles:def`), use `type::record($id)` in the query:

```ts
const [result] = await surreal.query<[WorkflowRecord[]]>(
  'SELECT * FROM type::record($id)',
  { id }
)
return result[0]
```

Do **not** use `WHERE id = $id LIMIT 1` for this case. SurrealDB treats a bound `$id` parameter as a plain string in a `WHERE` comparison, so it will not match an actual record ID and the query will return no rows.

`type::record($id)` tells SurrealDB to convert the parameter into a record ID before executing the `SELECT`, which makes the lookup exact and efficient.

### When to use `WHERE id = $id`

`WHERE id = $id` is still appropriate when you are comparing against a record-link field stored on another record, or when `$id` is already a record reference obtained from a previous query. It is not appropriate when the input is the raw string a caller passes in (for example from a URL parameter).

## Related

- [[Getting Started]]
- [[DB Package]]
