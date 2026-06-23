<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'
import type { UseSortableOptions } from '@vueuse/integrations/useSortable'
import type { SortableEvent } from 'sortablejs'
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

let draggedColumn: TableColumnConfig | null = null

function makeOptions(list: 'visible' | 'hidden'): UseSortableOptions {
  const isVisible = list === 'visible'
  const source = isVisible ? visibleColumns : hiddenColumns

  return {
    animation: 150,
    ghostClass: 'bg-blue-50',
    handle: '.drag-handle',
    group: 'columns',
    watchElement: true,
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

useSortable(visibleEl, visibleColumns, makeOptions('visible'))
useSortable(hiddenEl, hiddenColumns, makeOptions('hidden'))

function hide(col: TableColumnConfig) {
  const index = visibleColumns.value.findIndex((c) => c.column === col.column)
  if (index === -1) return
  const [removed] = visibleColumns.value.splice(index, 1)
  if (!removed) return
  removed.visible = false
  hiddenColumns.value.push(removed)
  emitColumns()
}

function show(col: TableColumnConfig) {
  const index = hiddenColumns.value.findIndex((c) => c.column === col.column)
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
              :key="col.column"
              class="flex items-center justify-between p-1 hover:bg-gray-50 rounded"
            >
              <div class="flex items-center gap-2 flex-1">
                <UIcon name="i-lucide-grip-vertical" class="text-gray-300 drag-handle cursor-grab active:cursor-grabbing" @click.stop />
                <span class="text-sm">{{ col.label ?? labelFor(col.column) }}</span>
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
              :key="col.column"
              class="flex items-center justify-between p-1 hover:bg-gray-50 rounded"
            >
              <div class="flex items-center gap-2 flex-1">
                <UIcon name="i-lucide-grip-vertical" class="text-gray-300 drag-handle cursor-grab active:cursor-grabbing" @click.stop />
                <span class="text-sm text-gray-500">{{ col.label ?? labelFor(col.column) }}</span>
              </div>
              <UIcon name="i-lucide-eye-off" class="text-gray-400 cursor-pointer" @click="show(col)" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
