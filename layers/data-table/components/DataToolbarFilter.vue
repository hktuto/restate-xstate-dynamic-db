<script setup lang="ts">
import type { FilterGroup, TableSchema } from 'shared'

interface Props {
  modelValue?: FilterGroup
  schema: TableSchema
  lockedFilter?: FilterGroup
  canUpdateView?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [FilterGroup]; apply: [] }>()

const filter = computed({
  get: () => props.modelValue ?? { op: 'and', conditions: [] },
  set: (val) => emit('update:modelValue', val),
})

function onOpen(open: boolean) {
  if (open && filter.value.conditions.length === 0) {
    filter.value = {
      ...filter.value,
      conditions: [{ field: '', operator: 'eq', value: '' }],
    }
  }
}
</script>

<template>
  <UPopover @update:open="onOpen">
    <UButton color="neutral" size="sm" icon="i-lucide-filter" trailing-icon="i-lucide-chevron-down">
      Filter
    </UButton>
    <template #content>
      <div class="p-3 w-96 space-y-2">
        <template v-if="!canUpdateView">
          <div class="text-sm font-medium text-gray-500">Locked filter</div>
          <div v-if="!lockedFilter || lockedFilter.conditions.length === 0" class="text-sm text-gray-400">
            None
          </div>
          <DataToolbarFilterBuilder
            v-else
            :model-value="lockedFilter"
            :schema="schema"
            disabled
          />
          <UDivider />
        </template>
        <div class="text-sm font-medium text-gray-500">{{ canUpdateView ? 'Filter' : 'Added conditions' }}</div>
        <DataToolbarFilterBuilder v-model="filter" :schema="schema" />
        <div class="pt-2 flex justify-end">
          <UButton type="button" color="primary" size="xs" icon="i-lucide-check" @click="emit('apply')">
            Apply
          </UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>
