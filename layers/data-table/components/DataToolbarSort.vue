<script setup lang="ts">
import type { SortSetting, TableSchema } from 'shared'

interface Props {
  modelValue: SortSetting[]
  schema: TableSchema
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [SortSetting[]] }>()

const sort = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const fieldOptions = computed(() =>
  props.schema.columns.map((c) => ({ label: c.label ?? c.name, value: c.name }))
)

function addSort() {
  sort.value.push({ field: '', direction: 'asc' })
}

function removeSort(index: number) {
  sort.value.splice(index, 1)
}
</script>

<template>
  <UPopover>
    <UButton color="neutral" size="sm" icon="i-lucide-arrow-up-down" trailing-icon="i-lucide-chevron-down">
      Sort
    </UButton>
    <template #panel>
      <div class="p-3 w-72 space-y-2">
        <div v-for="(s, i) in sort" :key="i" class="flex gap-2 items-center">
          <USelect v-model="s.field" :items="fieldOptions" size="xs" class="flex-1" />
          <USelect v-model="s.direction" :items="[{ label: 'Asc', value: 'asc' }, { label: 'Desc', value: 'desc' }]" size="xs" class="w-24" />
          <UButton color="error" size="xs" icon="i-lucide-x" @click="removeSort(i)" />
        </div>
        <UButton color="neutral" size="xs" icon="i-lucide-plus" @click="addSort">
          Add sort
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
