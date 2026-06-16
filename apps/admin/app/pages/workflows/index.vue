<script setup lang="ts">
interface Workflow {
  id: string
  name: string
}

const { data: workflows, refresh } = await useFetch<Workflow[]>('/api/workflows')

async function deleteWorkflow(id: string) {
  await $fetch(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Platform workflows</h1>
      <NuxtLink to="/workflows/new" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">New workflow</NuxtLink>
    </div>

    <ul class="bg-white rounded shadow divide-y">
      <li v-for="wf in workflows" :key="wf.id" class="p-4 flex items-center justify-between">
        <NuxtLink :to="`/workflows/${encodeURIComponent(wf.id)}`" class="font-medium hover:text-blue-600">{{ wf.name }}</NuxtLink>
        <button class="text-red-600 hover:underline" @click="deleteWorkflow(wf.id)">Delete</button>
      </li>
    </ul>
  </div>
</template>
