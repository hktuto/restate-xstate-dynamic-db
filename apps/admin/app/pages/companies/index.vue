<script setup lang="ts">
const config = {
  title: 'Companies',
  icon: 'i-lucide-building-2',
  table: 'companies',
  nsdb: 'platform--admin',
}
</script>

<template>
  <DataTablePage v-bind="config" />
</template>
