<script setup lang="ts">
import type { FilterGroup, TableSchema } from 'shared'

interface Props {
  modelValue?: FilterGroup
  schema: TableSchema
  lockedFilter?: FilterGroup
  canUpdateView?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [FilterGroup] }>()

const filter = computed({
  get: () => props.modelValue ?? { op: 'and', conditions: [] },
  set: (val) => emit('update:modelValue', val),
})
</script>

<template>
  <UPopover>
    <UButton color="neutral" size="sm" icon="i-lucide-filter" trailing-icon="i-lucide-chevron-down">
      Filter
    </UButton>
    <template #panel>
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
      </div>
    </template>
  </UPopover>
</template>
