<script setup lang="ts">
import type { WorkflowDefinition, StartRule } from 'shared'

const COMPANY_COOKIE_NAME = 'company'

const route = useRoute()
const id = route.params.id as string

const workflowDesign = ref<{ name: string; xstateConfig: WorkflowDefinition; starts?: StartRule[] } | null>(null)
const api = useApi()

const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})
const starts = ref<StartRule[]>([])

const runModal = ref<{ open: () => void } | null>(null)
const companyCookie = useCookie(COMPANY_COOKIE_NAME)

const namespace = computed(() => {
  if (!companyCookie.value) return ''
  try {
    const parsed = JSON.parse(companyCookie.value) as { namespace?: string }
    return parsed.namespace ?? ''
  } catch {
    return ''
  }
})

onMounted(async () => {
  workflowDesign.value = await api.fetch(`/api/workflow-designs/${id}`)
})

watchEffect(() => {
  if (workflowDesign.value) {
    name.value = workflowDesign.value.name
    config.value = workflowDesign.value.xstateConfig
    starts.value = workflowDesign.value.starts ?? []
  }
})

function onError(message: string) {
  console.error(message)
}

async function save() {
  await api.fetch(`/api/workflow-designs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: name.value, xstateConfig: config.value, starts: starts.value ?? [] })
  })
  await navigateTo('/workflow-designs')
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <h1 class="text-xl font-bold">Workflow Design</h1>
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
      :namespace="namespace"
      api-base-path="/api"
    />
  </div>
</template>
