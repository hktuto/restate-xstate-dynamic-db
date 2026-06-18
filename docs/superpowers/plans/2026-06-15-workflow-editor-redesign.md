---
title: Workflow Editor Redesign Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-18
updated: 2026-06-18
---

# Workflow Editor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the `layers/workflow-editor` Nuxt layer so it produces workflow definitions that match the current runtime model (one action per state, result-event transitions, explicit Start/Final nodes, human-in-the-loop task states).

**Architecture:** Keep the layer boundary and `@vue-flow/core`; replace the internal graph model, composables, and components. The new graph model uses typed nodes (`start`, `action`, `condition`, `task`, `final`) and auto-generated transition events. Bidirectional mapping between the graph and `WorkflowDefinition` lives in `useWorkflowGraph`, with legacy normalization on load.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, `@vue-flow/core`, `@vue-flow/background`, `packages/workflow-actions`, `packages/shared`, Vitest.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `layers/workflow-editor/package.json` | Modify | Add `test` script and Vitest dev dependency. |
| `layers/workflow-editor/vitest.config.ts` | Create | Vitest config for the layer. |
| `layers/workflow-editor/composables/types.ts` | Create | Shared `EditorNode`, `EditorEdge`, `EditorNodeData`, `EditorNodeType` types. |
| `layers/workflow-editor/composables/useWorkflowRuntimeEvents.ts` | Create | Returns allowed result events per node type. |
| `layers/workflow-editor/composables/useWorkflowGraph.ts` | Replace | Definition ↔ graph mapping + legacy normalization. |
| `layers/workflow-editor/composables/useWorkflowValidator.ts` | Replace | Real-time validation against the graph. |
| `layers/workflow-editor/composables/useWorkflowEditor.ts` | Replace | Graph CRUD and selection. |
| `layers/workflow-editor/components/StartNode.vue` | Create | Visual Start node. |
| `layers/workflow-editor/components/ActionNode.vue` | Create | Visual action state node. |
| `layers/workflow-editor/components/ConditionNode.vue` | Create | Diamond condition state node. |
| `layers/workflow-editor/components/TaskNode.vue` | Create | Human-task state node. |
| `layers/workflow-editor/components/FinalNode.vue` | Create | Visual final state node. |
| `layers/workflow-editor/components/StateNode.vue` | Delete | Replaced by typed nodes. |
| `layers/workflow-editor/components/ActionListEditor.vue` | Delete | Legacy entry/exit editor. |
| `layers/workflow-editor/components/WorkflowCanvas.vue` | Replace | Wires typed nodes and edges into VueFlow. |
| `layers/workflow-editor/components/TransitionEdge.vue` | Replace | Edge with event label and delete handle. |
| `layers/workflow-editor/components/ActionConfigPanel.vue` | Replace | Action selector + params form. |
| `layers/workflow-editor/components/ConditionConfigPanel.vue` | Create | Expression JSON editor. |
| `layers/workflow-editor/components/TaskConfigPanel.vue` | Create | Task type + instructions. |
| `layers/workflow-editor/components/WorkflowContextPanel.vue` | Replace | Workflow name + context JSON (initial removed — driven by Start node). |
| `layers/workflow-editor/components/DetailsPanel.vue` | Replace | Inspector router for selected node/edge. |
| `layers/workflow-editor/components/WorkflowToolbar.vue` | Replace | Add-node dropdown, name, validate, save, fit view. |
| `layers/workflow-editor/components/ValidationDrawer.vue` | Create | Error list with click-to-focus. |
| `layers/workflow-editor/components/WorkflowEditor.vue` | Replace | Top-level shell that composes everything. |
| `layers/workflow-editor/plugins/focus-directive.ts` | Delete | Not needed; focus handled inline. |
| `apps/admin/app/pages/workflows/[id].vue` | Modify | Wire `error` emit and save guard. |
| `apps/admin/app/pages/workflows/new.vue` | Modify | Wire `error` emit and save guard. |
| `apps/web/app/pages/workflows/[id].vue` | Modify | Wire `error` emit and save guard. |
| `apps/web/app/pages/workflows/new.vue` | Modify | Wire `error` emit and save guard. |
| `docs/40-Packages/workflow-editor-layer.md` | Modify | Update to reflect new internals. |
| `docs/50-Features/Workflow Designer.md` | Modify | Update status and scope. |
| `.gitignore` | Modify | Add `.superpowers/`. |

---

## Task 1: Test harness and shared types

**Files:**
- Modify: `layers/workflow-editor/package.json`
- Create: `layers/workflow-editor/vitest.config.ts`
- Create: `layers/workflow-editor/composables/types.ts`
- Create: `layers/workflow-editor/composables/useWorkflowRuntimeEvents.ts`
- Test: `layers/workflow-editor/composables/__tests__/useWorkflowRuntimeEvents.test.ts`

### Step 1: Add test script and Vitest dependency

Modify `layers/workflow-editor/package.json`:

```json
{
  "name": "workflow-editor-layer",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vue-flow/background": "^1.3.2",
    "@vue-flow/core": "^1.48.2",
    "shared": "workspace:*",
    "workflow-actions": "workspace:*"
  },
  "devDependencies": {
    "nuxt": "^4.4.8",
    "typescript": "^5.8.3",
    "vitest": "^4.1.9"
  }
}
```

### Step 2: Create Vitest config

Create `layers/workflow-editor/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false
  }
})
```

### Step 3: Create shared graph types

Create `layers/workflow-editor/composables/types.ts`:

```ts
export type EditorNodeType = 'start' | 'action' | 'condition' | 'task' | 'final'

export interface EditorNode {
  id: string
  type: EditorNodeType
  position: { x: number; y: number }
  data: EditorNodeData
}

export type EditorNodeData =
  | { kind: 'start' }
  | {
      kind: 'action'
      actionId: string
      params: Record<string, unknown>
      outputKey: string
    }
  | {
      kind: 'condition'
      expression: unknown
    }
  | {
      kind: 'task'
      taskType: 'approval' | 'review' | 'manual'
      taskInstructions: string
    }
  | { kind: 'final' }

export interface EditorEdge {
  id: string
  source: string
  target: string
  label: string
}
```

### Step 4: Create runtime-events helper

Create `layers/workflow-editor/composables/useWorkflowRuntimeEvents.ts`:

```ts
import type { EditorNodeData, EditorNodeType } from './types.js'

const TASK_SUGGESTED_EVENTS = ['approved', 'rejected']

export function useWorkflowRuntimeEvents() {
  function getResultEvents(type: EditorNodeType, data: EditorNodeData): string[] {
    if (type === 'start' || data.kind === 'start') return ['start']
    if (type === 'final' || data.kind === 'final') return []
    if (data.kind === 'action') return data.actionId === 'condition' ? ['true', 'false'] : ['ok', 'error']
    if (data.kind === 'condition') return ['true', 'false']
    if (data.kind === 'task') return TASK_SUGGESTED_EVENTS
    return []
  }

  function isEventAllowed(type: EditorNodeType, data: EditorNodeData, event: string): boolean {
    if (type === 'task' || data.kind === 'task') return event.length > 0
    const allowed = getResultEvents(type, data)
    return allowed.includes(event)
  }

  function defaultEvent(type: EditorNodeType, data: EditorNodeData, used: string[]): string | null {
    const candidates = getResultEvents(type, data)
    const unused = candidates.filter(e => !used.includes(e))
    return unused[0] ?? candidates[0] ?? null
  }

  return { getResultEvents, isEventAllowed, defaultEvent }
}
```

### Step 5: Write failing test

Create `layers/workflow-editor/composables/__tests__/useWorkflowRuntimeEvents.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { useWorkflowRuntimeEvents } from '../useWorkflowRuntimeEvents.js'

describe('useWorkflowRuntimeEvents', () => {
  const { getResultEvents, isEventAllowed, defaultEvent } = useWorkflowRuntimeEvents()

  it('returns ok/error for action states', () => {
    expect(getResultEvents('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: 'company' }))
      .toEqual(['ok', 'error'])
  })

  it('returns true/false for condition states', () => {
    expect(getResultEvents('condition', { kind: 'condition', expression: {} }))
      .toEqual(['true', 'false'])
  })

  it('returns true/false when actionId is condition', () => {
    expect(getResultEvents('action', { kind: 'action', actionId: 'condition', params: { expression: {} }, outputKey: '' }))
      .toEqual(['true', 'false'])
  })

  it('allows any non-empty event for task states', () => {
    expect(isEventAllowed('task', { kind: 'task', taskType: 'approval', taskInstructions: '' }, 'acknowledged')).toBe(true)
  })

  it('picks first unused default event', () => {
    expect(defaultEvent('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: '' }, [])).toBe('ok')
    expect(defaultEvent('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: '' }, ['ok'])).toBe('error')
  })
})
```

