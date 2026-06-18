<script setup lang="ts">
import type { EditorTool } from '../composables/useWorkflowEditor.js'

const tool = defineModel<EditorTool>('tool', { required: true })
const name = defineModel<string>('name')

const props = defineProps<{
  readonly?: boolean
  canSave?: boolean
}>()

const emit = defineEmits<{
  (e: 'fit-view'): void
  (e: 'save'): void
}>()
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-2 bg-white border-b flex-wrap">
    <input
      v-model="name"
      type="text"
      placeholder="Workflow name"
      class="border rounded px-2 py-1 text-sm w-48"
      :readonly="readonly"
    />

    <select
      :value="tool"
      class="border rounded px-2 py-1 text-sm"
      :disabled="readonly"
      @change="tool = ($event.target as HTMLSelectElement).value as EditorTool"
    >
      <option value="select">Select</option>
      <option value="pan">Pan</option>
      <option value="add-action">+ Action</option>
      <option value="add-condition">+ Condition</option>
      <option value="add-task">+ Task</option>
      <option value="add-final">+ Final</option>
    </select>

    <div class="flex-1" />

    <button class="px-2 py-1 text-sm rounded border border-gray-300" @click="emit('fit-view')">
      Fit view
    </button>
    <button
      v-if="!readonly"
      class="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
      :disabled="!canSave"
      @click="emit('save')"
    >
      Save
    </button>
  </div>
</template>
