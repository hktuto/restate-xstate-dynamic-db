<script setup lang="ts">
const config = {
  title: 'User Groups',
  icon: 'i-lucide-users-round',
  table: 'admin_user_groups',
  nsdb: 'platform--admin',
  newLink: '/user-groups/new',
  newLabel: 'Add group',
}
</script>

<template>
  <DataTablePage v-bind="config" />
</template>
