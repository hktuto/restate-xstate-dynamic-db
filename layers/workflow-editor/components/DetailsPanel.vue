<script setup lang="ts">
import { computed } from 'vue'
import type { EditorEdge, EditorNode } from '../composables/types.js'
import type { ActionMetadata } from 'shared'
import ActionConfigPanel from './ActionConfigPanel.vue'
import ConditionConfigPanel from './ConditionConfigPanel.vue'
import TaskConfigPanel from './TaskConfigPanel.vue'

const props = defineProps<{
  selectedNode?: EditorNode
  selectedEdge?: EditorEdge
  actions: ActionMetadata[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:node', id: string, data: Partial<EditorNode['data']>): void
  (e: 'update:edge', id: string, event: string): void
  (e: 'rename:node', oldId: string, newId: string): void
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


function updateActionConfig(config: { actionId: string; params: Record<string, unknown>; outputKey: string }) {
  if (!props.selectedNode) return
  emit('update:node', props.selectedNode.id, {
    kind: 'action',
    actionId: config.actionId,
    params: config.params,
    outputKey: config.outputKey
  } as Partial<EditorNode['data']>)
}

function updateConditionExpression(expression: unknown) {
  if (!props.selectedNode) return
  emit('update:node', props.selectedNode.id, { kind: 'condition', expression } as Partial<EditorNode['data']>)
}

function updateTask(patch: Partial<{ taskType: 'approval' | 'review' | 'manual'; taskInstructions: string }>) {
  if (!props.selectedNode || props.selectedNode.data.kind !== 'task') return
  emit('update:node', props.selectedNode.id, { ...props.selectedNode.data, ...patch } as Partial<EditorNode['data']>)
}
</script>

<template>
  <div class="p-4 space-y-4">
    <div v-if="!selectedNode && !selectedEdge" class="text-sm text-gray-500">
      Select a state or transition to edit its details.
    </div>

    <template v-if="selectedNode">
      <div v-if="selectedNode.id !== '__start'">
        <label class="block text-xs font-medium text-gray-600 mb-1">State ID</label>
        <input v-model="nodeName" class="w-full border rounded px-2 py-1 text-sm" :readonly="readonly" />
      </div>

      <div v-if="selectedNode.type === 'final'" class="text-sm text-gray-500">
        Final state. No configuration needed.
      </div>

      <ActionConfigPanel
        v-if="selectedNode.type === 'action' && selectedNode.data.kind === 'action'"
        :model-value="{ actionId: selectedNode.data.actionId, params: selectedNode.data.params, outputKey: selectedNode.data.outputKey }"
        :actions="actions"
        :readonly="readonly"
        @update:model-value="updateActionConfig"
      />

      <ConditionConfigPanel
        v-if="selectedNode.type === 'condition' && selectedNode.data.kind === 'condition'"
        :expression="selectedNode.data.expression"
        :readonly="readonly"
        @update:expression="updateConditionExpression"
      />

      <TaskConfigPanel
        v-if="selectedNode.type === 'task' && selectedNode.data.kind === 'task'"
        :task-type="selectedNode.data.taskType"
        :task-instructions="selectedNode.data.taskInstructions"
        :readonly="readonly"
        @update:task-type="updateTask({ taskType: $event })"
        @update:task-instructions="updateTask({ taskInstructions: $event })"
      />
    </template>

    <template v-if="selectedEdge">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Event</label>
        <input
          :value="selectedEdge.label"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @change="emit('update:edge', selectedEdge.id, ($event.target as HTMLInputElement).value)"
        />
        <p class="text-[10px] text-gray-500 mt-1">
          Suggested events depend on the source state type.
        </p>
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
    </template>
  </div>
</template>
