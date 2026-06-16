import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import type { WorkflowDefinition } from 'shared'

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

export interface PlatformWorkflowRecord {
  id: string
  name: string
  xstateConfig: WorkflowDefinition
  [key: string]: unknown
}

export interface PlatformWorkflowInput {
  name: string
  xstateConfig: WorkflowDefinition
}

export async function listPlatformWorkflows(): Promise<PlatformWorkflowRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [workflows] = await surreal.query<[PlatformWorkflowRecord[]]>('SELECT * FROM workflows')
    return normalizeIds(workflows)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createPlatformWorkflow(input: PlatformWorkflowInput): Promise<PlatformWorkflowRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [created] = await surreal.query<[PlatformWorkflowRecord[]]>(
      'CREATE workflows CONTENT $data',
      { data: input }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformWorkflow(id: string): Promise<PlatformWorkflowRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformWorkflowRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePlatformWorkflow(id: string, input: Partial<PlatformWorkflowInput>): Promise<PlatformWorkflowRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [updated] = await surreal.query<[PlatformWorkflowRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data: input }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deletePlatformWorkflow(id: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export interface PlatformTriggerRecord {
  id: string
  tableName: string
  event: string
  workflowId: string
  [key: string]: unknown
}

export interface PlatformTriggerInput {
  tableName: string
  event: string
  workflowId: string
}

export async function listPlatformTriggers(): Promise<PlatformTriggerRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [triggers] = await surreal.query<[PlatformTriggerRecord[]]>('SELECT * FROM triggers')
    return normalizeIds(triggers)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createPlatformTrigger(input: PlatformTriggerInput): Promise<PlatformTriggerRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [created] = await surreal.query<[PlatformTriggerRecord[]]>(
      'CREATE triggers CONTENT $data',
      { data: input }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deletePlatformTrigger(id: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export type PlatformWorkflowInstanceStatus = 'pending' | 'running' | 'waiting' | 'done' | 'error'

export interface PlatformWorkflowInstanceRecord {
  id: string
  workflowId: string
  tableName: string
  recordId: string
  namespace: string
  companyId?: string
  status: PlatformWorkflowInstanceStatus
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface PlatformWorkflowInstanceInput {
  workflowId: string
  tableName: string
  recordId: string
  namespace: string
  companyId?: string
  status?: PlatformWorkflowInstanceStatus
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

export async function findActivePlatformWorkflowInstance(
  workflowId: string,
  tableName: string,
  recordId: string
): Promise<PlatformWorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>(
      `SELECT * FROM workflow_instances
       WHERE workflowId = $workflowId AND tableName = $tableName AND recordId = $recordId
       AND status IN ['pending', 'running', 'waiting']
       ORDER BY createdAt DESC
       LIMIT 1`,
      { workflowId, tableName, recordId }
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
      ...input,
      status: input.status ?? 'pending',
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
  status: PlatformWorkflowInstanceStatus
): Promise<PlatformWorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [updated] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data: { status, updatedAt: new Date().toISOString() } }
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
  workflowId: string
  createdAt: string
  resolvedAt?: string
  [key: string]: unknown
}

export interface PlatformUserTaskInput {
  instanceId: string
  type: PlatformUserTaskType
  tableName: string
  recordId: string
  workflowId: string
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
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [members] = await surreal.query<[Array<{ company: unknown }>]>(
      'SELECT company FROM members WHERE profile = $profileId OR profile = type::record($profileId)',
      { profileId }
    )
    const companyIds = (members ?? [])
      .map((m) => String(m.company))
      .filter((id): id is string => Boolean(id))
    if (companyIds.length === 0) return []

    const [companies] = await surreal.query<[CompanyRecord[]]>(
      'SELECT * FROM companies WHERE id IN array::map($ids, |$id| type::record($id))',
      { ids: companyIds }
    )
    return normalizeIds(companies ?? [])
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
