<script setup lang="ts">
import type { WorkflowDefinition, StartRule, ActionInputMetadata } from 'shared'
import { useWorkflowRun } from '../composables/useWorkflowRun.js'
import NestedFormInput from './NestedFormInput.vue'
import { buildPayload } from './workflow-run-modal-helpers.js'

const USER_TRIGGER_TYPE = 'user_trigger'

const props = defineProps<{
  designId: string
  definition: WorkflowDefinition
  starts: StartRule[]
  namespace: string
  apiBasePath: string
  database?: string
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
const formValues = ref<Record<string, unknown>>({})

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

function getInitialValue(input: ActionInputMetadata): unknown {
  if (input.defaultValue !== undefined) return input.defaultValue
  if (input.fields && input.fields.length > 0) {
    if (input.dbType === 'array') return []
    if (input.dbType === 'object') return {}
  }
  if (input.displayType === 'checkbox') return false
  return ''
}

function initFormValues(visibleInputs: ActionInputMetadata[]) {
  const values: Record<string, unknown> = {}
  for (const input of visibleInputs) {
    values[input.name] = getInitialValue(input)
  }
  formValues.value = values
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
    const { visibleInputs } = await useWorkflowRun(props.namespace, props.definition, rule.startState, props.database)
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
          <NestedFormInput :input="input" v-model="formValues[input.name]" />
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
