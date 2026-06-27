export interface AdminUser {
  userId: string
  email: string
}

export function useAuth() {
  const user = useState<AdminUser | null>('adminUser', () => null)
  const authenticated = useState<boolean>('adminAuthenticated', () => false)
  const initialized = useState<boolean>('adminAuthInitialized', () => false)

  const api = useApi()
  const { connect, disconnect } = usePush()

  watch(authenticated, (isAuthenticated) => {
    if (isAuthenticated) {
      connect()
    } else {
      disconnect()
      connect()
    }
  })

  async function init(): Promise<boolean> {
    if (initialized.value) {
      return authenticated.value
    }

    try {
      const result = await api.fetch<{ authenticated: boolean; user: AdminUser | null }>('/api/admin/me')
      user.value = result.user ?? null
      authenticated.value = result.authenticated
    } catch (error) {
      console.error("error",error)
      user.value = null
      authenticated.value = false
    } finally {
      initialized.value = true
    }
    return authenticated.value
  }

  async function login(credentials: { email: string; password: string }): Promise<boolean> {
    initialized.value = false // reset the initialized state, so the init function will fetch the user
    await api.fetch('/api/admin/login', {
      method: 'POST',
      body: credentials,
    })
    return init()
  }

  async function logout(): Promise<void> {
    try {
      await api.fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      user.value = null
      authenticated.value = false
      await navigateTo('/login')
    }
  }

  return {
    user: readonly(user),
    authenticated: readonly(authenticated),
    initialized: readonly(initialized),
    init,
    login,
    logout,
  }
}
