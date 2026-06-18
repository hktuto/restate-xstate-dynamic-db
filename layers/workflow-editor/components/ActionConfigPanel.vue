<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { ActionMetadata, ParamSchema } from 'shared'

export interface ActionConfig {
  actionId: string
  params: Record<string, unknown>
  outputKey: string
}

const props = defineProps<{
  modelValue: ActionConfig
  actions: ActionMetadata[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ActionConfig): void
}>()

const activeAction = computed(() => props.actions.find(a => a.id === props.modelValue.actionId))
const jsonErrors = reactive<Record<string, string>>({})

function update(patch: Partial<ActionConfig>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function updateParam(key: string, value: unknown) {
  const next = { ...(props.modelValue.params ?? {}), [key]: value }
  update({ params: next })
}

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

function defaultValue(schema: ParamSchema): unknown {
  if (schema.default !== undefined) return schema.default
  if (schema.type === 'json') return {}
  if (schema.type === 'boolean') return false
  if (schema.type === 'number') return 0
  return ''
}

function coerceValue(schema: ParamSchema, raw: string): unknown {
  if (schema.type === 'boolean') return raw === 'true'
  if (schema.type === 'number') {
    const n = Number(raw)
    return Number.isNaN(n) ? undefined : n
  }
  return raw
}

function autoOutputKey(actionId: string, params?: Record<string, unknown>): string {
  const table = String(params?.table ?? '')
  const cap = table ? table.charAt(0).toUpperCase() + table.slice(1) : 'Record'
  if (actionId === 'getRecord') {
    const type = (params?.result as { type?: string })?.type ?? 'first'
    return type === 'list' ? `${table}List` : table
  }
  if (actionId === 'createRecord') return `new${cap}`
  if (actionId === 'updateRecord') return `updated${cap}`
  if (actionId === 'deleteRecord') return `deleted${cap}`
  return ''
}

function onSelectAction(actionId: string) {
  for (const key of Object.keys(jsonErrors)) delete jsonErrors[key]
  const action = props.actions.find(a => a.id === actionId)
  const params: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(action?.paramsSchema ?? {})) {
    params[key] = defaultValue(schema)
  }
  update({
    actionId,
    params,
    outputKey: autoOutputKey(actionId, params)
  })
}

function onJsonBlur(key: string, raw: string) {
  try {
    const parsed = JSON.parse(raw)
    delete jsonErrors[key]
    updateParam(key, parsed)
  } catch {
    jsonErrors[key] = 'Invalid JSON'
  }
}

watch(
  () => props.modelValue.params,
  (newParams, oldParams) => {
    if (!props.modelValue.actionId) return
    const newAuto = autoOutputKey(props.modelValue.actionId, newParams)
    const oldAuto = autoOutputKey(props.modelValue.actionId, oldParams)
    const current = props.modelValue.outputKey
    if (!current || current === oldAuto) {
      update({ outputKey: newAuto })
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="space-y-3">
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Action</label>
      <select
        :value="modelValue.actionId"
        class="w-full border rounded px-2 py-1 text-sm"
        :disabled="readonly"
        @change="onSelectAction(($event.target as HTMLSelectElement).value)"
      >
        <option value="">No action</option>
        <option v-for="action in actions" :key="action.id" :value="action.id">{{ action.label }}</option>
      </select>
    </div>

    <template v-if="activeAction">
      <div v-for="(schema, key) in activeAction.paramsSchema" :key="key">
        <label class="block text-xs font-medium text-gray-600 mb-1">{{ schema.label }}</label>

        <input
          v-if="schema.type === 'string'"
          :value="(modelValue.params?.[key] as string) ?? ''"
          type="text"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @input="updateParam(key, ($event.target as HTMLInputElement).value)"
        />

        <input
          v-else-if="schema.type === 'number'"
          :value="(modelValue.params?.[key] as number) ?? 0"
          type="number"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @change="updateParam(key, coerceValue(schema, ($event.target as HTMLInputElement).value))"
        />

        <select
          v-else-if="schema.type === 'boolean' || schema.type === 'select'"
          :value="String(modelValue.params?.[key] ?? '')"
          class="w-full border rounded px-2 py-1 text-sm"
          :disabled="readonly"
          @change="updateParam(key, coerceValue(schema, ($event.target as HTMLSelectElement).value))"
        >
          <option
            v-for="opt in schema.type === 'boolean'
              ? [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }]
              : (schema.options ?? [])"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>

        <template v-else-if="schema.type === 'json'">
          <textarea
            :value="formatJson(modelValue.params?.[key])"
            rows="4"
            class="w-full border rounded px-2 py-1 text-sm font-mono"
            :class="{ 'border-red-500': jsonErrors[key] }"
            :readonly="readonly"
            @blur="onJsonBlur(key, ($event.target as HTMLTextAreaElement).value)"
          />
          <p v-if="jsonErrors[key]" class="text-xs text-red-600 mt-1">{{ jsonErrors[key] }}</p>
        </template>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Output key</label>
        <input
          :value="modelValue.outputKey"
          type="text"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @input="update({ outputKey: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </template>
  </div>
</template>
