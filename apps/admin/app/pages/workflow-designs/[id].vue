<script setup lang="ts">
import type { WorkflowDefinition, StartRule } from 'shared'

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
const runValuesText = ref('{}')
const runResult = ref('')
const runError = ref('')

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
  let values: Record<string, unknown>
  try {
    values = JSON.parse(runValuesText.value)
  } catch {
    runError.value = 'Invalid JSON values'
    return
  }
  try {
    const result = await api.fetch<{ id: string }>('/api/admin/workflow-instances', {
      method: 'POST',
      body: JSON.stringify({ designId: id, values })
    })
    runResult.value = `Started instance ${result.id}`
  } catch (err) {
    runError.value = err instanceof Error ? err.message : String(err)
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
      <div class="bg-white rounded shadow p-6 w-full max-w-md">
        <h2 class="text-lg font-bold mb-4">Run workflow</h2>
        <label class="block text-sm font-medium mb-1">Values (JSON)</label>
        <textarea v-model="runValuesText" rows="5" class="w-full border rounded p-2 font-mono text-sm" />
        <p v-if="runError" class="text-red-600 text-sm mt-2">{{ runError }}</p>
        <p v-if="runResult" class="text-green-600 text-sm mt-2">{{ runResult }}</p>
        <div class="flex justify-end gap-2 mt-4">
          <button class="px-4 py-2 text-gray-700 hover:underline" @click="showRunModal = false">Cancel</button>
          <button class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" @click="run">Run</button>
        </div>
      </div>
    </div>
  </div>
</template>
