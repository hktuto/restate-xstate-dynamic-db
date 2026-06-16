---
title: Workflow Editor Revamp Implementation Plan
type: note
status: done
area: docs
created: 2026-06-16
updated: 2026-06-17
---

# Workflow Editor Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB- SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Revamp `layers/workflow-editor` into a canvas-first visual workflow editor with a collapsible sidebar, custom state/transition components, and preserved node positions.

**Architecture:** Keep `@vue-flow/core` as the canvas engine. Add custom node/edge components, a toolbar, and a toggle sidebar with Context and Details panels. Upgrade `useWorkflowGraph` to persist node positions in `definition.meta`. Extend `WorkflowDefinition` with optional `context` and `meta` fields without breaking existing saved workflows.

**Tech Stack:** Nuxt 4 layer, Vue 3, TypeScript, `@vue-flow/core`, `@vue-flow/background`, Tailwind CSS, `workflow-actions`, `shared`.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/shared/src/index.ts` | Add optional `context` and `meta` to `WorkflowDefinition`. |
| `layers/workflow-editor/composables/useWorkflowGraph.ts` | Convert definition ↔ graph; persist/restore positions from `definition.meta`. |
| `layers/workflow-editor/composables/useWorkflowEditor.ts` | Local editor state: selected id, active tool, derived nodes/edges, save handler. |
| `layers/workflow-editor/components/WorkflowEditor.vue` | Shell: toolbar + canvas + sidebar. |
| `layers/workflow-editor/components/WorkflowCanvas.vue` | VueFlow wrapper with custom nodes/edges and canvas events. |
| `layers/workflow-editor/components/StateNode.vue` | Custom state node (label, handles, selection, hover delete). |
| `layers/workflow-editor/components/TransitionEdge.vue` | Custom transition edge (event label, guard badge, delete handle). |
| `layers/workflow-editor/components/WorkflowToolbar.vue` | Tool buttons, save, fit view. |
| `layers/workflow-editor/components/SidebarPanel.vue` | Collapsible sidebar shell. |
| `layers/workflow-editor/components/ContextPanel.vue` | Machine context JSON editor + workflow id. |
| `layers/workflow-editor/components/DetailsPanel.vue` | Selected state or transition editor. |
| `layers/workflow-editor/components/ActionListEditor.vue` | Reusable add/remove/reorder for entry/exit actions. |
| `apps/web/app/pages/workflows/[id].vue` | Pass `name` separately, persist it outside `xstateConfig`. |
| `apps/web/app/pages/workflows/new.vue` | Same as above. |

---

## Task 1: Extend shared WorkflowDefinition type

**Files:**
- Modify: `packages/shared/src/index.ts:51-55`

- [x] **Step 1: Add optional `context` and `meta` to `WorkflowDefinition`**

```ts
export interface WorkflowDefinition {
  id: string
  initial: string
  states: Record<string, WorkflowState>
  context?: Record<string, unknown>
  meta?: Record<string, unknown>
}
```

- [x] **Step 2: Build shared package to verify types compile**

Run: `pnpm --filter shared build`
Expected: exit 0

- [x] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
pnpm --filter shared build
git commit -m "feat(shared): add context and meta to WorkflowDefinition"
```

---

## Task 2: Upgrade useWorkflowGraph to persist positions

**Files:**
- Modify: `layers/workflow-editor/composables/useWorkflowGraph.ts`

- [x] **Step 1: Update EditorNode and EditorEdge types**

```ts
export interface EditorNode {
  id: string
  type: 'state'
  position: { x: number; y: number }
  data: {
    label: string
    entry: (string | { id: string; params?: Record<string, unknown> })[]
    exit: (string | { id: string; params?: Record<string, unknown> })[]
  }
}

export interface EditorEdge {
  id: string
  source: string
  target: string
  label: string
  animated?: boolean
  data?: {
    guard?: { type: string; params?: Record<string, unknown> }
    actions?: (string | { id: string; params?: Record<string, unknown> })[]
  }
}
```

- [x] **Step 2: Read positions from definition.meta**

```ts
function getPositions(definition: WorkflowDefinition): Record<string, { x: number; y: number }> {
  const meta = definition.meta ?? {}
  const positions = (meta.editorPositions ?? {}) as Record<string, { x: number; y: number }>
  return positions
}
```

- [x] **Step 3: Update definitionToGraph to use persisted positions and include exit actions**

