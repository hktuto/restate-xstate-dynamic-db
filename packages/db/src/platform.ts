import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import type { WorkflowInstanceStatus } from './crud.js'
import type { TriggerBy } from 'shared'
import * as Crud from './crud.js'

export interface CompanyInput {
  name: string
  slug: string
  namespace?: string
}

export interface CompanyRecord extends CompanyInput {
  id: string
  namespace: string
  createdAt: string
  [key: string]: unknown
}

export type PlatformWorkflowDesignRecord = Crud.WorkflowDesignRecord
export type PlatformWorkflowDesignInput = Crud.WorkflowDesignInput

export async function listPlatformWorkflowDesigns(): Promise<PlatformWorkflowDesignRecord[]> {
  return Crud.listWorkflowDesigns('platform', 'admin')
}

export async function createPlatformWorkflowDesign(input: PlatformWorkflowDesignInput): Promise<PlatformWorkflowDesignRecord> {
  return Crud.createWorkflowDesign('platform', 'admin', input)
}

export async function getPlatformWorkflowDesign(id: string): Promise<PlatformWorkflowDesignRecord | undefined> {
  return Crud.getWorkflowDesign('platform', 'admin', id)
}

export async function updatePlatformWorkflowDesign(
  id: string,
  input: Partial<PlatformWorkflowDesignInput>
): Promise<PlatformWorkflowDesignRecord | undefined> {
  return Crud.updateWorkflowDesign('platform', 'admin', id, input)
}

export async function deletePlatformWorkflowDesign(id: string): Promise<void> {
  return Crud.deleteWorkflowDesign('platform', 'admin', id)
}

export interface PlatformSessionRecord {
  id: string
  refreshTokenHash: string
  accessTokenJti: string
  accountId?: string
  profileId?: string
  platformUserId?: string
  email: string
  type: 'user' | 'impersonation'
  impersonatorId?: string
  companyId?: string
  deviceFingerprint?: string
  deviceName?: string
  ip?: string
  userAgent?: string
  refreshExpiresAt: string
  accessExpiresAt: string
  lastUsedAt: string
  revokedAt?: string
  revokeReason?: string
  [key: string]: unknown
}

export interface CreatePlatformSessionInput {
  refreshTokenHash: string
  accessTokenJti: string
  accountId: string
  profileId: string
  platformUserId?: string
  email: string
  type?: 'user' | 'impersonation'
  impersonatorId?: string
  companyId?: string
  deviceFingerprint?: string
  deviceName?: string
  ip?: string
  userAgent?: string
  refreshExpiresAt: string
  accessExpiresAt: string
}

