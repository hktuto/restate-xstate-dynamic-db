---
title: Workflow Designer
type: feature
status: planned
area: workflow
created: 2026-06-14
updated: 2026-06-14
app:
  - web
  - admin
related:
  - [[40-Packages/workflow-editor-layer]]
  - [[50-Features/Workflow Engine]]
---

# Workflow Designer

## Overview

Visual editor for building XState workflows.

## Requirements

- Drag-and-drop states and transitions.
- Edit state configuration, actions, and guards.
- Load/save workflow definitions.
- Validate the machine before saving.

## Implementation

Provided by `layers/workflow-editor` and used in both `apps/web` and `apps/admin`.

## Related

- [[40-Packages/workflow-editor-layer|workflow-editor-layer]]
- [[50-Features/Workflow Engine|Workflow Engine]]
