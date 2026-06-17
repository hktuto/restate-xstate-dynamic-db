---
title: Guards & Conditions
type: feature
status: done
area: workflow
created: 2026-06-14
updated: 2026-06-17
app:
  - web
  - admin
  - runtime
related:
  - [[40-Packages/workflow-actions]]
  - [[50-Features/Workflow Engine]]
---

# Guards & Conditions

## Overview

Guards decide whether a transition is allowed. The default guard is `condition`, which evaluates the same MongoDB-style expression used by the `condition` action.

## `condition` guard

```ts
guard: {
  type: 'condition',
  params: {
    expression: { $eq: ['$context.record.status', 'active'] }
  }
}
```

The expression can use `$eq`, `$ne`, `$exists`, `$in`, `$nin`, `$and`, `$or`, and `$not`. Values prefixed with `$context.` are resolved from the machine context.

## Wait conditions

`waitFor` supports:

- `'done'` — resolved when the workflow reaches a final state.
- `'hasTag:<tag>'` — resolved when the current snapshot has the given tag, e.g. `hasTag:waiting`.

## Related

- [[40-Packages/workflow-actions|workflow-actions package]]
- [[50-Features/Workflow Engine|Workflow Engine]]
