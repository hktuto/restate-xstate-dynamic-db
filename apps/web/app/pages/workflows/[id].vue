<script setup lang="ts">
import type { WorkflowDefinition } from 'shared'

const route = useRoute()
const id = route.params.id as string

const { data: workflow } = await useFetch(`/api/workflows/${encodeURIComponent(id)}`)

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
  await $fetch(`/api/workflows/${encodeURIComponent(id)}`, {
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
      />
    </ClientOnly>
  </div>
</template>
