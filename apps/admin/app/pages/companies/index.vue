<script setup lang="ts">
usePageMeta({ title: 'Companies', icon: 'i-lucide-building-2' })
const config = useResourceCapabilities('company')
</script>

<template>
  <PageRenderer :config="config" />
</template>
