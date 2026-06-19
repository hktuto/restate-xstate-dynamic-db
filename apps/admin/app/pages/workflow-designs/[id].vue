<script setup lang="ts">
import type { WorkflowDefinition, StartRule } from 'shared'

const ADMIN_API_BASE_PATH = '/api/admin'
const ADMIN_NAMESPACE = 'platform'

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

const runModal = ref<{ open: () => void } | null>(null)

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
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <h1 class="text-2xl font-bold">Edit workflow design</h1>
      <button class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" @click="runModal?.open()">Run</button>
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

    <WorkflowRunModal
      ref="runModal"
      :design-id="id"
      :definition="config"
      :starts="starts"
      :namespace="ADMIN_NAMESPACE"
      :api-base-path="ADMIN_API_BASE_PATH"
      :error-handler="(message: string) => toast.add({ title: 'Run workflow', description: message, color: 'error' })"
    />
  </div>
</template>
