export default defineNuxtRouteMiddleware(async (to) => {
  // Public routes
  if (to.path === '/login' || to.path.startsWith('/api/')) {
    return
  }

  const auth = useState<{ authenticated: boolean } | null>('adminAuth', () => null)
  if (!auth.value) {
    auth.value = await $fetch('/api/auth/me', {
      headers: useRequestHeaders(['cookie'])
    })
  }

  if (!auth.value.authenticated) {
    return navigateTo('/login')
  }
})
