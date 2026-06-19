<script setup lang="ts">
interface WorkflowDesign {
  id: string
  name: string
}

const workflowDesigns = ref<WorkflowDesign[]>([])
const api = useApi()

async function refresh() {
  workflowDesigns.value = await api.fetch<WorkflowDesign[]>('/api/admin/workflow-designs')
}

await refresh()

async function deleteWorkflowDesign(id: string) {
  await api.fetch(`/api/admin/workflow-designs/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Workflow Designs</h1>
      <NuxtLink to="/workflow-designs/new" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">New workflow design</NuxtLink>
    </div>

    <ul class="bg-white rounded shadow divide-y">
      <li v-for="design in workflowDesigns" :key="design.id" class="p-4 flex items-center justify-between">
        <NuxtLink :to="`/workflow-designs/${design.id}`" class="font-medium hover:text-blue-600">{{ design.name }}</NuxtLink>
        <button class="text-red-600 hover:underline" @click="deleteWorkflowDesign(design.id)">Delete</button>
      </li>
    </ul>
  </div>
</template>
