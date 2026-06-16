---
title: Workflow Editor Revamp Design
type: note
status: in-progress
area: docs
created: 2026-06-16
updated: 2026-06-16
related:
  - [[50-Features/Workflow Designer]]
  - [[40-Packages/workflow-editor-layer]]
  - [[50-Features/Workflow Engine]]
  - [[50-Features/Workflow Actions Catalog]]
---

# Workflow Editor Revamp Design

## Overview

Revamp `layers/workflow-editor` from a form-first editor with a small VueFlow preview into a **canvas-first visual editor** similar to Stately. The canvas becomes the primary workspace; configuration moves to a collapsible sidebar.

This is **phase A**: flat states, transitions, entry/exit actions, and guards only. The data model and graph abstraction are designed so that nested states, parallel regions, simulation, and code view can be added in later phases without rewriting the canvas.

## Goals

- Make workflow authoring visual and fast.
- Keep the editor usable in both `apps/web` (tenant context) and `apps/admin` (platform context).
- Preserve the existing `WorkflowDefinition` contract so saved workflows remain compatible.
- Lay the groundwork for phase B (nested/parallel states) and phase C (simulation + code view).

## Non-goals (phase A)

- Nested or parallel states (visualized as flat only; data model may already contain them).
- Simulation / step-through debugging.
- Code view panel.
- Real-time collaboration.

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar (select | pan | add state | fit view | save)        │
├──────────────────────────┬──────────────────────────────────┤
│                          │  Sidebar (toggle open/close)     │
│      Canvas (VueFlow)    │  ├── Context panel               │
│   - State nodes          │  └── Details panel               │
│   - Transition edges     │       (state / transition)       │
│   - Background grid      │                                  │
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

## Component structure

| Component | Responsibility |
|---|---|
| `WorkflowEditor.vue` | Shell: toolbar, canvas, sidebar, keyboard shortcuts, save flow. |
| `WorkflowCanvas.vue` | VueFlow wrapper, registers custom nodes/edges, handles canvas events. |
| `StateNode.vue` | Custom node: label, selection highlight, transition drag handles. |
| `TransitionEdge.vue` | Custom edge: event label, guard badge, delete handle. |
| `WorkflowToolbar.vue` | Tool buttons, save button, undo/redo placeholders. |
| `SidebarPanel.vue` | Collapsible right sidebar shell. |
| `ContextPanel.vue` | Machine-level JSON editor for context + workflow name/ID. |
| `DetailsPanel.vue` | Selected state or transition editor. |

## Canvas interactions

### Tools

- **Select** (arrow): click to select, drag to move nodes, marquee select later.
- **Pan** (hand): drag canvas to pan.
- **Add state** (square/plus): click on empty canvas to drop a new state.

### Actions

- **Add state:** toolbar button → click canvas, or double-click empty canvas.
- **Rename state:** double-click state label, or edit ID in Details panel.
- **Select:** click state or edge; populates Details panel.
- **Move state:** drag; position persists in graph data.
- **Delete:** `Delete`/`Backspace` on selection, or hover × on state/edge.
- **Add transition:** drag from source node handle to target node; prompt for event name.
- **Edit transition:** click edge label to rename event; guard in Details panel.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `V` / hold `Space` | Pan tool |
| `S` | Select tool |
| `A` | Add state tool |
| `Delete` / `Backspace` | Remove selected |
| `Ctrl/Cmd + S` | Save |

## Sidebar panels

The sidebar is a slide-out panel on the right. Clicking a tab header toggles it open or closed.

### Context panel

- Workflow name (editable).
- Workflow ID (read-only).
- Machine context JSON editor (phase A).
- Optional event list (simple text list of event names, v1).

### Details panel

- Empty state when nothing selected.
- **State selected:**
  - State ID (editable).
  - State type: `atomic` (read-only in phase A; `compound`/`parallel` later).
  - Entry actions: add/remove/reorder from action catalog.
  - Exit actions: add/remove/reorder from action catalog.
- **Transition selected:**
  - Event name.
  - Source → Target (read-only; clickable to jump/select).
  - Guard: type + params.
  - Transition actions (if supported by runtime).

## Data model updates

### `WorkflowDefinition` (no breaking change)

Keep the existing shape. Phase A visualizes the flat `states` object only.

```ts
interface WorkflowDefinition {
  id: string
  initial: string
  context?: Record<string, unknown>
  states: Record<string, StateDefinition>
}

interface StateDefinition {
  on?: Record<string, TransitionDefinition | TransitionDefinition[]>
  entry?: string[]
  exit?: string[]
  // Future-ready, ignored by phase A UI:
  type?: 'atomic' | 'compound' | 'parallel'
  states?: Record<string, StateDefinition>
  initial?: string
  invoke?: InvokedActorDefinition
}

interface TransitionDefinition {
  target: string
  guard?: GuardDefinition
  actions?: string[]
}
```

### Graph model

```ts
interface EditorNode extends Node {
  id: string
  type: 'state'
  position: { x: number; y: number }
  data: {
    label: string
    entry: string[]
    exit: string[]
  }
}

interface EditorEdge extends Edge {
  id: string
  source: string
  target: string
  label: string
  data?: {
    guard?: GuardDefinition
    actions?: string[]
  }
}
```

`useWorkflowGraph` converts `WorkflowDefinition ↔ { nodes, edges }` and preserves node positions via a `positions` map stored on the definition (e.g., `meta?.editorPositions`).

## Migration plan

1. **Create new components** in `layers/workflow-editor/components/` alongside existing ones.
2. **Upgrade `useWorkflowGraph`** to support positions and custom node/edge data.
3. **Replace `WorkflowEditor.vue`** UI with new layout.
4. **Update `apps/web/app/pages/workflows/[id].vue`** only if the public API changes (it should not).
5. **Delete obsolete form components** (`GuardEditor.vue`, `ActionPicker.vue` may be reused inside sidebar).
6. **Update docs:** mark `50-Features/Workflow Designer` status `in-progress` and add this spec to related notes.

## Future phases

- **Phase B:** Nested compound states, parallel regions, history states.
- **Phase C:** Simulation / step-through debugging panel.
- **Phase D:** Code view panel showing generated XState config.
- **Phase E:** Auto-layout algorithms, minimap, snap-to-grid.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| VueFlow custom nodes become complex | Keep node/edge components thin; put config in sidebar. |
| Nested states later break layout | Abstract layout behind `useWorkflowGraph`; swap engine later. |
| Position data bloats workflow definition | Store positions under `meta.editorPositions`, optional. |

## Related

- [[50-Features/Workflow Designer]]
- [[40-Packages/workflow-editor-layer]]
- [[50-Features/Workflow Engine]]
- [[50-Features/Workflow Actions Catalog]]