```ts
function definitionToGraph(definition: WorkflowDefinition): { nodes: EditorNode[]; edges: EditorEdge[] } {
  const positions = getPositions(definition)
  const stateEntries = Object.entries(definition.states)
  const nodes: EditorNode[] = stateEntries.map(([stateId, stateDef], idx) => ({
    id: stateId,
    type: 'state',
    position: positions[stateId] ?? { x: 100 + idx * 220, y: 100 + (idx % 2) * 120 },
    data: {
      label: stateId,
      entry: normalizeActions(stateDef.entry),
      exit: normalizeActions(stateDef.exit)
    }
  }))

  const edges: EditorEdge[] = []
  for (const [sourceId, stateDef] of stateEntries) {
    for (const [event, targetDefRaw] of Object.entries(stateDef.on || {})) {
      const targetDefs = Array.isArray(targetDefRaw) ? targetDefRaw : [targetDefRaw]
      for (const targetDef of targetDefs) {
        const guardKey = targetDef.guard
          ? `${targetDef.guard.type}-${JSON.stringify(targetDef.guard.params ?? {})}`
          : 'no-guard'
        const actionKey = targetDef.actions?.length
          ? `-${JSON.stringify(targetDef.actions)}`
          : ''
        edges.push({
          id: `${sourceId}-${event}-${targetDef.target}-${guardKey}${actionKey}`,
          source: sourceId,
          target: targetDef.target,
          label: event,
          animated: true,
          data: {
            guard: targetDef.guard,
            actions: targetDef.actions
          }
        })
      }
    }
  }

  return { nodes, edges }
}
```

- [x] **Step 4: Update graphToDefinition to persist positions and handle exit actions**

```ts
function graphToDefinition(
  nodes: EditorNode[],
  edges: EditorEdge[],
  initial: string,
  id: string,
  context?: Record<string, unknown>,
  existingMeta?: Record<string, unknown>
): WorkflowDefinition {
  const positions: Record<string, { x: number; y: number }> = {}
  const states: WorkflowDefinition['states'] = {}

  for (const node of nodes) {
    positions[node.id] = node.position
    states[node.id] = {}
    if (node.data.entry?.length) {
      states[node.id].entry = node.data.entry
    }
    if (node.data.exit?.length) {
      states[node.id].exit = node.data.exit
    }
  }

  const grouped = new Map<string, EditorEdge[]>()
  for (const edge of edges) {
    const key = `${edge.source}::${edge.label}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(edge)
  }

  for (const [key, groupEdges] of grouped) {
    const [sourceId, event] = key.split('::')
    if (!states[sourceId].on) states[sourceId].on = {}

    const transitions: WorkflowTransition[] = groupEdges.map(edge => {
      const t: WorkflowTransition = { target: edge.target }
      if (edge.data?.guard) {
        t.guard = edge.data.guard
      }
      if (edge.data?.actions?.length) {
        t.actions = edge.data.actions
      }
      return t
    })

    states[sourceId].on![event] = transitions.length === 1 ? transitions[0] : transitions
  }

  return {
    id,
    initial,
    states,
    context,
    meta: {
      ...existingMeta,
      editorPositions: positions
    }
  }
}
```

- [x] **Step 5: Verify build**

Run: `pnpm --filter workflow-editor build`
Expected: exit 0

- [x] **Step 6: Commit**

```bash
git add layers/workflow-editor/composables/useWorkflowGraph.ts
pnpm --filter workflow-editor build
git commit -m "feat(workflow-editor): persist node positions and exit actions in graph"
```

---

## Task 3: Create useWorkflowEditor composable

**Files:**
- Create: `layers/workflow-editor/composables/useWorkflowEditor.ts`

- [x] **Step 1: Create the composable**

```ts
import type { WorkflowDefinition } from 'shared'
import type { EditorNode, EditorEdge } from './useWorkflowGraph'

export type EditorTool = 'select' | 'pan' | 'add-state'

export interface UseWorkflowEditorOptions {
  definition: Ref<WorkflowDefinition>
  readonly?: boolean
}

