import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import * as Crud from './crud.js'

export interface MemberRecord {
  id: string
  profileId?: string
  email: string
  role: 'owner' | 'admin' | 'member'
  status: 'pending' | 'active' | 'inactive'
  inviteCode?: string
  joinedAt?: string
  invitedBy?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface MemberInput {
  email: string
  role: 'owner' | 'admin' | 'member'
  status?: 'pending' | 'active' | 'inactive'
  inviteCode?: string | null
  invitedBy?: string
  profileId?: string
  joinedAt?: string
}

export async function listMembers(namespace: string): Promise<MemberRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [members] = await surreal.query<[MemberRecord[]]>('SELECT * FROM members')
    return normalizeIds(members)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createMember(namespace: string, input: MemberInput): Promise<MemberRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = {
      ...input,
      status: input.status ?? 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[MemberRecord[]]>('CREATE members CONTENT $data', { data })
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getMemberById(namespace: string, id: string): Promise<MemberRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[MemberRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getMemberByProfileId(
  namespace: string,
  profileId: string
): Promise<MemberRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[MemberRecord[]]>(
      'SELECT * FROM members WHERE profileId = $profileId LIMIT 1',
      { profileId }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getMemberByInviteCode(
  namespace: string,
  inviteCode: string
): Promise<MemberRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[MemberRecord[]]>(
      'SELECT * FROM members WHERE inviteCode = $inviteCode LIMIT 1',
      { inviteCode }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateMember(
  namespace: string,
  id: string,
  input: Partial<MemberInput>
): Promise<MemberRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = {
      ...input,
      updatedAt: new Date().toISOString()
    }
    const [updated] = await surreal.query<[MemberRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteMember(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export type { WorkflowDesignRecord, WorkflowDesignInput } from './crud.js'

export async function listWorkflowDesigns(namespace: string): Promise<Crud.WorkflowDesignRecord[]> {
  return Crud.listWorkflowDesigns(namespace, 'main')
}

export async function createWorkflowDesign(namespace: string, input: Crud.WorkflowDesignInput): Promise<Crud.WorkflowDesignRecord> {
  return Crud.createWorkflowDesign(namespace, 'main', input)
}

export async function getWorkflowDesign(namespace: string, id: string): Promise<Crud.WorkflowDesignRecord | undefined> {
  return Crud.getWorkflowDesign(namespace, 'main', id)
}

export async function updateWorkflowDesign(
  namespace: string,
  id: string,
  input: Partial<Crud.WorkflowDesignInput>
): Promise<Crud.WorkflowDesignRecord | undefined> {
  return Crud.updateWorkflowDesign(namespace, 'main', id, input)
}

export async function deleteWorkflowDesign(namespace: string, id: string): Promise<void> {
  return Crud.deleteWorkflowDesign(namespace, 'main', id)
}

export type { WorkflowInstanceStatus } from './crud.js'
export type { WorkflowInstanceRecord, WorkflowInstanceInput } from './crud.js'

export async function listWorkflowInstances(namespace: string): Promise<Crud.WorkflowInstanceRecord[]> {
  return Crud.listWorkflowInstances(namespace, 'main')
}

export async function getWorkflowInstance(namespace: string, id: string): Promise<Crud.WorkflowInstanceRecord | undefined> {
  return Crud.getWorkflowInstance(namespace, 'main', id)
}

export async function createWorkflowInstance(namespace: string, input: Crud.WorkflowInstanceInput): Promise<Crud.WorkflowInstanceRecord> {
  return Crud.createWorkflowInstance(namespace, 'main', input)
}

export async function deleteWorkflowInstance(namespace: string, id: string): Promise<void> {
  return Crud.deleteWorkflowInstance(namespace, 'main', id)
}

export async function updateWorkflowInstanceStatus(
  namespace: string,
  id: string,
  status: Crud.WorkflowInstanceStatus,
  currentState?: string
): Promise<Crud.WorkflowInstanceRecord | undefined> {
  return Crud.updateWorkflowInstanceStatus(namespace, 'main', id, status, currentState)
}

export type { UserTaskStatus, UserTaskType, UserTaskRecord, UserTaskInput } from './crud.js'

export async function listUserTasks(namespace: string): Promise<Crud.UserTaskRecord[]> {
  return Crud.listUserTasks(namespace, 'main')
}

export async function getUserTaskById(namespace: string, id: string): Promise<Crud.UserTaskRecord | undefined> {
  return Crud.getUserTaskById(namespace, 'main', id)
}

export async function createUserTask(namespace: string, input: Crud.UserTaskInput): Promise<Crud.UserTaskRecord> {
  return Crud.createUserTask(namespace, 'main', input)
}

export async function updateUserTaskStatus(
  namespace: string,
  id: string,
  status: Crud.UserTaskStatus
): Promise<Crud.UserTaskRecord | undefined> {
  return Crud.updateUserTaskStatus(namespace, 'main', id, status)
}

export async function deleteUserTask(namespace: string, id: string): Promise<void> {
  return Crud.deleteUserTask(namespace, 'main', id)
}

export interface CompanyPolicyRecord {
  id: string
  companyId: string
  maxSessions?: number | null
  sessionOverflowAction?: 'revoke_oldest' | 'reject'
  allowImpersonation?: boolean
  allowApiKeys?: boolean
  [key: string]: unknown
}

export async function getCompanyPolicy(namespace: string, companyId: string): Promise<CompanyPolicyRecord | null> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[CompanyPolicyRecord[]]>(
      'SELECT * FROM company_policies WHERE companyId = $companyId LIMIT 1',
      { companyId }
    )
    return normalizeId(rows[0]) ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export async function ensureCompanyPolicy(namespace: string, companyId: string): Promise<CompanyPolicyRecord> {
  const existing = await getCompanyPolicy(namespace, companyId)
  if (existing) return existing
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[CompanyPolicyRecord[]]>(
      'CREATE company_policies CONTENT $data RETURN *',
      {
        data: {
          companyId,
          maxSessions: null,
          sessionOverflowAction: 'revoke_oldest',
          allowImpersonation: true,
          allowApiKeys: true
        }
      }
    )
    return normalizeId(rows[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export interface TenantSessionRecord {
  id: string
  platformSessionId: string
  memberId: string
  profileId: string
  email: string
  companyId: string
  type: 'user' | 'impersonation'
  impersonatorId?: string
  deviceFingerprint?: string
  deviceName?: string
  ip?: string
  userAgent?: string
  lastUsedAt: string
  revokedAt?: string
  revokeReason?: string
  [key: string]: unknown
}

export interface CreateTenantSessionInput {
  platformSessionId: string
  memberId: string
  profileId: string
  email: string
  companyId: string
  type?: 'user' | 'impersonation'
  impersonatorId?: string
  deviceFingerprint?: string
  deviceName?: string
  ip?: string
  userAgent?: string
}

export async function createTenantSession(namespace: string, input: CreateTenantSessionInput): Promise<TenantSessionRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[TenantSessionRecord[]]>(
      'CREATE sessions CONTENT $data RETURN *',
      { data: { ...input, type: input.type ?? 'user', lastUsedAt: new Date().toISOString() } }
    )
    return normalizeId(rows[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getTenantSessionById(namespace: string, sessionId: string): Promise<TenantSessionRecord | null> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[TenantSessionRecord[]]>(
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

export async function getActiveTenantSessionByPlatformSessionId(
  namespace: string,
  platformSessionId: string,
  companyId: string
): Promise<TenantSessionRecord | null> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[TenantSessionRecord[]]>(
      'SELECT * FROM sessions WHERE platformSessionId = $platformSessionId AND companyId = $companyId AND revokedAt IS NONE LIMIT 1',
      { platformSessionId, companyId }
    )
    return normalizeId(rows[0]) ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export async function touchTenantSession(namespace: string, sessionId: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query(
      'UPDATE type::record($id) SET lastUsedAt = $now',
      { id: sessionId, now: new Date().toISOString() }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function revokeTenantSession(namespace: string, sessionId: string, reason?: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
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

export async function revokeTenantSessionsByPlatformSessionId(namespace: string, platformSessionId: string, reason?: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    if (reason) {
      await surreal.query(
        'UPDATE sessions SET revokedAt = $now, revokeReason = $reason WHERE platformSessionId = $platformSessionId AND revokedAt IS NONE',
        { platformSessionId, now: new Date().toISOString(), reason }
      )
    } else {
      await surreal.query(
        'UPDATE sessions SET revokedAt = $now WHERE platformSessionId = $platformSessionId AND revokedAt IS NONE',
        { platformSessionId, now: new Date().toISOString() }
      )
    }
  } finally {
    await closeSurreal(surreal)
  }
}

export async function countActiveTenantSessions(namespace: string, memberId: string): Promise<number> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[{ count: number }[]]>(
      'SELECT count() FROM sessions WHERE memberId = $memberId AND revokedAt IS NONE GROUP ALL',
      { memberId }
    )
    return Number(rows[0]?.count ?? 0)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function findOldestActiveTenantSession(namespace: string, memberId: string): Promise<TenantSessionRecord | null> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[TenantSessionRecord[]]>(
      'SELECT * FROM sessions WHERE memberId = $memberId AND revokedAt IS NONE ORDER BY lastUsedAt ASC LIMIT 1',
      { memberId }
    )
    return normalizeId(rows[0]) ?? null
  } finally {
    await closeSurreal(surreal)
  }
}