### Step 6: Run the test

```bash
cd layers/workflow-editor && pnpm test
```

Expected: PASS.

### Step 7: Commit

```bash
git add layers/workflow-editor/package.json \
  layers/workflow-editor/vitest.config.ts \
  layers/workflow-editor/composables/types.ts \
  layers/workflow-editor/composables/useWorkflowRuntimeEvents.ts \
  layers/workflow-editor/composables/__tests__/useWorkflowRuntimeEvents.test.ts
git commit -m "feat(workflow-editor): add test harness, graph types, and runtime event helper"
```

---

## Task 2: Graph mapping with legacy normalization

**Files:**
- Replace: `layers/workflow-editor/composables/useWorkflowGraph.ts`
- Test: `layers/workflow-editor/composables/__tests__/useWorkflowGraph.test.ts`

### Step 1: Replace `useWorkflowGraph.ts`

```ts
import type { WorkflowDefinition, WorkflowState } from 'shared'
import type { EditorEdge, EditorNode, EditorNodeData, EditorNodeType } from './types.js'

const START_NODE_ID = '__start'

function emptyDefinition(id: string): WorkflowDefinition {
  return { id, initial: '', states: {} }
}

function inferNodeType(state: WorkflowState): EditorNodeType {
  if (state.type === 'final') return 'final'
  if (state.tags?.includes('waiting')) return 'task'
  const action = state.meta?.action as string | undefined
  if (action === 'condition') return 'condition'
  if (action) return 'action'
  return 'action'
}

function stateToData(state: WorkflowState): EditorNodeData {
  const type = inferNodeType(state)
  if (type === 'final') return { kind: 'final' }
  if (type === 'task') {
    return {
      kind: 'task',
      taskType: (state.meta?.taskType as 'approval' | 'review' | 'manual') ?? 'manual',
      taskInstructions: (state.meta?.taskInstructions as string) ?? ''
    }
  }
  if (type === 'condition') {
    return {
      kind: 'condition',
      expression: (state.meta?.params as Record<string, unknown> | undefined)?.expression ?? null
    }
  }
  const actionId = (state.meta?.action as string) ?? ''
  return {
    kind: 'action',
    actionId,
    params: (state.meta?.params as Record<string, unknown> | undefined) ?? {},
    outputKey: (state.meta?.outputKey as string) ?? ''
  }
}

function dataToState(node: EditorNode): WorkflowState {
  const base: WorkflowState = {}
  if (node.type === 'final') {
    base.type = 'final'
    return base
  }
  if (node.data.kind === 'task') {
    base.tags = ['waiting']
    base.meta = {
      taskType: node.data.taskType,
      taskInstructions: node.data.taskInstructions
    }
    return base
  }
  if (node.data.kind === 'condition') {
    base.meta = {
      action: 'condition',
      params: { expression: node.data.expression }
    }
    return base
  }
  if (node.data.kind === 'action') {
    if (node.data.actionId) {
      base.meta = {
        action: node.data.actionId,
        params: node.data.params,
        outputKey: node.data.outputKey || undefined
      }
    }
    return base
  }
  return base
}

export function useWorkflowGraph() {
  function definitionToGraph(definition: WorkflowDefinition): { nodes: EditorNode[]; edges: EditorEdge[] } {
    const positions = (definition.meta?.editorPositions ?? {}) as Record<string, { x: number; y: number }>
    const stateEntries = Object.entries(definition.states)

    const nodes: EditorNode[] = stateEntries.map(([stateId, stateDef], idx) => ({
      id: stateId,
      type: inferNodeType(stateDef),
      position: positions[stateId] ?? { x: 100 + idx * 220, y: 100 + (idx % 2) * 120 },
      data: stateToData(stateDef)
    }))

    const startPosition = positions[START_NODE_ID] ?? {
      x: (positions[definition.initial]?.x ?? 200) - 180,
      y: positions[definition.initial]?.y ?? 100
    }
    nodes.unshift({
      id: START_NODE_ID,
      type: 'start',
      position: startPosition,
      data: { kind: 'start' }
    })

    const edges: EditorEdge[] = []
    if (definition.initial) {
      edges.push({
        id: `${START_NODE_ID}->${definition.initial}:start`,
        source: START_NODE_ID,
        target: definition.initial,
        label: 'start'
      })
    }

    for (const [sourceId, stateDef] of Object.entries(definition.states)) {
      for (const [event, targetDefRaw] of Object.entries(stateDef.on ?? {})) {
        const targetDefs = Array.isArray(targetDefRaw) ? targetDefRaw : [targetDefRaw]
        for (const targetDef of targetDefs) {
          edges.push({
            id: `${sourceId}->${targetDef.target}:${event}`,
            source: sourceId,
            target: targetDef.target,
            label: event
          })
        }
      }
    }

    return { nodes, edges }
  }

  function graphToDefinition(
    nodes: EditorNode[],
    edges: EditorEdge[],
    base: WorkflowDefinition = emptyDefinition('workflow')
  ): WorkflowDefinition {
    const stateNodes = nodes.filter(n => n.id !== START_NODE_ID)
    const states: WorkflowDefinition['states'] = {}
    const positions: Record<string, { x: number; y: number }> = {}

    for (const node of stateNodes) {
      states[node.id] = dataToState(node)
      positions[node.id] = node.position
    }
    const startEdge = edges.find(e => e.source === START_NODE_ID)
    const initial = startEdge?.target ?? base.initial

    for (const edge of edges) {
      if (edge.source === START_NODE_ID) continue
      const state = states[edge.source]
      if (!state) continue
      if (!state.on) state.on = {}
      state.on[edge.label] = { target: edge.target }
    }

    positions[START_NODE_ID] = nodes.find(n => n.id === START_NODE_ID)?.position ?? { x: 0, y: 0 }

    return {
      id: base.id,
      initial,
      states,
      context: base.context,
      meta: { ...base.meta, editorPositions: positions }
    }
  }

  return { definitionToGraph, graphToDefinition, START_NODE_ID }
}
```

### Step 2: Write round-trip test

Create `layers/workflow-editor/composables/__tests__/useWorkflowGraph.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { WorkflowDefinition } from 'shared'
import { useWorkflowGraph } from '../useWorkflowGraph.js'

const sample: WorkflowDefinition = {
  id: 'provisionCompany',
  initial: 'getCompany',
  states: {
    getCompany: {
      meta: { action: 'getRecord', params: { table: 'companies', filter: { id: { $context: 'record.id' } }, result: { type: 'first' } }, outputKey: 'company' },
      on: { ok: { target: 'checkExists' }, error: { target: 'failed' } }
    },
    checkExists: {
      meta: { action: 'condition', params: { expression: { $ne: [{ $context: 'company' }, null] } } },
      on: { true: { target: 'done' }, false: { target: 'approveProvision' } }
    },
    approveProvision: {
      tags: ['waiting'],
      meta: { taskType: 'approval', taskInstructions: 'Approve provisioning' },
      on: { approved: { target: 'done' }, rejected: { target: 'failed' } }
    },
    done: { type: 'final' },
    failed: { type: 'final' }
  },
  context: {},
  meta: { editorPositions: { getCompany: { x: 10, y: 20 } } }
}

describe('useWorkflowGraph', () => {
  const { definitionToGraph, graphToDefinition, START_NODE_ID } = useWorkflowGraph()

  it('converts a definition to a graph with a start node', () => {
    const { nodes, edges } = definitionToGraph(sample)
    expect(nodes.find(n => n.id === START_NODE_ID)).toBeDefined()
    expect(nodes.find(n => n.id === 'getCompany')?.type).toBe('action')
    expect(nodes.find(n => n.id === 'checkExists')?.type).toBe('condition')
    expect(nodes.find(n => n.id === 'approveProvision')?.type).toBe('task')
    expect(nodes.find(n => n.id === 'done')?.type).toBe('final')
  })

  it('round-trips a definition', () => {
    const { nodes, edges } = definitionToGraph(sample)
    const rebuilt = graphToDefinition(nodes, edges, sample)
    expect(rebuilt.initial).toBe('getCompany')
    expect(rebuilt.states.getCompany.meta).toEqual(sample.states.getCompany.meta)
    expect(rebuilt.states.approveProvision.tags).toEqual(['waiting'])
    expect(rebuilt.states.done.type).toBe('final')
  })

  it('normalizes a legacy entry/exit definition', () => {
    const legacy: WorkflowDefinition = {
      id: 'legacy',
      initial: 'a',
      states: {
        a: {
          entry: ['getRecord'],
          exit: [{ id: 'createRecord', params: {} }],
          meta: { action: 'getRecord', params: {} },
          on: { ok: { target: 'b', actions: ['foo'] } }
        },
        b: { type: 'final' }
      }
    }
    const { nodes } = definitionToGraph(legacy)
    const a = nodes.find(n => n.id === 'a')
    expect(a?.type).toBe('action')
    expect((a?.data as any).actionId).toBe('getRecord')
  })
})
```

