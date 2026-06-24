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

const config = computed(() => ({
  resource: 'workflow_design',
  canUpdateView: canUpdateView.value,
  canEditSchema: canEditSchema.value,
  canManagePermissions: canManagePermissions.value,
}))
</script>

<template>
  <PageRenderer :config="config" />
</template>
