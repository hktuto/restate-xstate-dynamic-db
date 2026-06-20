<script setup lang="ts">
const config = {
  title: 'Workflow Designs',
  icon: 'i-lucide-workflow',
  table: 'workflow_designs',
  nsdb: 'platform--admin',
  newLink: '/workflow-designs/new',
  newLabel: 'New workflow design',
}
</script>

<template>
  <DataTablePage v-bind="config" />
</template>