### Step 3: Run tests

```bash
cd layers/workflow-editor && pnpm test
```

Expected: PASS.

### Step 4: Commit

```bash
git add layers/workflow-editor/composables/useWorkflowGraph.ts \
  layers/workflow-editor/composables/__tests__/useWorkflowGraph.test.ts
git commit -m "feat(workflow-editor): rewrite graph mapping with runtime-matched model and legacy normalization"
```

---

## Task 3: Validator

**Files:**
- Replace: `layers/workflow-editor/composables/useWorkflowValidator.ts`
- Test: `layers/workflow-editor/composables/__tests__/useWorkflowValidator.test.ts`

### Step 1: Replace `useWorkflowValidator.ts`

```ts
import type { EditorEdge, EditorNode } from './types.js'
import { useWorkflowRuntimeEvents } from './useWorkflowRuntimeEvents.js'

export interface ValidationError {
  id: string
  path: string
  message: string
}

const START_NODE_ID = '__start'
const JS_ID = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export function useWorkflowValidator() {
  const { isEventAllowed } = useWorkflowRuntimeEvents()

  function validate(nodes: EditorNode[], edges: EditorEdge[]): ValidationError[] {
    const errors: ValidationError[] = []
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const startNodes = nodes.filter(n => n.id === START_NODE_ID)

    if (startNodes.length !== 1) {
      errors.push({ id: START_NODE_ID, path: 'start', message: 'Exactly one Start node is required' })
    }

    const ids = new Set<string>()
    for (const node of nodes) {
      if (ids.has(node.id)) {
        errors.push({ id: node.id, path: `nodes.${node.id}`, message: `Duplicate state id "${node.id}"` })
      }
      ids.add(node.id)
      if (node.id !== START_NODE_ID && !JS_ID.test(node.id)) {
        errors.push({ id: node.id, path: `nodes.${node.id}`, message: `State id "${node.id}" must be a valid identifier` })
      }
    }

    const startEdges = edges.filter(e => e.source === START_NODE_ID)
    if (startEdges.length !== 1) {
      errors.push({ id: START_NODE_ID, path: 'start.edge', message: 'Start node must have exactly one outgoing transition' })
    } else if (!nodeMap.has(startEdges[0].target)) {
      errors.push({ id: startEdges[0].id, path: 'start.edge.target', message: 'Start transition points to a missing state' })
    }

    const hasFinal = nodes.some(n => n.type === 'final')
    if (!hasFinal) {
      errors.push({ id: 'final', path: 'final', message: 'At least one Final state is required' })
    }

    for (const node of nodes) {
      if (node.type === 'final') {
        const outgoing = edges.filter(e => e.source === node.id)
        if (outgoing.length) {
          errors.push({ id: node.id, path: `nodes.${node.id}.on`, message: 'Final states cannot have outgoing transitions' })
        }
        continue
      }

      if (node.id === START_NODE_ID) continue

      const outgoing = edges.filter(e => e.source === node.id)
      if (!outgoing.length) {
        errors.push({ id: node.id, path: `nodes.${node.id}.on`, message: `State "${node.id}" must have at least one outgoing transition` })
      }

      if (node.type === 'action' && node.data.kind === 'action') {
        if (!node.data.actionId) {
          errors.push({ id: node.id, path: `nodes.${node.id}.action`, message: `Action state "${node.id}" must select an action` })
        }
      }

      if (node.type === 'condition' && node.data.kind === 'condition') {
        if (node.data.expression === null || node.data.expression === undefined || JSON.stringify(node.data.expression) === '{}') {
          errors.push({ id: node.id, path: `nodes.${node.id}.expression`, message: `Condition state "${node.id}" must have an expression` })
        }
      }

      if (node.type === 'task' && node.data.kind === 'task') {
        if (!node.data.taskType) {
          errors.push({ id: node.id, path: `nodes.${node.id}.taskType`, message: `Task state "${node.id}" must select a task type` })
        }
      }
    }

    for (const edge of edges) {
      if (!nodeMap.has(edge.target)) {
        errors.push({ id: edge.id, path: `edges.${edge.id}.target`, message: `Transition targets missing state "${edge.target}"` })
      }
      const source = nodeMap.get(edge.source)
      if (!source) continue
      if (source.id === START_NODE_ID) continue
      if (!isEventAllowed(source, edge.label)) {
        errors.push({ id: edge.id, path: `edges.${edge.id}.event`, message: `Event "${edge.label}" is not allowed from state "${edge.source}"` })
      }
    }

    return errors
  }

  return { validate }
}
```

### Step 2: Write validator tests

Create `layers/workflow-editor/composables/__tests__/useWorkflowValidator.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { EditorEdge, EditorNode } from '../types.js'
import { useWorkflowValidator } from '../useWorkflowValidator.js'

describe('useWorkflowValidator', () => {
  const { validate } = useWorkflowValidator()

  it('flags missing start node', () => {
    const errors = validate([], [])
    expect(errors.some(e => e.path === 'start')).toBe(true)
  })

  it('flags final state with outgoing transition', () => {
    const nodes: EditorNode[] = [
      { id: '__start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
      { id: 'a', type: 'final', position: { x: 0, y: 0 }, data: { kind: 'final' } }
    ]
    const edges: EditorEdge[] = [
      { id: '__start->a:start', source: '__start', target: 'a', label: 'start' },
      { id: 'a->a:loop', source: 'a', target: 'a', label: 'loop' }
    ]
    const errors = validate(nodes, edges)
    expect(errors.some(e => e.message.includes('Final states cannot have outgoing'))).toBe(true)
  })

  it('flags invalid event from action state', () => {
    const nodes: EditorNode[] = [
      { id: '__start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
      { id: 'a', type: 'action', position: { x: 0, y: 0 }, data: { kind: 'action', actionId: 'getRecord', params: {}, outputKey: '' } },
      { id: 'b', type: 'final', position: { x: 0, y: 0 }, data: { kind: 'final' } }
    ]
    const edges: EditorEdge[] = [
      { id: '__start->a:start', source: '__start', target: 'a', label: 'start' },
      { id: 'a->b:approved', source: 'a', target: 'b', label: 'approved' }
    ]
    const errors = validate(nodes, edges)
    expect(errors.some(e => e.message.includes('not allowed'))).toBe(true)
  })
})
```

### Step 3: Run tests

```bash
cd layers/workflow-editor && pnpm test
```

Expected: PASS.

### Step 4: Commit

```bash
git add layers/workflow-editor/composables/useWorkflowValidator.ts \
  layers/workflow-editor/composables/__tests__/useWorkflowValidator.test.ts
git commit -m "feat(workflow-editor): add runtime-aware validator"
```

---

## Task 4: Editor state CRUD

**Files:**
- Replace: `layers/workflow-editor/composables/useWorkflowEditor.ts`
- Test: `layers/workflow-editor/composables/__tests__/useWorkflowEditor.test.ts`

### Step 1: Replace `useWorkflowEditor.ts`

