import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import type { WorkflowDefinition, StartRule, TriggerBy } from 'shared'

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

export interface WorkflowDesignRecord {
  id: string
  name: string
  xstateConfig: WorkflowDefinition
  starts?: StartRule[]
  [key: string]: unknown
}

export interface WorkflowDesignInput {
  name: string
  xstateConfig: WorkflowDefinition
  starts?: StartRule[]
}

export async function listWorkflowDesigns(namespace: string): Promise<WorkflowDesignRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [designs] = await surreal.query<[WorkflowDesignRecord[]]>('SELECT * FROM workflow_designs')
    return normalizeIds(designs)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createWorkflowDesign(namespace: string, input: WorkflowDesignInput): Promise<WorkflowDesignRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = {
      name: input.name,
      xstateConfig: input.xstateConfig,
      starts: input.starts
    }
    const [created] = await surreal.query<[WorkflowDesignRecord[]]>('CREATE workflow_designs CONTENT $data', { data })
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getWorkflowDesign(namespace: string, id: string): Promise<WorkflowDesignRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[WorkflowDesignRecord[]]>('SELECT * FROM type::record($id)', { id })
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateWorkflowDesign(namespace: string, id: string, input: Partial<WorkflowDesignInput>): Promise<WorkflowDesignRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [updated] = await surreal.query<[WorkflowDesignRecord[]]>('UPDATE type::record($id) MERGE $data', { id, data: input })
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteWorkflowDesign(namespace: string, id: string): Promise<void> {
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

export interface WorkflowInstanceInput {
  designId: string
  status?: WorkflowInstanceStatus
  currentState?: string
  context?: Record<string, unknown>
  triggerBy?: TriggerBy
  namespace: string
  companyId?: string
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

export async function createWorkflowInstance(namespace: string, input: WorkflowInstanceInput): Promise<WorkflowInstanceRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const now = new Date().toISOString()
    const data = {
      designId: input.designId,
      status: input.status ?? 'pending',
      currentState: input.currentState,
      context: input.context,
      triggerBy: input.triggerBy,
      namespace: input.namespace,
      companyId: input.companyId,
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
  status: WorkflowInstanceStatus,
  currentState?: string
): Promise<WorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data: { status: WorkflowInstanceStatus; currentState?: string; updatedAt: string } = {
      status,
      updatedAt: new Date().toISOString()
    }
    if (currentState !== undefined) {
      data.currentState = currentState
    }
    const [updated] = await surreal.query<[WorkflowInstanceRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
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
  designId: string
  createdAt: string
  resolvedAt?: string
  [key: string]: unknown
}

export interface UserTaskInput {
  instanceId: string
  type: UserTaskType
  tableName: string
  recordId: string
  designId: string
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
