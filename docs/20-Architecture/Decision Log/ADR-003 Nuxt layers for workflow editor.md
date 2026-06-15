---
title: ADR-003: Nuxt layers for workflow editor
type: adr
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Monorepo Layout]]
  - [[40-Packages/workflow-editor-layer]]
---

# ADR-003: Nuxt layers for workflow editor

## Context

Both the web app and admin app need the visual workflow editor. We want to avoid duplicating editor code.

## Decision

Implement the workflow editor as a Nuxt layer in `layers/workflow-editor` and extend it from both apps.

## Rationale

- Nuxt layers share components, composables, and config cleanly.
- Keeps editor code in one place while allowing app-specific overrides.
- Consistent with the Nuxt 4 workspace model.

## Consequences

- Layer dependencies must be installed/linked correctly in the monorepo.
- Changes to the layer affect both apps.

## Related

- [[Monorepo Layout]]
- [[40-Packages/workflow-editor-layer|workflow-editor-layer]]
