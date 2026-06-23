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

const props = withDefaults(defineProps<Props>(), {
  icon: 'i-lucide-table',
})

const defaultNsdb = computed(() => props.nsdb ?? 'platform--admin')
const schemaEditLink = computed(() => props.schemaEditLink ?? `/schema/${encodeURIComponent(props.table)}?nsdb=${encodeURIComponent(defaultNsdb.value)}`)
const permissionsEditLink = computed(() => props.permissionsEditLink ?? `/permissions/${encodeURIComponent(props.table)}?nsdb=${encodeURIComponent(defaultNsdb.value)}`)
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
