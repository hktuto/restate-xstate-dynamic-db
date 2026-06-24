<script setup lang="ts">
const route = useRoute()

usePageMeta({ title: `Permissions: ${route.params.table}`, icon: 'i-lucide-shield' })

const table = computed(() => route.params.table as string)
const nsdb = computed(() => (route.query.nsdb as string) || 'platform--admin')
</script>

<template>
  <UCard
    :title="`Permission manager for ${table}`"
    :description="`Namespace/database: ${nsdb}. The permission manager will be implemented here.`"
  />
</template>