export function useWorkflowEditor(options: UseWorkflowEditorOptions) {
  const { definition, readonly } = options

  const { definitionToGraph, graphToDefinition } = useWorkflowGraph()

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
    return graphToDefinition(
      nodes.value,
      edges.value,
      definition.value.initial,
      definition.value.id,
      definition.value.context,
      definition.value.meta
    )
  }

  function addState(id: string, position: { x: number; y: number }) {
    if (readonly) return
    if (!id || nodes.value.some(n => n.id === id)) return
    nodes.value.push({
      id,
      type: 'state',
      position,
      data: { label: id, entry: [], exit: [] }
    })
    if (!definition.value.initial) {
      definition.value.initial = id
    }
  }

  function removeState(id: string) {
    if (readonly) return
    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
    if (definition.value.initial === id) {
      definition.value.initial = nodes.value[0]?.id ?? ''
    }
    if (selectedId.value === id) selectedId.value = null
  }

  function addTransition(source: string, target: string, event: string) {
    if (readonly) return
    if (!source || !target || !event) return
    const guardKey = 'no-guard'
    const id = `${source}-${event}-${target}-${guardKey}`
    if (edges.value.some(e => e.id === id)) return
    edges.value.push({ id, source, target, label: event, animated: true })
  }

  function removeEdge(id: string) {
    if (readonly) return
    edges.value = edges.value.filter(e => e.id !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  function renameState(oldId: string, newId: string) {
    if (readonly) return
    if (!newId || nodes.value.some(n => n.id === newId)) return
    const node = nodes.value.find(n => n.id === oldId)
    if (!node) return
    node.id = newId
    node.data.label = newId
    for (const edge of edges.value) {
      if (edge.source === oldId) edge.source = newId
      if (edge.target === oldId) edge.target = newId
    }
    if (definition.value.initial === oldId) {
      definition.value.initial = newId
    }
    if (selectedId.value === oldId) selectedId.value = newId
  }

  function updateStateData(id: string, data: Partial<EditorNode['data']>) {
    if (readonly) return
    const node = nodes.value.find(n => n.id === id)
    if (!node) return
    Object.assign(node.data, data)
  }

  function renameEdge(id: string, newLabel: string) {
    if (readonly) return
    const edge = edges.value.find(e => e.id === id)
    if (!edge) return
    edge.label = newLabel
    updateEdgeData(id, edge.data ?? {})
  }

  function updateEdgeData(id: string, data: Partial<NonNullable<EditorEdge['data']>>) {
    if (readonly) return
    const edge = edges.value.find(e => e.id === id)
    if (!edge) return
    if (!edge.data) edge.data = {}
    Object.assign(edge.data, data)

    // Regenerate edge id when label or guard changes so collisions are detected.
    const guardKey = edge.data.guard
      ? `${edge.data.guard.type}-${JSON.stringify(edge.data.guard.params ?? {})}`
      : 'no-guard'
    const actionKey = edge.data.actions?.length
      ? `-${JSON.stringify(edge.data.actions)}`
      : ''
    const newId = `${edge.source}-${edge.label}-${edge.target}-${guardKey}${actionKey}`
    if (newId !== edge.id) {
      edge.id = newId
      if (selectedId.value === id) selectedId.value = newId
    }
  }

  watch([nodes, edges], () => {
    definition.value = build()
  }, { deep: true })

  return {
    nodes,
    edges,
    selectedId,
    tool,
    load,
    addState,
    removeState,
    addTransition,
    removeEdge,
    renameState,
    renameEdge,
    updateStateData,
    updateEdgeData
  }
}
```

- [x] **Step 2: Verify build**

Run: `pnpm --filter workflow-editor build`
Expected: exit 0

- [x] **Step 3: Commit**

```bash
git add layers/workflow-editor/composables/useWorkflowEditor.ts
pnpm --filter workflow-editor build
git commit -m "feat(workflow-editor): add useWorkflowEditor composable"
```

---

## Task 4: Create StateNode component

**Files:**
- Create: `layers/workflow-editor/components/StateNode.vue`

- [x] **Step 1: Create custom node with handles**

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { EditorNode } from '../composables/useWorkflowGraph'

const props = defineProps<{
  id: string
  data: EditorNode['data']
  selected?: boolean
}>()

const emit = defineEmits<{
  (e: 'rename', id: string, newId: string): void
}>()

const isEditing = ref(false)
const editName = ref(props.id)

function startEdit() {
  isEditing.value = true
  editName.value = props.id
}

function commitEdit() {
  isEditing.value = false
  const trimmed = editName.value.trim()
  if (trimmed && trimmed !== props.id) {
    emit('rename', props.id, trimmed)
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') commitEdit()
  if (event.key === 'Escape') {
    isEditing.value = false
    editName.value = props.id
  }
}
</script>

<template>
  <div
    class="min-w-[120px] px-4 py-2 rounded-lg border-2 bg-white text-center shadow-sm"
    :class="selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'"
  >
    <Handle type="target" :position="Position.Top" class="!bg-gray-400" />

    <div v-if="isEditing">
      <input
        v-model="editName"
        v-focus
        class="w-full text-center text-sm border rounded px-1"
        @blur="commitEdit"
        @keydown="onKeydown"
      />
    </div>
    <div v-else class="font-medium text-sm cursor-pointer" @dblclick="startEdit">
      {{ data.label }}
    </div>

    <div v-if="data.entry?.length || data.exit?.length" class="mt-1 flex flex-wrap justify-center gap-1">
      <span
        v-for="action in data.entry"
        :key="`entry-${typeof action === 'string' ? action : action.id}`"
        class="text-[10px] px-1 bg-green-100 text-green-800 rounded"
      >
        {{ typeof action === 'string' ? action : action.id }}
      </span>
      <span
        v-for="action in data.exit"
        :key="`exit-${typeof action === 'string' ? action : action.id}`"
        class="text-[10px] px-1 bg-orange-100 text-orange-800 rounded"
      >
        {{ typeof action === 'string' ? action : action.id }}→
      </span>
    </div>

    <Handle type="source" :position="Position.Bottom" class="!bg-gray-400" />
  </div>
</template>
```

- [x] **Step 2: Add v-focus directive to layer**

Create or update `layers/workflow-editor/plugins/focus-directive.ts`:

```ts
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('focus', {
    mounted(el: HTMLElement) {
      el.focus()
      el.select()
    }
  })
})
```

- [x] **Step 3: Verify build**

Run: `pnpm --filter workflow-editor build`
Expected: exit 0

- [x] **Step 4: Commit**

```bash
git add layers/workflow-editor/components/StateNode.vue layers/workflow-editor/plugins/focus-directive.ts
pnpm --filter workflow-editor build
git commit -m "feat(workflow-editor): add StateNode component"
```

---

## Task 5: Create TransitionEdge component

**Files:**
- Create: `layers/workflow-editor/components/TransitionEdge.vue`

- [x] **Step 1: Create custom edge with label and guard badge**

```vue
<script setup lang="ts">
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@vue-flow/core'
import type { EditorEdge } from '../composables/useWorkflowGraph'

const props = defineProps<EdgeProps<EditorEdge>>()

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

const hasGuard = computed(() => !!props.data?.guard?.type)
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
      <span>{{ data?.label ?? label }}</span>
      <span v-if="hasGuard" class="text-blue-600" title="Guard condition">🛡</span>
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

- [x] **Step 2: Verify build**

Run: `pnpm --filter workflow-editor build`
Expected: exit 0

- [x] **Step 3: Commit**

```bash
git add layers/workflow-editor/components/TransitionEdge.vue
pnpm --filter workflow-editor build
git commit -m "feat(workflow-editor): add TransitionEdge component"
```

---

## Task 6: Create WorkflowToolbar component

**Files:**
- Create: `layers/workflow-editor/components/WorkflowToolbar.vue`

- [x] **Step 1: Create toolbar**

```vue
<script setup lang="ts">
import type { EditorTool } from '../composables/useWorkflowEditor'

const props = defineProps<{
  tool: EditorTool
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:tool', tool: EditorTool): void
  (e: 'fit-view'): void
  (e: 'save'): void
}>()

function setTool(tool: EditorTool) {
  emit('update:tool', tool)
}
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-2 bg-white border-b">
    <button
      class="px-2 py-1 text-sm rounded border"
      :class="tool === 'select' ? 'bg-blue-100 border-blue-300' : 'border-gray-300'"
      @click="setTool('select')"
    >
      Select
    </button>
    <button
      class="px-2 py-1 text-sm rounded border"
      :class="tool === 'pan' ? 'bg-blue-100 border-blue-300' : 'border-gray-300'"
      @click="setTool('pan')"
    >
      Pan
    </button>
    <button
      class="px-2 py-1 text-sm rounded border"
      :class="tool === 'add-state' ? 'bg-blue-100 border-blue-300' : 'border-gray-300'"
      @click="setTool('add-state')"
    >
      Add state
    </button>

    <div class="flex-1" />

    <button class="px-2 py-1 text-sm rounded border border-gray-300" @click="emit('fit-view')">
      Fit view
    </button>
    <button
      v-if="!readonly"
      class="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
      @click="emit('save')"
    >
      Save
    </button>
  </div>
</template>
```

- [x] **Step 2: Verify build**

Run: `pnpm --filter workflow-editor build`
Expected: exit 0

- [x] **Step 3: Commit**

```bash
git add layers/workflow-editor/components/WorkflowToolbar.vue
pnpm --filter workflow-editor build
git commit -m "feat(workflow-editor): add WorkflowToolbar component"
```

---

## Task 7: Create SidebarPanel, ContextPanel, and DetailsPanel

**Files:**
- Create: `layers/workflow-editor/components/SidebarPanel.vue`
- Create: `layers/workflow-editor/components/ContextPanel.vue`
- Create: `layers/workflow-editor/components/DetailsPanel.vue`
- Create: `layers/workflow-editor/components/ActionListEditor.vue`

- [x] **Step 1: Create SidebarPanel.vue**

```vue
<script setup lang="ts">
const activeTab = defineModel<'context' | 'details'>('activeTab', { default: 'details' })
const isOpen = defineModel<boolean>('open', { default: true })

function toggle() {
  isOpen.value = !isOpen.value
}

function setTab(tab: 'context' | 'details') {
  if (activeTab.value === tab && isOpen.value) {
    isOpen.value = false
  } else {
    activeTab.value = tab
    isOpen.value = true
  }
}
</script>

<template>
  <div class="flex h-full border-l bg-white">
    <div class="flex flex-col border-r bg-gray-50">
      <button
        class="px-3 py-2 text-xs font-medium border-b"
        :class="activeTab === 'context' ? 'bg-white text-blue-600' : 'text-gray-600'"
        @click="setTab('context')"
      >
        Context
      </button>
      <button
        class="px-3 py-2 text-xs font-medium border-b"
        :class="activeTab === 'details' ? 'bg-white text-blue-600' : 'text-gray-600'"
        @click="setTab('details')"
      >
        Details
      </button>
      <div class="flex-1" />
      <button class="px-3 py-2 text-gray-600 hover:bg-gray-200" @click="toggle">
        {{ isOpen ? '›' : '‹' }}
      </button>
    </div>
    <div v-if="isOpen" class="w-80 overflow-y-auto">
      <slot />
    </div>
  </div>
</template>
```

- [x] **Step 2: Create ActionListEditor.vue**

```vue
<script setup lang="ts">
import type { ActionMetadata } from 'shared'

const props = defineProps<{
  modelValue: (string | { id: string; params?: Record<string, unknown> })[]
  actions: ActionMetadata[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: (string | { id: string; params?: Record<string, unknown> })[]): void
}>()

const selectedAction = ref('')

function add() {
  if (!selectedAction.value) return
  const next = [...props.modelValue, selectedAction.value]
  emit('update:modelValue', next)
  selectedAction.value = ''
}

function remove(index: number) {
  const next = [...props.modelValue]
  next.splice(index, 1)
  emit('update:modelValue', next)
}

function labelFor(action: string | { id: string }) {
  const id = typeof action === 'string' ? action : action.id
  return props.actions.find(a => a.id === id)?.label ?? id
}
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="(action, index) in modelValue"
      :key="`${typeof action === 'string' ? action : action.id}-${index}`"
      class="flex items-center justify-between text-sm px-2 py-1 bg-gray-50 rounded"
    >
      <span>{{ labelFor(action) }}</span>
      <button v-if="!readonly" class="text-gray-400 hover:text-red-600" @click="remove(index)">×</button>
    </div>
    <div v-if="!readonly" class="flex gap-2">
      <select v-model="selectedAction" class="flex-1 border rounded px-2 py-1 text-sm">
        <option value="">Select action</option>
        <option v-for="action in actions" :key="action.id" :value="action.id">{{ action.label }}</option>
      </select>
      <button class="px-2 py-1 border rounded text-sm" @click="add">Add</button>
    </div>
  </div>
</template>
```

- [x] **Step 3: Create ContextPanel.vue**

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
      <label class="block text-xs font-medium text-gray-600 mb-1">Initial state</label>
      <select
        :value="definition.initial"
        class="w-full border rounded px-2 py-1 text-sm"
        :disabled="readonly"
        @change="emit('update:definition', { ...definition, initial: ($event.target as HTMLSelectElement).value })"
      >
        <option value="">-- select --</option>
        <option v-for="state in Object.keys(definition.states)" :key="state" :value="state">{{ state }}</option>
      </select>
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

- [x] **Step 4: Create DetailsPanel.vue**

```vue
<script setup lang="ts">
import type { EditorNode, EditorEdge } from '../composables/useWorkflowGraph'
import type { ActionMetadata, GuardMetadata } from 'shared'

const props = defineProps<{
  selectedNode?: EditorNode
  selectedEdge?: EditorEdge
  actions: ActionMetadata[]
  guards: GuardMetadata[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:node', id: string, data: Partial<EditorNode['data']>): void
  (e: 'update:edge', id: string, data: Partial<NonNullable<EditorEdge['data']>>): void
  (e: 'rename:node', oldId: string, newId: string): void
  (e: 'rename:edge', id: string, newLabel: string): void
  (e: 'select:node', id: string): void
}>()

const nodeName = computed({
  get: () => props.selectedNode?.id ?? '',
  set: (value: string) => {
    if (props.selectedNode && value !== props.selectedNode.id) {
      emit('rename:node', props.selectedNode.id, value)
    }
  }
})

const eventName = computed({
  get: () => props.selectedEdge?.label ?? '',
  set: (value: string) => {
    if (props.selectedEdge && value !== props.selectedEdge.label) {
      emit('rename:edge', props.selectedEdge.id, value)
    }
  }
})

const selectedGuardType = computed({
  get: () => props.selectedEdge?.data?.guard?.type ?? '',
  set: (type: string) => {
    if (!props.selectedEdge) return
    const guard = type
      ? { type, params: props.selectedEdge.data?.guard?.params ?? {} }
      : undefined
    emit('update:edge', props.selectedEdge.id, { guard })
  }
})

const activeGuard = computed(() => props.guards.find(g => g.id === selectedGuardType.value))

const guardParamValue = computed({
  get: () => {
    const key = Object.keys(activeGuard.value?.paramsSchema ?? {})[0]
    return key ? String(props.selectedEdge?.data?.guard?.params?.[key] ?? '') : ''
  },
  set: (value: string) => {
    if (!props.selectedEdge || !activeGuard.value) return
    const key = Object.keys(activeGuard.value.paramsSchema)[0]
    if (!key) return
    emit('update:edge', props.selectedEdge.id, {
      guard: { type: selectedGuardType.value, params: { [key]: value } }
    })
  }
})
</script>

<template>
  <div class="p-4 space-y-4">
    <div v-if="!selectedNode && !selectedEdge" class="text-sm text-gray-500">
      Select a state or transition to edit its details.
    </div>

    <!-- State details -->
    <template v-if="selectedNode">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">State ID</label>
        <input v-model="nodeName" class="w-full border rounded px-2 py-1 text-sm" :readonly="readonly" />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Type</label>
        <input value="atomic" class="w-full border rounded px-2 py-1 text-sm bg-gray-50" readonly />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Entry actions</label>
        <ActionListEditor
          :model-value="selectedNode.data.entry"
          :actions="actions"
          :readonly="readonly"
          @update:model-value="emit('update:node', selectedNode.id, { entry: $event })"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Exit actions</label>
        <ActionListEditor
          :model-value="selectedNode.data.exit"
          :actions="actions"
          :readonly="readonly"
          @update:model-value="emit('update:node', selectedNode.id, { exit: $event })"
        />
      </div>
    </template>

    <!-- Transition details -->
    <template v-if="selectedEdge">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Event</label>
        <input v-model="eventName" class="w-full border rounded px-2 py-1 text-sm" :readonly="readonly" />
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

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Guard</label>
        <select v-model="selectedGuardType" class="w-full border rounded px-2 py-1 text-sm" :disabled="readonly">
          <option value="">No guard</option>
          <option v-for="guard in guards" :key="guard.id" :value="guard.id">{{ guard.label }}</option>
        </select>
        <input
          v-if="activeGuard"
          v-model="guardParamValue"
          class="w-full mt-2 border rounded px-2 py-1 text-sm"
          :placeholder="activeGuard.paramsSchema?.[Object.keys(activeGuard.paramsSchema)[0]]?.label ?? 'Value'"
          :readonly="readonly"
        />
      </div>
    </template>
  </div>
</template>
```

- [x] **Step 5: Verify build**

Run: `pnpm --filter workflow-editor build`
Expected: exit 0

- [x] **Step 6: Commit**

```bash
git add layers/workflow-editor/components/SidebarPanel.vue layers/workflow-editor/components/ContextPanel.vue layers/workflow-editor/components/DetailsPanel.vue layers/workflow-editor/components/ActionListEditor.vue
pnpm --filter workflow-editor build
git commit -m "feat(workflow-editor): add sidebar panels"
```

---

## Task 8: Create WorkflowCanvas component

**Files:**
- Create: `layers/workflow-editor/components/WorkflowCanvas.vue`

- [x] **Step 1: Create VueFlow wrapper**

```vue
<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { EditorNode, EditorEdge } from '../composables/useWorkflowGraph'
import type { EditorTool } from '../composables/useWorkflowEditor'
import StateNode from './StateNode.vue'
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
  (e: 'add-state', position: { x: number; y: number }): void
  (e: 'connect', params: { source: string; target: string }): void
  (e: 'rename:node', oldId: string, newId: string): void
  (e: 'delete:edge', id: string): void
}>()

const { fitView } = useVueFlow()

const nodeTypes = { state: StateNode }
const edgeTypes = { transition: TransitionEdge }

// Bridge prop arrays to VueFlow's v-model while emitting changes upstream.
const flowNodes = computed({
  get: () => props.nodes,
  set: (value) => emit('update:nodes', value)
})

const flowEdges = computed({
  get: () => props.edges,
  set: (value) => emit('update:edges', value)
})

function onPaneClick(event: MouseEvent) {
  if (props.tool === 'add-state') {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    emit('add-state', {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    })
  }
}

function onConnect(params: { source: string; target: string }) {
  emit('connect', params)
}

function onNodeClick(_event: MouseEvent, node: EditorNode) {
  emit('select', node.id)
}

function onEdgeClick(_event: MouseEvent, edge: EditorEdge) {
  emit('select', edge.id)
}

function onPaneClickClear() {
  if (props.tool === 'select') {
    emit('select', null)
  }
}

function onRename(oldId: string, newId: string) {
  emit('rename:node', oldId, newId)
}

function onDeleteEdge(id: string) {
  emit('delete:edge', id)
}

function fit() {
  fitView()
}

defineExpose({ fitView: fit })
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
      @pane-click="onPaneClickClear"
      @dblclick="onPaneClick"
      @connect="onConnect"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
    >
      <Background />

      <template #node-state="nodeProps">
        <StateNode v-bind="nodeProps" @rename="onRename" />
      </template>

      <template #edge-transition="edgeProps">
        <TransitionEdge v-bind="edgeProps" :readonly="readonly" @delete="onDeleteEdge" />
      </template>
    </VueFlow>
  </div>
</template>
```

- [x] **Step 2: Verify build**

Run: `pnpm --filter workflow-editor build`
Expected: exit 0

- [x] **Step 3: Commit**

```bash
git add layers/workflow-editor/components/WorkflowCanvas.vue
pnpm --filter workflow-editor build
git commit -m "feat(workflow-editor): add WorkflowCanvas component"
```

---

## Task 9: Rewrite WorkflowEditor.vue shell

**Files:**
- Modify: `layers/workflow-editor/components/WorkflowEditor.vue`

- [x] **Step 1: Replace WorkflowEditor.vue with new shell**

```vue
<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'
import { useWorkflowEditor } from '../composables/useWorkflowEditor'
import { useWorkflowActions } from '../composables/useWorkflowActions'
import { useWorkflowValidator } from '../composables/useWorkflowValidator'
import WorkflowToolbar from './WorkflowToolbar.vue'
import WorkflowCanvas from './WorkflowCanvas.vue'
import SidebarPanel from './SidebarPanel.vue'
import ContextPanel from './ContextPanel.vue'
import DetailsPanel from './DetailsPanel.vue'

const props = defineProps<{
  modelValue: WorkflowDefinition
  name?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: WorkflowDefinition): void
  (e: 'update:name', value: string): void
  (e: 'save', value: WorkflowDefinition): void
}>()

