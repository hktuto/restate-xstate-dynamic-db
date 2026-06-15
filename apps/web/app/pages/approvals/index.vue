<script setup lang="ts">
interface Approval {
  id: string
  tableName: string
  recordId: string
  workflowId: string
  awakeableId: string
  status: 'pending' | 'approved' | 'rejected'
  user?: {
    name: string
    email: string
  }
}

const { data: approvals, refresh } = await useFetch<Approval[]>('/api/approvals')

async function approve(id: string) {
  await $fetch(`/api/approvals/${id}/approve`, { method: 'POST' })
  await refresh()
}

async function reject(id: string) {
  await $fetch(`/api/approvals/${id}/reject`, { method: 'POST' })
  await refresh()
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Pending Approvals</h1>

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
        <tr v-for="a in approvals" :key="a.id" class="border-t">
          <td class="p-3">{{ a.id }}</td>
          <td class="p-3">{{ a.user?.name ?? `record ${a.recordId}` }}</td>
          <td class="p-3">{{ a.user?.email ?? '-' }}</td>
          <td class="p-3">{{ a.status }}</td>
          <td class="p-3 flex gap-2">
            <button class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700" @click="approve(a.id)">Approve</button>
            <button class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" @click="reject(a.id)">Reject</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
