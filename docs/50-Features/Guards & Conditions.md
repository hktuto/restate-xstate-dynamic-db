---
title: Guards & Conditions
type: feature
status: planned
area: workflow
created: 2026-06-14
updated: 2026-06-14
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

Guards determine whether a transition is allowed based on context or event data.

## Implementation

Guards live alongside actions in `packages/workflow-actions`. They receive the current machine context and event and return a boolean.

## Related

- [[40-Packages/workflow-actions|workflow-actions package]]
- [[50-Features/Workflow Engine|Workflow Engine]]