const definition = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const editor = useWorkflowEditor({ definition, readonly: props.readonly })
const { actions, guards } = useWorkflowActions()
const { validate } = useWorkflowValidator()

const canvasRef = ref<InstanceType<typeof WorkflowCanvas> | null>(null)
const sidebarOpen = ref(true)
const activeTab = ref<'context' | 'details'>('details')

const selectedNode = computed(() => editor.nodes.value.find(n => n.id === editor.selectedId.value))
const selectedEdge = computed(() => editor.edges.value.find(e => e.id === editor.selectedId.value))
const errors = computed(() => validate(props.modelValue))

watch(() => props.modelValue, (def) => {
  if (def) editor.load(def)
}, { deep: false })

onMounted(() => {
  editor.load(props.modelValue)
})

function onConnect(params: { source: string; target: string }) {
  const event = prompt('Event name for this transition?')
  if (event) {
    editor.addTransition(params.source, params.target, event)
  }
}

function onAddState(position: { x: number; y: number }) {
  const id = prompt('State name?')?.trim()
  if (id) {
    editor.addState(id, position)
  }
}

function onKeydown(event: KeyboardEvent) {
  if (props.readonly) return
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    emit('save', props.modelValue)
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedNode.value) {
      editor.removeState(selectedNode.value.id)
    } else if (selectedEdge.value) {
      editor.removeEdge(selectedEdge.value.id)
    }
  }
  if (event.key.toLowerCase() === 'v') editor.tool.value = 'pan'
  if (event.key.toLowerCase() === 's') editor.tool.value = 'select'
  if (event.key.toLowerCase() === 'a') editor.tool.value = 'add-state'
}

