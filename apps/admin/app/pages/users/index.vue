<script setup lang="ts">
const config = ref<{
  title: string
  icon: string
  table: string
  nsdb: string
  newLink?: string
  newLabel: string
}>({
  title: 'Users',
  icon: 'i-lucide-users',
  table: 'platform_users',
  nsdb: 'platform--admin',
  newLink: undefined,
  newLabel: 'Add user',
})

const { can } = useAdminPermission()
const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  if (await can('admin_user', 'create')) {
    config.value.newLink = '/users/new'
  }
  canUpdateView.value = await can('admin_user', 'update_default_view_settings')
  canEditSchema.value = await can('admin_user', 'edit_schema')
  canManagePermissions.value = await can('admin_user', 'manage_permissions')
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
