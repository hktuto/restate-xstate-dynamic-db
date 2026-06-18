<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { EditorNodeData } from '../composables/types.js'

type TaskData = Extract<EditorNodeData, { kind: 'task' }>

defineProps<{
  id: string
  data: TaskData
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
    <div class="text-xs text-purple-700 mt-1 capitalize">
      {{ data.taskType }} task
    </div>
    <Handle type="source" :position="Position.Bottom" class="!bg-purple-400" />
  </div>
</template>