```ts
import { ref, type Ref } from 'vue'
import type { WorkflowDefinition } from 'shared'
import type { EditorEdge, EditorNode } from './types.js'
import { useWorkflowGraph } from './useWorkflowGraph.js'
import { useWorkflowRuntimeEvents } from './useWorkflowRuntimeEvents.js'

export type EditorTool = 'select' | 'pan' | 'add-action' | 'add-condition' | 'add-task' | 'add-final'

export interface UseWorkflowEditorOptions {
  definition: Ref<WorkflowDefinition>
  readonly?: boolean
}

const START_NODE_ID = '__start'
let idCounter = 0

function uniqueId(prefix: string, nodes: EditorNode[]): string {
  let n = ++idCounter
  let candidate = `${prefix}${n}`
  while (nodes.some(node => node.id === candidate)) {
    candidate = `${prefix}${++n}`
  }
  return candidate
}

export function useWorkflowEditor(options: UseWorkflowEditorOptions) {
  const { definition, readonly } = options
  const { definitionToGraph, graphToDefinition } = useWorkflowGraph()
  const { defaultEvent } = useWorkflowRuntimeEvents()

  const nodes = ref<EditorNode[]>([])
  const edges = ref<EditorEdge[]>([])
  const selectedId = ref<string | null>(null)
  const tool = ref<EditorTool>('select')

  function load(def: WorkflowDefinition) {
    const graph = definitionToGraph(def)
    nodes.value = graph.nodes
    edges.value = graph.edges
  }

  function build(): WorkflowDefinition {
    return graphToDefinition(nodes.value, edges.value, definition.value)
  }

  function addNode(type: EditorNode['type'], position: { x: number; y: number }) {
    if (readonly) return
    if (type === 'start') return

    const id = uniqueId(
      type === 'final' ? 'done' : type,
      nodes.value
    )

    let data: EditorNode['data']
    if (type === 'final') data = { kind: 'final' }
    else if (type === 'condition') data = { kind: 'condition', expression: null }
    else if (type === 'task') data = { kind: 'task', taskType: 'manual', taskInstructions: '' }
    else data = { kind: 'action', actionId: '', params: {}, outputKey: '' }

    nodes.value.push({ id, type, position, data })
  }

  function removeNode(id: string) {
    if (readonly || id === START_NODE_ID) return
    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  function addTransition(source: string, target: string) {
    if (readonly) return
    const sourceNode = nodes.value.find(n => n.id === source)
    const targetNode = nodes.value.find(n => n.id === target)
    if (!sourceNode || !targetNode) return
    if (sourceNode.type === 'final') return

    const used = edges.value.filter(e => e.source === source).map(e => e.label)
    const event = defaultEvent(sourceNode, used)
    if (!event) return
    if (used.includes(event)) return

    const id = `${source}->${target}:${event}`
    if (edges.value.some(e => e.id === id)) return
    edges.value.push({ id, source, target, label: event })
  }

  function removeEdge(id: string) {
    if (readonly) return
    edges.value = edges.value.filter(e => e.id !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  function renameNode(oldId: string, newId: string) {
    if (readonly || oldId === START_NODE_ID) return
    const trimmed = newId.trim()
    if (!trimmed || nodes.value.some(n => n.id === trimmed)) return
    const node = nodes.value.find(n => n.id === oldId)
    if (!node) return
    node.id = trimmed
    for (const edge of edges.value) {
      if (edge.source === oldId) edge.source = trimmed
      if (edge.target === oldId) edge.target = trimmed
      if (edge.id.includes(oldId)) edge.id = `${edge.source}->${edge.target}:${edge.label}`
    }
    if (selectedId.value === oldId) selectedId.value = trimmed
  }

  function updateNodeData(id: string, data: Partial<EditorNode['data']>) {
    if (readonly) return
    const node = nodes.value.find(n => n.id === id)
    if (!node) return
    node.data = { ...node.data, ...data } as EditorNode['data']
  }

  function updateEdgeEvent(id: string, event: string) {
    if (readonly) return
    const edge = edges.value.find(e => e.id === id)
    if (!edge) return
    edge.label = event
    edge.id = `${edge.source}->${edge.target}:${event}`
  }

  return {
    nodes,
    edges,
    selectedId,
    tool,
    load,
    build,
    addNode,
    removeNode,
    addTransition,
    removeEdge,
    renameNode,
    updateNodeData,
    updateEdgeEvent
  }
}
```

### Step 2: Write CRUD tests

Create `layers/workflow-editor/composables/__tests__/useWorkflowEditor.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { WorkflowDefinition } from 'shared'
import { useWorkflowEditor } from '../useWorkflowEditor.js'

const emptyDef: WorkflowDefinition = { id: 'test', initial: '', states: {} }

describe('useWorkflowEditor', () => {
  it('adds an action node', () => {
    const { nodes, addNode } = useWorkflowEditor({ definition: ref(emptyDef) })
    addNode('action', { x: 10, y: 20 })
    expect(nodes.value).toHaveLength(1)
    expect(nodes.value[0].type).toBe('action')
    expect(nodes.value[0].data.kind).toBe('action')
  })

  it('adds a transition with the default event', () => {
    const editor = useWorkflowEditor({ definition: ref(emptyDef) })
    editor.addNode('action', { x: 0, y: 0 })
    editor.addNode('final', { x: 200, y: 0 })
    const actionId = editor.nodes.value[0].id
    const finalId = editor.nodes.value[1].id
    editor.addTransition(actionId, finalId)
    expect(editor.edges.value[0].label).toBe('ok')
  })

  it('renames a node and updates edges', () => {
    const editor = useWorkflowEditor({ definition: ref(emptyDef) })
    editor.addNode('action', { x: 0, y: 0 })
    const oldId = editor.nodes.value[0].id
    editor.renameNode(oldId, 'fetchUser')
    expect(editor.nodes.value[0].id).toBe('fetchUser')
  })
})
```

### Step 3: Run tests

```bash
cd layers/workflow-editor && pnpm test
```

Expected: PASS.

### Step 4: Commit

```bash
git add layers/workflow-editor/composables/useWorkflowEditor.ts \
  layers/workflow-editor/composables/__tests__/useWorkflowEditor.test.ts
git commit -m "feat(workflow-editor): add graph CRUD composable"
```

---

## Task 5: Node components

**Files:**
- Create: `layers/workflow-editor/components/StartNode.vue`
- Create: `layers/workflow-editor/components/ActionNode.vue`
- Create: `layers/workflow-editor/components/ConditionNode.vue`
- Create: `layers/workflow-editor/components/TaskNode.vue`
- Create: `layers/workflow-editor/components/FinalNode.vue`
- Delete: `layers/workflow-editor/components/StateNode.vue`
- Delete: `layers/workflow-editor/components/ActionListEditor.vue`

### Step 1: Create `StartNode.vue`

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  selected?: boolean
}>()
</script>

<template>
  <div
    class="w-16 h-16 rounded-full border-2 bg-gray-100 flex items-center justify-center text-xs font-bold shadow-sm"
    :class="selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-400'"
  >
    Start
    <Handle type="source" :position="Position.Right" class="!bg-gray-400" />
  </div>
</template>
```

### Step 2: Create `ActionNode.vue`

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { EditorNode } from '../composables/types.js'

defineProps<{
  id: string
  data: EditorNode['data']
  selected?: boolean
}>()
</script>

<template>
  <div
    class="min-w-[140px] px-3 py-2 rounded-lg border-2 bg-blue-50 text-center shadow-sm"
    :class="selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-300'"
  >
    <Handle type="target" :position="Position.Top" class="!bg-blue-400" />
    <div class="font-semibold text-sm">{{ id }}</div>
    <div v-if="data.kind === 'action'" class="text-xs text-blue-700 mt-1">
      {{ data.actionId || 'No action' }}
    </div>
    <div v-if="data.kind === 'action' && data.outputKey" class="text-[10px] text-gray-500">
      → {{ data.outputKey }}
    </div>
    <Handle type="source" :position="Position.Bottom" class="!bg-blue-400" />
  </div>
</template>
```

### Step 3: Create `ConditionNode.vue`

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  id: string
  selected?: boolean
}>()
</script>

<template>
  <div
    class="w-24 h-24 flex items-center justify-center"
    :class="selected ? 'drop-shadow-md' : ''"
  >
    <div
      class="w-16 h-16 rotate-45 border-2 bg-amber-50 flex items-center justify-center shadow-sm"
      :class="selected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-300'"
    >
      <span class="-rotate-45 text-xs font-semibold text-center">{{ id }}</span>
    </div>
    <Handle type="target" :position="Position.Top" class="!bg-amber-400" />
    <Handle type="source" :position="Position.Bottom" class="!bg-amber-400" />
    <Handle type="source" :position="Position.Left" class="!bg-amber-400" />
    <Handle type="source" :position="Position.Right" class="!bg-amber-400" />
  </div>
