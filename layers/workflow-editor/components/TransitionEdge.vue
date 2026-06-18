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
