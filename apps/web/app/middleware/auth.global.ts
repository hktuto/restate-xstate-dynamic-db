export default defineNuxtRouteMiddleware((to) => {
  const publicPaths = ['/login', '/register', '/accept-invite', '/logout']
  if (publicPaths.includes(to.path) || to.path.startsWith('/api/')) {
    return
  }

  const session = useCookie('tenant_session')
  if (!session.value) {
    return navigateTo('/login')
  }

  const company = useCookie('company')
  if (!company.value) {
    return navigateTo('/companies')
  }
})
