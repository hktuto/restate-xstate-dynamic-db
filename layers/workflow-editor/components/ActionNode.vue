<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { EditorNodeData } from '../composables/types.js'

type ActionData = Extract<EditorNodeData, { kind: 'action' }>

defineProps<{
  id: string
  data: ActionData
  selected?: boolean
}>()
</script>

<template>
  <div
    class="min-w-[140px] px-3 py-2 rounded-lg border-2 bg-blue-50 text-center shadow-sm"
    :class="selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-300'"
  >
    <Handle type="target" :position="Position.Top" class="!bg-blue-400" />
    <div class="font-semibold text-sm">{{ id }}</div>
    <div class="text-xs text-blue-700 mt-1">
      {{ data.actionId || 'No action' }}
    </div>
    <div v-if="data.outputKey" class="text-[10px] text-gray-500">
      → {{ data.outputKey }}
    </div>
    <Handle type="source" :position="Position.Bottom" class="!bg-blue-400" />
  </div>
</template>
