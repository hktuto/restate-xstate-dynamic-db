<script setup lang="ts">
usePageMeta({ title: 'User Groups', icon: 'i-lucide-users' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('admin_user_group', 'update_default_view_settings')
  canEditSchema.value = await can('admin_user_group', 'edit_schema')
  canManagePermissions.value = await can('admin_user_group', 'manage_permissions')
})
</script>

<template>
  <ViewRenderer
    resource="admin_user_group"
    :can-update-view="canUpdateView"
    :can-edit-schema="canEditSchema"
    :can-manage-permissions="canManagePermissions"
  />
</template>
