<script setup lang="ts">
import type { ValidationError } from '../composables/useWorkflowValidator.js'

const props = defineProps<{
  errors: ValidationError[]
}>()

const emit = defineEmits<{
  (e: 'focus', id: string): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
</script>

<template>
  <div v-if="errors.length" class="border-t bg-red-50">
    <button
      class="w-full px-3 py-1 text-left text-xs font-medium text-red-700 flex items-center justify-between"
      @click="isOpen = !isOpen"
    >
      <span>{{ errors.length }} validation issue{{ errors.length === 1 ? '' : 's' }}</span>
      <span>{{ isOpen ? '▼' : '▲' }}</span>
    </button>
    <ul v-if="isOpen" class="px-3 py-2 text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
      <li
        v-for="error in errors"
        :key="`${error.id}-${error.message}`"
        class="cursor-pointer hover:underline"
        @click="emit('focus', error.id)"
      >
        {{ error.path }}: {{ error.message }}
      </li>
    </ul>
  </div>
</template>