export async function createPlatformSession(namespace: string, input: CreatePlatformSessionInput): Promise<PlatformSessionRecord> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    const [rows] = await surreal.query<[PlatformSessionRecord[]]>(
      'CREATE sessions CONTENT $data RETURN *',
      { data: { ...input, type: input.type ?? 'user', lastUsedAt: new Date().toISOString() } }
    )
    return normalizeId(rows[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformSessionByRefreshToken(namespace: string, refreshTokenHash: string): Promise<PlatformSessionRecord | null> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    const [rows] = await surreal.query<[PlatformSessionRecord[]]>(
      'SELECT * FROM sessions WHERE refreshTokenHash = $hash AND revokedAt IS NONE AND refreshExpiresAt > $now LIMIT 1',
      { hash: refreshTokenHash, now: new Date().toISOString() }
    )
    return normalizeId(rows[0]) ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformSessionById(namespace: string, sessionId: string): Promise<PlatformSessionRecord | null> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    const [rows] = await surreal.query<[PlatformSessionRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id: sessionId }
    )
    const record = normalizeId(rows[0])
    if (!record || record.revokedAt) return null
    return record
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePlatformSessionToken(namespace: string, sessionId: string, updates: Partial<Pick<PlatformSessionRecord, 'refreshTokenHash' | 'accessTokenJti' | 'accessExpiresAt' | 'refreshExpiresAt' | 'lastUsedAt'>>): Promise<void> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    await surreal.query(
      'UPDATE type::record($id) MERGE $updates',
      { id: sessionId, updates }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function revokePlatformSession(namespace: string, sessionId: string, reason?: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    if (reason) {
      await surreal.query(
        'UPDATE type::record($id) SET revokedAt = $now, revokeReason = $reason',
        { id: sessionId, now: new Date().toISOString(), reason }
      )
    } else {
      await surreal.query(
        'UPDATE type::record($id) SET revokedAt = $now',
        { id: sessionId, now: new Date().toISOString() }
      )
    }
  } finally {
    await closeSurreal(surreal)
  }
}

export async function countActivePlatformSessions(namespace: string, accountId: string): Promise<number> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    const [rows] = await surreal.query<[{ count: number }[]]>(
      'SELECT count() FROM sessions WHERE accountId = $accountId AND revokedAt IS NONE AND refreshExpiresAt > $now GROUP ALL',
      { accountId, now: new Date().toISOString() }
    )
    return Number(rows[0]?.count ?? 0)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function findOldestActivePlatformSession(namespace: string, accountId: string): Promise<PlatformSessionRecord | null> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    const [rows] = await surreal.query<[PlatformSessionRecord[]]>(
      'SELECT * FROM sessions WHERE accountId = $accountId AND revokedAt IS NONE AND refreshExpiresAt > $now ORDER BY lastUsedAt ASC LIMIT 1',
      { accountId, now: new Date().toISOString() }
    )
    return normalizeId(rows[0]) ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export type PlatformWorkflowInstanceRecord = Crud.WorkflowInstanceRecord

export interface PlatformWorkflowInstanceInput {
  designId: string
  status?: WorkflowInstanceStatus
  currentState?: string
  context?: Record<string, unknown>
  triggerBy?: TriggerBy
  namespace?: string
  companyId?: string
}

export async function listPlatformWorkflowInstances(): Promise<PlatformWorkflowInstanceRecord[]> {
  return Crud.listWorkflowInstances('platform', 'admin')
}

export async function getPlatformWorkflowInstance(id: string): Promise<PlatformWorkflowInstanceRecord | undefined> {
  return Crud.getWorkflowInstance('platform', 'admin', id)
}

export async function createPlatformWorkflowInstance(input: PlatformWorkflowInstanceInput): Promise<PlatformWorkflowInstanceRecord> {
  return Crud.createWorkflowInstance('platform', 'admin', {
    ...input,
    namespace: input.namespace ?? 'platform'
  })
}

export async function updatePlatformWorkflowInstanceStatus(
  id: string,
  status: WorkflowInstanceStatus,
  currentState?: string
): Promise<PlatformWorkflowInstanceRecord | undefined> {
  return Crud.updateWorkflowInstanceStatus('platform', 'admin', id, status, currentState)
}

export async function deletePlatformWorkflowInstance(id: string): Promise<void> {
  return Crud.deleteWorkflowInstance('platform', 'admin', id)
}

export type PlatformUserTaskStatus = Crud.UserTaskStatus
export type PlatformUserTaskType = Crud.UserTaskType
export type PlatformUserTaskRecord = Crud.UserTaskRecord

export interface PlatformUserTaskInput {
  instanceId: string
  type: PlatformUserTaskType
  tableName: string
  recordId: string
  designId: string
}

export async function listPlatformUserTasks(): Promise<PlatformUserTaskRecord[]> {
  return Crud.listUserTasks('platform', 'admin')
}

export async function getPlatformUserTaskById(id: string): Promise<PlatformUserTaskRecord | undefined> {
  return Crud.getUserTaskById('platform', 'admin', id)
}

export async function createPlatformUserTask(input: PlatformUserTaskInput): Promise<PlatformUserTaskRecord> {
  return Crud.createUserTask('platform', 'admin', input)
}

export async function updatePlatformUserTaskStatus(
  id: string,
  status: PlatformUserTaskStatus
): Promise<PlatformUserTaskRecord | undefined> {
  return Crud.updateUserTaskStatus('platform', 'admin', id, status)
}

export async function deletePlatformUserTask(id: string): Promise<void> {
  return Crud.deleteUserTask('platform', 'admin', id)
}

export async function deleteCompanyBySlug(slug: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE companies WHERE slug = $slug', { slug })
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listCompanies(): Promise<CompanyRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [companies] = await surreal.query<[CompanyRecord[]]>('SELECT * FROM companies')
    return normalizeIds(companies)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createCompany(input: CompanyInput): Promise<CompanyRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const id = crypto.randomUUID().replace(/-/g, '')
    const record = {
      ...input,
      namespace: input.namespace ?? `company_${id}`,
      status: 'active',
      createdAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[CompanyRecord[]]>(
      'CREATE companies CONTENT $data',
      { data: record }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getCompanyBySlug(slug: string): Promise<CompanyRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[CompanyRecord[]]>(
      'SELECT * FROM companies WHERE slug = $slug LIMIT 1',
      { slug }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getCompanyByNamespace(namespace: string): Promise<CompanyRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[CompanyRecord[]]>(
      'SELECT * FROM companies WHERE namespace = $namespace LIMIT 1',
      { namespace }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

function isMissingNamespaceOrDatabase(err: unknown): boolean {
  if (err && typeof err === 'object' && 'kind' in err && err.kind === 'NotFound') {
    const details = (err as { details?: { kind?: string } }).details
    if (details?.kind === 'Namespace' || details?.kind === 'Database') {
      return true
    }
  }
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes('namespace does not exist') ||
    message.includes('database does not exist') ||
    message.includes('NS_NOT_FOUND') ||
    message.includes('DB_NOT_FOUND')
  )
}

export async function listCompaniesForProfile(profileId: string): Promise<CompanyRecord[]> {
  const companies = await listCompanies()
  const memberships = await Promise.all(
    companies.map(async (company) => {
      try {
        const surreal = await getSurreal(company.namespace, 'main')
        try {
          const [members] = await surreal.query<[Array<{ id: string }>]>(
            'SELECT id FROM members WHERE profileId = $profileId LIMIT 1',
            { profileId }
          )
          return Array.isArray(members) && members.length > 0 ? company : null
        } finally {
          await closeSurreal(surreal)
        }
      } catch (err) {
        if (isMissingNamespaceOrDatabase(err)) {
          console.warn('listCompaniesForProfile: skipping company due to missing namespace/database', { companyId: company.id, namespace: company.namespace })
          return null
        }
        throw err
      }
    })
  )
  return memberships.filter((c): c is CompanyRecord => c !== null)
}

export interface PlatformUserRecord {
  id: string
  email: string
  password: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface PlatformUserInput {
  email: string
  password: string
}

export interface PlatformUserUpdateInput {
  email?: string
  password?: string
}

export async function listPlatformUsers(): Promise<PlatformUserRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [users] = await surreal.query<[PlatformUserRecord[]]>(
      'SELECT * FROM platform_users ORDER BY email'
    )
    return normalizeIds(users)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformUserById(id: string): Promise<PlatformUserRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformUserRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformUserByEmail(email: string): Promise<PlatformUserRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformUserRecord[]]>(
      'SELECT * FROM platform_users WHERE email = $email LIMIT 1',
      { email }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createPlatformUser(input: PlatformUserInput): Promise<PlatformUserRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const now = new Date().toISOString()
    const data = {
      ...input,
      createdAt: now,
      updatedAt: now,
    }
    const [created] = await surreal.query<[PlatformUserRecord[]]>(
      'CREATE platform_users CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePlatformUser(
  id: string,
  input: PlatformUserUpdateInput
): Promise<PlatformUserRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data: Record<string, unknown> = {}
    if (input.email !== undefined) data.email = input.email
    if (input.password !== undefined) data.password = input.password
    data.updatedAt = new Date().toISOString()

    const [updated] = await surreal.query<[PlatformUserRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deletePlatformUser(id: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query(
      'DELETE admin_user_group_memberships WHERE in = type::record($id)',
      { id }
    )
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export interface UserProfileRecord {
  id: string
  name: string
  gender?: string
  birthday?: string
  preferences?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface UserProfileInput {
  name: string
  gender?: string
  birthday?: string
  preferences?: Record<string, unknown>
}

export async function createUserProfile(input: UserProfileInput): Promise<UserProfileRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data = {
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[UserProfileRecord[]]>(
      'CREATE user_profiles CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getUserProfileById(id: string): Promise<UserProfileRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[UserProfileRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getUserProfilesByIds(ids: string[]): Promise<UserProfileRecord[]> {
  if (ids.length === 0) return []
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [profiles] = await surreal.query<[UserProfileRecord[]]>(
      'SELECT * FROM user_profiles WHERE id IN array::map($ids, |$id| type::record($id))',
      { ids }
    )
    return normalizeIds(profiles ?? [])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateUserProfile(
  id: string,
  input: Partial<UserProfileInput>
): Promise<UserProfileRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data = {
      ...input,
      updatedAt: new Date().toISOString()
    }
    const [updated] = await surreal.query<[UserProfileRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export type AuthProvider = 'email' | 'oauth_google' | 'oauth_github' | 'phone'

export interface AccountRecord {
  id: string
  provider: AuthProvider
  providerKey: string
  credential?: string
  profileId: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface AccountInput {
  provider: AuthProvider
  providerKey: string
  credential?: string
  profileId: string
}

export async function createAccount(input: AccountInput): Promise<AccountRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data = {
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[AccountRecord[]]>(
      'CREATE accounts CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getAccountByProviderKey(
  provider: AuthProvider,
  providerKey: string
): Promise<AccountRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[AccountRecord[]]>(
      'SELECT * FROM accounts WHERE provider = $provider AND providerKey = $providerKey LIMIT 1',
      { provider, providerKey }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateAccountCredential(
  id: string,
  credential: string
): Promise<AccountRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [updated] = await surreal.query<[AccountRecord[]]>(
      'UPDATE type::record($id) SET credential = $credential, updatedAt = $updatedAt',
      { id, credential, updatedAt: new Date().toISOString() }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}
