import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import type { WorkflowInstanceStatus } from './tenant.js'
import type { WorkflowDefinition, StartRule, TriggerBy } from 'shared'

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

export interface PlatformWorkflowDesignRecord {
  id: string
  name: string
  xstateConfig: WorkflowDefinition
  starts?: StartRule[]
  [key: string]: unknown
}

export interface PlatformWorkflowDesignInput {
  name: string
  xstateConfig: WorkflowDefinition
  starts?: StartRule[]
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

export async function listPlatformWorkflowDesigns(): Promise<PlatformWorkflowDesignRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [designs] = await surreal.query<[PlatformWorkflowDesignRecord[]]>('SELECT * FROM workflow_designs')
    return normalizeIds(designs)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createPlatformWorkflowDesign(input: PlatformWorkflowDesignInput): Promise<PlatformWorkflowDesignRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data = {
      name: input.name,
      xstateConfig: input.xstateConfig,
      starts: input.starts
    }
    const [created] = await surreal.query<[PlatformWorkflowDesignRecord[]]>(
      'CREATE workflow_designs CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformWorkflowDesign(id: string): Promise<PlatformWorkflowDesignRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformWorkflowDesignRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePlatformWorkflowDesign(id: string, input: Partial<PlatformWorkflowDesignInput>): Promise<PlatformWorkflowDesignRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [updated] = await surreal.query<[PlatformWorkflowDesignRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data: input }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deletePlatformWorkflowDesign(id: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export interface PlatformWorkflowInstanceRecord {
  id: string
  designId: string
  status: WorkflowInstanceStatus
  currentState?: string
  context?: Record<string, unknown>
  triggerBy?: TriggerBy
  namespace: string
  companyId?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

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
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [instances] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>('SELECT * FROM workflow_instances ORDER BY createdAt DESC')
    return normalizeIds(instances)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformWorkflowInstance(id: string): Promise<PlatformWorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createPlatformWorkflowInstance(input: PlatformWorkflowInstanceInput): Promise<PlatformWorkflowInstanceRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const now = new Date().toISOString()
    const data = {
      designId: input.designId,
      status: input.status ?? 'pending',
      currentState: input.currentState,
      context: input.context,
      triggerBy: input.triggerBy,
      namespace: 'platform',
      companyId: input.companyId,
      createdAt: now,
      updatedAt: now
    }
    const [created] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>(
      'CREATE workflow_instances CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePlatformWorkflowInstanceStatus(
  id: string,
  status: WorkflowInstanceStatus,
  currentState?: string
): Promise<PlatformWorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data: { status: WorkflowInstanceStatus; currentState?: string; updatedAt: string } = {
      status,
      updatedAt: new Date().toISOString()
    }
    if (currentState !== undefined) {
      data.currentState = currentState
    }
    const [updated] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deletePlatformWorkflowInstance(id: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export type PlatformUserTaskStatus = 'pending' | 'completed' | 'cancelled' | 'rejected'
export type PlatformUserTaskType = 'approval' | 'review' | 'manual'

export interface PlatformUserTaskRecord {
  id: string
  instanceId: string
  type: PlatformUserTaskType
  status: PlatformUserTaskStatus
  tableName: string
  recordId: string
  designId: string
  createdAt: string
  resolvedAt?: string
  [key: string]: unknown
}

export interface PlatformUserTaskInput {
  instanceId: string
  type: PlatformUserTaskType
  tableName: string
  recordId: string
  designId: string
}

export async function listPlatformUserTasks(): Promise<PlatformUserTaskRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [tasks] = await surreal.query<[PlatformUserTaskRecord[]]>('SELECT * FROM user_tasks ORDER BY createdAt DESC')
    return normalizeIds(tasks)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformUserTaskById(id: string): Promise<PlatformUserTaskRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformUserTaskRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createPlatformUserTask(input: PlatformUserTaskInput): Promise<PlatformUserTaskRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data = {
      ...input,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[PlatformUserTaskRecord[]]>(
      'CREATE user_tasks CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePlatformUserTaskStatus(
  id: string,
  status: PlatformUserTaskStatus
): Promise<PlatformUserTaskRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const terminalStatuses: PlatformUserTaskStatus[] = ['completed', 'rejected', 'cancelled']
    const data: { status: PlatformUserTaskStatus; resolvedAt?: string } = { status }
    if (terminalStatuses.includes(status)) {
      data.resolvedAt = new Date().toISOString()
    }
    const [updated] = await surreal.query<[PlatformUserTaskRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deletePlatformUserTask(id: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
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
        console.warn(`listCompaniesForProfile: skipping company ${company.id} (${company.namespace}):`, err)
        return null
      }
    })
  )
  return memberships.filter((c): c is CompanyRecord => c !== null)
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
