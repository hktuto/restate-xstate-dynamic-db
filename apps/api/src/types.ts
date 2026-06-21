import type { TenantSession, AdminSession } from './lib/session.js'

export interface TenantScope {
  type: 'tenant'
  namespace: string
  database: string
  accountId: string
  profileId: string
  memberId: string
  role: 'owner' | 'admin' | 'member'
  permissions?: Record<string, string>
  session: TenantSession
}

export interface AdminScope {
  type: 'admin'
  namespace: string
  database: string
  userId: string
  email: string
  session: AdminSession
  permissions?: Record<string, string>
}

export type ApiScope = TenantScope | AdminScope
