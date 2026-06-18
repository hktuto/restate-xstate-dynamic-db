---
title: Workflow Editor Redesign Design
type: note
status: in-progress
area: docs
created: 2026-06-15
updated: 2026-06-18
related:
  - [[50-Features/Workflow Designer]]
  - [[50-Features/Workflow Engine]]
  - [[50-Features/Workflow Actions Catalog]]
  - [[50-Features/Guards & Conditions]]
  - [[40-Packages/workflow-actions]]
  - [[40-Packages/workflow-editor-layer]]
  - [[30-Apps/Admin App/Overview]]
  - [[30-Apps/Web App/Overview]]
  - [[20-Architecture/Data Model]]
  - [[20-Architecture/Workflow Runtime]]
---

# Workflow Editor Redesign Design

This note describes the redesign of the shared workflow editor (`layers/workflow-editor`) so it matches the current workflow runtime and action catalog instead of the legacy XState v4-style model it still carries.

## Goal

Replace the outdated editor internals with a runtime-matched, opinionated visual editor that both `apps/web` and `apps/admin` can reuse. The editor must produce `WorkflowDefinition` objects that `apps/workflow-runtime` can compile and run without ambiguity.

## Non-goals

- Generic XState authoring with full `entry`/`exit`/transition-action support.
- Trigger management inside the editor (triggers stay on their own pages).
- Multi-user real-time collaboration on the same canvas.
- Versioning, diffs, or branching of workflow definitions in this iteration.

## Context

The runtime now uses an XState v5 `invoke`-per-state model:

- Each non-final state runs **one action** defined in `state.meta.action`.
- Action states emit `ok` / `error`.
- Condition action states emit `true` / `false`.
- `waiting`-tagged states with `meta.taskType` create user tasks.
- `type: 'final'` marks completion.

The current editor still exposes legacy concepts (`entry`/`exit` arrays, transition-level actions, manual event names, state `type: 'final'` read-only). This causes confusion and produces definitions the runtime does not fully execute.

## Decisions

1. **Rewrite the layer in place (Option A).** Keep `layers/workflow-editor` as a Nuxt 4 layer and keep `@vue-flow/core`. Rebuild the internal components and composables to match the new model.
2. **Opinionated authoring model.** One action per state; all branching is explicit via condition states; no transition guards.
3. **Explicit Start and Final nodes.** The Start node defines the initial state; Final nodes mark terminal states.
4. **Auto-generated transition events.** Events are derived from the source state type and action result.
5. **Human-in-the-loop states.** Task states expose `approval`, `review`, and `manual` task types.
6. **Manual canvas layout.** Drag-and-drop with snap-to-grid; positions persist in `meta.editorPositions`.
7. **Real-time validation.** Structural and model errors appear as badges and in a validation drawer.
8. **Load-time normalization.** Legacy definitions are upgraded to the new shape when opened.

## Authoring model

### Node types

| Node type | Runtime meaning | Outgoing events |
|---|---|---|
| `start` | Defines `initial` state | One edge to the first state, labeled `start` |
| `action` | `state.meta.action` with params and optional `outputKey` | `ok`, `error` |
| `condition` | `state.meta.action = 'condition'` with an expression | `true`, `false` |
| `task` | `state.tags = ['waiting']`, `meta.taskType` | User-defined resolve events, e.g. `approved`, `rejected` |
| `final` | `type: 'final'` | None |

### Example definition produced by the editor

