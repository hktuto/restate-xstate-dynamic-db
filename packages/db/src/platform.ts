import { getSurreal, closeSurreal } from './client.js'
import type { WorkflowDefinition } from 'shared'

export interface CompanyInput {
  name: string
  slug: string
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
    return workflows
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
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformWorkflow(id: string): Promise<PlatformWorkflowRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformWorkflowRecord[]]>(
      'SELECT * FROM workflows WHERE id = $id LIMIT 1',
      { id }
    )
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePlatformWorkflow(id: string, input: Partial<PlatformWorkflowInput>): Promise<PlatformWorkflowRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [updated] = await surreal.query<[PlatformWorkflowRecord[]]>(
      'UPDATE $id MERGE $data',
      { id, data: input }
    )
    return updated[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deletePlatformWorkflow(id: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE $id', { id })
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
    return triggers
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
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deletePlatformTrigger(id: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE $id', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listCompanies(): Promise<CompanyRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [companies] = await surreal.query<[CompanyRecord[]]>('SELECT * FROM companies')
    return companies
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
      namespace: `company_${id}`,
      createdAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[CompanyRecord[]]>(
      'CREATE companies CONTENT $data',
      { data: record }
    )
    return created[0]
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
    return result[0]
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
    return result[0]
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
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getUserProfileById(id: string): Promise<UserProfileRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[UserProfileRecord[]]>(
      'SELECT * FROM user_profiles WHERE id = $id LIMIT 1',
      { id }
    )
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getUserProfilesByIds(ids: string[]): Promise<UserProfileRecord[]> {
  if (ids.length === 0) return []
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [profiles] = await surreal.query<[UserProfileRecord[]]>(
      'SELECT * FROM user_profiles WHERE id IN $ids',
      { ids }
    )
    return profiles ?? []
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
      'UPDATE $id MERGE $data',
      { id, data }
    )
    return updated[0]
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
    return created[0]
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
    return result[0]
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
      'UPDATE $id SET credential = $credential, updatedAt = $updatedAt',
      { id, credential, updatedAt: new Date().toISOString() }
    )
    return updated[0]
  } finally {
    await closeSurreal(surreal)
  }
}
