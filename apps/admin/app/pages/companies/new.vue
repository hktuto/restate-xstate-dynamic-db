<script setup lang="ts">
const name = ref('')
const slug = ref('')
const error = ref('')
const router = useRouter()

async function submit() {
  error.value = ''
  try {
    await $fetch('/api/companies', {
      method: 'POST',
      body: { name: name.value, slug: slug.value }
    })
    await router.push('/companies')
  } catch (e: any) {
    error.value = e.statusMessage || 'Failed to create company'
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto bg-white p-6 rounded shadow">
    <h1 class="text-xl font-semibold mb-4">New Company</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium">Name</label>
        <input v-model="name" class="border rounded px-3 py-2 w-full" required />
      </div>
      <div>
        <label class="block text-sm font-medium">Slug</label>
        <input v-model="slug" class="border rounded px-3 py-2 w-full" required />
      </div>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <div class="flex gap-3">
        <NuxtLink to="/companies" class="px-4 py-2 rounded border hover:bg-gray-50">Cancel</NuxtLink>
        <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create
        </button>
      </div>
    </form>
  </div>
</template>
