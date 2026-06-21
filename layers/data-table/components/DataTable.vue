<script setup lang="ts">
import type { TableSchema, ViewDefinition } from 'shared'

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
const error = ref('')
const saveError = ref('')

function viewBasePath(): string {
  return props.nsdb ? `/api/admin/views/${props.nsdb}` : '/api/views'
}

function tableBasePath(): string {
  return props.nsdb ? `/api/admin/tables/${props.nsdb}` : '/api/tables'
}

async function load() {
  loading.value = true
  error.value = ''
  saveError.value = ''
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

async function handleSave(updated: ViewDefinition) {
  saveError.value = ''
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
          :view="view"
          :schema="schema"
          :can-update-view="canUpdateView"
          :can-edit-schema="canEditSchema"
          :can-manage-permissions="canManagePermissions"
          :schema-edit-link="schemaEditLink"
          :permissions-edit-link="permissionsEditLink"
          @save="handleSave"
        />
        <div v-if="saveError" class="text-sm text-red-600">{{ saveError }}</div>
        <DataTableRenderer :view="view" :schema="schema" :rows="rows" />
      </div>
    </template>
  </UDashboardPanel>
</template>
