import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import type { WorkflowDefinition } from 'shared'

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

export interface WorkflowRecord {
  id: string
  name: string
  xstateConfig: WorkflowDefinition
  [key: string]: unknown
}

export interface WorkflowInput {
  name: string
  xstateConfig: WorkflowDefinition
}

export async function listWorkflows(namespace: string): Promise<WorkflowRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [workflows] = await surreal.query<[WorkflowRecord[]]>('SELECT * FROM workflows')
    return normalizeIds(workflows)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createWorkflow(namespace: string, input: WorkflowInput): Promise<WorkflowRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = {
      name: input.name,
      xstateConfig: input.xstateConfig
    }
    const [created] = await surreal.query<[WorkflowRecord[]]>('CREATE workflows CONTENT $data', { data })
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getWorkflow(namespace: string, id: string): Promise<WorkflowRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[WorkflowRecord[]]>('SELECT * FROM type::record($id)', { id })
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateWorkflow(namespace: string, id: string, input: Partial<WorkflowInput>): Promise<WorkflowRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [updated] = await surreal.query<[WorkflowRecord[]]>('UPDATE type::record($id) MERGE $data', { id, data: input })
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteWorkflow(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export interface TriggerRecord {
  id: string
  tableName: string
  event: string
  workflowId: string
  [key: string]: unknown
}

export interface TriggerInput {
  tableName: string
  event: string
  workflowId: string
}

export async function listTriggers(namespace: string): Promise<TriggerRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [triggers] = await surreal.query<[TriggerRecord[]]>('SELECT * FROM triggers')
    return normalizeIds(triggers)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createTrigger(namespace: string, input: TriggerInput): Promise<TriggerRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = {
      tableName: input.tableName,
      event: input.event,
      workflowId: input.workflowId
    }
    const [created] = await surreal.query<[TriggerRecord[]]>('CREATE triggers CONTENT $data', { data })
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteTrigger(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export type WorkflowInstanceStatus = 'pending' | 'running' | 'waiting' | 'done' | 'error'

export interface WorkflowInstanceRecord {
  id: string
  workflowId: string
  tableName: string
  recordId: string
  namespace: string
  companyId?: string
  status: WorkflowInstanceStatus
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface WorkflowInstanceInput {
  workflowId: string
  status: WorkflowInstanceStatus
  tableName: string
  recordId: string
  namespace: string
  companyId?: string
  context?: Record<string, unknown>
}

export async function listWorkflowInstances(namespace: string): Promise<WorkflowInstanceRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [instances] = await surreal.query<[WorkflowInstanceRecord[]]>('SELECT * FROM workflow_instances ORDER BY createdAt DESC')
    return normalizeIds(instances)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getWorkflowInstance(namespace: string, id: string): Promise<WorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[WorkflowInstanceRecord[]]>('SELECT * FROM type::record($id)', { id })
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function findActiveWorkflowInstance(
  namespace: string,
  workflowId: string,
  tableName: string,
  recordId: string
): Promise<WorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[WorkflowInstanceRecord[]]>(
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

export async function createWorkflowInstance(namespace: string, input: WorkflowInstanceInput): Promise<WorkflowInstanceRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const now = new Date().toISOString()
    const data = {
      ...input,
      status: input.status ?? 'pending',
      createdAt: now,
      updatedAt: now
    }
    const [created] = await surreal.query<[WorkflowInstanceRecord[]]>('CREATE workflow_instances CONTENT $data', { data })
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteWorkflowInstance(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateWorkflowInstanceStatus(
  namespace: string,
  id: string,
  status: WorkflowInstanceStatus
): Promise<WorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [updated] = await surreal.query<[WorkflowInstanceRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data: { status, updatedAt: new Date().toISOString() } }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export type UserTaskStatus = 'pending' | 'completed' | 'cancelled' | 'rejected'
export type UserTaskType = 'approval' | 'review' | 'manual'

export interface UserTaskRecord {
  id: string
  instanceId: string
  type: UserTaskType
  status: UserTaskStatus
  tableName: string
  recordId: string
  workflowId: string
  createdAt: string
  resolvedAt?: string
  [key: string]: unknown
}

export interface UserTaskInput {
  instanceId: string
  type: UserTaskType
  tableName: string
  recordId: string
  workflowId: string
  status?: UserTaskStatus
}

export async function listUserTasks(namespace: string): Promise<UserTaskRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [tasks] = await surreal.query<[UserTaskRecord[]]>('SELECT * FROM user_tasks ORDER BY createdAt DESC')
    return normalizeIds(tasks)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getUserTaskById(namespace: string, id: string): Promise<UserTaskRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[UserTaskRecord[]]>('SELECT * FROM type::record($id)', { id })
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createUserTask(namespace: string, input: UserTaskInput): Promise<UserTaskRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = {
      ...input,
      status: input.status ?? 'pending',
      createdAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[UserTaskRecord[]]>('CREATE user_tasks CONTENT $data', { data })
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateUserTaskStatus(
  namespace: string,
  id: string,
  status: UserTaskStatus
): Promise<UserTaskRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const terminalStatuses: UserTaskStatus[] = ['completed', 'rejected', 'cancelled']
    const data: { status: UserTaskStatus; resolvedAt?: string } = { status }
    if (terminalStatuses.includes(status)) {
      data.resolvedAt = new Date().toISOString()
    }
    const [updated] = await surreal.query<[UserTaskRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteUserTask(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}
