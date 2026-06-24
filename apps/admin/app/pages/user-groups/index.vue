<script setup lang="ts">
usePageMeta({ title: 'User Groups', icon: 'i-lucide-users' })

const config = useResourceCapabilities('admin_user_group')
</script>

<template>
  <PageRenderer :config="config" />
</template>
