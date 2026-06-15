<script setup lang="ts">
const { data: companies, error } = await useFetch('/api/companies')
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Companies</h1>
      <NuxtLink to="/companies/new" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        New company
      </NuxtLink>
    </div>
    <div v-if="error" class="text-red-600">{{ error.statusMessage }}</div>
    <table v-else class="w-full bg-white rounded shadow">
      <thead class="bg-gray-100">
        <tr>
          <th class="text-left px-4 py-2">Name</th>
          <th class="text-left px-4 py-2">Slug</th>
          <th class="text-left px-4 py-2">Namespace</th>
          <th class="text-left px-4 py-2">Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="company in companies" :key="company.id" class="border-t">
          <td class="px-4 py-2">{{ company.name }}</td>
          <td class="px-4 py-2">{{ company.slug }}</td>
          <td class="px-4 py-2 font-mono text-sm">{{ company.namespace }}</td>
          <td class="px-4 py-2">{{ new Date(company.createdAt).toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
