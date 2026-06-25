<script setup lang="ts">
import type { RuntimeViewState } from '../utils/view-state'
import type { TableSchema, ViewDefinition } from 'shared'

interface Props {
  runtime: RuntimeViewState
  dirty: boolean
  view: ViewDefinition
  schema: TableSchema
  search?: string
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
  schemaEditLink?: string
  permissionsEditLink?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ save: []; 'apply-filter': []; 'update:search': [string] }>()

const localSearch = computed({
  get: () => props.search ?? '',
  set: (val) => emit('update:search', val),
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 p-2 border border-gray-200 rounded bg-white">
    <UInput
      v-model="localSearch"
      placeholder="Search..."
      size="sm"
      icon="i-lucide-search"
      class="w-48"
    />
    <DataToolbarFilter
      v-model="runtime.filter"
      :schema="schema"
      :locked-filter="view.filter"
      :can-update-view="canUpdateView"
      @apply="emit('apply-filter')"
    />
    <DataToolbarGroup v-model="runtime.group" :schema="schema" />
    <DataToolbarSort v-model="runtime.sort" :schema="schema" />
    <DataToolbarColumn v-model="runtime.columns" :schema="schema" />
    <DataToolbarSetting
      :can-edit-schema="canEditSchema"
      :can-manage-permissions="canManagePermissions"
      :schema-edit-link="schemaEditLink"
      :permissions-edit-link="permissionsEditLink"
    />
    <slot name="toolbar-actions" />
    <UButton
      v-if="canUpdateView && dirty"
      color="primary"
      size="sm"
      @click="emit('save')"
    >
      Save view
    </UButton>
  </div>
</template>
