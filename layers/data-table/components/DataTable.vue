<script setup lang="ts">
import type { FilterGroup, TableSchema, ViewDefinition } from 'shared'
import { deepClone, effectiveFilter } from '../utils/view-state'

interface Props {
  table: string
  nsdb?: string
  title?: string
  icon?: string
  newLink?: string
  newLabel?: string
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
  schemaEditLink?: string
  permissionsEditLink?: string
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
const refreshing = ref(false)
const error = ref('')
const saveError = ref('')
const appliedFilter = ref<FilterGroup>({ op: 'and', conditions: [] })
const initializing = ref(false)
const searchQuery = ref('')

const { runtime, dirty, save: buildSaveView } = useDataToolbar(view, toRef(props, 'canUpdateView'))

function buildAppliedFilter(): FilterGroup {
  const filter = effectiveFilter(runtime.value, view.value!, props.canUpdateView)
  return filter ? deepClone(filter) : { op: 'and', conditions: [] }
}

function viewBasePath(): string {
  return props.nsdb ? `/api/admin/views/${props.nsdb}` : '/api/views'
}

function tableBasePath(): string {
  return props.nsdb ? `/api/admin/tables/${props.nsdb}` : '/api/tables'
}

async function loadViewAndSchema() {
  const { view: loadedView, schema: loadedSchema } = await api.fetch<{ view: ViewDefinition; schema: TableSchema }>(
    `${viewBasePath()}/default/${props.table}`
  )
  view.value = loadedView
  schema.value = loadedSchema
  appliedFilter.value = view.value ? buildAppliedFilter() : { op: 'and', conditions: [] }
}

async function loadRecords() {
  if (!view.value) return
  refreshing.value = true
  error.value = ''
  try {
    const body = buildQueryBody(runtime.value, 1, 25, { filter: appliedFilter.value, search: searchQuery.value })
    const result = await api.fetch<{ records: Record<string, unknown>[]; total: number }>(
      `${tableBasePath()}/${props.table}/query`,
      { method: 'POST', body: JSON.stringify(body) }
    )
    rows.value = result.records
    total.value = result.total
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load records'
  } finally {
    refreshing.value = false
  }
}

async function load() {
  loading.value = true
  initializing.value = true
  saveError.value = ''
  try {
    await loadViewAndSchema()
    await nextTick()
    await loadRecords()
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load data'
  } finally {
    loading.value = false
    initializing.value = false
  }
}

function refreshIfReady() {
  if (initializing.value) return
  return loadRecords()
}

watch(appliedFilter, refreshIfReady, { deep: true })
watch(() => runtime.value.sort, refreshIfReady, { deep: true })
watch(() => runtime.value.columns, refreshIfReady, { deep: true })

let searchTimeout: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(searchTimeout))
watch(searchQuery, () => {
  if (initializing.value) return
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => refreshIfReady(), 300)
})

async function handleSave() {
  saveError.value = ''
  const updated = buildSaveView()
  if (!updated.id) return
  try {
    await api.fetch(`${viewBasePath()}/${updated.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updated),
    })
    await load()
  } catch (err: any) {
    saveError.value = err?.message ?? 'Failed to save view'
  }
}

await load()
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="title ?? table" :icon="icon">
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
              <span v-if="refreshing" class="ml-2 text-gray-400">(refreshing)</span>
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
        <DataToolbar
          v-model:search="searchQuery"
          :runtime="runtime"
          :dirty="dirty"
          :view="view"
          :schema="schema"
          :can-update-view="canUpdateView"
          :can-edit-schema="canEditSchema"
          :can-manage-permissions="canManagePermissions"
          :schema-edit-link="schemaEditLink"
          :permissions-edit-link="permissionsEditLink"
          @save="handleSave"
          @apply-filter="appliedFilter = buildAppliedFilter()"
        />
        <div v-if="saveError" class="text-sm text-red-600">{{ saveError }}</div>
        <div class="relative">
          <DataTableRenderer :view="view" :schema="schema" :rows="rows" :columns="runtime.columns" />
          <div v-if="refreshing" class="absolute inset-0 bg-white/50 flex items-start justify-center pt-12">
            <span class="text-sm text-gray-500">Loading records…</span>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