function fitView() {
  canvasRef.value?.fitView()
}

function onSave() {
  emit('save', props.modelValue)
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="flex flex-col h-full min-h-[600px] border rounded bg-white">
    <WorkflowToolbar
      v-model:tool="editor.tool"
      :readonly="readonly"
      @fit-view="fitView"
      @save="onSave"
    />

    <div v-if="errors.length" class="bg-red-50 text-red-700 px-3 py-2 text-sm border-b">
      <ul class="list-disc pl-4">
        <li v-for="err in errors" :key="err.path">{{ err.path }}: {{ err.message }}</li>
      </ul>
    </div>

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
        @add-state="onAddState"
        @connect="onConnect"
        @rename:node="editor.renameState"
        @delete:edge="editor.removeEdge"
      />

      <SidebarPanel v-model:open="sidebarOpen" v-model:active-tab="activeTab">
        <ContextPanel
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
          :guards="guards"
          :readonly="readonly"
          @update:node="editor.updateStateData"
          @update:edge="editor.updateEdgeData"
          @rename:node="editor.renameState"
          @rename:edge="editor.renameEdge"
          @select:node="editor.selectedId.value = $event"
        />
      </SidebarPanel>
    </div>
  </div>
</template>
```

- [x] **Step 2: Verify build**

Run: `pnpm --filter workflow-editor build`
Expected: exit 0

- [x] **Step 3: Commit**

```bash
git add layers/workflow-editor/components/WorkflowEditor.vue
pnpm --filter workflow-editor build
git commit -m "feat(workflow-editor): rewrite WorkflowEditor shell"
```

---

## Task 10: Update workflow pages to pass name separately

**Files:**
- Modify: `apps/web/app/pages/workflows/[id].vue`
- Modify: `apps/web/app/pages/workflows/new.vue`

- [x] **Step 1: Update [id].vue**

```vue
<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'

const route = useRoute()
const id = route.params.id as string

const { data: workflow } = await useFetch(`/api/workflows/${id}`)

const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})

