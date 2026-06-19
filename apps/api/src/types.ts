export interface TenantScope {
  type: 'tenant'
  namespace: string
  database: string
  accountId: string
  profileId: string
  memberId: string
  role: 'owner' | 'member'
  permissions?: Record<string, string>
}

export interface AdminScope {
  type: 'admin'
  namespace: string
  database: string
  userId: string
  email: string
}

export type ApiScope = TenantScope | AdminScope
