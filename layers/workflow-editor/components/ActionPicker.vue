<script setup lang="ts">
import type { ActionMetadata } from 'shared'

const props = defineProps<{
  modelValue: string
  actions: ActionMetadata[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function onChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <select :value="modelValue" class="border rounded px-2 py-1 text-sm" @change="onChange">
    <option value="">Select action</option>
    <option v-for="action in actions" :key="action.id" :value="action.id">
      {{ action.label }}
    </option>
  </select>
</template>
