<script setup lang="ts">
interface UserTask {
  id: string
  tableName: string
  recordId: string
  workflowId: string
  status: 'pending' | 'completed' | 'cancelled' | 'rejected'
  member?: {
    name?: string
    email: string
  }
}

const { data: tasks, refresh } = await useFetch<UserTask[]>('/api/user-tasks')

async function approve(id: string) {
  await $fetch(`/api/user-tasks/${id}/approve`, { method: 'POST' })
  await refresh()
}

async function reject(id: string) {
  await $fetch(`/api/user-tasks/${id}/reject`, { method: 'POST' })
  await refresh()
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Pending Tasks</h1>

    <table class="w-full bg-white rounded shadow">
      <thead class="bg-gray-100">
        <tr>
          <th class="text-left p-3">ID</th>
          <th class="text-left p-3">User</th>
          <th class="text-left p-3">Email</th>
          <th class="text-left p-3">Status</th>
          <th class="text-left p-3"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in tasks" :key="t.id" class="border-t">
          <td class="p-3">{{ t.id }}</td>
          <td class="p-3">{{ t.member?.name ?? `record ${t.recordId}` }}</td>
          <td class="p-3">{{ t.member?.email ?? '-' }}</td>
          <td class="p-3">{{ t.status }}</td>
          <td class="p-3 flex gap-2">
            <button class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700" @click="approve(t.id)">Approve</button>
            <button class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" @click="reject(t.id)">Reject</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
