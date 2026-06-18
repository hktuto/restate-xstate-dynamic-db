<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { EditorNode, EditorEdge } from '../composables/types.js'
import type { ActionMetadata, GuardMetadata } from 'shared'
import ActionConfigPanel from './ActionConfigPanel.vue'

const props = defineProps<{
  selectedNode?: EditorNode
  selectedEdge?: EditorEdge
  actions: ActionMetadata[]
  guards: GuardMetadata[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:node', id: string, data: Partial<EditorNode['data']>): void
  (e: 'update:edge', id: string, data: Partial<NonNullable<EditorEdge['data']>>): void
  (e: 'rename:node', oldId: string, newId: string): void
  (e: 'rename:edge', id: string, newLabel: string): void
  (e: 'select:node', id: string): void
}>()

const nodeName = computed({
  get: () => props.selectedNode?.id ?? '',
  set: (value: string) => {
    if (props.selectedNode && value !== props.selectedNode.id) {
      emit('rename:node', props.selectedNode.id, value)
    }
  }
})

const eventName = computed({
  get: () => props.selectedEdge?.label ?? '',
  set: (value: string) => {
    if (props.selectedEdge && value !== props.selectedEdge.label) {
      emit('rename:edge', props.selectedEdge.id, value)
    }
  }
})

const selectedGuardType = computed({
  get: () => props.selectedEdge?.data?.guard?.type ?? '',
  set: (type: string) => {
    if (!props.selectedEdge) return
    const guard = type
      ? { type, params: props.selectedEdge.data?.guard?.params ?? {} }
      : undefined
    emit('update:edge', props.selectedEdge.id, { guard })
  }
})

const activeGuard = computed(() => props.guards.find(g => g.id === selectedGuardType.value))

const jsonErrors = reactive<Record<string, string>>({})

watch(() => props.selectedEdge?.id, () => {
  Object.keys(jsonErrors).forEach(key => delete jsonErrors[key])
})

watch(selectedGuardType, () => {
  Object.keys(jsonErrors).forEach(key => delete jsonErrors[key])
})

const guardParamValue = computed({
  get() {
    if (!activeGuard.value || !props.selectedEdge?.data?.guard?.params) return ''
    const key = Object.keys(activeGuard.value.paramsSchema)[0]
    if (!key) return ''
    const value = props.selectedEdge.data.guard.params[key]
    if (value === undefined || value === null) return ''
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  },
  set(value: string) {
    if (!props.selectedEdge) return
    const key = Object.keys(activeGuard.value?.paramsSchema ?? {})[0]
    if (!key) return
    let parsed: unknown = value
    try {
      parsed = JSON.parse(value)
      delete jsonErrors[key]
    } catch {
      jsonErrors[key] = 'Invalid JSON'
    }
    emit('update:edge', props.selectedEdge.id, {
      guard: { type: selectedGuardType.value, params: { [key]: parsed } }
    })
  }
})
</script>

<template>
  <div class="p-4 space-y-4">
    <div v-if="!selectedNode && !selectedEdge" class="text-sm text-gray-500">
      Select a state or transition to edit its details.
    </div>

    <template v-if="selectedNode">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">State ID</label>
        <input v-model="nodeName" class="w-full border rounded px-2 py-1 text-sm" :readonly="readonly" />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Type</label>
        <input value="atomic" class="w-full border rounded px-2 py-1 text-sm bg-gray-50" readonly />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Action</label>
        <ActionConfigPanel
          :model-value="selectedNode.data.meta ?? {}"
          :actions="actions"
          :readonly="readonly"
          @update:model-value="emit('update:node', selectedNode.id, { meta: $event })"
        />
      </div>
    </template>

    <template v-if="selectedEdge">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Event</label>
        <select
          v-if="selectedEdge?.data?.sourceAction"
          v-model="eventName"
          class="w-full border rounded px-2 py-1 text-sm"
          :disabled="readonly"
        >
          <option
            v-for="opt in selectedEdge.data.sourceAction === 'condition'
              ? [{ label: 'true', value: 'true' }, { label: 'false', value: 'false' }]
              : [{ label: 'ok', value: 'ok' }, { label: 'error', value: 'error' }]"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
        <input
          v-else
          v-model="eventName"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Source → Target</label>
        <div class="text-sm">
          <button class="text-blue-600 hover:underline" @click="emit('select:node', selectedEdge.source)">
            {{ selectedEdge.source }}
          </button>
          →
          <button class="text-blue-600 hover:underline" @click="emit('select:node', selectedEdge.target)">
            {{ selectedEdge.target }}
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Guard</label>
        <select v-model="selectedGuardType" class="w-full border rounded px-2 py-1 text-sm" :disabled="readonly">
          <option value="">No guard</option>
          <option v-for="guard in guards" :key="guard.id" :value="guard.id">{{ guard.label }}</option>
        </select>
        <template v-if="activeGuard">
          <div class="mt-2">
            <label class="block text-xs font-medium text-gray-600 mb-1">
              {{ activeGuard.paramsSchema?.expression?.label ?? 'Value' }}
            </label>
            <textarea
              :value="guardParamValue"
              rows="4"
              class="w-full border rounded px-2 py-1 text-sm font-mono"
              :class="{ 'border-red-500': jsonErrors[Object.keys(activeGuard.paramsSchema)[0]] }"
              :readonly="readonly"
              @blur="guardParamValue = ($event.target as HTMLTextAreaElement).value"
            />
            <p
              v-if="jsonErrors[Object.keys(activeGuard.paramsSchema)[0]]"
              class="text-xs text-red-600 mt-1"
            >
              {{ jsonErrors[Object.keys(activeGuard.paramsSchema)[0]] }}
            </p>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
