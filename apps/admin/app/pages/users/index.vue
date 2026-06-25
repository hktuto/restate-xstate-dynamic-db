<script setup lang="ts">
usePageMeta({ title: 'Users', icon: 'i-lucide-users' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('admin_user', 'update_default_view_settings')
  canEditSchema.value = await can('admin_user', 'edit_schema')
  canManagePermissions.value = await can('admin_user', 'manage_permissions')
})
</script>

<template>
  <ViewRenderer
    resource="admin_user"
    :can-update-view="canUpdateView"
    :can-edit-schema="canEditSchema"
    :can-manage-permissions="canManagePermissions"
  />
</template>
