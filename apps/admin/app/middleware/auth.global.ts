export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.includes('/maintenance')) {
    return
  }
  const auth = useAuth()
  if(!auth.initialized.value) {
    await auth.init()
  }
  if (to.path === '/login') {
    console.log('to.path', to.path, 'auth.authenticated.value', auth.authenticated.value)
    if(auth.authenticated.value) {
      return navigateTo('/')
    }
    return
  }


  if (!auth.authenticated.value) {
    return navigateTo('/login')
  }
})
