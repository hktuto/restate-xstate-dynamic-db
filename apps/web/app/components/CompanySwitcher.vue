<script setup lang="ts">
interface Company {
  id: string
  name: string
  slug: string
  namespace: string
}

const companies = ref<Company[]>([])
const companyCookie = useCookie('company')
const api = useApi()

onMounted(async () => {
  companies.value = await api.fetch<Company[]>('/api/companies')
})

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const selected = companies.value?.find(c => c.slug === target.value)
  if (selected) {
    companyCookie.value = JSON.stringify({ id: selected.id, slug: selected.slug, namespace: selected.namespace })
  } else {
    companyCookie.value = null
  }
  window.location.reload()
}
</script>

<template>
  <select
    :value="companyCookie ? JSON.parse(companyCookie).slug : ''"
    @change="onChange"
    class="border rounded px-3 py-2 text-sm bg-white"
  >
    <option value="">Select company</option>
    <option v-for="company in companies" :key="company.id" :value="company.slug">
      {{ company.name }}
    </option>
  </select>
</template>
