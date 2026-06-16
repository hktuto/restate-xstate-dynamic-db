<script setup lang="ts">
import type { HealthCheckRecord } from 'db/health-checks'

interface HealthCheckData {
  latest: HealthCheckRecord[]
  history: HealthCheckRecord[]
}

const { data, refresh, pending, error } = await useFetch<HealthCheckData>('/api/health-checks')
const running = ref(false)
const runError = ref<string | null>(null)

function statusClass(status: string): string {
  return status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

async function runNow() {
  running.value = true
  runError.value = null
  try {
    await $fetch('/api/health-checks/run', { method: 'POST' })
    await refresh()
  } catch (err) {
    runError.value = err instanceof Error ? err.message : String(err)
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Health Monitor</h1>
      <div class="flex items-center gap-3">
        <span v-if="runError" class="text-sm text-red-600">{{ runError }}</span>
        <button
          :disabled="running"
          class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          @click="runNow"
        >
          {{ running ? 'Running...' : 'Run checks now' }}
        </button>
      </div>
    </div>

    <div v-if="pending" class="text-gray-500">Loading health checks...</div>
    <div v-else-if="error" class="text-red-600">Failed to load health checks: {{ error.message }}</div>
    <template v-else>
      <div v-if="!data?.latest?.length" class="text-gray-500">
        No health checks available yet. Click "Run checks now" to populate.
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="check in data.latest"
          :key="check.service"
          class="bg-white p-4 rounded shadow"
        >
          <div class="text-sm text-gray-500 capitalize">{{ check.service }}</div>
          <div class="flex items-center gap-2 mt-1">
            <span
              class="inline-block w-3 h-3 rounded-full"
              :class="statusClass(check.status)"
              :aria-label="check.status"
            />
            <span class="text-lg font-semibold capitalize">{{ check.status }}</span>
          </div>
          <div class="text-xs text-gray-400 mt-2">{{ formatDate(check.checkedAt) }}</div>
          <div class="text-xs text-gray-500 mt-1">{{ check.responseTimeMs }}ms</div>
          <div v-if="check.message" class="text-xs text-red-600 mt-2">{{ check.message }}</div>
        </div>
      </div>

      <div class="bg-white rounded shadow overflow-hidden">
        <h2 class="font-semibold p-4 border-b">History</h2>
        <div v-if="!data?.history?.length" class="p-4 text-gray-500">
          No history available yet.
        </div>
        <table v-else class="w-full text-sm text-left">
          <thead class="bg-gray-50 text-gray-600">
            <tr>
              <th scope="col" class="px-4 py-2">Service</th>
              <th scope="col" class="px-4 py-2">Status</th>
              <th scope="col" class="px-4 py-2">Checked At</th>
              <th scope="col" class="px-4 py-2">Response Time</th>
              <th scope="col" class="px-4 py-2">Message</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.history" :key="row.id" class="border-b">
              <td class="px-4 py-2 capitalize">{{ row.service }}</td>
              <td class="px-4 py-2">
                <span
                  class="inline-block w-2 h-2 rounded-full mr-1"
                  :class="statusClass(row.status)"
                  :aria-label="row.status"
                />
                {{ row.status }}
              </td>
              <td class="px-4 py-2">{{ formatDate(row.checkedAt) }}</td>
              <td class="px-4 py-2">{{ row.responseTimeMs }}ms</td>
              <td class="px-4 py-2 text-red-600">{{ row.message ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
