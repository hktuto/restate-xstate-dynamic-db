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
  newLink: '/workflow-designs/new',
  newLabel: 'New workflow design',
})

const { can } = useAdminPermission()
onMounted(async () => {
  if (!(await can('workflow_design', 'create'))) {
    config.value.newLink = undefined
  }
})
</script>

<template>
  <DataTablePage v-bind="config" />
</template>
