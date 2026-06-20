<script setup lang="ts">
import type { TableSchema, ViewDefinition } from 'shared'

interface Props {
  title: string
  icon?: string
  table: string
  nsdb?: string
  newLink?: string
  newLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'i-lucide-table',
})

const api = useApi()

const view = ref<ViewDefinition | null>(null)
const schema = ref<TableSchema | null>(null)
const rows = ref<Record<string, unknown>[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

function viewBasePath(): string {
  return props.nsdb ? `/api/admin/views/${props.nsdb}` : '/api/views'
}

function tableBasePath(): string {
  return props.nsdb ? `/api/admin/tables/${props.nsdb}` : '/api/tables'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { view: loadedView, schema: loadedSchema } = await api.fetch<{ view: ViewDefinition; schema: TableSchema }>(
      `${viewBasePath()}/default/${props.table}`
    )
    view.value = loadedView
    schema.value = loadedSchema
    const result = await api.fetch<{ records: Record<string, unknown>[]; total: number }>(
      `${tableBasePath()}/${props.table}/query`,
      { method: 'POST', body: JSON.stringify({ page: 1, pageSize: 25 }) }
    )
    rows.value = result.records
    total.value = result.total
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load data'
  } finally {
    loading.value = false
  }
}

await load()
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="title" :icon="icon">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="error" class="p-4 text-red-600 bg-red-50 rounded">
        {{ error }}
      </div>
      <div v-else-if="loading" class="p-4 text-gray-500">
        Loading...
      </div>
      <div v-else-if="view && schema" class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">{{ view.name }}</h1>
            <p v-if="view.description" class="text-sm text-gray-500">{{ view.description }}</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-sm text-gray-500">
              {{ total }} records
            </div>
            <NuxtLink
              v-if="newLink"
              :to="newLink"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {{ newLabel ?? 'New' }}
            </NuxtLink>
          </div>
        </div>
        <TableView :view="view" :schema="schema" :rows="rows" />
      </div>
    </template>
  </UDashboardPanel>
</template>
