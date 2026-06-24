<script setup lang="ts">
usePageMeta({ title: 'Workflow Designs', icon: 'i-lucide-workflow' })
const config = useResourceCapabilities('workflow_design')
</script>

<template>
  <PageRenderer :config="config" />
</template>
