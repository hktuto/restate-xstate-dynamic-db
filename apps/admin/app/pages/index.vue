<script setup lang="ts">
interface DashboardStats {
  companies: number
  workflows: number
  triggers: number
}

const { data: stats } = await useFetch<DashboardStats>('/api/dashboard')
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">Dashboard</h1>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <NuxtLink to="/companies" class="bg-white p-4 rounded shadow hover:shadow-md transition">
        <div class="text-sm text-gray-500">Companies</div>
        <div class="text-3xl font-bold">{{ stats?.companies ?? 0 }}</div>
      </NuxtLink>
      <NuxtLink to="/workflows" class="bg-white p-4 rounded shadow hover:shadow-md transition">
        <div class="text-sm text-gray-500">Platform Workflows</div>
        <div class="text-3xl font-bold">{{ stats?.workflows ?? 0 }}</div>
      </NuxtLink>
      <NuxtLink to="/triggers" class="bg-white p-4 rounded shadow hover:shadow-md transition">
        <div class="text-sm text-gray-500">Platform Triggers</div>
        <div class="text-3xl font-bold">{{ stats?.triggers ?? 0 }}</div>
      </NuxtLink>
    </div>

    <div class="bg-white p-4 rounded shadow">
      <h2 class="font-semibold mb-3">Quick actions</h2>
      <div class="flex flex-wrap gap-3">
        <NuxtLink to="/companies/new" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create company
        </NuxtLink>
        <NuxtLink to="/workflows/new" class="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900">
          New workflow
        </NuxtLink>
        <NuxtLink to="/triggers" class="border px-4 py-2 rounded hover:bg-gray-50">
          Manage triggers
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
