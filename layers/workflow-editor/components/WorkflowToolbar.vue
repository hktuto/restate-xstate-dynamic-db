<script setup lang="ts">
import type { EditorTool } from '../composables/useWorkflowEditor'

const tool = defineModel<EditorTool>('tool', { required: true })

const props = defineProps<{
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'fit-view'): void
  (e: 'save'): void
}>()
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-2 bg-white border-b">
    <button
      class="px-2 py-1 text-sm rounded border"
      :class="tool === 'select' ? 'bg-blue-100 border-blue-300' : 'border-gray-300'"
      @click="tool = 'select'"
    >
      Select
    </button>
    <button
      class="px-2 py-1 text-sm rounded border"
      :class="tool === 'pan' ? 'bg-blue-100 border-blue-300' : 'border-gray-300'"
      @click="tool = 'pan'"
    >
      Pan
    </button>
    <button
      class="px-2 py-1 text-sm rounded border"
      :class="tool === 'add-state' ? 'bg-blue-100 border-blue-300' : 'border-gray-300'"
      @click="tool = 'add-state'"
    >
      Add state
    </button>

    <div class="flex-1" />

    <button class="px-2 py-1 text-sm rounded border border-gray-300" @click="emit('fit-view')">
      Fit view
    </button>
    <button
      v-if="!readonly"
      class="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
      @click="emit('save')"
    >
      Save
    </button>
  </div>
</template>
