<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const email = ref('admin@example.com')
const password = ref('admin')
const error = ref('')
const router = useRouter()
const auth = useState<{ authenticated: boolean } | null>('adminAuth')
const api = useApi()

async function login() {
  error.value = ''
  try {
    await api.fetch('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.value, password: password.value })
    })
    auth.value = { authenticated: true }
    await router.push('/')
  } catch (e: any) {
    error.value = e.message || 'Login failed'
  }
}
</script>

<template>
  <div class="max-w-md w-full bg-white p-6 rounded shadow">
    <h1 class="text-xl font-semibold mb-4">SuperAdmin Login</h1>
    <form class="space-y-4" @submit.prevent="login">
      <div>
        <label class="block text-sm font-medium">Email</label>
        <input v-model="email" type="email" class="border rounded px-3 py-2 w-full" />
      </div>
      <div>
        <label class="block text-sm font-medium">Password</label>
        <input v-model="password" type="password" class="border rounded px-3 py-2 w-full" />
      </div>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <button type="submit" class="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Login
      </button>
    </form>
  </div>
</template>
