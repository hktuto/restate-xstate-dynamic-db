<script setup lang="ts">
const route = useRoute()

const title = computed(() => `Permissions: ${route.params.table}`)
usePageMeta({ title, icon: 'i-lucide-shield' })

const table = computed(() => route.params.table as string)
const nsdb = computed(() => (route.query.nsdb as string) || 'platform--admin')
</script>

<template>
  <UCard
    :title="`Permission manager for ${table}`"
    :description="`Namespace/database: ${nsdb}. The permission manager will be implemented here.`"
  />
</template>
