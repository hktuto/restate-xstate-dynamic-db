<script setup lang="ts">
const route = useRoute()
const code = computed(() => String(route.query.code || ''))
const companySlug = computed(() => String(route.query.company || ''))

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()
const api = useApi()

async function submit() {
  error.value = ''
  try {
    await api.fetch('/api/auth/accept-invite', {
      method: 'POST',
      body: {
        inviteCode: code.value,
        companySlug: companySlug.value,
        email: email.value,
        password: password.value,
        name: name.value
      }
    })
    await router.push('/')
  } catch (e: any) {
    error.value = e.message || 'Failed to accept invite'
  }
}
</script>

<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
    <h1 class="text-xl font-semibold mb-4">Accept invite</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium">Name</label>
        <input v-model="name" class="border rounded px-3 py-2 w-full" required />
      </div>
      <div>
        <label class="block text-sm font-medium">Email</label>
        <input v-model="email" type="email" class="border rounded px-3 py-2 w-full" required />
      </div>
      <div>
        <label class="block text-sm font-medium">Password</label>
        <input v-model="password" type="password" class="border rounded px-3 py-2 w-full" required />
      </div>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">
        Accept invite
      </button>
    </form>
  </div>
</template>
