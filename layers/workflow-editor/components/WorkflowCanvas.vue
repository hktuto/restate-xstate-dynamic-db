<script setup lang="ts">
import { ref } from 'vue'
import { VueFlow } from '@vue-flow/core'
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

const vueFlowInstance = ref<any>(null)

function onInit(instance: any) {
  vueFlowInstance.value = instance
}

const nodeTypes = { state: StateNode }
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
  vueFlowInstance.value?.fitView()
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
      @init="onInit"
      @pane-click="onPaneClickClear"
      @dblclick="onPaneClick"
      @connect="onConnect"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
    >
      <Background />

      <template #node-state="nodeProps">
        <StateNode v-bind="nodeProps" :readonly="readonly" @rename="onRename" />
      </template>

      <template #edge-transition="edgeProps">
        <TransitionEdge v-bind="edgeProps" :readonly="readonly" @delete="onDeleteEdge" />
      </template>
    </VueFlow>
  </div>
</template>
