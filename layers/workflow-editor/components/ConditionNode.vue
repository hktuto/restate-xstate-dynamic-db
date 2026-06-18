<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  id: string
  selected?: boolean
}>()
</script>

<template>
  <div
    class="w-24 h-24 flex items-center justify-center"
    :class="selected ? 'drop-shadow-md' : ''"
  >
    <div
      class="w-16 h-16 rotate-45 border-2 bg-amber-50 flex items-center justify-center shadow-sm"
      :class="selected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-300'"
    >
      <span class="-rotate-45 text-xs font-semibold text-center">{{ id }}</span>
    </div>
    <Handle type="target" :position="Position.Top" class="!bg-amber-400" />
    <Handle type="source" :position="Position.Bottom" class="!bg-amber-400" />
    <Handle type="source" :position="Position.Left" class="!bg-amber-400" />
    <Handle type="source" :position="Position.Right" class="!bg-amber-400" />
  </div>
</template>
