<script setup lang="ts">
interface Workflow {
  id: string
  name: string
}

interface Trigger {
  id: string
  tableName: string
  event: string
  workflowId: string
  workflowName: string
}

const { data: workflows } = await useFetch<Workflow[]>('/api/workflows')
const { data: triggers, refresh } = await useFetch<Trigger[]>('/api/triggers')

const form = reactive({
  tableName: 'companies',
  event: 'create',
  workflowId: undefined as string | undefined
})

async function createTrigger() {
  if (!form.workflowId) return
  await $fetch('/api/triggers', {
    method: 'POST',
    body: {
      tableName: form.tableName,
      event: form.event,
      workflowId: form.workflowId
    }
  })
  form.workflowId = undefined
  await refresh()
}

async function deleteTrigger(id: string) {
  await $fetch(`/api/triggers/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Platform triggers</h1>

    <form class="bg-white p-4 rounded shadow mb-6 space-y-3" @submit.prevent="createTrigger">
      <h2 class="font-semibold">Attach workflow to a platform event</h2>
      <div class="grid grid-cols-3 gap-3">
        <select v-model="form.tableName" class="border rounded px-3 py-2">
          <option value="companies">companies</option>
        </select>
        <select v-model="form.event" class="border rounded px-3 py-2">
          <option value="create">create</option>
          <option value="update">update</option>
          <option value="delete">delete</option>
        </select>
        <select v-model="form.workflowId" class="border rounded px-3 py-2">
          <option :value="undefined">Select workflow</option>
          <option v-for="wf in workflows" :key="wf.id" :value="wf.id">{{ wf.name }}</option>
        </select>
      </div>
      <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Attach</button>
    </form>

    <table class="w-full bg-white rounded shadow">
      <thead class="bg-gray-100">
        <tr>
          <th class="text-left p-3">Table</th>
          <th class="text-left p-3">Event</th>
          <th class="text-left p-3">Workflow</th>
          <th class="text-left p-3"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in triggers" :key="t.id" class="border-t">
          <td class="p-3">{{ t.tableName }}</td>
          <td class="p-3">{{ t.event }}</td>
          <td class="p-3">{{ t.workflowName }}</td>
          <td class="p-3">
            <button class="text-red-600 hover:underline" @click="deleteTrigger(t.id)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
