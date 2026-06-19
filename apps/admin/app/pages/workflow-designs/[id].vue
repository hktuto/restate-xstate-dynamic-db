<script setup lang="ts">
import type { WorkflowDefinition, StartRule, ActionInputMetadata } from 'shared'
import { useWorkflowRun } from '~/composables/useWorkflowRun'

const route = useRoute()
const id = route.params.id as string

const workflowDesign = ref<{ name: string; xstateConfig: WorkflowDefinition; starts?: StartRule[] } | null>(null)
const api = useApi()
const toast = useToast()

const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})
const starts = ref<StartRule[]>([])

const showRunModal = ref(false)
const runLoading = ref(false)
const runResult = ref('')
const runError = ref('')
const runInputs = ref<ActionInputMetadata[]>([])
const runValues = ref<Record<string, unknown>>({})

function initRunValues(inputs: ActionInputMetadata[]) {
  const values: Record<string, unknown> = {}
  for (const input of inputs) {
    if (input.defaultValue !== undefined) {
      values[input.name] = input.defaultValue
    } else if (input.displayType === 'checkbox') {
      values[input.name] = false
    } else {
      values[input.name] = ''
    }
  }
  runValues.value = values
}

function getInputValue(input: ActionInputMetadata): string {
  const value = runValues.value[input.name]
  if (value === undefined || value === null) return ''
  return String(value)
}

function isChecked(input: ActionInputMetadata): boolean {
  return Boolean(runValues.value[input.name])
}

function setInputValue(input: ActionInputMetadata, value: string | boolean) {
  if (input.displayType === 'number') {
    runValues.value[input.name] = value === '' ? '' : Number(value)
  } else {
    runValues.value[input.name] = value
  }
}

async function loadRunInputs() {
  runResult.value = ''
  runError.value = ''
  runInputs.value = []
  runValues.value = {}

  const rule = starts.value.find((s) => s.type === 'user_trigger')
  if (!rule) {
    runError.value = 'Design has no user trigger'
    return
  }

  try {
    const { visibleInputs } = await useWorkflowRun('platform', config.value, rule.startState)
    runInputs.value = visibleInputs.value
    initRunValues(runInputs.value)
  } catch (err) {
    runError.value = err instanceof Error ? err.message : String(err)
  }
}

watch(showRunModal, (open) => {
  if (open) {
    loadRunInputs()
  }
})

onMounted(async () => {
  workflowDesign.value = await api.fetch(`/api/admin/workflow-designs/${id}`)
})

watchEffect(() => {
  if (workflowDesign.value) {
    name.value = workflowDesign.value.name
    config.value = workflowDesign.value.xstateConfig
    starts.value = workflowDesign.value.starts ?? []
  }
})

function onError(message: string) {
  toast.add({ title: 'Workflow editor', description: message, color: 'error' })
}

async function save() {
  await api.fetch(`/api/admin/workflow-designs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: name.value, xstateConfig: config.value, starts: starts.value ?? [] })
  })
  await navigateTo('/workflow-designs')
}

async function run() {
  runResult.value = ''
  runError.value = ''
  runLoading.value = true
  try {
    const result = await api.fetch<{ id: string }>('/api/admin/workflow-instances', {
      method: 'POST',
      body: JSON.stringify({ designId: id, values: runValues.value })
    })
    runResult.value = `Started instance ${result.id}`
    setTimeout(() => {
      showRunModal.value = false
    }, 800)
  } catch (err) {
    runError.value = err instanceof Error ? err.message : String(err)
  } finally {
    runLoading.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <h1 class="text-2xl font-bold">Edit workflow design</h1>
      <button class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" @click="showRunModal = true">Run</button>
    </div>

    <div class="h-[calc(100vh-160px)]">
      <ClientOnly>
        <WorkflowEditor
          v-if="config"
          v-model="config"
          :name="name"
          @update:name="name = $event"
          @save="save"
          @error="onError"
        />
      </ClientOnly>
    </div>

    <div v-if="showRunModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showRunModal = false">
      <div class="bg-white rounded shadow p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <h2 class="text-lg font-bold mb-4">Run workflow</h2>

        <div v-if="runInputs.length === 0 && !runError && !runLoading" class="text-sm text-gray-600 mb-4">
          No inputs required.
        </div>

        <div v-for="input in runInputs" :key="input.name" class="mb-4">
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
              v-for="opt in (input.config?.options as { label: string; value: string }[] | undefined) ?? []"
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

        <p v-if="runError" class="text-red-600 text-sm mt-2">{{ runError }}</p>
        <p v-if="runResult" class="text-green-600 text-sm mt-2">{{ runResult }}</p>

        <div class="flex justify-end gap-2 mt-4">
          <button class="px-4 py-2 text-gray-700 hover:underline" @click="showRunModal = false">Cancel</button>
          <button class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50" :disabled="runLoading" @click="run">
            {{ runLoading ? 'Running…' : 'Run' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
