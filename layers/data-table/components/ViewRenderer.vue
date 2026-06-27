<script setup lang="ts">
import type { ResourceActionPlacement, TableSchema, ViewActionBindings, ViewDefinition } from 'shared'
import { resolveViewActions } from '../utils/view-actions'

interface Props {
  resource: string
  view?: string | ViewDefinition
  canUpdateView?: boolean
}

const props = defineProps<Props>()

const api = useApi()
const namespace = { namespace: 'platform', database: 'admin' }
const loadResourceActionPlacements = useResourceActionPlacements()
const nsdb = computed(() => `${namespace.namespace}--${namespace.database}`)

const resourceTypeRecord = ref<{ name: string; table: string } | null>(null)
const viewDefinition = ref<ViewDefinition | null>(null)
const schema = ref<TableSchema | null>(null)
const actionPlacements = ref<Record<string, ResourceActionPlacement[]> | null>(null)
const loading = ref(false)
const error = ref('')

function isAdminScope() {
  return namespace.namespace === 'platform' && namespace.database === 'admin'
}

function adminBase(path: string): string {
  return `/api/admin${path}/${nsdb.value}`
}

function viewBasePath(): string {
  return isAdminScope() ? adminBase('/views') : '/api/views'
}

async function loadResourceTypeRecord() {
  const path = isAdminScope()
    ? adminBase('/resource-types')
    : '/api/resource-types'
  const res = await api.fetch<{ name: string; table: string }>(`${path}/${props.resource}`)
  resourceTypeRecord.value = res
}

async function loadViewAndSchema(table: string) {
  if (typeof props.view === 'object' && props.view !== null) {
    viewDefinition.value = props.view
    const res = await api.fetch<{ view: ViewDefinition; schema: TableSchema }>(
      `${viewBasePath()}/default/${table}`,
    )
    schema.value = res.schema
    return
  }

  if (typeof props.view === 'string') {
    const res = await api.fetch<{ view: ViewDefinition; schema: TableSchema }>(
      `${viewBasePath()}/${props.view}`,
    )
    viewDefinition.value = res.view
    schema.value = res.schema
    return
  }

  const res = await api.fetch<{ view: ViewDefinition; schema: TableSchema }>(
    `${viewBasePath()}/default/${table}`,
  )
  viewDefinition.value = res.view
  schema.value = res.schema
}

function buildDefaultActionBindings(
  placements: Record<string, ResourceActionPlacement[]>,
): ViewActionBindings {
  const bindings: ViewActionBindings = {}
  for (const [actionName, actionPlacements] of Object.entries(placements)) {
    for (const placement of actionPlacements) {
      if (placement.location === 'toolbar') {
        bindings.toolbar = [...(bindings.toolbar ?? []), actionName]
      } else if (placement.location === 'item-contextMenu') {
        bindings['item-contextMenu'] = [...(bindings['item-contextMenu'] ?? []), actionName]
      } else if (placement.location === 'item-rowDoubleClick') {
        bindings['item-rowDoubleClick'] = [actionName]
      }
    }
  }
  return bindings
}

const resolvedActions = computed(() => {
  if (!viewDefinition.value || !actionPlacements.value) {
    return { toolbar: [], itemContextMenu: [] }
  }
  const bindings = viewDefinition.value.config?.actions ?? buildDefaultActionBindings(actionPlacements.value)
  return resolveViewActions(viewDefinition.value.type, bindings, actionPlacements.value)
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    await loadResourceTypeRecord()
    const table = resourceTypeRecord.value?.table
    if (!table) {
      throw new Error(`Resource type ${props.resource} has no table`)
    }
    await loadViewAndSchema(table)
    if (viewDefinition.value?.resourceType && viewDefinition.value.resourceType !== props.resource) {
      throw new Error(
        `View resource type mismatch: ${viewDefinition.value.resourceType} != ${props.resource}`,
      )
    }
    actionPlacements.value = await loadResourceActionPlacements(props.resource)
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load view'
  } finally {
    loading.value = false
  }
}

watch(() => props.resource, () => load())
watch(() => props.view, () => load(), { deep: true })

onMounted(() => load())
</script>

<template>
  <div>
    <div v-if="loading" class="text-sm text-gray-500">
      Loading view...
    </div>
    <div v-else-if="error" class="text-red-600 text-sm">
      {{ error }}
    </div>
    <DataTableContainer
      v-else-if="viewDefinition && schema && resourceTypeRecord"
      :resource="resource"
      :table="resourceTypeRecord.table"
      :nsdb="nsdb"
      :scope="isAdminScope() ? 'admin' : 'tenant'"
      :schema="schema"
      :view="viewDefinition"
      :actions="resolvedActions"
      :can-update-view="canUpdateView"
      @refresh="load"
    />
  </div>
</template>
