<script setup lang="ts">
const config = {
  title: 'Users',
  icon: 'i-lucide-users',
  table: 'platform_users',
  nsdb: 'platform--admin',
}
</script>

<template>
  <DataTablePage v-bind="config" />
</template>