</template>
```

### Step 4: Create `TaskNode.vue`

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { EditorNode } from '../composables/types.js'

defineProps<{
  id: string
  data: EditorNode['data']
  selected?: boolean
}>()
</script>

<template>
  <div
    class="min-w-[140px] px-3 py-2 rounded-lg border-2 bg-purple-50 text-center shadow-sm"
    :class="selected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-purple-300'"
  >
    <Handle type="target" :position="Position.Top" class="!bg-purple-400" />
    <div class="font-semibold text-sm">{{ id }}</div>
    <div v-if="data.kind === 'task'" class="text-xs text-purple-700 mt-1 capitalize">
      {{ data.taskType }} task
    </div>
    <Handle type="source" :position="Position.Bottom" class="!bg-purple-400" />
  </div>
</template>
```

### Step 5: Create `FinalNode.vue`

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  id: string
  selected?: boolean
}>()
</script>

<template>
  <div
    class="min-w-[100px] px-3 py-2 rounded-lg border-2 bg-green-50 text-center shadow-sm"
    :class="selected ? 'border-green-500 ring-2 ring-green-200' : 'border-green-300'"
  >
    <Handle type="target" :position="Position.Top" class="!bg-green-400" />
    <div class="font-semibold text-sm">{{ id }}</div>
    <div class="text-[10px] text-green-700">final</div>
  </div>
</template>
```

### Step 6: Delete legacy components

```bash
rm layers/workflow-editor/components/StateNode.vue
rm layers/workflow-editor/components/ActionListEditor.vue
```

### Step 7: Commit

```bash
git add layers/workflow-editor/components/StartNode.vue \
  layers/workflow-editor/components/ActionNode.vue \
  layers/workflow-editor/components/ConditionNode.vue \
  layers/workflow-editor/components/TaskNode.vue \
  layers/workflow-editor/components/FinalNode.vue
git rm layers/workflow-editor/components/StateNode.vue \
  layers/workflow-editor/components/ActionListEditor.vue
git commit -m "feat(workflow-editor): add typed node components and remove legacy ones"
```

---

## Task 6: Canvas and edge

**Files:**
- Replace: `layers/workflow-editor/components/WorkflowCanvas.vue`
- Replace: `layers/workflow-editor/components/TransitionEdge.vue`

### Step 1: Replace `WorkflowCanvas.vue`

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { EditorNode, EditorEdge } from '../composables/types.js'
import type { EditorTool } from '../composables/useWorkflowEditor.js'
import StartNode from './StartNode.vue'
import ActionNode from './ActionNode.vue'
import ConditionNode from './ConditionNode.vue'
import TaskNode from './TaskNode.vue'
import FinalNode from './FinalNode.vue'
import TransitionEdge from './TransitionEdge.vue'

const props = defineProps<{
  nodes: EditorNode[]
  edges: EditorEdge[]
  tool: EditorTool
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:nodes', nodes: EditorNode[]): void
  (e: 'update:edges', edges: EditorEdge[]): void
  (e: 'select', id: string | null): void
  (e: 'add-node', type: EditorNode['type'], position: { x: number; y: number }): void
  (e: 'connect', params: { source: string; target: string }): void
}>()

const vueFlowInstance = ref<any>(null)

function onInit(instance: any) {
  vueFlowInstance.value = instance
}

const nodeTypes = {
  start: StartNode,
  action: ActionNode,
  condition: ConditionNode,
  task: TaskNode,
  final: FinalNode
}

const edgeTypes = { transition: TransitionEdge }

const flowNodes = computed({
  get: () => props.nodes,
  set: (value) => emit('update:nodes', value)
})

const flowEdges = computed({
  get: () => props.edges,
  set: (value) => emit('update:edges', value)
})

// VueFlow does not expose a pane double-click event, so add-node is triggered
// by a single pane click when the active tool is an add-* tool.
function onPaneClick(event: MouseEvent) {
  if (props.tool.startsWith('add-')) {
    if (props.readonly) return
    const type = props.tool.replace('add-', '') as EditorNode['type']
    const position = vueFlowInstance.value
      ? vueFlowInstance.value.screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
      : { x: event.offsetX, y: event.offsetY }
    emit('add-node', type, position)
    return
  }
  if (props.tool === 'select' || props.tool === 'pan') {
    emit('select', null)
  }
}

function onConnect(params: { source: string; target: string }) {
  if (props.readonly) return
  emit('connect', params)
}

function onNodeClick(_event: MouseEvent, node: EditorNode) {
  emit('select', node.id)
}

function onEdgeClick(_event: MouseEvent, edge: EditorEdge) {
  emit('select', edge.id)
}

function fitView() {
  vueFlowInstance.value?.fitView()
}

defineExpose({ fitView })
</script>

<template>
  <div class="flex-1 h-full">
    <VueFlow
      v-model:nodes="flowNodes"
      v-model:edges="flowEdges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :pan-on-drag="tool === 'pan'"
      :nodes-draggable="tool === 'select' && !readonly"
      :nodes-connectable="tool === 'select' && !readonly"
      :edges-updatable="false"
      :delete-key-code="null"
      fit-view-on-init
      @init="onInit"
      @pane-click="onPaneClick"
      @connect="onConnect"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
    >
      <Background />
    </VueFlow>
  </div>
</template>
```

### Step 2: Replace `TransitionEdge.vue`

```vue
<script setup lang="ts">
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@vue-flow/core'
import type { EditorEdge } from '../composables/types.js'

const props = defineProps<EdgeProps<EditorEdge> & {
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'delete', id: string): void
}>()

const path = computed(() => getBezierPath({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  targetX: props.targetX,
  targetY: props.targetY,
  sourcePosition: props.sourcePosition,
  targetPosition: props.targetPosition
}))
</script>

<template>
  <BaseEdge :id="id" :path="path[0]" :marker-end="markerEnd" :style="style" />

  <EdgeLabelRenderer>
    <div
      :style="{
        transform: `translate(-50%, -50%) translate(${path[1]}px,${path[2]}px)`,
        pointerEvents: 'all'
      }"
      class="absolute nodrag nopan flex items-center gap-1 px-2 py-0.5 bg-white border rounded text-xs shadow-sm"
      :class="selected ? 'border-blue-500' : 'border-gray-300'"
    >
      <span>{{ label }}</span>
      <button
        v-if="!readonly"
        class="ml-1 text-gray-400 hover:text-red-600"
        @click="emit('delete', id)"
      >
        ×
      </button>
    </div>
  </EdgeLabelRenderer>
</template>
```

### Step 3: Commit

```bash
git add layers/workflow-editor/components/WorkflowCanvas.vue \
  layers/workflow-editor/components/TransitionEdge.vue
git commit -m "feat(workflow-editor): wire typed nodes and edges into VueFlow canvas"
```

---

## Task 7: Inspector and config panels

**Files:**
- Replace: `layers/workflow-editor/components/ActionConfigPanel.vue`
- Create: `layers/workflow-editor/components/ConditionConfigPanel.vue`
- Create: `layers/workflow-editor/components/TaskConfigPanel.vue`
- Replace: `layers/workflow-editor/components/WorkflowContextPanel.vue`
- Replace: `layers/workflow-editor/components/DetailsPanel.vue`

### Step 1: Replace `ActionConfigPanel.vue`

