import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import type { Surreal } from 'surrealdb'
import type { WorkflowDefinition, StartRule, TriggerBy } from 'shared'

export async function withSurreal<T>(
  namespace: string,
  database: string,
  fn: (surreal: Surreal) => Promise<T>
): Promise<T> {
  const surreal = await getSurreal(namespace, database)
  try {
    return await fn(surreal)
  } finally {
    await closeSurreal(surreal)
  }
}

export type WorkflowInstanceStatus = 'pending' | 'running' | 'waiting' | 'done' | 'error'

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

export async function listWorkflowDesigns(namespace: string, database: string): Promise<WorkflowDesignRecord[]> {
  return withSurreal(namespace, database, async (surreal) => {
    const [designs] = await surreal.query<[WorkflowDesignRecord[]]>('SELECT * FROM workflow_designs')
    return normalizeIds(designs)
  })
}

export async function createWorkflowDesign(
  namespace: string,
  database: string,
  input: WorkflowDesignInput
): Promise<WorkflowDesignRecord> {
  return withSurreal(namespace, database, async (surreal) => {
    const data = {
      name: input.name,
      xstateConfig: input.xstateConfig,
      starts: input.starts
    }
    const [created] = await surreal.query<[WorkflowDesignRecord[]]>('CREATE workflow_designs CONTENT $data', { data })
    return normalizeId(created[0])!
  })
}

export async function getWorkflowDesign(
  namespace: string,
  database: string,
  id: string
): Promise<WorkflowDesignRecord | undefined> {
  return withSurreal(namespace, database, async (surreal) => {
    const [result] = await surreal.query<[WorkflowDesignRecord[]]>('SELECT * FROM type::record($id)', { id })
    return normalizeId(result[0])
  })
}

export async function updateWorkflowDesign(
  namespace: string,
  database: string,
  id: string,
  input: Partial<WorkflowDesignInput>
): Promise<WorkflowDesignRecord | undefined> {
  return withSurreal(namespace, database, async (surreal) => {
    const [updated] = await surreal.query<[WorkflowDesignRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data: input }
    )
    return normalizeId(updated[0])
  })
}

export async function deleteWorkflowDesign(namespace: string, database: string, id: string): Promise<void> {
  return withSurreal(namespace, database, async (surreal) => {
    await surreal.query('DELETE type::record($id)', { id })
  })
}

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

export async function listWorkflowInstances(namespace: string, database: string): Promise<WorkflowInstanceRecord[]> {
  return withSurreal(namespace, database, async (surreal) => {
    const [instances] = await surreal.query<[WorkflowInstanceRecord[]]>(
      'SELECT * FROM workflow_instances ORDER BY createdAt DESC'
    )
    return normalizeIds(instances)
  })
}

export async function getWorkflowInstance(
  namespace: string,
  database: string,
  id: string
): Promise<WorkflowInstanceRecord | undefined> {
  return withSurreal(namespace, database, async (surreal) => {
    const [result] = await surreal.query<[WorkflowInstanceRecord[]]>('SELECT * FROM type::record($id)', { id })
    return normalizeId(result[0])
  })
}

export async function createWorkflowInstance(
  namespace: string,
  database: string,
  input: WorkflowInstanceInput
): Promise<WorkflowInstanceRecord> {
  return withSurreal(namespace, database, async (surreal) => {
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
    const [created] = await surreal.query<[WorkflowInstanceRecord[]]>(
      'CREATE workflow_instances CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  })
}

export async function deleteWorkflowInstance(namespace: string, database: string, id: string): Promise<void> {
  return withSurreal(namespace, database, async (surreal) => {
    await surreal.query('DELETE type::record($id)', { id })
  })
}

export async function updateWorkflowInstanceStatus(
  namespace: string,
  database: string,
  id: string,
  status: WorkflowInstanceStatus,
  currentState?: string
): Promise<WorkflowInstanceRecord | undefined> {
  return withSurreal(namespace, database, async (surreal) => {
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
  })
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

export async function listUserTasks(namespace: string, database: string): Promise<UserTaskRecord[]> {
  return withSurreal(namespace, database, async (surreal) => {
    const [tasks] = await surreal.query<[UserTaskRecord[]]>('SELECT * FROM user_tasks ORDER BY createdAt DESC')
    return normalizeIds(tasks)
  })
}

export async function getUserTaskById(
  namespace: string,
  database: string,
  id: string
): Promise<UserTaskRecord | undefined> {
  return withSurreal(namespace, database, async (surreal) => {
    const [result] = await surreal.query<[UserTaskRecord[]]>('SELECT * FROM type::record($id)', { id })
    return normalizeId(result[0])
  })
}

export async function createUserTask(
  namespace: string,
  database: string,
  input: UserTaskInput
): Promise<UserTaskRecord> {
  return withSurreal(namespace, database, async (surreal) => {
    const data = {
      ...input,
      status: input.status ?? 'pending',
      createdAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[UserTaskRecord[]]>('CREATE user_tasks CONTENT $data', { data })
    return normalizeId(created[0])!
  })
}

export async function updateUserTaskStatus(
  namespace: string,
  database: string,
  id: string,
  status: UserTaskStatus
): Promise<UserTaskRecord | undefined> {
  return withSurreal(namespace, database, async (surreal) => {
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
  })
}

export async function deleteUserTask(namespace: string, database: string, id: string): Promise<void> {
  return withSurreal(namespace, database, async (surreal) => {
    await surreal.query('DELETE type::record($id)', { id })
  })
}
