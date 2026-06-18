<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'
import type { EditorNode } from '../composables/types.js'
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
const validationOpen = ref(false)
const lastEmitted = ref<WorkflowDefinition | null>(null)

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

function onUpdateName(value: string | undefined) {
  emit('update:name', value ?? '')
}

function onSave() {
  if (!canSave.value) {
    emit('error', 'Please fix validation errors before saving.')
    return
  }
  emit('save', editor.build())
}

function onFocusError(id: string) {
  editor.selectedId.value = id
  // VueFlow exposes fitView with nodes option if needed; keep simple for now.
}

let isInternalUpdate = false
let isInitialLoad = true

watch([editor.nodes, editor.edges], () => {
  const id = editor.selectedId.value
  if (id && !editor.nodes.value.some(n => n.id === id) && !editor.edges.value.some(e => e.id === id)) {
    editor.selectedId.value = null
  }

  if (isInitialLoad) {
    isInitialLoad = false
    return
  }

  isInternalUpdate = true
  const emitted = editor.build()
  lastEmitted.value = emitted
  emit('update:modelValue', emitted)
  nextTick(() => { isInternalUpdate = false })
}, { deep: true })

watch(() => props.modelValue, (def) => {
  if (!def || isInternalUpdate) return
  if (JSON.stringify(def) === JSON.stringify(lastEmitted.value)) return
  editor.load(def)
}, { deep: false, immediate: true })
</script>

<template>
  <div class="flex flex-col h-full min-h-[600px] border rounded bg-white">
    <WorkflowToolbar
      v-model:tool="editor.tool.value"
      :name="name"
      :readonly="readonly"
      :can-save="canSave"
      @update:name="onUpdateName"
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