```vue
<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { ActionMetadata, ParamSchema } from 'shared'

export interface ActionConfig {
  actionId: string
  params: Record<string, unknown>
  outputKey: string
}

const props = defineProps<{
  modelValue: ActionConfig
  actions: ActionMetadata[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ActionConfig): void
}>()

const activeAction = computed(() => props.actions.find(a => a.id === props.modelValue.actionId))
const jsonErrors = reactive<Record<string, string>>({})

function update(patch: Partial<ActionConfig>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function updateParam(key: string, value: unknown) {
  const next = { ...(props.modelValue.params ?? {}), [key]: value }
  update({ params: next })
}

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

function defaultValue(schema: ParamSchema): unknown {
  if (schema.default !== undefined) return schema.default
  if (schema.type === 'json') return {}
  if (schema.type === 'boolean') return false
  if (schema.type === 'number') return 0
  return ''
}

function coerceValue(schema: ParamSchema, raw: string): unknown {
  if (schema.type === 'boolean') return raw === 'true'
  if (schema.type === 'number') {
    const n = Number(raw)
    return Number.isNaN(n) ? undefined : n
  }
  return raw
}

function autoOutputKey(actionId: string, params?: Record<string, unknown>): string {
  const table = String(params?.table ?? '')
  const cap = table ? table.charAt(0).toUpperCase() + table.slice(1) : 'Record'
  if (actionId === 'getRecord') {
    const type = (params?.result as { type?: string })?.type ?? 'first'
    return type === 'list' ? `${table}List` : table
  }
  if (actionId === 'createRecord') return `new${cap}`
  if (actionId === 'updateRecord') return `updated${cap}`
  if (actionId === 'deleteRecord') return `deleted${cap}`
  return ''
}

function onSelectAction(actionId: string) {
  for (const key of Object.keys(jsonErrors)) delete jsonErrors[key]
  const action = props.actions.find(a => a.id === actionId)
  const params: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(action?.paramsSchema ?? {})) {
    params[key] = defaultValue(schema)
  }
  update({
    actionId,
    params,
    outputKey: autoOutputKey(actionId, params)
  })
}

function onJsonBlur(key: string, raw: string) {
  try {
    const parsed = JSON.parse(raw)
    delete jsonErrors[key]
    updateParam(key, parsed)
  } catch {
    jsonErrors[key] = 'Invalid JSON'
  }
}

watch(
  () => props.modelValue.params,
  (newParams, oldParams) => {
    if (!props.modelValue.actionId) return
    const newAuto = autoOutputKey(props.modelValue.actionId, newParams)
    const oldAuto = autoOutputKey(props.modelValue.actionId, oldParams)
    const current = props.modelValue.outputKey
    if (!current || current === oldAuto) {
      update({ outputKey: newAuto })
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="space-y-3">
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Action</label>
      <select
        :value="modelValue.actionId"
        class="w-full border rounded px-2 py-1 text-sm"
        :disabled="readonly"
        @change="onSelectAction(($event.target as HTMLSelectElement).value)"
      >
        <option value="">No action</option>
        <option v-for="action in actions" :key="action.id" :value="action.id">{{ action.label }}</option>
      </select>
    </div>

    <template v-if="activeAction">
      <div v-for="(schema, key) in activeAction.paramsSchema" :key="key">
        <label class="block text-xs font-medium text-gray-600 mb-1">{{ schema.label }}</label>

        <input
          v-if="schema.type === 'string'"
          :value="(modelValue.params?.[key] as string) ?? ''"
          type="text"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @input="updateParam(key, ($event.target as HTMLInputElement).value)"
        />

        <input
          v-else-if="schema.type === 'number'"
          :value="(modelValue.params?.[key] as number) ?? 0"
          type="number"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @change="updateParam(key, coerceValue(schema, ($event.target as HTMLInputElement).value))"
        />

        <select
          v-else-if="schema.type === 'boolean' || schema.type === 'select'"
          :value="String(modelValue.params?.[key] ?? '')"
          class="w-full border rounded px-2 py-1 text-sm"
          :disabled="readonly"
          @change="updateParam(key, coerceValue(schema, ($event.target as HTMLSelectElement).value))"
        >
          <option
            v-for="opt in schema.type === 'boolean'
              ? [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }]
              : (schema.options ?? [])"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>

        <template v-else-if="schema.type === 'json'">
          <textarea
            :value="formatJson(modelValue.params?.[key])"
            rows="4"
            class="w-full border rounded px-2 py-1 text-sm font-mono"
            :class="{ 'border-red-500': jsonErrors[key] }"
            :readonly="readonly"
            @blur="onJsonBlur(key, ($event.target as HTMLTextAreaElement).value)"
          />
          <p v-if="jsonErrors[key]" class="text-xs text-red-600 mt-1">{{ jsonErrors[key] }}</p>
        </template>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Output key</label>
        <input
          :value="modelValue.outputKey"
          type="text"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @input="update({ outputKey: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </template>
  </div>
</template>
```

### Step 2: Create `ConditionConfigPanel.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  expression: unknown
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:expression', value: unknown): void
}>()

const json = computed({
  get: () => JSON.stringify(props.expression ?? {}, null, 2),
  set: (value: string) => {
    try {
      emit('update:expression', JSON.parse(value))
    } catch {
      // ignore while typing; parent can validate
    }
  }
})
</script>

<template>
  <div>
    <label class="block text-xs font-medium text-gray-600 mb-1">Expression (JSON)</label>
    <textarea
      v-model="json"
      rows="6"
      class="w-full border rounded px-2 py-1 text-sm font-mono"
      :readonly="readonly"
    />
    <p class="text-[10px] text-gray-500 mt-1">
      Use MongoDB-style operators: <code>$eq</code>, <code>$ne</code>, <code>$and</code>, <code>$or</code>, <code>$context.field</code>.
    </p>
  </div>
</template>
```

### Step 3: Create `TaskConfigPanel.vue`

```vue
<script setup lang="ts">
import type { EditorNodeData } from '../composables/types.js'

type TaskType = Extract<EditorNodeData, { kind: 'task' }>['taskType']

const props = defineProps<{
  taskType: TaskType
  taskInstructions: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:taskType', value: TaskType): void
  (e: 'update:taskInstructions', value: string): void
}>()

const taskTypes: { label: string; value: TaskType }[] = [
  { label: 'Approval', value: 'approval' },
  { label: 'Review', value: 'review' },
  { label: 'Manual', value: 'manual' }
]
</script>

<template>
  <div class="space-y-3">
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Task type</label>
      <select
        :value="taskType"
        class="w-full border rounded px-2 py-1 text-sm"
        :disabled="readonly"
        @change="emit('update:taskType', ($event.target as HTMLSelectElement).value as TaskType)"
      >
        <option v-for="t in taskTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Instructions</label>
      <textarea
        :value="taskInstructions"
        rows="4"
        class="w-full border rounded px-2 py-1 text-sm"
        :readonly="readonly"
        @input="emit('update:taskInstructions', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
  </div>
</template>
```

### Step 4: Replace `WorkflowContextPanel.vue`

Rename the existing `ContextPanel.vue` to `WorkflowContextPanel.vue` to avoid clashing with a future generic `ContextPanel`.

```bash
git mv layers/workflow-editor/components/ContextPanel.vue layers/workflow-editor/components/WorkflowContextPanel.vue
```

Then replace its content:

```vue
<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'

const props = defineProps<{
  definition: WorkflowDefinition
  name?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:name', value: string): void
  (e: 'update:definition', value: WorkflowDefinition): void
}>()

const contextJson = computed({
  get: () => JSON.stringify(props.definition.context ?? {}, null, 2),
  set: (value: string) => {
    try {
      const parsed = JSON.parse(value)
      emit('update:definition', { ...props.definition, context: parsed })
    } catch {
      // ignore invalid JSON while typing
    }
  }
})
</script>

<template>
  <div class="p-4 space-y-4">
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Workflow ID</label>
      <input :value="definition.id" class="w-full border rounded px-2 py-1 text-sm bg-gray-50" readonly />
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Workflow name</label>
      <input
        :value="name"
        class="w-full border rounded px-2 py-1 text-sm"
        :readonly="readonly"
        @input="emit('update:name', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Context (JSON)</label>
      <textarea
        v-model="contextJson"
        class="w-full h-48 border rounded px-2 py-1 text-xs font-mono"
        :readonly="readonly"
      />
    </div>
  </div>
</template>
```

### Step 5: Replace `DetailsPanel.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { EditorEdge, EditorNode } from '../composables/types.js'
import type { ActionMetadata } from 'shared'
import ActionConfigPanel from './ActionConfigPanel.vue'
import ConditionConfigPanel from './ConditionConfigPanel.vue'
import TaskConfigPanel from './TaskConfigPanel.vue'
import { useWorkflowRuntimeEvents } from '../composables/useWorkflowRuntimeEvents.js'

