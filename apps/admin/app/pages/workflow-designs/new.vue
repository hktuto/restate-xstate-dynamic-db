<script setup lang="ts">
usePageMeta({ title: 'New Workflow Design', icon: 'i-lucide-workflow' })

import type { WorkflowDefinition, StartRule } from 'shared'

const name = ref('')
const config = ref<WorkflowDefinition>({
  id: 'workflow',
  initial: '',
  states: {}
})
const starts = ref<StartRule[]>([])

const api = useApi()
const toast = useToast()

function onError(message: string) {
  toast.add({ title: 'Workflow editor', description: message, color: 'error' })
}

async function save() {
  await api.fetch('/api/admin/workflow-designs', {
    method: 'POST',
    body: JSON.stringify({ name: name.value, xstateConfig: config.value, starts: starts.value ?? [] })
  })
  await navigateTo('/workflow-designs')
}
</script>

<template>
  <div>
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
  </div>
</template>
