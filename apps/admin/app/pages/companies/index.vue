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

const config = computed(() => ({
  resource: 'company',
  canUpdateView: canUpdateView.value,
  canEditSchema: canEditSchema.value,
  canManagePermissions: canManagePermissions.value,
}))
</script>

<template>
  <PageRenderer :config="config" />
</template>
