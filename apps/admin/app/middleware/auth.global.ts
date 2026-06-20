export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path.startsWith('/api/')) {
    return
  }

  const auth = useAuth()
  await auth.init()

  if (!auth.authenticated.value) {
    return navigateTo('/login')
  }
})
