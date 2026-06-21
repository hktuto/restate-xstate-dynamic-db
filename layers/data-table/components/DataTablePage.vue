<script setup lang="ts">
interface Props {
  title: string
  icon?: string
  table: string
  nsdb?: string
  newLink?: string
  newLabel?: string
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
  schemaEditLink?: string
  permissionsEditLink?: string
}

withDefaults(defineProps<Props>(), {
  icon: 'i-lucide-table',
})
</script>

<template>
  <DataTable
    :table="table"
    :nsdb="nsdb"
    :title="title"
    :icon="icon"
    :new-link="newLink"
    :new-label="newLabel"
    :can-update-view="canUpdateView"
    :can-edit-schema="canEditSchema"
    :can-manage-permissions="canManagePermissions"
    :schema-edit-link="schemaEditLink"
    :permissions-edit-link="permissionsEditLink"
  />
</template>
