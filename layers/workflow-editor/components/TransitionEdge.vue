<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useVueFlow, type EdgeProps } from '@vue-flow/core'
import type { EditorEdge } from '../composables/types.js'

const props = defineProps<EdgeProps<EditorEdge>>()

const { removeEdges } = useVueFlow()

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
      class="absolute nodrag nopan px-2 py-0.5 bg-white border rounded text-xs shadow-sm"
      :class="selected ? 'border-blue-500' : 'border-gray-300'"
    >
      {{ label }}
      <button
        v-if="!props.data?.readonly"
        type="button"
        class="ml-1 text-red-500 hover:text-red-700"
        aria-label="Delete edge"
        @click.stop="removeEdges([id])"
      >
        ×
      </button>
    </div>
  </EdgeLabelRenderer>
</template>