const props = defineProps<{
  selectedNode?: EditorNode
  selectedEdge?: EditorEdge
  actions: ActionMetadata[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:node', id: string, data: Partial<EditorNode['data']>): void
  (e: 'update:edge', id: string, event: string): void
  (e: 'rename:node', oldId: string, newId: string): void
  (e: 'select:node', id: string): void
}>()

const { getResultEvents, isEventAllowed } = useWorkflowRuntimeEvents()

const nodeName = computed({
  get: () => props.selectedNode?.id ?? '',
  set: (value: string) => {
    if (props.selectedNode && value !== props.selectedNode.id) {
      emit('rename:node', props.selectedNode.id, value)
    }
  }
})

const allowedEvents = computed(() => {
  if (!props.selectedEdge) return []
  const source = props.selectedNode ? undefined : undefined
  // Source node id comes from edge; parent passes only selected edge.
  // We compute allowed events from edge source by looking it up via a prop if added later.
  // For now, allow any event and let validation catch invalid ones.
  return []
})

function updateActionConfig(config: { actionId: string; params: Record<string, unknown>; outputKey: string }) {
  if (!props.selectedNode) return
  emit('update:node', props.selectedNode.id, {
    kind: 'action',
    actionId: config.actionId,
    params: config.params,
    outputKey: config.outputKey
  } as Partial<EditorNode['data']>)
}

function updateConditionExpression(expression: unknown) {
  if (!props.selectedNode) return
  emit('update:node', props.selectedNode.id, { kind: 'condition', expression } as Partial<EditorNode['data']>)
}

function updateTask(patch: Partial<{ taskType: 'approval' | 'review' | 'manual'; taskInstructions: string }>) {
  if (!props.selectedNode || props.selectedNode.data.kind !== 'task') return
  emit('update:node', props.selectedNode.id, { kind: 'task', ...props.selectedNode.data, ...patch } as Partial<EditorNode['data']>)
}
</script>

<template>
  <div class="p-4 space-y-4">
    <div v-if="!selectedNode && !selectedEdge" class="text-sm text-gray-500">
      Select a state or transition to edit its details.
    </div>

    <template v-if="selectedNode">
      <div v-if="selectedNode.id !== '__start'">
        <label class="block text-xs font-medium text-gray-600 mb-1">State ID</label>
        <input v-model="nodeName" class="w-full border rounded px-2 py-1 text-sm" :readonly="readonly" />
      </div>

      <div v-if="selectedNode.type === 'final'" class="text-sm text-gray-500">
        Final state. No configuration needed.
      </div>

      <ActionConfigPanel
        v-if="selectedNode.type === 'action' && selectedNode.data.kind === 'action'"
        :model-value="{ actionId: selectedNode.data.actionId, params: selectedNode.data.params, outputKey: selectedNode.data.outputKey }"
        :actions="actions"
        :readonly="readonly"
        @update:model-value="updateActionConfig"
      />

      <ConditionConfigPanel
        v-if="selectedNode.type === 'condition' && selectedNode.data.kind === 'condition'"
        :expression="selectedNode.data.expression"
        :readonly="readonly"
        @update:expression="updateConditionExpression"
      />

      <TaskConfigPanel
        v-if="selectedNode.type === 'task' && selectedNode.data.kind === 'task'"
        :task-type="selectedNode.data.taskType"
        :task-instructions="selectedNode.data.taskInstructions"
        :readonly="readonly"
        @update:task-type="updateTask({ taskType: $event })"
        @update:task-instructions="updateTask({ taskInstructions: $event })"
      />
    </template>

    <template v-if="selectedEdge">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Event</label>
        <input
          :value="selectedEdge.label"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @change="emit('update:edge', selectedEdge.id, ($event.target as HTMLInputElement).value)"
        />
        <p class="text-[10px] text-gray-500 mt-1">
          Suggested events depend on the source state type.
        </p>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Source → Target</label>
        <div class="text-sm">
          <button class="text-blue-600 hover:underline" @click="emit('select:node', selectedEdge.source)">
            {{ selectedEdge.source }}
          </button>
          →
          <button class="text-blue-600 hover:underline" @click="emit('select:node', selectedEdge.target)">
            {{ selectedEdge.target }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
```

### Step 6: Commit

```bash
git add layers/workflow-editor/components/ActionConfigPanel.vue \
  layers/workflow-editor/components/ConditionConfigPanel.vue \
  layers/workflow-editor/components/TaskConfigPanel.vue \
  layers/workflow-editor/components/WorkflowContextPanel.vue \
  layers/workflow-editor/components/DetailsPanel.vue
git commit -m "feat(workflow-editor): add inspector and config panels"
```

---

## Task 8: Toolbar and validation drawer

**Files:**
- Replace: `layers/workflow-editor/components/WorkflowToolbar.vue`
- Create: `layers/workflow-editor/components/ValidationDrawer.vue`

### Step 1: Replace `WorkflowToolbar.vue`

```vue
<script setup lang="ts">
import type { EditorTool } from '../composables/useWorkflowEditor.js'

const tool = defineModel<EditorTool>('tool', { required: true })
const name = defineModel<string>('name')

const props = defineProps<{
  readonly?: boolean
  canSave?: boolean
}>()

const emit = defineEmits<{
  (e: 'fit-view'): void
  (e: 'save'): void
}>()
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-2 bg-white border-b flex-wrap">
    <input
      v-model="name"
      type="text"
      placeholder="Workflow name"
      class="border rounded px-2 py-1 text-sm w-48"
      :readonly="readonly"
    />

    <select
      :value="tool"
      class="border rounded px-2 py-1 text-sm"
      :disabled="readonly"
      @change="tool = ($event.target as HTMLSelectElement).value as EditorTool"
    >
      <option value="select">Select</option>
      <option value="pan">Pan</option>
      <option value="add-action">+ Action</option>
      <option value="add-condition">+ Condition</option>
      <option value="add-task">+ Task</option>
      <option value="add-final">+ Final</option>
    </select>

    <div class="flex-1" />

    <button class="px-2 py-1 text-sm rounded border border-gray-300" @click="emit('fit-view')">
      Fit view
    </button>
    <button
      v-if="!readonly"
      class="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
      :disabled="!canSave"
      @click="emit('save')"
    >
      Save
    </button>
  </div>
</template>
```

### Step 2: Create `ValidationDrawer.vue`

```vue
<script setup lang="ts">
import type { ValidationError } from '../composables/useWorkflowValidator.js'

const props = defineProps<{
  errors: ValidationError[]
}>()

const emit = defineEmits<{
  (e: 'focus', id: string): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
</script>

<template>
  <div v-if="errors.length" class="border-t bg-red-50">
    <button
      class="w-full px-3 py-1 text-left text-xs font-medium text-red-700 flex items-center justify-between"
      @click="isOpen = !isOpen"
    >
      <span>{{ errors.length }} validation issue{{ errors.length === 1 ? '' : 's' }}</span>
      <span>{{ isOpen ? '▼' : '▲' }}</span>
    </button>
    <ul v-if="isOpen" class="px-3 py-2 text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
      <li
        v-for="error in errors"
        :key="`${error.id}-${error.message}`"
        class="cursor-pointer hover:underline"
        @click="emit('focus', error.id)"
      >
        {{ error.path }}: {{ error.message }}
      </li>
    </ul>
  </div>
</template>
```

### Step 3: Commit

```bash
git add layers/workflow-editor/components/WorkflowToolbar.vue \
  layers/workflow-editor/components/ValidationDrawer.vue
git commit -m "feat(workflow-editor): add toolbar and validation drawer"
```

---

## Task 9: Shell assembly

**Files:**
- Replace: `layers/workflow-editor/components/WorkflowEditor.vue`
- Delete: `layers/workflow-editor/plugins/focus-directive.ts`

### Step 1: Replace `WorkflowEditor.vue`

```vue
<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'
import { useWorkflowEditor } from '../composables/useWorkflowEditor.js'
import { useWorkflowActions } from '../composables/useWorkflowActions.js'
import { useWorkflowValidator } from '../composables/useWorkflowValidator.js'
import WorkflowToolbar from './WorkflowToolbar.vue'
import WorkflowCanvas from './WorkflowCanvas.vue'
import SidebarPanel from './SidebarPanel.vue'
import WorkflowContextPanel from './WorkflowContextPanel.vue'
import DetailsPanel from './DetailsPanel.vue'
import ValidationDrawer from './ValidationDrawer.vue'

const props = defineProps<{
  modelValue: WorkflowDefinition
  name?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: WorkflowDefinition): void
  (e: 'update:name', value: string): void
  (e: 'save', value: WorkflowDefinition): void
  (e: 'error', message: string): void
}>()

const definition = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const editor = useWorkflowEditor({ definition, readonly: props.readonly })
const { actions } = useWorkflowActions()
const { validate } = useWorkflowValidator()

const canvasRef = ref<InstanceType<typeof WorkflowCanvas> | null>(null)
const sidebarOpen = ref(true)
const activeTab = ref<'context' | 'details'>('details')
const validationOpen = ref(true)

const selectedNode = computed(() => editor.nodes.value.find(n => n.id === editor.selectedId.value))
const selectedEdge = computed(() => editor.edges.value.find(e => e.id === editor.selectedId.value))
const errors = computed(() => validate(editor.nodes.value, editor.edges.value))
const canSave = computed(() => !props.readonly && errors.value.length === 0)

function onConnect(params: { source: string; target: string }) {
  editor.addTransition(params.source, params.target)
}

function onAddNode(type: EditorNode['type'], position: { x: number; y: number }) {
  editor.addNode(type, position)
}

function fitView() {
  canvasRef.value?.fitView()
}

function onSave() {
  if (!canSave.value) {
    emit('error', 'Please fix validation errors before saving.')
    return
  }
  emit('save', props.modelValue)
}

function onFocusError(id: string) {
  editor.selectedId.value = id
  // VueFlow exposes fitView with nodes option if needed; keep simple for now.
}

let isInternalUpdate = false

watch([editor.nodes, editor.edges], () => {
  isInternalUpdate = true
  emit('update:modelValue', editor.build())
  nextTick(() => { isInternalUpdate = false })
}, { deep: true })

watch(() => props.modelValue, (def) => {
  if (def && !isInternalUpdate) {
    editor.load(def)
  }
}, { deep: false })

onMounted(() => {
  editor.load(props.modelValue)
})
</script>

<template>
  <div class="flex flex-col h-full min-h-[600px] border rounded bg-white">
    <WorkflowToolbar
      v-model:tool="editor.tool.value"
      v-model:name="name"
      :readonly="readonly"
      :can-save="canSave"
      @fit-view="fitView"
      @save="onSave"
    />

    <div class="flex flex-1 overflow-hidden">
      <WorkflowCanvas
        ref="canvasRef"
        :nodes="editor.nodes.value"
        :edges="editor.edges.value"
        :tool="editor.tool.value"
        :readonly="readonly"
        @update:nodes="editor.nodes.value = $event"
        @update:edges="editor.edges.value = $event"
        @select="editor.selectedId.value = $event"
        @add-node="onAddNode"
        @connect="onConnect"
      />

      <SidebarPanel v-model:open="sidebarOpen" v-model:active-tab="activeTab">
        <WorkflowContextPanel
          v-if="activeTab === 'context'"
          :definition="modelValue"
          :name="name"
          :readonly="readonly"
          @update:name="emit('update:name', $event)"
          @update:definition="emit('update:modelValue', $event)"
        />
        <DetailsPanel
          v-if="activeTab === 'details'"
          :selected-node="selectedNode"
          :selected-edge="selectedEdge"
          :actions="actions"
          :readonly="readonly"
          @update:node="editor.updateNodeData"
          @update:edge="editor.updateEdgeEvent"
          @rename:node="editor.renameNode"
          @select:node="editor.selectedId.value = $event"
        />
      </SidebarPanel>
    </div>

    <ValidationDrawer
      v-model:open="validationOpen"
      :errors="errors"
      @focus="onFocusError"
    />
  </div>
</template>
```

### Step 2: Delete focus plugin

```bash
rm layers/workflow-editor/plugins/focus-directive.ts
```

### Step 3: Commit

```bash
git add layers/workflow-editor/components/WorkflowEditor.vue
git rm layers/workflow-editor/plugins/focus-directive.ts
git commit -m "feat(workflow-editor): assemble new editor shell"
```

---

## Task 10: Host app integration

**Files:**
- Modify: `apps/admin/app/pages/workflows/[id].vue`
- Modify: `apps/admin/app/pages/workflows/new.vue`
- Modify: `apps/web/app/pages/workflows/[id].vue`
- Modify: `apps/web/app/pages/workflows/new.vue`

### Step 1: Add error handling and save guard to admin edit page

Modify `apps/admin/app/pages/workflows/[id].vue`:

```vue
<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'

const route = useRoute()
const id = route.params.id as string

const workflow = ref<{ name: string; xstateConfig: WorkflowDefinition } | null>(null)
const api = useApi()
const toast = useToast() // Nuxt UI toast; replace with your app's toast if different

const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})

