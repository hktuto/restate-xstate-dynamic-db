<script setup lang="ts">
import type { ColumnRow, TableColumnConfig, TableSchema, ViewDefinition } from 'shared'

const route = useRoute()
const router = useRouter()
const api = useApi()

const id = computed(() => route.params.id as string)
const isNew = computed(() => id.value === 'new')
const nsdb = computed(() => (route.query.nsdb as string) ?? '')

const tables = ref<{ name: string; label?: string }[]>([])
const schema = ref<TableSchema | null>(null)
const saving = ref(false)
const loading = ref(false)
const error = ref('')

const view = ref<ViewDefinition>({
  table: (route.query.table as string) ?? '',
  type: 'table',
  name: '',
  description: '',
  isDefault: false,
  config: { table: { columns: [] } },
})

async function loadTables() {
  if (!nsdb.value) return
  tables.value = await api.fetch<{ name: string; label?: string }[]>(`/api/admin/tables/${nsdb.value}`)
}

async function loadSchema() {
  if (!view.value.table || !nsdb.value) {
    schema.value = null
    return
  }
  schema.value = await api.fetch<TableSchema>(`/api/admin/tables/${nsdb.value}/${view.value.table}`)
  syncColumns()
}

function syncColumns() {
  if (!schema.value) return
  const existing = new Map(view.value.config?.table?.columns?.map((c) => [c.column, c]))
  const columns: TableColumnConfig[] = schema.value.columns
    .filter((col: ColumnRow) => !col.hidden)
    .sort((a: ColumnRow, b: ColumnRow) => (a.order ?? Infinity) - (b.order ?? Infinity))
    .map((col: ColumnRow) => ({
      column: col.name,
      label: existing.get(col.name)?.label ?? col.label,
      width: existing.get(col.name)?.width ?? 'auto',
      visible: existing.get(col.name)?.visible ?? true,
    }))
  view.value.config = { table: { columns } }
}

async function loadView() {
  if (isNew.value) {
    await loadSchema()
    return
  }
  loading.value = true
  try {
    view.value = await api.fetch<ViewDefinition>(`/api/admin/views/${nsdb.value}/${encodeURIComponent(id.value)}`)
    await loadSchema()
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load view'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const method = isNew.value ? 'POST' : 'PATCH'
    const url = isNew.value
      ? `/api/admin/views/${nsdb.value}`
      : `/api/admin/views/${nsdb.value}/${encodeURIComponent(id.value)}`
    await api.fetch(url, {
      method,
      body: JSON.stringify(view.value),
    })
    await router.push(`/views?nsdb=${nsdb.value}${view.value.table ? `&table=${view.value.table}` : ''}`)
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to save view'
  } finally {
    saving.value = false
  }
}

function moveColumn(index: number, direction: number) {
  const cols = view.value.config?.table?.columns ?? []
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= cols.length) return
  const current = cols[index]
  const target = cols[newIndex]
  if (!current || !target) return
  cols[index] = target
  cols[newIndex] = current
}

await loadTables()
await loadView()
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="isNew ? 'New View' : 'Edit View'" icon="i-lucide-eye" />
    </template>

    <template #body>
      <div v-if="loading" class="text-gray-500">Loading...</div>
      <div v-else-if="error" class="p-4 text-red-600 bg-red-50 rounded">{{ error }}</div>
      <form v-else class="space-y-6" @submit.prevent="save">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Table</label>
            <select v-model="view.table" class="mt-1 block w-full rounded border-gray-300 shadow-sm" @change="loadSchema">
              <option value="">Select table</option>
              <option v-for="t in tables" :key="t.name" :value="t.name">{{ t.label ?? t.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Name</label>
            <input v-model="view.name" type="text" class="mt-1 block w-full rounded border-gray-300 shadow-sm" required />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Description</label>
          <input v-model="view.description" type="text" class="mt-1 block w-full rounded border-gray-300 shadow-sm" />
        </div>

        <div class="flex items-center gap-2">
          <input id="isDefault" v-model="view.isDefault" type="checkbox" />
          <label for="isDefault" class="text-sm font-medium text-gray-700">Default view for this table</label>
        </div>

        <div v-if="schema">
          <h2 class="text-lg font-semibold mb-2">Columns</h2>
          <ul class="space-y-2">
            <li
              v-for="(col, index) in view.config?.table?.columns"
              :key="col.column"
              class="flex items-center gap-4 p-3 bg-white rounded border"
            >
              <input v-model="col.visible" type="checkbox" />
              <div class="flex-1">
                <div class="font-medium">{{ col.column }}</div>
                <input v-model="col.label" type="text" placeholder="Label" class="text-sm border rounded px-2 py-1 mt-1" />
              </div>
              <div>
                <label class="text-xs text-gray-500">Width</label>
                <input v-model="col.width" type="text" placeholder="auto" class="text-sm border rounded px-2 py-1 w-20" />
              </div>
              <div class="flex flex-col gap-1">
                <button type="button" class="text-gray-500 hover:text-gray-700" @click="moveColumn(index, -1)">▲</button>
                <button type="button" class="text-gray-500 hover:text-gray-700" @click="moveColumn(index, 1)">▼</button>
              </div>
            </li>
          </ul>
        </div>

        <div class="flex gap-2">
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
          <NuxtLink :to="`/views?nsdb=${nsdb}`" class="px-4 py-2 text-gray-700 hover:underline">Cancel</NuxtLink>
        </div>
      </form>
    </template>
  </UDashboardPanel>
</template>
