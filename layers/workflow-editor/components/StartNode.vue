<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  selected?: boolean
}>()
</script>

<template>
  <div
    class="w-16 h-16 rounded-full border-2 bg-gray-100 flex items-center justify-center text-xs font-bold shadow-sm"
    :class="selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-400'"
  >
    Start
    <Handle type="source" :position="Position.Right" class="!bg-gray-400" />
  </div>
</template>
