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

function onPaneClick(event: MouseEvent) {
  if (props.tool.startsWith('add-')) {
    const type = props.tool.replace('add-', '') as EditorNode['type']
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    emit('add-node', type, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    })
    emit('select', null)
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
  if (props.tool === 'select') emit('select', null)
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
      @pane-click="onPaneClickClear"
      @dblclick="onPaneClick"
      @connect="onConnect"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
    >
      <Background />
    </VueFlow>
  </div>
</template>
