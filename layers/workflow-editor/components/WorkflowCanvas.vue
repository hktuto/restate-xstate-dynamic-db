<script setup lang="ts">
import { ref, computed } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { NodeMouseEvent, EdgeMouseEvent, NodeTypesObject, VueFlowStore } from '@vue-flow/core'
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

const vueFlowInstance = ref<VueFlowStore | null>(null)

function onInit(instance: VueFlowStore) {
  vueFlowInstance.value = instance
}

const nodeTypes = {
  start: StartNode,
  action: ActionNode,
  condition: ConditionNode,
  task: TaskNode,
  final: FinalNode
} as NodeTypesObject

const edgeTypes = { transition: TransitionEdge }

const flowNodes = computed({
  get: () => props.nodes,
  set: (value) => emit('update:nodes', value)
})

const flowEdges = computed({
  get: () => props.edges,
  set: (value) => emit('update:edges', value)
})

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

function onNodeClick({ node }: NodeMouseEvent) {
  emit('select', (node as EditorNode).id)
}

function onEdgeClick({ edge }: EdgeMouseEvent) {
  emit('select', (edge as EditorEdge).id)
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
      :default-edge-options="{ type: 'transition' }"
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
