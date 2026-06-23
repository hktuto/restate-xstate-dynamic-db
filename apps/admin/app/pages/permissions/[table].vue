<script setup lang="ts">
const route = useRoute()
const table = computed(() => route.params.table as string)
const nsdb = computed(() => (route.query.nsdb as string) || 'platform--admin')
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="`Permissions: ${table}`" icon="i-lucide-shield">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UCard
        :title="`Permission manager for ${table}`"
        :description="`Namespace/database: ${nsdb}. The permission manager will be implemented here.`"
      />
    </template>
  </UDashboardPanel>
</template>
