---
title: workflow-editor-layer
type: package
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
package: workflow-editor-layer
related:
  - [[50-Features/Workflow Designer]]
  - [[20-Architecture/Decision Log/ADR-003 Nuxt layers for workflow editor]]
---

# workflow-editor-layer

## Purpose

Shared Nuxt layer providing the visual workflow editor used by both `apps/web` and `apps/admin`.

## Location

`layers/workflow-editor`

## Contract

The editor is a pure Vue component that:

- Accepts `modelValue: WorkflowDefinition`.
- Emits `update:modelValue` on changes.
- Emits `save` when the user explicitly saves.

## Dependencies

- `@vue-flow/core`
- `@vue-flow/background`
- `packages/workflow-actions`
- `packages/db`

## Related

- [[50-Features/Workflow Designer|Workflow Designer]]
- [[20-Architecture/Decision Log/ADR-003 Nuxt layers for workflow editor|ADR-003]]