watchEffect(() => {
  if (workflow.value) {
    name.value = workflow.value.name
    config.value = workflow.value.xstateConfig
  }
})

async function save() {
  await $fetch(`/api/workflows/${id}`, {
    method: 'PATCH',
    body: { name: name.value, xstateConfig: config.value }
  })
  await navigateTo('/workflows')
}
</script>

<template>
  <div class="h-[calc(100vh-120px)]">
    <WorkflowEditor
      v-if="config"
      v-model="config"
      :name="name"
      @update:name="name = $event"
      @save="save"
    />
  </div>
</template>
```

- [x] **Step 2: Update new.vue**

```vue
<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'

const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})

async function save() {
  await $fetch('/api/workflows', {
    method: 'POST',
    body: { name: name.value, xstateConfig: config.value }
  })
  await navigateTo('/workflows')
}
</script>

<template>
  <div class="h-[calc(100vh-120px)]">
    <WorkflowEditor
      v-model="config"
      :name="name"
      @update:name="name = $event"
      @save="save"
    />
  </div>
</template>
```

- [x] **Step 3: Verify build**

Run: `pnpm -r build`
Expected: exit 0

- [x] **Step 4: Commit**

```bash
git add apps/web/app/pages/workflows/[id].vue apps/web/app/pages/workflows/new.vue
pnpm -r build
git commit -m "feat(web): update workflow pages for new editor"
```

---

## Task 11: Remove obsolete form components

**Files:**
- Delete: `layers/workflow-editor/components/GuardEditor.vue`
- Delete: `layers/workflow-editor/components/ActionPicker.vue`

- [x] **Step 1: Delete obsolete components**

```bash
rm layers/workflow-editor/components/GuardEditor.vue
rm layers/workflow-editor/components/ActionPicker.vue
```

- [x] **Step 2: Verify build still passes**

Run: `pnpm --filter workflow-editor build`
Expected: exit 0

- [x] **Step 3: Commit**

```bash
git rm layers/workflow-editor/components/GuardEditor.vue layers/workflow-editor/components/ActionPicker.vue
pnpm --filter workflow-editor build
git commit -m "chore(workflow-editor): remove obsolete form components"
```

---

## Task 12: Build and verify full stack

**Files:**
- None (verification task)

- [x] **Step 1: Run full build**

Run: `pnpm -r build`
Expected: exit 0

- [x] **Step 2: Run dev servers and smoke test**

Run:
```bash
docker compose up -d
pnpm --filter db seed
pnpm --filter web dev
```

Open http://localhost:3000/workflows/new
Expected: Canvas shows, can add state, add transition, save.

- [x] **Step 3: Commit any final fixes**

---

## Task 13: Update documentation

**Files:**
- Modify: `docs/50-Features/Workflow Designer.md`
- Modify: `docs/40-Packages/workflow-editor-layer.md`

- [x] **Step 1: Mark Workflow Designer done**

```markdown
---
title: Workflow Designer
type: feature
status: done
area: workflow
...
---
```

- [x] **Step 2: Mark workflow-editor-layer done**

```markdown
---
title: workflow-editor-layer
type: package
status: done
area: architecture
...
---
```

- [x] **Step 3: Commit**

```bash
git add docs/50-Features/Workflow\ Designer.md docs/40-Packages/workflow-editor-layer.md
git commit -m "docs: mark workflow editor revamp complete"
```

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Canvas-first layout | Task 9 |
| Toolbar with tools | Task 6 |
| Custom state nodes | Task 4 |
| Custom transition edges | Task 5 |
| Drag to create transition | Task 8 |
| Click/dbl-click to add state | Task 8, Task 9 |
| Sidebar toggle open/close | Task 7 |
| Context panel with JSON editor | Task 7 |
| Details panel for selected state/transition | Task 7 |
| Persist positions in meta | Task 2 |
| Preserve WorkflowDefinition contract | Task 1, Task 2 |
| Future-ready recursive model | Task 1 (type/state fields) |
| Build and verify | Task 12 |
| Update docs | Task 13 |
