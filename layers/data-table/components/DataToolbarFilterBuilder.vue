<script setup lang="ts">
import type { FilterCondition, FilterGroup, TableSchema } from 'shared'

interface Props {
  modelValue: FilterGroup
  schema: TableSchema
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [FilterGroup] }>()

const group = computed({
  get: () => props.modelValue,
  set: (val) => {
    if (!props.disabled) emit('update:modelValue', val)
  },
})

const operators = [
  { label: '=', value: 'eq' },
  { label: '≠', value: 'neq' },
  { label: '>', value: 'gt' },
  { label: '≥', value: 'gte' },
  { label: '<', value: 'lt' },
  { label: '≤', value: 'lte' },
  { label: 'contains', value: 'contains' },
]

const fieldOptions = computed(() =>
  props.schema.columns.map((c) => ({ label: c.label ?? c.name, value: c.name }))
)

function isCondition(item: FilterCondition | FilterGroup): item is FilterCondition {
  return 'field' in item
}

function addCondition() {
  if (props.disabled) return
  group.value.conditions.push({ field: '', operator: 'eq', value: '' })
}

function addGroup() {
  if (props.disabled) return
  group.value.conditions.push({ op: 'and', conditions: [] })
}

function remove(index: number) {
  if (props.disabled) return
  group.value.conditions.splice(index, 1)
}

function updateChild(index: number, val: FilterGroup) {
  if (props.disabled) return
  group.value.conditions[index] = val
}
</script>

<template>
  <div class="space-y-2">
    <USelect
      v-model="group.op"
      :items="[{ label: 'AND', value: 'and' }, { label: 'OR', value: 'or' }]"
      size="xs"
      class="w-20"
      :disabled="disabled"
    />
    <div v-for="(item, i) in group.conditions" :key="i" class="pl-3 border-l border-gray-200 space-y-1">
      <template v-if="isCondition(item)">
        <div class="flex gap-2 items-center">
          <USelect v-model="item.field" :items="fieldOptions" size="xs" class="flex-1" :disabled="disabled" />
          <USelect v-model="item.operator" :items="operators" size="xs" class="w-20" :disabled="disabled" />
          <UInput v-model="item.value" size="xs" class="flex-1" :disabled="disabled" />
          <UButton v-if="!disabled" color="error" size="xs" icon="i-lucide-x" @click="remove(i)" />
        </div>
      </template>
      <template v-else>
        <div class="flex gap-2 items-start">
          <DataToolbarFilterBuilder
            :model-value="item"
            :schema="schema"
            :disabled="disabled"
            @update:model-value="(val) => updateChild(i, val)"
          />
          <UButton v-if="!disabled" color="error" size="xs" icon="i-lucide-x" class="mt-6" @click="remove(i)" />
        </div>
      </template>
    </div>
    <div v-if="!disabled" class="flex gap-2">
      <UButton color="neutral" size="xs" icon="i-lucide-plus" @click="addCondition">
        Condition
      </UButton>
      <UButton color="neutral" size="xs" icon="i-lucide-plus" @click="addGroup">
        Group
      </UButton>
    </div>
  </div>
</template>
