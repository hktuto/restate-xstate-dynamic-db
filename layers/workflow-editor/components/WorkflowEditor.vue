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
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }
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
  window.addEventListener('keydown', onKeydown)
  editor.load(props.modelValue)
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
