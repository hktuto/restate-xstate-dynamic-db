<script setup lang="ts">
usePageMeta({ title: 'Workflow Designs', icon: 'i-lucide-workflow' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('workflow_design', 'update_default_view_settings')
  canEditSchema.value = await can('workflow_design', 'edit_schema')
  canManagePermissions.value = await can('workflow_design', 'manage_permissions')
})
</script>

<template>
  <ViewRenderer
    resource="workflow_design"
    :can-update-view="canUpdateView"
    :can-edit-schema="canEditSchema"
    :can-manage-permissions="canManagePermissions"
  />
</template>
