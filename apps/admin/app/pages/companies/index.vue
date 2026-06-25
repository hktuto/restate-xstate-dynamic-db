<script setup lang="ts">
usePageMeta({ title: 'Companies', icon: 'i-lucide-building-2' })

const { can } = useAdminPermission()
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
  <ViewRenderer
    resource="company"
    :can-update-view="canUpdateView"
    :can-edit-schema="canEditSchema"
    :can-manage-permissions="canManagePermissions"
  />
</template>
