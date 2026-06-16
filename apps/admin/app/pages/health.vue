<script setup lang="ts">
import type { HealthCheckRecord, HealthCheckService } from 'db/health-checks'

interface LatestData {
  latest: HealthCheckRecord[]
}

interface HistoryData {
  service: HealthCheckService
  limit: number
  history: HealthCheckRecord[]
}

const DEFAULT_HISTORY_LIMIT = 20

const { data, refresh, pending, error } = await useFetch<LatestData>('/api/health-checks')
const running = ref(false)
const runError = ref<string | null>(null)
const expanded = ref<Set<HealthCheckService>>(new Set())

const historyByService = ref<Partial<Record<HealthCheckService, HealthCheckRecord[]>>>({})
const historyPending = ref<Set<HealthCheckService>>(new Set())
const historyError = ref<Partial<Record<HealthCheckService, string>>>({})

const firstService = computed<HealthCheckService | null>(() => data.value?.latest[0]?.service ?? null)



async function loadHistory(service: HealthCheckService, force = false) {
  if (!force && historyByService.value[service] !== undefined) return

  historyPending.value.add(service)
  historyError.value[service] = undefined

  try {
    const result = await $fetch<HistoryData>('/api/health-checks/history', {
      query: { service, limit: DEFAULT_HISTORY_LIMIT }
    })
    historyByService.value[service] = result.history
  } catch (err) {
    historyError.value[service] = err instanceof Error ? err.message : String(err)
  } finally {
    historyPending.value.delete(service)
  }
}

watch(
  expanded,
  (services) => {
    for (const service of services) {
      loadHistory(service)
    }
  },
  { immediate: true }
)

function toggle(service: HealthCheckService) {
  const next = new Set(expanded.value)
  if (next.has(service)) {
    next.delete(service)
  } else {
    next.add(service)
  }
  expanded.value = next
}

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
    await Promise.all(
      Array.from(expanded.value).map(service => loadHistory(service, true))
    )
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
      <div v-else class="space-y-4">
        <div
          v-for="check in data.latest"
          :key="check.service"
          class="bg-white rounded-xl shadow overflow-hidden"
        >
          <button
            class="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            @click="toggle(check.service)"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-500 capitalize">{{ check.service }}</span>
              <svg
                class="w-4 h-4 text-gray-400 transition-transform"
                :class="{ 'rotate-180': expanded.has(check.service) }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span
                class="inline-block w-3 h-3 rounded-full"
                :class="statusClass(check.status)"
                :aria-label="check.status"
              />
              <span class="text-lg font-semibold capitalize">{{ check.status }}</span>
            </div>
            <div class="text-xs text-gray-400 mt-2">Last check: {{ formatDate(check.checkedAt) }}</div>
            <div class="text-xs text-gray-500 mt-1">{{ check.responseTimeMs }}ms</div>
          </button>

          <div
            v-if="expanded.has(check.service)"
            class="border-t px-4 pb-4"
          >
            <div class="pt-3">
              <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Recent history
              </h3>
              <div v-if="historyPending.has(check.service)" class="text-sm text-gray-500">
                Loading history...
              </div>
              <div v-else-if="historyError[check.service]" class="text-sm text-red-600">
                {{ historyError[check.service] }}
              </div>
              <div v-else-if="!historyByService[check.service]?.length" class="text-sm text-gray-500">
                No history available.
              </div>
              <ul v-else class="space-y-2">
                <li
                  v-for="row in historyByService[check.service]"
                  :key="row.id"
                  class="text-sm border-b last:border-b-0 pb-2 last:pb-0"
                >
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-block w-2 h-2 rounded-full"
                      :class="statusClass(row.status)"
                      :aria-label="row.status"
                    />
                    <span class="capitalize">{{ row.status }}</span>
                    <span class="text-gray-400 ml-auto">{{ row.responseTimeMs }}ms</span>
                  </div>
                  <div class="text-gray-500 text-xs mt-1">{{ formatDate(row.checkedAt) }}</div>
                  <div v-if="row.message" class="text-red-600 text-xs mt-1">{{ row.message }}</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
