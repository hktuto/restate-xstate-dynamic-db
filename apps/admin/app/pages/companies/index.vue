<script setup lang="ts">
usePageMeta({ title: 'Companies', icon: 'i-lucide-building-2' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('company', 'update_default_view_settings')
})
</script>

<template>
  <ViewRenderer
    resource="company"
    :can-update-view="canUpdateView"
  />
</template>
