export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path.startsWith('/api/')) {
    return
  }

  try {
    const api = useApi()
    const result = await api.fetch<{ authenticated: boolean }>('/api/admin/me')
    if (!result.authenticated) {
      return navigateTo('/login')
    }
  } catch {
    return navigateTo('/login')
  }
})
