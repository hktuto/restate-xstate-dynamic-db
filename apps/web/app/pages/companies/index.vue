<script setup lang="ts">
interface Company {
  id: string
  name: string
  slug: string
  namespace: string
}

const companies = ref<Company[]>([])
const api = useApi()

async function loadCompanies() {
  companies.value = await api.fetch<Company[]>('/api/companies')
}

await loadCompanies()

const router = useRouter()

async function enterCompany(company: Company) {
  await api.fetch('/api/auth/company', {
    method: 'POST',
    body: { companyId: company.id, slug: company.slug }
  })
  const companyCookie = useCookie('company')
  companyCookie.value = JSON.stringify({ id: company.id, slug: company.slug, namespace: company.namespace })
  await router.push('/')
}
</script>

<template>
  <div class="max-w-xl mx-auto">
    <h1 class="text-2xl font-semibold mb-4">Your companies</h1>
    <div v-if="!companies?.length" class="text-gray-500 mb-4">
      You don't have any companies yet.
    </div>
    <div v-else class="space-y-2 mb-6">
      <button
        v-for="company in companies"
        :key="company.id"
        class="w-full text-left bg-white p-4 rounded shadow hover:bg-gray-50"
        @click="enterCompany(company)"
      >
        <div class="font-medium">{{ company.name }}</div>
        <div class="text-sm text-gray-500">{{ company.slug }}</div>
      </button>
    </div>
    <NuxtLink to="/companies/new" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
      Create a company
    </NuxtLink>
  </div>
</template>
