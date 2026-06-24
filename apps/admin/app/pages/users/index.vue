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

const config = computed(() => ({
  resource: 'admin_user',
  canUpdateView: canUpdateView.value,
  canEditSchema: canEditSchema.value,
  canManagePermissions: canManagePermissions.value,
}))
</script>

<template>
  <PageRenderer :config="config" />
</template>
