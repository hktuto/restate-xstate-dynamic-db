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
    <h1 class="text-2xl font-bold mb-4">New platform workflow</h1>

    <ClientOnly>
      <WorkflowEditor
        v-model="config"
        :name="name"
        @update:name="name = $event"
        @save="save"
      />
    </ClientOnly>
  </div>
</template>
