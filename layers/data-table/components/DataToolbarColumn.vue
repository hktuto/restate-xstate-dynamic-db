<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import type { Options as SortableOptions, SortableEvent } from 'sortablejs'
import type { TableColumnConfig, TableSchema } from 'shared'

interface Props {
  modelValue: TableColumnConfig[]
  schema: TableSchema
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [TableColumnConfig[]] }>()

const visibleColumns = ref<TableColumnConfig[]>([])
const hiddenColumns = ref<TableColumnConfig[]>([])

watch(() => props.modelValue, (val) => {
  const copy = val.map((c) => ({ ...c }))
  visibleColumns.value = copy.filter((c) => c.visible !== false)
  hiddenColumns.value = copy.filter((c) => c.visible === false)
}, { immediate: true })

function emitColumns() {
  emit('update:modelValue', [...visibleColumns.value, ...hiddenColumns.value].map((c) => ({ ...c })))
}

const schemaColumns = props.schema.columns.map((c) => ({ label: c.label ?? c.name, value: c.name }))
function labelFor(column: string) {
  return schemaColumns.find((s) => s.value === column)?.label ?? column
}

function columnKey(col: TableColumnConfig): string {
  if (col.type === 'lookup' && col.lookup) {
    const suffix = col.lookup.agg ?? col.lookup.field ?? ''
    return `${col.lookup.relation}.${suffix}`
  }
  return col.column ?? ''
}

function displayLabel(col: TableColumnConfig): string {
  if (col.label) return col.label
  if (col.type === 'lookup' && col.lookup) {
    if (col.lookup.agg === 'count') return `${col.lookup.relation} count`
    return `${col.lookup.relation}.${col.lookup.field ?? ''}`
  }
  return labelFor(col.column ?? '')
}

let draggedColumn: TableColumnConfig | null = null

function makeOptions(list: 'visible' | 'hidden'): SortableOptions {
  const isVisible = list === 'visible'
  const source = isVisible ? visibleColumns : hiddenColumns

  return {
    animation: 150,
    ghostClass: 'bg-blue-50',
    handle: '.drag-handle',
    group: 'columns',
    onStart: () => {
      draggedColumn = null
    },
    onRemove: (e: SortableEvent) => {
      const index = e.oldIndex ?? 0
      const [removed] = source.value.splice(index, 1)
      if (removed) draggedColumn = removed
      emitColumns()
    },
    onAdd: (e: SortableEvent) => {
      e.item.remove()
      const target = isVisible ? visibleColumns : hiddenColumns
      const col = draggedColumn
      if (!col) return
      col.visible = isVisible
      const index = Math.min(e.newIndex ?? target.value.length, target.value.length)
      target.value.splice(index, 0, col)
      draggedColumn = null
      emitColumns()
    },
    onUpdate: (e: SortableEvent) => {
      const from = e.oldIndex ?? 0
      const to = e.newIndex ?? 0
      const [moved] = source.value.splice(from, 1)
      if (!moved) return
      source.value.splice(to, 0, moved)
      emitColumns()
    },
  }
}

const visibleEl = ref<HTMLElement | null>(null)
const hiddenEl = ref<HTMLElement | null>(null)

let visibleSortable: Sortable | undefined
let hiddenSortable: Sortable | undefined

function createSortable(el: HTMLElement | null, list: 'visible' | 'hidden', existing?: Sortable) {
  if (!el) return existing
  existing?.destroy()
  return Sortable.create(el, makeOptions(list))
}

watch(visibleEl, (el) => { visibleSortable = createSortable(el, 'visible', visibleSortable) })
watch(hiddenEl, (el) => { hiddenSortable = createSortable(el, 'hidden', hiddenSortable) })

onBeforeUnmount(() => {
  visibleSortable?.destroy()
  hiddenSortable?.destroy()
})

function hide(col: TableColumnConfig) {
  const key = columnKey(col)
  const index = visibleColumns.value.findIndex((c) => columnKey(c) === key)
  if (index === -1) return
  const [removed] = visibleColumns.value.splice(index, 1)
  if (!removed) return
  removed.visible = false
  hiddenColumns.value.push(removed)
  emitColumns()
}

function show(col: TableColumnConfig) {
  const key = columnKey(col)
  const index = hiddenColumns.value.findIndex((c) => columnKey(c) === key)
  if (index === -1) return
  const [removed] = hiddenColumns.value.splice(index, 1)
  if (!removed) return
  removed.visible = true
  visibleColumns.value.push(removed)
  emitColumns()
}
</script>

<template>
  <UPopover>
    <UButton color="neutral" size="sm" icon="i-lucide-columns-3" trailing-icon="i-lucide-chevron-down">
      Columns
    </UButton>
    <template #content>
      <div class="p-3 w-60 space-y-3">
        <div>
          <div class="text-xs font-medium text-gray-500 mb-1">Visible</div>
          <div ref="visibleEl" class="space-y-1 min-h-[2rem]">
            <div
              v-for="col in visibleColumns"
              :key="columnKey(col)"
              class="flex items-center justify-between p-1 hover:bg-gray-50 rounded"
            >
              <div class="flex items-center gap-2 flex-1">
                <UIcon name="i-lucide-grip-vertical" class="text-gray-300 drag-handle cursor-grab active:cursor-grabbing" @click.stop />
                <span class="text-sm">{{ displayLabel(col) }}</span>
              </div>
              <UIcon name="i-lucide-eye" class="text-gray-500 cursor-pointer" @click="hide(col)" />
            </div>
          </div>
        </div>
        <UDivider />
        <div>
          <div class="text-xs font-medium text-gray-500 mb-1">Hidden</div>
          <div ref="hiddenEl" class="space-y-1 min-h-[2rem]">
            <div
              v-for="col in hiddenColumns"
              :key="columnKey(col)"
              class="flex items-center justify-between p-1 hover:bg-gray-50 rounded"
            >
              <div class="flex items-center gap-2 flex-1">
                <UIcon name="i-lucide-grip-vertical" class="text-gray-300 drag-handle cursor-grab active:cursor-grabbing" @click.stop />
                <span class="text-sm text-gray-500">{{ displayLabel(col) }}</span>
              </div>
              <UIcon name="i-lucide-eye-off" class="text-gray-400 cursor-pointer" @click="show(col)" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
