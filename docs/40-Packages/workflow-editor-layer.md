---
title: workflow-editor-layer
type: package
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-19
package: workflow-editor-layer
related:
  - [[50-Features/Workflow Designer]]
  - [[20-Architecture/Decision Log/ADR-003 Nuxt layers for workflow editor]]
  - [[50-Features/Workflow Engine]]
  - [[30-Apps/web]]
  - [[30-Apps/admin]]
---

# workflow-editor-layer

## Purpose

Shared Nuxt layer that provides the visual workflow editor used by both [[30-Apps/web|web]] and [[30-Apps/admin|admin]]. The layer is registered as a Nuxt layer under `layers/workflow-editor` and consumed by extending it from the host applications.

## Location

`layers/workflow-editor`

## Contract

The editor is a pure Vue component (`WorkflowEditor.vue`) that:

- Accepts `modelValue: WorkflowDefinition`.
- Accepts optional `name` and `readonly` props.
- Emits `update:modelValue` on every internal graph change.
- Emits `update:name` when the workflow name changes.
- Emits `save` when the user explicitly saves a valid workflow.
- Emits `error` when a save is attempted while validation errors exist.

## Dependencies

- `@vue-flow/core`
- `@vue-flow/background`
- `packages/workflow-actions`
- `packages/db` (types via `shared`)

## Component inventory

| Component | Responsibility |
|-----------|----------------|
| `WorkflowEditor.vue` | Editor shell. Wires state, toolbar, canvas, sidebar, validation drawer, and save guard. |
| `WorkflowCanvas.vue` | VueFlow canvas. Renders nodes, edges, background, and handles pointer/tool interactions. |
| `TransitionEdge.vue` | Custom edge type with a delete button. |
| `StartNode.vue` | Visual entry node (visual-only `__start`). |
| `ActionNode.vue` | Node for action-backed states. |
| `ConditionNode.vue` | Node for condition/guard states. |
| `TaskNode.vue` | Node for human task states (`tags: ['waiting']`). |
| `FinalNode.vue` | Node for final states. |
| `WorkflowToolbar.vue` | Toolbar with name input, tool selector, fit-view, and save. |
| `ValidationDrawer.vue` | Collapsible list of validation errors; clicking an error focuses the offending node/edge. |
| `ActionConfigPanel.vue` | Action selection and parameter/output key editing. |
| `ConditionConfigPanel.vue` | Condition expression editing. |
| `TaskConfigPanel.vue` | Task type and instructions editing. |
| `WorkflowContextPanel.vue` | Raw workflow definition and name editing. |
| `DetailsPanel.vue` | Sidebar inspector for the selected node or edge. |
| `SidebarPanel.vue` | Collapsible sidebar shell with Context/Details tabs. |
| `WorkflowRunModal.vue` | Shared modal for running a workflow from a `user_trigger` start rule. |

## Composable inventory

| Composable | Responsibility |
|------------|----------------|
| `useWorkflowEditor.ts` | Core editor state and mutations (nodes, edges, selection, tool, add/remove/rename/update). |
| `useWorkflowGraph.ts` | Bidirectional mapping between `WorkflowDefinition` and the VueFlow graph model. |
| `useWorkflowValidator.ts` | Validates the graph and returns `ValidationError[]`. |
| `useWorkflowRuntimeEvents.ts` | Determines which events are valid for each node type and suggests default events. |
| `useWorkflowRun.ts` | Resolves visible form inputs for a given start state. |

## Shared types

`composables/types.ts` exports:

- `EditorNodeType`: `'start' | 'action' | 'condition' | 'task' | 'final'`
- `EditorNode`: `{ id, type, position, data }`
- `EditorNodeData`: discriminated union of `start`, `action`, `condition`, `task`, and `final` data shapes.
- `EditorEdge`: `{ id, source, target, label, data? }`
- `CONDITION_ACTION_ID`: constant `'condition'` used to detect condition states from legacy/workflow definitions.

## Graph model

The graph model now matches the runtime model directly:

- One action per action state, stored in `state.meta.action`.
- Condition states use `meta.action === CONDITION_ACTION_ID` with `meta.params.expression`.
- Task states use `tags: ['waiting']` with `meta.taskType` and `meta.taskInstructions`.
- Final states use `state.type === 'final'`.
- A visual-only `__start` node represents the workflow `initial` transition.
- Legacy normalization drops `entry`, `exit`, and per-transition `actions`, keeping only `meta.action` for runtime parity.

## Validation rules

`useWorkflowValidator` enforces:

- Exactly one `__start` node exists.
- Start node has exactly one outgoing transition to a real state.
- State ids are unique and valid JavaScript identifiers.
- At least one Final state exists.
- Final states have no outgoing transitions.
- Non-final states have at least one outgoing transition (no dangling dead-ends).
- Action states have a selected `actionId`.
- Condition states have a non-empty expression.
- Task states have a selected `taskType`.
- Edge sources and targets exist.
- Edge labels are allowed events for the source state type (`ok`/`error` for actions, `true`/`false` for conditions, any non-empty string for tasks).

## Known UX

- The canvas uses a toolbar-based add/select/pan model.
- Delete is inline on edges (custom `TransitionEdge`) and handled via the editor API for nodes; keyboard shortcuts are removed for now.
- The Save button is disabled while validation errors exist, and attempting to save emits an `error` event.

## Related

- [[50-Features/Workflow Designer|Workflow Designer]]
- [[20-Architecture/Decision Log/ADR-003 Nuxt layers for workflow editor|ADR-003]]
- [[50-Features/Workflow Engine|Workflow Engine]]