```ts
{
  id: 'provisionCompany',
  initial: 'getCompany',
  states: {
    getCompany: {
      meta: {
        action: 'getRecord',
        params: { filter: { id: { $context: 'record.id' } }, result: { type: 'first' } },
        outputKey: 'company'
      },
      on: {
        ok: { target: 'checkExists' },
        error: { target: 'failed' }
      }
    },
    checkExists: {
      meta: {
        action: 'condition',
        params: { expression: { $ne: [{ $context: 'company' }, null] } }
      },
      on: {
        true: { target: 'done' },
        false: { target: 'approveProvision' }
      }
    },
    approveProvision: {
      tags: ['waiting'],
      meta: {
        taskType: 'approval',
        taskInstructions: 'Approve new company provisioning'
      },
      on: {
        approved: { target: 'done' },
        rejected: { target: 'failed' }
      }
    },
    done: { type: 'final' },
    failed: { type: 'final' }
  },
  context: {},
  meta: {
    editorPositions: {
      start: { x: 40, y: 140 },
      getCompany: { x: 180, y: 120 },
      checkExists: { x: 420, y: 120 },
      approveProvision: { x: 380, y: 260 },
      done: { x: 620, y: 132 },
      failed: { x: 620, y: 260 }
    }
  }
}
```

### Start node mapping

The Start node is a visual-only construct. It is **not** written to `WorkflowDefinition.states`. Its single outgoing edge determines `definition.initial`. If the Start node is missing or disconnected, validation fails.

### Final node mapping

A Final node is a regular state with `type: 'final'` and no outgoing edges. The editor may create an auto-generated ID (e.g. `done`, `failed`) or let the user name it.

### Task state mapping

Task states are ordinary states with `tags: ['waiting']` and `meta.taskType`. They have **no** `meta.action`. Outgoing transitions are user-defined resolve events. The runtime creates a `user_tasks` row when the state is entered and resumes the workflow when the task is resolved via the existing `/api/user-tasks/:id/resolve` endpoint.

## UI layout

- **Top toolbar:** workflow name input, add-node dropdown, validate button, save button, fit-to-screen button, undo/redo (optional).
- **Center canvas:** `@vue-flow/core` graph with snap-to-grid, pan, zoom.
- **Right inspector:** context-aware form for the selected node or edge.
- **Bottom validation drawer:** collapsible list of errors/warnings; clicking an item focuses the offending node/edge.

A wireframe of this layout is saved in `.superpowers/brainstorm/1001-1781755285/content/workflow-editor-wireframe.html`.

## Component breakdown

| Component | Responsibility |
|---|---|
| `WorkflowEditor.vue` | Top-level shell. Loads `modelValue`, orchestrates validation, emits `update:modelValue` and `save`. Host apps provide API save logic. |
| `WorkflowCanvas.vue` | VueFlow container. Renders nodes/edges, handles selection, dragging, connecting, deleting. |
| `StartNode.vue` | Visual Start node. No data form. |
| `ActionNode.vue` | Visual shell for action states. Shows action id, output key, and error badge. |
| `ConditionNode.vue` | Diamond-shaped visual shell for condition states. |
| `TaskNode.vue` | Visual shell for task states. Shows task type and badge. |
| `FinalNode.vue` | Visual shell for final states. |
| `TransitionEdge.vue` | Edge line + event label + delete handle. |
| `InspectorPanel.vue` | Right panel router. Picks the correct sub-form based on selection. |
| `ActionConfigPanel.vue` | Action selector, dynamic params form, output key. |
| `ConditionConfigPanel.vue` | Expression builder / JSON editor using the same DSL as `workflow-actions/runtime/expression.ts`. |
| `TaskConfigPanel.vue` | Task type selector + instructions/assignee fields. |
| `WorkflowToolbar.vue` | Add nodes, name input, validate, save, fit view. |
| `ValidationDrawer.vue` | Real-time validation list. |

## Composables

| Composable | Responsibility |
|---|---|
| `useWorkflowGraph(definition)` | Bidirectional mapping between `WorkflowDefinition` and VueFlow nodes/edges. Handles legacy normalization on load. |
| `useWorkflowEditor(graph)` | Selection, CRUD (add/rename/delete states and transitions), history stack. |
| `useWorkflowValidator(graph, definition)` | Continuous validation; returns structured errors with node/edge ids. |
| `useWorkflowActions()` | Loads action/guard metadata from `packages/workflow-actions`. |
| `useWorkflowRuntimeEvents()` | Returns allowed outgoing event names for each node type. |

## Data flow

