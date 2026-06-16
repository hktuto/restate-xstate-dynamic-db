<script setup lang="ts">
import { ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { EditorNode } from '../composables/useWorkflowGraph'

const props = defineProps<{
  id: string
  data: EditorNode['data']
  selected?: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'rename', id: string, newId: string): void
}>()

const isEditing = ref(false)
const editName = ref(props.id)

function startEdit() {
  if (props.readonly) return
  isEditing.value = true
  editName.value = props.id
}

function commitEdit() {
  isEditing.value = false
  const trimmed = editName.value.trim()
  if (trimmed && trimmed !== props.id) {
    emit('rename', props.id, trimmed)
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') commitEdit()
  if (event.key === 'Escape') {
    isEditing.value = false
    editName.value = props.id
  }
}
</script>

<template>
  <div
    class="min-w-[120px] px-4 py-2 rounded-lg border-2 bg-white text-center shadow-sm"
    :class="selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'"
  >
    <Handle type="target" :position="Position.Top" class="!bg-gray-400" />

    <div v-if="isEditing">
      <input
        v-model="editName"
        v-focus
        class="w-full text-center text-sm border rounded px-1"
        @blur="commitEdit"
        @keydown="onKeydown"
      />
    </div>
    <div
      v-else
      class="font-medium text-sm"
      :class="readonly ? 'cursor-default' : 'cursor-pointer'"
      @dblclick="startEdit"
    >
      {{ data.label }}
    </div>

    <div v-if="data.entry?.length || data.exit?.length" class="mt-1 flex flex-wrap justify-center gap-1">
      <span
        v-for="action in data.entry"
        :key="`entry-${typeof action === 'string' ? action : action.id}`"
        class="text-[10px] px-1 bg-green-100 text-green-800 rounded"
      >
        {{ typeof action === 'string' ? action : action.id }}
      </span>
      <span
        v-for="action in data.exit"
        :key="`exit-${typeof action === 'string' ? action : action.id}`"
        class="text-[10px] px-1 bg-orange-100 text-orange-800 rounded"
      >
        {{ typeof action === 'string' ? action : action.id }}→
      </span>
    </div>

    <Handle type="source" :position="Position.Bottom" class="!bg-gray-400" />
  </div>
</template>
