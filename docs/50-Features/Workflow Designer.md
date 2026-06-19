---
title: Workflow Designer
type: feature
status: done
area: workflow
created: 2026-06-14
updated: 2026-06-19
app:
  - web
  - admin
related:
  - [[40-Packages/workflow-editor-layer]]
  - [[50-Features/Workflow Engine]]
  - [[30-Apps/web]]
  - [[30-Apps/admin]]
---

# Workflow Designer

## Overview

Visual editor for building XState-compatible workflow definitions. Users drag, connect, and configure states; the editor emits a runtime-matched `WorkflowDefinition` on every change and a `save` event when the user explicitly persists a valid workflow.

## Requirements

- Drag-and-drop states and transitions.
- Edit state configuration, actions, conditions, and human tasks.
- Load/save workflow definitions.
- Validate the machine before saving.

## Implementation

Provided by `layers/workflow-editor` and used in both [[30-Apps/web|web]] and [[30-Apps/admin|admin]]. The consuming host pages integrate `WorkflowEditor.vue` and forward `error` events to their own toast/error UI.

## Running workflows

The `WorkflowRunModal` component renders a form from the first `user_trigger` start rule's inputs. It validates required and JSON fields, converts values to the correct runtime types, and posts to the host app's workflow-instances endpoint. Both web and admin detail pages use the shared modal, supplying their own namespace and API base path.

## Supported node types

| Type | Purpose |
|------|---------|
| Start | Visual entry point (`__start`). Has exactly one outgoing transition to the initial state. |
| Action | Performs one configured action (`getRecord`, `createRecord`, etc.). |
| Condition | Evaluates an expression and branches on `true`/`false`. |
| Task | Represents a human task (`approval`, `review`, or `manual`). |
| Final | Terminal state. Cannot have outgoing transitions. |

## Branching

Branching is event-driven:

- **Action** states emit `ok` or `error`.
- **Condition** states branch on `true` or `false`.
- **Task** states accept user-named events (for example `approved`, `rejected`, or any custom event).
- When a new transition is created, the editor picks a default event that has not yet been used from the source state.

## Validation drawer and save guard

- The editor validates the graph continuously.
- Validation errors are shown in a collapsible drawer at the bottom of the editor.
- Clicking an error focuses the related node or edge.
- The Save button is disabled while errors exist.
- Attempting to save with errors emits an `error` event with a guard message.

## Inspector/config panels

The right sidebar has two tabs:

- **Context**: edit workflow name and the raw workflow definition.
- **Details**: inspect and edit the selected node or transition.
  - Action nodes: configure action, params, and output key.
  - Condition nodes: configure expression.
  - Task nodes: configure task type and instructions.
  - Transitions: edit the event label and jump to source/target nodes.

## Toolbar controls

- Name input.
- Tool selector: `select`, `pan`, `add-action`, `add-condition`, `add-task`, `add-final`.
- Fit view button.
- Save button (disabled when invalid or readonly).

## Known limitations

- Keyboard shortcuts are removed for now; all add/delete/focus operations are toolbar or click driven.
- Readonly mode disables editing controls and node dragging but still allows panning/fit view.

## Related

- [[40-Packages/workflow-editor-layer|workflow-editor-layer]]
- [[50-Features/Workflow Engine|Workflow Engine]]
- [[30-Apps/web|web]]
- [[30-Apps/admin|admin]]
