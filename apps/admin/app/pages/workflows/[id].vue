<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'

const route = useRoute()
const id = route.params.id as string

const workflow = ref<{ name: string; xstateConfig: WorkflowDefinition } | null>(null)
const api = useApi()
const toast = useToast()

const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})

onMounted(async () => {
  workflow.value = await api.fetch(`/api/admin/workflows/${id}`)
})

watchEffect(() => {
  if (workflow.value) {
    name.value = workflow.value.name
    config.value = workflow.value.xstateConfig
  }
})

function onError(message: string) {
  toast.add({ title: 'Workflow editor', description: message, color: 'error' })
}

async function save() {
  await api.fetch(`/api/admin/workflows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: name.value, xstateConfig: config.value })
  })
  await navigateTo('/workflows')
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Edit platform workflow</h1>

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
