<script setup lang="ts">
import type { WorkflowDefinition, StartRule } from 'shared'

const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})
const starts = ref<StartRule[]>([])

const api = useApi()

function onError(message: string) {
  console.error(message)
}

async function save() {
  await api.fetch('/api/workflow-designs', {
    method: 'POST',
    body: JSON.stringify({ name: name.value, xstateConfig: config.value, starts: starts.value ?? [] })
  })
  await navigateTo('/workflow-designs')
}
</script>

<template>
  <div class="h-[calc(100vh-120px)]">
    <ClientOnly>
      <WorkflowEditor
        v-model="config"
        :name="name"
        @update:name="name = $event"
        @save="save"
        @error="onError"
      />
    </ClientOnly>
  </div>
</template>
