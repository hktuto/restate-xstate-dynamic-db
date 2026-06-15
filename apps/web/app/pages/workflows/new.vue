<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'

const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})

async function save() {
  await $fetch('/api/workflows', {
    method: 'POST',
    body: { name: name.value, xstateConfig: config.value }
  })
  await navigateTo('/workflows')
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">New workflow</h1>

    <div class="mb-4">
      <label class="block text-sm font-medium">Workflow name</label>
      <input
        v-model="name"
        class="border rounded px-3 py-2 w-full"
        placeholder="e.g. onboardUser"
      />
    </div>

    <ClientOnly>
      <WorkflowEditor v-model="config" @save="save" />
    </ClientOnly>
  </div>
</template>
