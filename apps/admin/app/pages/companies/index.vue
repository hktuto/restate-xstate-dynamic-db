<script setup lang="ts">
const { can } = useAdminPermission()

const config = {
  title: 'Companies',
  icon: 'i-lucide-building-2',
  table: 'companies',
  nsdb: 'platform--admin',
}

const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('company', 'update_default_view_settings')
  canEditSchema.value = await can('company', 'edit_schema')
  canManagePermissions.value = await can('company', 'manage_permissions')
})
</script>

<template>
  <DataTablePage
    v-bind="config"
    :can-update-view="canUpdateView"
    :can-edit-schema="canEditSchema"
    :can-manage-permissions="canManagePermissions"
  />
</template>
