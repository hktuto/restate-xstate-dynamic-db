import { createUserTask } from 'db/tenant'
import type { UserTaskType } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ instanceId: string; type: UserTaskType; tableName: string; recordId: string; workflowId: string; namespace: string }>(event)
  const { instanceId, type, tableName, recordId, workflowId } = body
  if (!instanceId || !type || !tableName || !recordId || !workflowId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  const validTypes: UserTaskType[] = ['approval', 'review', 'manual']
  if (!validTypes.includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid task type' })
  }

  const namespace = event.context.company?.namespace ?? body.namespace
  if (!namespace) {
    throw createError({ statusCode: 400, statusMessage: 'Namespace required' })
  }

  const task = await createUserTask(namespace, { instanceId, type, tableName, recordId, workflowId })
  return task
})
