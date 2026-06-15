<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'

const route = useRoute()
const id = route.params.id as string

const { data: workflow } = await useFetch(`/api/workflows/${id}`)
const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})

watchEffect(() => {
  if (workflow.value) {
    name.value = workflow.value.name
    config.value = workflow.value.xstateConfig
  }
})

async function save() {
  await $fetch(`/api/workflows/${id}`, {
    method: 'PATCH',
    body: { name: name.value, xstateConfig: config.value }
  })
  await navigateTo('/workflows')
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Edit platform workflow</h1>

    <div class="mb-4">
      <label class="block text-sm font-medium">Workflow name</label>
      <input v-model="name" class="border rounded px-3 py-2 w-full" placeholder="e.g. provisionCompany" />
    </div>

    <ClientOnly>
      <WorkflowEditor v-if="config" v-model="config" @save="save" />
    </ClientOnly>
  </div>
</template>
