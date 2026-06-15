export default defineNuxtRouteMiddleware((to) => {
  // API routes are handled by Nitro server middleware
  if (to.path.startsWith('/api/')) {
    return
  }

  const companySlug = useCookie('company_slug')
  if (!companySlug.value && to.path !== '/') {
    return navigateTo('/')
  }
})
