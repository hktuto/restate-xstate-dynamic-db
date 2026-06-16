<script setup lang="ts">
import type { HealthCheckRecord } from 'db/health-checks'

interface HealthCheckData {
  latest: HealthCheckRecord[]
  history: HealthCheckRecord[]
}

const { data, refresh } = await useFetch<HealthCheckData>('/api/health-checks')
const running = ref(false)

async function runNow() {
  running.value = true
  try {
    await $fetch('/api/health-checks/run', { method: 'POST' })
    await refresh()
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Health Monitor</h1>
      <button
        :disabled="running"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        @click="runNow"
      >
        {{ running ? 'Running...' : 'Run checks now' }}
      </button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="check in data?.latest ?? []"
        :key="check.service"
        class="bg-white p-4 rounded shadow"
      >
        <div class="text-sm text-gray-500 capitalize">{{ check.service }}</div>
        <div class="flex items-center gap-2 mt-1">
          <span
            class="inline-block w-3 h-3 rounded-full"
            :class="check.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'"
          />
          <span class="text-lg font-semibold capitalize">{{ check.status }}</span>
        </div>
        <div class="text-xs text-gray-400 mt-2">{{ new Date(check.checkedAt).toLocaleString() }}</div>
        <div class="text-xs text-gray-500 mt-1">{{ check.responseTimeMs }}ms</div>
        <div v-if="check.message" class="text-xs text-red-600 mt-2">{{ check.message }}</div>
      </div>
    </div>

    <div class="bg-white rounded shadow overflow-hidden">
      <h2 class="font-semibold p-4 border-b">History</h2>
      <table class="w-full text-sm text-left">
        <thead class="bg-gray-50 text-gray-600">
          <tr>
            <th class="px-4 py-2">Service</th>
            <th class="px-4 py-2">Status</th>
            <th class="px-4 py-2">Checked At</th>
            <th class="px-4 py-2">Response Time</th>
            <th class="px-4 py-2">Message</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.history ?? []" :key="row.id" class="border-b">
            <td class="px-4 py-2 capitalize">{{ row.service }}</td>
            <td class="px-4 py-2">
              <span
                class="inline-block w-2 h-2 rounded-full mr-1"
                :class="row.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'"
              />
              {{ row.status }}
            </td>
            <td class="px-4 py-2">{{ new Date(row.checkedAt).toLocaleString() }}</td>
            <td class="px-4 py-2">{{ row.responseTimeMs }}ms</td>
            <td class="px-4 py-2 text-red-600">{{ row.message ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
