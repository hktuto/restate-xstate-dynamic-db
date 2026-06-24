<script setup lang="ts">
const route = useRoute()

usePageMeta({ title: `Schema: ${route.params.table}`, icon: 'i-lucide-table-2' })

const table = computed(() => route.params.table as string)
const nsdb = computed(() => (route.query.nsdb as string) || 'platform--admin')
</script>

<template>
  <UCard
    :title="`Schema editor for ${table}`"
    :description="`Namespace/database: ${nsdb}. The schema editor will be implemented here.`"
  />
</template>
