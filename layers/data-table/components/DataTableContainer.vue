<script setup lang="ts">
import type { FilterGroup, TableSchema, ViewDefinition } from 'shared'
import { buildQueryBody } from '../utils/query-body'
import { deepClone, effectiveFilter } from '../utils/view-state'
import { useDataToolbar } from '../composables/useDataToolbar'
import DataToolbar from './DataToolbar.vue'
import type { ResolvedActions } from '../utils/view-actions'
import type { ActionContext } from 'shared'

interface Props {
  resource: string
  table: string
  nsdb: string
  scope: 'admin' | 'tenant'
  schema: TableSchema
  view: ViewDefinition
  actions: ResolvedActions
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'refresh'): void }>()

const api = useApi()
const rows = ref<Record<string, unknown>[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const saveError = ref('')
const appliedFilter = ref<FilterGroup>({ op: 'and', conditions: [] })
const searchQuery = ref('')

const { runtime, dirty, save: buildSaveView } = useDataToolbar(toRef(props, 'view'), toRef(props, 'canUpdateView'))

const actionHostRef = ref<{ trigger: (component: string, method?: string | null, record?: Record<string, unknown>) => void } | null>(null)

function queryBasePath(): string {
  return props.scope === 'admin' ? `/api/admin/tables/${props.nsdb}` : '/api/tables'
}

function viewBasePath(): string {
  return props.scope === 'admin' ? `/api/admin/views/${props.nsdb}` : '/api/views'
}

function schemaEditLink(): string {
  return props.scope === 'admin'
    ? `/schema/${encodeURIComponent(props.table)}?nsdb=${encodeURIComponent(props.nsdb)}`
    : `/schema/${encodeURIComponent(props.table)}`
}

function permissionsEditLink(): string {
  return props.scope === 'admin'
    ? `/permissions/${encodeURIComponent(props.table)}?nsdb=${encodeURIComponent(props.nsdb)}`
    : `/permissions/${encodeURIComponent(props.table)}`
}

function buildActionContext(action: string, record?: Record<string, unknown>): ActionContext {
  return {
    resourceType: props.resource,
    action,
    table: props.table,
    nsdb: props.nsdb,
    schema: props.schema,
    view: props.view,
    record,
    refresh: () => emit('refresh'),
  }
}

function buildAppliedFilter(): FilterGroup {
  const filter = effectiveFilter(runtime.value, props.view, props.canUpdateView ?? false)
  return filter ? deepClone(filter) : { op: 'and', conditions: [] }
}

async function loadRecords(force = false) {
  loading.value = true
  error.value = ''
  try {
    const body = buildQueryBody(runtime.value, props.schema, 1, 25, { filter: appliedFilter.value, search: searchQuery.value })
    const result = await api.fetch<{ records: Record<string, unknown>[]; total: number }>(
      `${queryBasePath()}/${props.table}/query`,
      { method: 'POST', body: JSON.stringify(body) },
    )
    rows.value = result.records
    total.value = result.total
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load records'
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saveError.value = ''
  const updated = buildSaveView()
  if (!updated.id) return
  try {
    await api.fetch(`${viewBasePath()}/${updated.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updated),
    })
    await loadRecords(true)
  } catch (err: any) {
    saveError.value = err?.message ?? 'Failed to save view'
  }
}

function handleRowDoubleClick(row: Record<string, unknown>) {
  const action = props.actions.rowDoubleClick
  if (!action) return
  actionHostRef.value?.trigger(action.component, action.method, row)
}

watch(
  () => [props.view, props.schema],
  () => {
    if (props.view && props.schema) {
      appliedFilter.value = buildAppliedFilter()
      loadRecords()
    }
  },
  { immediate: true },
)

let fetchTimeout: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(fetchTimeout))

watch(
  [appliedFilter, () => runtime.value.sort, () => runtime.value.columns, searchQuery],
  () => {
    clearTimeout(fetchTimeout)
    fetchTimeout = setTimeout(() => loadRecords(), 300)
  },
  { deep: true },
)
</script>

<template>
  <div class="space-y-4">
    <DataToolbar
      v-model:search="searchQuery"
      :runtime="runtime"
      :dirty="dirty"
      :view="view"
      :schema="schema"
      :can-update-view="canUpdateView"
      :can-edit-schema="canEditSchema"
      :can-manage-permissions="canManagePermissions"
      :schema-edit-link="schemaEditLink()"
      :permissions-edit-link="permissionsEditLink()"
      @save="handleSave"
      @apply-filter="appliedFilter = buildAppliedFilter()"
    />

    <div v-if="saveError" class="text-sm text-red-600">
      {{ saveError }}
    </div>

    <div v-if="actions.toolbar.length" class="flex items-center gap-2">
      <component
        v-for="action in actions.toolbar"
        :key="action.component"
        :is="action.component"
        :context="buildActionContext(action.action)"
      />
    </div>

    <div v-if="error" class="text-red-600 text-sm">
      {{ error }}
    </div>

    <div v-if="loading" class="text-sm text-gray-500">
      Loading...
    </div>

    <DataTableRenderer
      v-else
      :view="view"
      :rows="rows"
      :schema="schema"
      :columns="runtime.columns"
      @row-double-click="handleRowDoubleClick"
    >
      <template #row-actions="{ row }">
        <div class="flex items-center gap-1">
          <component
            v-for="action in actions.itemContextMenu"
            :key="action.component"
            :is="action.component"
            :context="buildActionContext(action.action, row)"
          />
        </div>
      </template>
    </DataTableRenderer>

    <ActionHost
      v-if="actions.rowDoubleClick"
      ref="actionHostRef"
      :actions="[actions.rowDoubleClick]"
      :context="buildActionContext(actions.rowDoubleClick.action)"
    />
  </div>
</template>
