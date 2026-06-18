<script setup lang="ts">
import type { EditorNodeData } from '../composables/types.js'

type TaskType = Extract<EditorNodeData, { kind: 'task' }>['taskType']

const props = defineProps<{
  taskType: TaskType
  taskInstructions: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:taskType', value: TaskType): void
  (e: 'update:taskInstructions', value: string): void
}>()

const taskTypes: { label: string; value: TaskType }[] = [
  { label: 'Approval', value: 'approval' },
  { label: 'Review', value: 'review' },
  { label: 'Manual', value: 'manual' }
]
</script>

<template>
  <div class="space-y-3">
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Task type</label>
      <select
        :value="taskType"
        class="w-full border rounded px-2 py-1 text-sm"
        :disabled="readonly"
        @change="emit('update:taskType', ($event.target as HTMLSelectElement).value as TaskType)"
      >
        <option v-for="t in taskTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Instructions</label>
      <textarea
        :value="taskInstructions"
        rows="4"
        class="w-full border rounded px-2 py-1 text-sm"
        :readonly="readonly"
        @input="emit('update:taskInstructions', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
  </div>
</template>
