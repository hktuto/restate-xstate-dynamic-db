<script setup lang="ts">
usePageMeta({ title: 'Users', icon: 'i-lucide-users' })
const config = useResourceCapabilities('admin_user')
</script>

<template>
  <PageRenderer :config="config" />
</template>
