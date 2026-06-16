<script setup lang="ts">
import type { EditorNode, EditorEdge } from '../composables/useWorkflowGraph'
import type { ActionMetadata, GuardMetadata } from 'shared'

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

const guardParamValue = computed({
  get: () => {
    const key = Object.keys(activeGuard.value?.paramsSchema ?? {})[0]
    return key ? String(props.selectedEdge?.data?.guard?.params?.[key] ?? '') : ''
  },
  set: (value: string) => {
    if (!props.selectedEdge || !activeGuard.value) return
    const key = Object.keys(activeGuard.value.paramsSchema)[0]
    if (!key) return
    emit('update:edge', props.selectedEdge.id, {
      guard: { type: selectedGuardType.value, params: { [key]: value } }
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
        <label class="block text-xs font-medium text-gray-600 mb-1">Entry actions</label>
        <ActionListEditor
          :model-value="selectedNode.data.entry"
          :actions="actions"
          :readonly="readonly"
          @update:model-value="emit('update:node', selectedNode.id, { entry: $event })"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Exit actions</label>
        <ActionListEditor
          :model-value="selectedNode.data.exit"
          :actions="actions"
          :readonly="readonly"
          @update:model-value="emit('update:node', selectedNode.id, { exit: $event })"
        />
      </div>
    </template>

    <template v-if="selectedEdge">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Event</label>
        <input v-model="eventName" class="w-full border rounded px-2 py-1 text-sm" :readonly="readonly" />
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
        <input
          v-if="activeGuard"
          v-model="guardParamValue"
          class="w-full mt-2 border rounded px-2 py-1 text-sm"
          :placeholder="activeGuard.paramsSchema?.[Object.keys(activeGuard.paramsSchema)[0]]?.label ?? 'Value'"
          :readonly="readonly"
        />
      </div>
    </template>
  </div>
</template>