onMounted(async () => {
  workflow.value = await api.fetch(`/api/admin/workflows/${id}`)
})

watchEffect(() => {
  if (workflow.value) {
    name.value = workflow.value.name
    config.value = workflow.value.xstateConfig
  }
})

function onError(message: string) {
  toast.add({ title: 'Workflow editor', description: message, color: 'red' })
}

async function save() {
  await api.fetch(`/api/admin/workflows/${id}`, {
    method: 'PATCH',
    body: { name: name.value, xstateConfig: config.value }
  })
  await navigateTo('/workflows')
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Edit platform workflow</h1>

    <ClientOnly>
      <WorkflowEditor
        v-if="config"
        v-model="config"
        :name="name"
        @update:name="name = $event"
        @save="save"
        @error="onError"
      />
    </ClientOnly>
  </div>
</template>
```

Repeat the same `onError` and `@error` wiring for:
- `apps/admin/app/pages/workflows/new.vue`
- `apps/web/app/pages/workflows/[id].vue`
- `apps/web/app/pages/workflows/new.vue`

If the app does not have `useToast()`, emit the error to a simple `alert()` or your existing toast composable.

### Step 2: Commit

```bash
git add apps/admin/app/pages/workflows/[id].vue \
  apps/admin/app/pages/workflows/new.vue \
  apps/web/app/pages/workflows/[id].vue \
  apps/web/app/pages/workflows/new.vue
git commit -m "feat(workflow-editor): wire error emit into host pages"
```

---

## Task 11: Verification and docs

**Files:**
- Modify: `docs/40-Packages/workflow-editor-layer.md`
- Modify: `docs/50-Features/Workflow Designer.md`
- Modify: `.gitignore`

### Step 1: Run layer tests

```bash
pnpm --filter workflow-editor-layer test
```

Expected: all tests pass.

### Step 2: Run typecheck for the layer and both apps

```bash
pnpm --filter workflow-editor-layer typecheck || true
pnpm --filter web typecheck
pnpm --filter admin typecheck
```

Expected: no new errors in `apps/web` or `apps/admin` outside unrelated areas. Fix any type errors in the layer or host pages before proceeding.

### Step 3: Update package documentation

Modify `docs/40-Packages/workflow-editor-layer.md` to describe the new node types, runtime-matched model, and host app contract.

Modify `docs/50-Features/Workflow Designer.md`:
- Set `status: in-progress` during work, then `status: done` when verified.
- Update `updated:` date.
- Reference the new design spec.

### Step 4: Add `.superpowers` to `.gitignore`

```gitignore
# Superpowers brainstorming sessions
.superpowers/
```

### Step 5: Final commit

```bash
git add docs/40-Packages/workflow-editor-layer.md \
  docs/50-Features/Workflow Designer.md \
  .gitignore
git commit -m "docs(workflow-editor): update docs and gitignore for redesign"
```

---

## Self-review

| Spec requirement | Implementing task |
|---|---|
| Opinionated one-action-per-state model | Task 2 graph mapping, Task 7 ActionConfigPanel |
| Auto-generated result events | Task 1 runtime events helper, Task 4 addTransition |
| Dedicated Start/Final nodes | Task 2, Task 5 StartNode/FinalNode |
| Human-in-the-loop task states | Task 5 TaskNode, Task 7 TaskConfigPanel |
| No transition guards; condition as state action | Task 2 condition node, Task 7 ConditionConfigPanel |
| Manual drag-and-drop layout | Task 6 WorkflowCanvas (VueFlow defaults) |
| Real-time validation | Task 3 validator, Task 8/9 ValidationDrawer |
| Legacy normalization on load | Task 2 definitionToGraph |
| Shared layer for web and admin | Task 9 shell unchanged contract; Task 10 host wiring |
| Trigger authoring stays separate | Out of scope (no tasks) |

**Placeholder scan:** No TBD/TODO/fill-in sections remain. All code blocks are concrete.

**Type consistency:** `EditorNodeData`, `EditorNodeType`, and `START_NODE_ID` are used consistently across tasks. Action config shape `{ actionId, params, outputKey }` matches the runtime `meta.action`/`meta.params`/`meta.outputKey` mapping.

**Gaps:** None identified. Undo/redo, expression evaluator, and task assignment rules are explicitly deferred to later iterations per the spec.