1. Host page loads `WorkflowDefinition` via `useApi()` and passes it as `modelValue`.
2. `WorkflowEditor` calls `useWorkflowGraph(modelValue)` to build the VueFlow graph.
3. User edits the graph through `useWorkflowEditor`.
4. After every meaningful change, `useWorkflowGraph` re-derives a new `WorkflowDefinition`.
5. `WorkflowEditor` emits `update:modelValue` so the host can keep the dirty state.
6. `useWorkflowValidator` watches the graph and surfaces errors immediately.
7. On Save, the host PATCHes the definition to `/api/workflows/:id` or `/api/admin/workflows/:id`.

## Validation rules

Hard errors (block Save):

- Exactly one Start node.
- Start node has exactly one outgoing edge to a non-final state.
- Every state ID is unique and a valid JS identifier.
- At least one Final state exists.
- Action states have a selected action id and params that match the catalog schema.
- Condition states have a non-empty expression.
- Task states have a `taskType` and at least one outgoing transition.
- Every non-final state has at least one outgoing transition.
- Transition events match the source node type (e.g. `ok`/`error` for action states).
- No transitions originate from a Final state.
- No dangling transitions (target node exists).

Warnings (do not block Save):

- Unreachable states.
- Duplicate final states with the same name.
- Action output key not used by any downstream state.

## Backwards compatibility / migration

Because old definitions may contain `entry`/`exit` arrays and transition-level `actions` that the runtime ignores, the editor will normalize on load:

1. If `state.meta.action` exists, treat the state as an **action** or **condition** state depending on the action id.
2. If `state.tags` includes `waiting`, treat it as a **task** state.
3. Drop `entry`, `exit`, and transition-level `actions`.
4. Keep `type: 'final'` states as **final** nodes.
5. Keep `meta.editorPositions` if present; otherwise auto-layout once.
6. If the definition cannot be safely normalized, mark it read-only and show a conversion warning.

New saves write only the new shape.

## API surface

The editor remains a pure presentational layer. Host apps provide:

- `modelValue: WorkflowDefinition`
- `@update:modelValue` handler
- `@save` handler that calls the appropriate API route:
  - Tenant: `PATCH /api/workflows/:id`
  - Platform admin: `PATCH /api/admin/workflows/:id`
- `@error` handler for API/validation errors

Action and guard metadata are imported directly from `packages/workflow-actions` so the editor stays in sync with the runtime catalog.

## Error handling

- **Client validation:** blocks Save when hard errors exist and scrolls the first error into view.
- **API errors:** the host app displays a toast; the editor emits `error` with the message.
- **Normalization warnings:** shown as a non-blocking banner when an old definition is loaded.

## Security / permissions

The editor does not enforce roles. Host pages must guard mutations (currently `owner`/`admin` for tenant workflows, `nsdb` admin for platform workflows) before enabling the Save button.

## Testing approach

- **Unit tests for composables:** `useWorkflowGraph`, `useWorkflowValidator`, and the legacy normalizer with fixture definitions.
- **Component tests for forms:** action/condition/task config panels with Vue Test Utils.
- **Canvas smoke tests:** ensure nodes and edges render for a sample definition.
- **Typecheck:** the layer must pass `nuxt typecheck` without errors.
- **Runtime round-trip:** save a definition from the editor, load it via the API, and confirm `apps/workflow-runtime/src/compile.ts` accepts it.

## Risks

| Risk | Mitigation |
|---|---|
| Legacy definitions are silently corrupted by normalization | Read-only warning + explicit convert button for ambiguous cases. |
| Expression editor becomes hard to use | Start with a JSON textarea and a simple expression helper; iterate toward a visual builder. |
| Auto-generated events feel limiting | Document the model clearly; custom events can be added later behind an “advanced” toggle. |
| VueFlow upgrade or API changes | Pin version in layer `package.json`; abstract node/edge shapes behind our own components. |

## Open questions

1. Should undo/redo be part of the first implementation or added later?
2. Should the expression editor include a live evaluator/preview?
3. Should task states support assignment rules (e.g. role, user) now or in a later user-task redesign?
