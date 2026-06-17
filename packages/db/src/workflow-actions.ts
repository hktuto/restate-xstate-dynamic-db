import { getSurreal, closeSurreal } from './client.js'

export interface WorkflowActionRecord {
  id: string
  instanceId: string
  workflowId: string
  stateId: string
  action: string
  params?: Record<string, unknown>
  status: 'started' | 'completed' | 'failed'
  inputContext?: Record<string, unknown>
  outputContext?: Record<string, unknown>
  outputData?: unknown
  resultEvent?: 'ok' | 'error' | 'true' | 'false'
  errorMessage?: string
  startedAt: string
  completedAt?: string
}

export async function upsertWorkflowAction(
  namespace: string,
  id: string,
  data: Omit<WorkflowActionRecord, 'id'>
): Promise<WorkflowActionRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[WorkflowActionRecord[]]>(
      'UPSERT type::record($id) CONTENT $data RETURN *',
      { id: `workflow_actions:${id}`, data }
    )
    return rows[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listWorkflowActionsByInstance(
  namespace: string,
  instanceId: string
): Promise<WorkflowActionRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[WorkflowActionRecord[]]>(
      'SELECT * FROM workflow_actions WHERE instanceId = $instanceId ORDER BY startedAt ASC',
      { instanceId }
    )
    return rows ?? []
  } finally {
    await closeSurreal(surreal)
  }
}
