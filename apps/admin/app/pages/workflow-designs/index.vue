<script setup lang="ts">
usePageMeta({ title: 'Workflow Designs', icon: 'i-lucide-workflow' })

const { can } = useAdminPermission()
const canUpdateView = ref(false)

onMounted(async () => {
  canUpdateView.value = await can('workflow_design', 'update_default_view_settings')
})
</script>

<template>
  <ViewRenderer
    resource="workflow_design"
    :can-update-view="canUpdateView"
  />
</template>
