<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useSortable, type UseSortableOptions } from '@vueuse/integrations/useSortable'
import type { TableColumnConfig, TableSchema } from 'shared'

interface Props {
  modelValue: TableColumnConfig[]
  schema: TableSchema
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [TableColumnConfig[]] }>()

const listEl = ref<HTMLElement | null>(null)
const localColumns = ref<TableColumnConfig[]>([])

watch(() => props.modelValue, (val) => {
  localColumns.value = val.map((c) => ({ ...c }))
}, { immediate: true, deep: true })

watch(localColumns, (val) => {
  emit('update:modelValue', val.map((c) => ({ ...c })))
}, { deep: true })

useSortable(listEl, localColumns, {
  animation: 150,
  ghostClass: 'bg-blue-50',
} as UseSortableOptions)

const schemaColumns = computed(() =>
  props.schema.columns.map((c) => ({ label: c.label ?? c.name, value: c.name })),
)

function toggle(index: number) {
  const col = localColumns.value[index]
  if (!col) return
  col.visible = col.visible === false ? true : false
}
</script>

<template>
  <UPopover>
    <UButton color="neutral" size="sm" icon="i-lucide-columns-3" trailing-icon="i-lucide-chevron-down">
      Columns
    </UButton>
    <template #content>
      <div ref="listEl" class="p-3 w-56 space-y-1">
        <div
          v-for="(col, i) in localColumns"
          :key="col.column"
          class="flex items-center justify-between p-1 hover:bg-gray-50 rounded cursor-pointer"
          @click="toggle(i)"
        >
          <span class="text-sm">{{ col.label ?? schemaColumns.find(s => s.value === col.column)?.label ?? col.column }}</span>
          <UIcon v-if="col.visible !== false" name="i-lucide-eye" class="text-gray-500" />
          <UIcon v-else name="i-lucide-eye-off" class="text-gray-400" />
        </div>
      </div>
    </template>
  </UPopover>
</template>
