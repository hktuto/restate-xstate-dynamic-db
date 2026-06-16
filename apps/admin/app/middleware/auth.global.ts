export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login' || to.path.startsWith('/api/')) {
    return
  }

  const session = useCookie('admin_session')
  if (!session.value) {
    return navigateTo('/login')
  }
})
