<script setup lang="ts">
import type { GroupSetting, TableSchema } from 'shared'

interface Props {
  modelValue: GroupSetting[]
  schema: TableSchema
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [GroupSetting[]] }>()

const group = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const fieldOptions = computed(() =>
  props.schema.columns.map((c) => ({ label: c.label ?? c.name, value: c.name }))
)

function addGroup() {
  group.value.push({ field: '' })
}

function removeGroup(index: number) {
  group.value.splice(index, 1)
}
</script>

<template>
  <UPopover>
    <UButton color="neutral" size="sm" icon="i-lucide-layers" trailing-icon="i-lucide-chevron-down">
      Group
    </UButton>
    <template #panel>
      <div class="p-3 w-64 space-y-2">
        <div v-for="(g, i) in group" :key="i" class="flex gap-2 items-center">
          <USelect v-model="g.field" :items="fieldOptions" size="xs" class="flex-1" />
          <UButton color="error" size="xs" icon="i-lucide-x" @click="removeGroup(i)" />
        </div>
        <UButton color="neutral" size="xs" icon="i-lucide-plus" @click="addGroup">
          Add group
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
