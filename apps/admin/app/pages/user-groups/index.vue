<script setup lang="ts">
const config = ref<{
  title: string
  icon: string
  table: string
  nsdb: string
  newLink?: string
  newLabel: string
}>({
  title: 'User Groups',
  icon: 'i-lucide-users-round',
  table: 'admin_user_groups',
  nsdb: 'platform--admin',
  newLink: undefined,
  newLabel: 'Add group',
})

const { can } = useAdminPermission()
const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  if (await can('admin_user_group', 'create')) {
    config.value.newLink = '/user-groups/new'
  }
  canUpdateView.value = await can('admin_user_group', 'update_default_view_settings')
  canEditSchema.value = await can('admin_user_group', 'edit_schema')
  canManagePermissions.value = await can('admin_user_group', 'manage_permissions')
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
