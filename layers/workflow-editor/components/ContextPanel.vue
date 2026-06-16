<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'

const props = defineProps<{
  definition: WorkflowDefinition
  name?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:name', value: string): void
  (e: 'update:definition', value: WorkflowDefinition): void
}>()

const contextJson = computed({
  get: () => JSON.stringify(props.definition.context ?? {}, null, 2),
  set: (value: string) => {
    try {
      const parsed = JSON.parse(value)
      emit('update:definition', { ...props.definition, context: parsed })
    } catch {
      // ignore invalid JSON while typing
    }
  }
})
</script>

<template>
  <div class="p-4 space-y-4">
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Workflow ID</label>
      <input :value="definition.id" class="w-full border rounded px-2 py-1 text-sm bg-gray-50" readonly />
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Workflow name</label>
      <input
        :value="name"
        class="w-full border rounded px-2 py-1 text-sm"
        :readonly="readonly"
        @input="emit('update:name', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Initial state</label>
      <select
        :value="definition.initial"
        class="w-full border rounded px-2 py-1 text-sm"
        :disabled="readonly"
        @change="emit('update:definition', { ...definition, initial: ($event.target as HTMLSelectElement).value })"
      >
        <option value="">-- select --</option>
        <option v-for="state in Object.keys(definition.states)" :key="state" :value="state">{{ state }}</option>
      </select>
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Context (JSON)</label>
      <textarea
        v-model="contextJson"
        class="w-full h-48 border rounded px-2 py-1 text-xs font-mono"
        :readonly="readonly"
      />
    </div>
  </div>
</template>
