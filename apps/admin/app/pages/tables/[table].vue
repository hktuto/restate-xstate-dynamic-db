<script setup lang="ts">
const route = useRoute()

const tableName = computed(() => route.params.table as string)
const nsdb = computed(() => (route.query.nsdb as string) || 'platform--admin')
</script>

<template>
  <DataTablePage :title="tableName" icon="i-lucide-table" :table="tableName" :nsdb="nsdb" />
</template>
