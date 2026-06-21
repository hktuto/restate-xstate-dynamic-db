<script setup lang="ts">
const config = ref<{
  title: string
  icon: string
  table: string
  nsdb: string
  newLink?: string
  newLabel: string
}>({
  title: 'User Groups',
  icon: 'i-lucide-users-round',
  table: 'admin_user_groups',
  nsdb: 'platform--admin',
  newLink: undefined,
  newLabel: 'Add group',
})

const { can } = useAdminPermission()
onMounted(async () => {
  if (await can('admin_user_group', 'create')) {
    config.value.newLink = '/user-groups/new'
  }
})
</script>

<template>
  <DataTablePage v-bind="config" />
</template>
