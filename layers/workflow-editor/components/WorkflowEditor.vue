<script setup lang="ts">
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { WorkflowDefinition } from 'shared'
import type { EditorNode, EditorEdge } from '../composables/useWorkflowGraph'

const props = defineProps<{
  modelValue: WorkflowDefinition
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: WorkflowDefinition): void
  (e: 'save', value: WorkflowDefinition): void
}>()

const { actions, guards } = useWorkflowActions()
const { definitionToGraph, graphToDefinition } = useWorkflowGraph()
const { validate } = useWorkflowValidator()

const nodes = ref<EditorNode[]>([])
const edges = ref<EditorEdge[]>([])
const initialState = ref('')

function loadDefinition(def: WorkflowDefinition) {
  initialState.value = def.initial || ''
  const graph = definitionToGraph(def)
  nodes.value = graph.nodes
  edges.value = graph.edges
}

function buildDefinition(): WorkflowDefinition {
  return graphToDefinition(nodes.value, edges.value, initialState.value, props.modelValue.id)
}

watch([nodes, edges, initialState], () => {
  emit('update:modelValue', buildDefinition())
}, { deep: true })

onMounted(() => loadDefinition(props.modelValue))
watch(() => props.modelValue, (def) => loadDefinition(def), { deep: true })

const errors = computed(() => validate(buildDefinition()))

const newStateName = ref('')
const newStateAction = ref('')
function addState() {
  if (props.readonly) return
  const id = newStateName.value.trim()
  if (!id || nodes.value.some(n => n.id === id)) return
  nodes.value.push({
    id,
    position: { x: 100 + nodes.value.length * 180, y: 120 },
    data: { label: id, actions: newStateAction.value.trim() ? [newStateAction.value.trim()] : [] }
  })
  if (!initialState.value) initialState.value = id
  newStateName.value = ''
  newStateAction.value = ''
}

function removeStateAction(nodeId: string, action: string) {
  if (props.readonly) return
  const node = nodes.value.find(n => n.id === nodeId)
  if (node) {
    node.data.actions = node.data.actions.filter(a => typeof a === 'string' ? a !== action : a.id !== action)
  }
}

function addStateAction(nodeId: string, action: string) {
  if (props.readonly || !action) return
  const node = nodes.value.find(n => n.id === nodeId)
  if (node && !node.data.actions.some(a => (typeof a === 'string' ? a : a.id) === action)) {
    node.data.actions.push(action)
  }
}

const edgeSource = ref('')
const edgeEvent = ref('')
const edgeTarget = ref('')
const edgeGuard = ref<{ type?: string; params?: Record<string, unknown> }>({})
function addTransition() {
  if (props.readonly) return
  if (!edgeSource.value || !edgeEvent.value || !edgeTarget.value) return
  const guardKey = edgeGuard.value?.type
    ? `${edgeGuard.value.type}-${JSON.stringify(edgeGuard.value.params ?? {})}`
    : 'no-guard'
  edges.value.push({
    id: `${edgeSource.value}-${edgeEvent.value}-${edgeTarget.value}-${guardKey}`,
    source: edgeSource.value,
    target: edgeTarget.value,
    label: edgeEvent.value,
    animated: true,
    data: edgeGuard.value?.type
      ? { guardType: edgeGuard.value.type, guardParams: edgeGuard.value.params }
      : undefined
  })
  edgeSource.value = ''
  edgeEvent.value = ''
  edgeTarget.value = ''
  edgeGuard.value = {}
}

function removeEdge(id: string) {
  if (props.readonly) return
  edges.value = edges.value.filter(e => e.id !== id)
}

