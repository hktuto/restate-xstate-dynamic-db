<script setup lang="ts">
import type { WorkflowDefinition, StartRule, ActionInputMetadata } from 'shared'
import { useWorkflowRun } from '../composables/useWorkflowRun.js'
import { buildPayload } from './workflow-run-modal-helpers.js'

const USER_TRIGGER_TYPE = 'user_trigger'

const props = defineProps<{
  designId: string
  definition: WorkflowDefinition
  starts: StartRule[]
  namespace: string
  apiBasePath: string
  errorHandler?: (message: string) => void
}>()

const emit = defineEmits<{
  (e: 'success', instanceId: string): void
}>()

const api = useApi()

const isOpen = ref(false)
const loading = ref(false)
const result = ref('')
const error = ref('')
const inputs = ref<ActionInputMetadata[]>([])
const formValues = ref<Record<string, string | boolean>>({})

function open() {
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

function reportError(message: string) {
  error.value = message
  if (props.errorHandler) {
    props.errorHandler(message)
  } else {
    console.error(message)
  }
}

function getInitialValue(input: ActionInputMetadata): string | boolean {
  if (input.displayType === 'checkbox') {
    if (input.defaultValue === undefined || input.defaultValue === null) return false
    return Boolean(input.defaultValue)
  }
  if (input.defaultValue === undefined || input.defaultValue === null) return ''
  if (input.displayType === 'json') {
    if (typeof input.defaultValue === 'string') return input.defaultValue
    return JSON.stringify(input.defaultValue)
  }
  return String(input.defaultValue)
}

function initFormValues(visibleInputs: ActionInputMetadata[]) {
  const values: Record<string, string | boolean> = {}
  for (const input of visibleInputs) {
    values[input.name] = getInitialValue(input)
  }
  formValues.value = values
}

function getInputValue(input: ActionInputMetadata): string {
  const value = formValues.value[input.name]
  if (value === undefined || value === null) return ''
  return String(value)
}

function isChecked(input: ActionInputMetadata): boolean {
  return Boolean(formValues.value[input.name])
}

function setInputValue(input: ActionInputMetadata, value: string | boolean) {
  formValues.value[input.name] = value
}

function isSelectOption(o: unknown): o is { label: string; value: string } {
  return (
    typeof o === 'object' &&
    o !== null &&
    'label' in o &&
    'value' in o &&
    typeof (o as Record<string, unknown>).label === 'string' &&
    typeof (o as Record<string, unknown>).value === 'string'
  )
}

function getSelectOptions(input: ActionInputMetadata): { label: string; value: string }[] {
  const opts = input.config?.options
  if (!Array.isArray(opts)) return []
  return opts.filter(isSelectOption)
}

async function loadInputs() {
  result.value = ''
  error.value = ''
  inputs.value = []
  formValues.value = {}

  const rule = props.starts.find((s) => s.type === USER_TRIGGER_TYPE)
  if (!rule) {
    reportError('Design has no user trigger')
    return
  }

  if (!props.namespace) {
    reportError('No namespace selected')
    return
  }

  try {
    const { visibleInputs } = await useWorkflowRun(props.namespace, props.definition, rule.startState)
    inputs.value = visibleInputs.value
    initFormValues(inputs.value)
  } catch (err) {
    reportError(err instanceof Error ? err.message : String(err))
  }
}

watch(isOpen, (open) => {
  if (open) {
    loadInputs()
  }
})

async function submit() {
  result.value = ''
  error.value = ''

  const { values, errors } = buildPayload(inputs.value, formValues.value)
  const firstError = errors[0]
  if (firstError) {
    reportError(firstError)
    return
  }

  loading.value = true
  try {
    const res = await api.fetch<{ id: string }>(`${props.apiBasePath}/workflow-instances`, {
      method: 'POST',
      body: JSON.stringify({ designId: props.designId, values })
    })
    result.value = `Started instance ${res.id}`
    emit('success', res.id)
    setTimeout(() => {
      isOpen.value = false
    }, 800)
  } catch (err) {
    reportError(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

defineExpose({ open, close })
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="close">
    <div class="bg-white rounded shadow p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
      <h2 class="text-lg font-bold mb-4">Run workflow</h2>

      <form @submit.prevent="submit">
        <div v-if="inputs.length === 0 && !error && !loading" class="text-sm text-gray-600 mb-4">
          No inputs required.
        </div>

        <div v-for="input in inputs" :key="input.name" class="mb-4">
          <label class="block text-sm font-medium mb-1">
            {{ input.label }}
            <span v-if="input.required" class="text-red-600">*</span>
          </label>

          <select
            v-if="input.displayType === 'select'"
            :value="getInputValue(input)"
            class="w-full border rounded p-2"
            :required="input.required"
            @change="setInputValue(input, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Select…</option>
            <option
              v-for="opt in getSelectOptions(input)"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>

          <input
            v-else-if="input.displayType === 'checkbox'"
            :checked="isChecked(input)"
            type="checkbox"
            class="w-5 h-5"
            @change="setInputValue(input, ($event.target as HTMLInputElement).checked)"
          />

          <textarea
            v-else-if="input.displayType === 'json' || input.displayType === 'richText'"
            :value="getInputValue(input)"
            rows="4"
            class="w-full border rounded p-2 font-mono text-sm"
            :required="input.required"
            @input="setInputValue(input, ($event.target as HTMLTextAreaElement).value)"
          />

          <input
            v-else
            :value="getInputValue(input)"
            :type="input.displayType"
            class="w-full border rounded p-2"
            :required="input.required"
            @input="setInputValue(input, ($event.target as HTMLInputElement).value)"
          />

          <p v-if="input.description" class="text-gray-600 text-xs mt-1">{{ input.description }}</p>
        </div>

        <p v-if="error" class="text-red-600 text-sm mt-2">{{ error }}</p>
        <p v-if="result" class="text-green-600 text-sm mt-2">{{ result }}</p>

        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="px-4 py-2 text-gray-700 hover:underline" @click="close">Cancel</button>
          <button
            type="submit"
            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            :disabled="loading"
          >
            {{ loading ? 'Running…' : 'Run' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
