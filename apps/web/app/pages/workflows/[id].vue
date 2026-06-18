<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'

const route = useRoute()
const id = route.params.id as string

const workflow = ref<{ name: string; xstateConfig: WorkflowDefinition } | null>(null)
const api = useApi()

const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})

onMounted(async () => {
  workflow.value = await api.fetch(`/api/workflows/${id}`)
})

watchEffect(() => {
  if (workflow.value) {
    name.value = workflow.value.name
    config.value = workflow.value.xstateConfig
  }
})

function onError(message: string) {
  console.error(message)
}

async function save() {
  await api.fetch(`/api/workflows/${id}`, {
    method: 'PATCH',
    body: { name: name.value, xstateConfig: config.value }
  })
  await navigateTo('/workflows')
}
</script>

<template>
  <div class="h-[calc(100vh-120px)]">
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
</template>
