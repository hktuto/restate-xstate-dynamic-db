<script setup lang="ts">
const config = ref<{
  title: string
  icon: string
  table: string
  nsdb: string
  newLink?: string
  newLabel: string
}>({
  title: 'Workflow Designs',
  icon: 'i-lucide-workflow',
  table: 'workflow_designs',
  nsdb: 'platform--admin',
  newLink: undefined,
  newLabel: 'New workflow design',
})

const { can } = useAdminPermission()
const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  if (await can('workflow_design', 'create')) {
    config.value.newLink = '/workflow-designs/new'
  }
  canUpdateView.value = await can('workflow_design', 'update_default_view_settings')
  canEditSchema.value = await can('workflow_design', 'edit_schema')
  canManagePermissions.value = await can('workflow_design', 'manage_permissions')
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
