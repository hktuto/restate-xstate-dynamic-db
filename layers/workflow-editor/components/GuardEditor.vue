<script setup lang="ts">
import type { GuardMetadata } from 'shared'

const props = defineProps<{
  modelValue?: { type?: string; params?: Record<string, unknown> }
  guards: GuardMetadata[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: { type?: string; params?: Record<string, unknown> }): void
}>()

const guardType = computed({
  get: () => props.modelValue?.type ?? '',
  set: (type: string) => emit('update:modelValue', { ...props.modelValue, type, params: {} })
})

const activeGuard = computed(() => props.guards.find(g => g.id === guardType.value))

const paramValue = computed({
  get: () => {
    const firstKey = Object.keys(activeGuard.value?.paramsSchema ?? {})[0]
    return firstKey ? String(props.modelValue?.params?.[firstKey] ?? '') : ''
  },
  set: (value: string) => {
    const firstKey = Object.keys(activeGuard.value?.paramsSchema ?? {})[0]
    if (!firstKey) return
    emit('update:modelValue', {
      ...props.modelValue,
      type: guardType.value,
      params: { [firstKey]: value }
    })
  }
})
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <select v-model="guardType" class="border rounded px-2 py-1 text-sm">
      <option value="">No guard</option>
      <option v-for="guard in guards" :key="guard.id" :value="guard.id">
        {{ guard.label }}
      </option>
    </select>
    <input
      v-if="activeGuard"
      v-model="paramValue"
      :placeholder="activeGuard.paramsSchema?.[Object.keys(activeGuard.paramsSchema)[0]]?.label ?? 'Value'"
      class="border rounded px-2 py-1 text-sm"
    />
  </div>
</template>