function onSave() {
  emit('save', buildDefinition())
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="errors.length" class="bg-red-50 text-red-700 p-3 rounded text-sm">
      <ul class="list-disc pl-4">
        <li v-for="err in errors" :key="err.path">{{ err.path }}: {{ err.message }}</li>
      </ul>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium">Workflow id</label>
        <input
          :value="modelValue.id"
          class="border rounded px-3 py-2 w-full"
          readonly
        />
      </div>
      <div>
        <label class="block text-sm font-medium">Initial state</label>
        <select v-model="initialState" class="border rounded px-3 py-2 w-full" :disabled="readonly">
          <option value="">-- select --</option>
          <option v-for="node in nodes" :key="node.id" :value="node.id">{{ node.id }}</option>
        </select>
      </div>
    </div>

    <div v-if="!readonly" class="bg-white p-4 rounded shadow space-y-3">
      <h3 class="font-semibold">Add state</h3>
      <div class="grid grid-cols-3 gap-3">
        <input v-model="newStateName" placeholder="State name" class="border rounded px-3 py-2" />
        <ActionPicker v-model="newStateAction" :actions="actions" />
        <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" @click="addState">Add state</button>
      </div>
    </div>

    <div class="bg-white p-4 rounded shadow space-y-3">
      <h3 class="font-semibold">States & actions</h3>
      <div v-for="node in nodes" :key="node.id" class="border rounded p-3 space-y-2">
        <div class="font-medium">{{ node.id }}</div>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="action in node.data.actions"
            :key="typeof action === 'string' ? action : action.id"
            class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
          >
            {{ typeof action === 'string' ? action : action.id }}
            <button v-if="!readonly" class="text-blue-600 hover:text-blue-800" @click="removeStateAction(node.id, typeof action === 'string' ? action : action.id)">×</button>
          </span>
        </div>
        <div v-if="!readonly" class="flex gap-2">
          <ActionPicker :model-value="''" :actions="actions" @update:model-value="addStateAction(node.id, $event)" />
        </div>
      </div>
    </div>

    <div v-if="!readonly" class="bg-white p-4 rounded shadow space-y-3">
      <h3 class="font-semibold">Add transition</h3>
      <div class="grid grid-cols-5 gap-3 items-end">
        <select v-model="edgeSource" class="border rounded px-3 py-2">
          <option value="">Source</option>
          <option v-for="node in nodes" :key="node.id" :value="node.id">{{ node.id }}</option>
        </select>
        <input v-model="edgeEvent" placeholder="Event" class="border rounded px-3 py-2" />
        <select v-model="edgeTarget" class="border rounded px-3 py-2">
          <option value="">Target</option>
          <option v-for="node in nodes" :key="node.id" :value="node.id">{{ node.id }}</option>
        </select>
        <GuardEditor v-model="edgeGuard" :guards="guards" />
        <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" @click="addTransition">Add transition</button>
      </div>
      <p class="text-xs text-gray-500">Leave guard empty for unconditional transitions. Add multiple transitions with the same event and different guards for XOR logic.</p>
    </div>

    <div class="bg-white p-4 rounded shadow space-y-3">
      <h3 class="font-semibold">Transitions</h3>
      <ul class="space-y-1">
        <li v-for="edge in edges" :key="edge.id" class="flex items-center justify-between text-sm border-b pb-1">
          <span>
            {{ edge.source }} --{{ edge.label }}--> {{ edge.target }}
            <span v-if="edge.data?.guardType" class="text-gray-500">[{{ edge.data.guardType }}: {{ edge.data.guardParams }}]</span>
          </span>
          <button v-if="!readonly" class="text-red-600 hover:underline" @click="removeEdge(edge.id)">Remove</button>
        </li>
      </ul>
    </div>

    <div class="h-96 border rounded bg-white">
      <VueFlow v-model:nodes="nodes" v-model:edges="edges" fit-view-on-init>
        <Background />
      </VueFlow>
    </div>

    <details class="bg-gray-100 p-3 rounded">
      <summary class="cursor-pointer text-sm font-medium">Generated workflow definition</summary>
      <pre class="text-xs mt-2 overflow-auto">{{ JSON.stringify(buildDefinition(), null, 2) }}</pre>
    </details>

    <div v-if="!readonly" class="flex justify-end">
      <button class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" @click="onSave">Save workflow</button>
    </div>
  </div>
</template>
