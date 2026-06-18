<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  id: string
  selected?: boolean
}>()
</script>

<template>
  <div
    class="min-w-[100px] px-3 py-2 rounded-lg border-2 bg-green-50 text-center shadow-sm"
    :class="selected ? 'border-green-500 ring-2 ring-green-200' : 'border-green-300'"
  >
    <Handle type="target" :position="Position.Top" class="!bg-green-400" />
    <div class="font-semibold text-sm">{{ id }}</div>
    <div class="text-[10px] text-green-700">final</div>
  </div>
</template>
