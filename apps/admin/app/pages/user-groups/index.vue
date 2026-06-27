<script setup lang="ts">
usePageMeta({ title: 'User Groups', icon: 'i-lucide-users' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('admin_user_group', 'update_default_view_settings')
})
</script>

<template>
  <ViewRenderer
    resource="admin_user_group"
    :can-update-view="canUpdateView"
  />
</template>
