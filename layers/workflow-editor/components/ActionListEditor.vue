<script setup lang="ts">
import type { ActionMetadata } from 'shared'

const props = defineProps<{
  modelValue: (string | { id: string; params?: Record<string, unknown> })[]
  actions: ActionMetadata[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: (string | { id: string; params?: Record<string, unknown> })[]): void
}>()

const selectedAction = ref('')

function add() {
  if (!selectedAction.value) return
  const next = [...props.modelValue, selectedAction.value]
  emit('update:modelValue', next)
  selectedAction.value = ''
}

function remove(index: number) {
  const next = [...props.modelValue]
  next.splice(index, 1)
  emit('update:modelValue', next)
}

function labelFor(action: string | { id: string }) {
  const id = typeof action === 'string' ? action : action.id
  return props.actions.find(a => a.id === id)?.label ?? id
}
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="(action, index) in modelValue"
      :key="`${typeof action === 'string' ? action : action.id}-${index}`"
      class="flex items-center justify-between text-sm px-2 py-1 bg-gray-50 rounded"
    >
      <span>{{ labelFor(action) }}</span>
      <button v-if="!readonly" class="text-gray-400 hover:text-red-600" @click="remove(index)">×</button>
    </div>
    <div v-if="!readonly" class="flex gap-2">
      <select v-model="selectedAction" class="flex-1 border rounded px-2 py-1 text-sm">
        <option value="">Select action</option>
        <option v-for="action in actions" :key="action.id" :value="action.id">{{ action.label }}</option>
      </select>
      <button class="px-2 py-1 border rounded text-sm" @click="add">Add</button>
    </div>
  </div>
</template>
