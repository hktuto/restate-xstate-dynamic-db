---
title: Guards & Conditions
type: feature
status: planned
area: workflow
created: 2026-06-14
updated: 2026-06-15
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

Guards determine whether a transition is allowed based on context or event data. Conditions are also used by `waitFor` to block callers until a workflow reaches a specific state.

## Implementation

Guards live alongside actions in `packages/workflow-actions`. `createGuardRegistry` builds a map of XState guard implementations. Each guard receives the current machine context, event, and any params configured in the workflow definition.

## Wait conditions

`waitFor` supports two condition shapes:

- `'done'` — resolved when the workflow reaches a final state.
- `'hasTag:<tag>'` — resolved when the current snapshot has the given tag, e.g. `hasTag:waiting`.

## Related

- [[40-Packages/workflow-actions|workflow-actions package]]
- [[50-Features/Workflow Engine|Workflow Engine]]
