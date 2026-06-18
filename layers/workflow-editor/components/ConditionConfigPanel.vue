<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  expression: unknown
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:expression', value: unknown): void
}>()

const json = computed({
  get: () => JSON.stringify(props.expression ?? {}, null, 2),
  set: (value: string) => {
    try {
      emit('update:expression', JSON.parse(value))
    } catch {
      // ignore while typing; parent can validate
    }
  }
})
</script>

<template>
  <div>
    <label class="block text-xs font-medium text-gray-600 mb-1">Expression (JSON)</label>
    <textarea
      v-model="json"
      rows="6"
      class="w-full border rounded px-2 py-1 text-sm font-mono"
      :readonly="readonly"
    />
    <p class="text-[10px] text-gray-500 mt-1">
      Use MongoDB-style operators: <code>$eq</code>, <code>$ne</code>, <code>$and</code>, <code>$or</code>, <code>$context.field</code>.
    </p>
  </div>
</template>
