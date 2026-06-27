<script setup lang="ts">
usePageMeta({ title: 'Users', icon: 'i-lucide-users' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('admin_user', 'update_default_view_settings')
})
</script>

<template>
  <ViewRenderer
    resource="admin_user"
    :can-update-view="canUpdateView"
  />
</template>
