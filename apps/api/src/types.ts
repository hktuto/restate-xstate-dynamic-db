export interface TenantScope {
  type: 'tenant'
  namespace: string
  database: string
  accountId: string
  profileId: string
  memberId: string
  role: 'owner' | 'admin' | 'member'
}

export interface AdminScope {
  type: 'admin'
  namespace: string
  database: string
  userId: string
  email: string
}

export type ApiScope = TenantScope | AdminScope
