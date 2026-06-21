<script setup lang="ts">
import type { TableSchema, ViewDefinition } from 'shared'

interface Props {
  view: ViewDefinition
  schema: TableSchema
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
  schemaEditLink?: string
  permissionsEditLink?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ save: [view: ViewDefinition] }>()

const { runtime, dirty, save: buildSaveView } = useDataToolbar(toRef(props, 'view'), toRef(props, 'canUpdateView'))

function onSave() {
  emit('save', buildSaveView())
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 p-2 border border-gray-200 rounded bg-white">
    <DataToolbarFilter
      v-model="runtime.filter"
      :schema="schema"
      :locked-filter="view.filter"
      :can-update-view="canUpdateView"
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
    <UButton
      v-if="canUpdateView && dirty"
      color="primary"
      size="sm"
      @click="onSave"
    >
      Save view
    </UButton>
  </div>
</template>
