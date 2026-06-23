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

const COMPARISON_OPERATORS = [
  { label: '=', value: 'eq' },
  { label: '≠', value: 'neq' },
  { label: '>', value: 'gt' },
  { label: '≥', value: 'gte' },
  { label: '<', value: 'lt' },
  { label: '≤', value: 'lte' },
]

const TEXT_OPERATORS = [
  { label: '=', value: 'eq' },
  { label: '≠', value: 'neq' },
  { label: 'contains', value: 'contains' },
  { label: 'starts with', value: 'startsWith' },
  { label: 'ends with', value: 'endsWith' },
]

const SET_OPERATORS = [
  { label: '=', value: 'eq' },
  { label: '≠', value: 'neq' },
  { label: 'in', value: 'in' },
  { label: 'not in', value: 'notIn' },
]

const EQUALITY_OPERATOR = [{ label: '=', value: 'eq' }]

function operatorsFor(fieldName: string) {
  const column = props.schema.columns.find((c) => c.name === fieldName)
  switch (column?.displayType) {
    case 'number':
    case 'date':
      return COMPARISON_OPERATORS
    case 'checkbox':
      return EQUALITY_OPERATOR
    case 'select':
    case 'tag':
    case 'relation':
    case 'user':
      return SET_OPERATORS
    case 'text':
    case 'email':
    case 'url':
    case 'richText':
    default:
      return TEXT_OPERATORS
  }
}

function columnFor(fieldName: string) {
  return props.schema.columns.find((c) => c.name === fieldName)
}

function hasSelectOptions(fieldName: string): boolean {
  const column = columnFor(fieldName)
  return column?.displayType === 'select' && Array.isArray(column.config?.options)
}

function selectOptions(fieldName: string) {
  const column = columnFor(fieldName)
  const options = column?.config?.options
  return Array.isArray(options) ? options as { label: string; value: string }[] : []
}

const fieldOptions = computed(() =>
  props.schema.columns.map((c) => ({ label: c.label ?? c.name, value: c.name }))
)

function isCondition(item: FilterCondition | FilterGroup): item is FilterCondition {
  return 'field' in item
}

function setConditionField(item: FilterCondition, fieldName: string) {
  if (props.disabled) return
  item.field = fieldName
  item.operator = 'eq'
  item.value = ''
}

function isMultiSelectOperator(operator: string): boolean {
  return operator === 'in' || operator === 'notIn'
}

function selectValue(item: FilterCondition): string | string[] {
  if (isMultiSelectOperator(item.operator)) {
    if (Array.isArray(item.value)) return item.value as string[]
    return item.value ? [String(item.value)] : []
  }
  return item.value ? String(item.value) : ''
}

function setOperator(item: FilterCondition, operator: string) {
  if (props.disabled) return
  const wasMulti = isMultiSelectOperator(item.operator)
  const isMulti = isMultiSelectOperator(operator)
  item.operator = operator as FilterCondition['operator']
  if (wasMulti && !isMulti) {
    item.value = Array.isArray(item.value) ? String(item.value[0] ?? '') : ''
  } else if (!wasMulti && isMulti) {
    item.value = item.value ? [String(item.value)] : []
  }
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
      :portal="false"
    />
    <div v-for="(item, i) in group.conditions" :key="i" class="pl-3 border-l border-gray-200 space-y-1">
      <template v-if="isCondition(item)">
        <div class="flex gap-2 items-center">
          <USelect :model-value="item.field" :items="fieldOptions" size="xs" class="flex-1" :disabled="disabled" :portal="false" @update:model-value="(val) => setConditionField(item, val as string)" />
          <USelect :model-value="item.operator" :items="operatorsFor(item.field)" size="xs" class="w-24" :disabled="disabled" :portal="false" @update:model-value="(val) => setOperator(item, val as string)" />
          <USelect
            v-if="hasSelectOptions(item.field)"
            :model-value="selectValue(item)"
            :items="selectOptions(item.field)"
            :multiple="isMultiSelectOperator(item.operator)"
            size="xs"
            class="flex-1"
            :disabled="disabled"
            :portal="false"
            @update:model-value="(val) => item.value = val"
          />
          <UInput v-else v-model="item.value as string" size="xs" class="flex-1" :disabled="disabled" />
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
