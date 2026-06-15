<script setup lang="ts">
interface Company {
  id: string
  name: string
  slug: string
}

const { data: companies } = await useFetch<Company[]>('/api/companies')
const companySlug = useCookie('company_slug')

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement
  companySlug.value = target.value
  window.location.reload()
}
</script>

<template>
  <select
    :value="companySlug"
    @change="onChange"
    class="border rounded px-3 py-2 text-sm bg-white"
  >
    <option value="">Select company</option>
    <option v-for="company in companies" :key="company.id" :value="company.slug">
      {{ company.name }}
    </option>
  </select>
</template>
