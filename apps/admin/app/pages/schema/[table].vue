<script setup lang="ts">
const route = useRoute()
const table = computed(() => route.params.table as string)
const nsdb = computed(() => (route.query.nsdb as string) || 'platform--admin')
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="`Schema: ${table}`" icon="i-lucide-table-2">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UCard
        :title="`Schema editor for ${table}`"
        :description="`Namespace/database: ${nsdb}. The schema editor will be implemented here.`"
      />
    </template>
  </UDashboardPanel>
</template>
