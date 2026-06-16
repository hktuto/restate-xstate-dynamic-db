import { updateWorkflowInstanceStatus, getWorkflowInstance } from 'db/tenant'
import type { WorkflowInstanceStatus } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id', { decode: true })
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID required' })
  }

  const body = await readBody<{ status: WorkflowInstanceStatus; namespace?: string }>(event)

  const validStatuses: WorkflowInstanceStatus[] = ['pending', 'running', 'waiting', 'done', 'error']
  if (!validStatuses.includes(body.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }

  const bodyNamespace = body.namespace
  const contextNamespace = event.context.company?.namespace
  const namespace = contextNamespace ?? bodyNamespace
  if (!namespace) {
    throw createError({ statusCode: 400, statusMessage: 'Namespace required' })
  }
  if (contextNamespace && bodyNamespace && contextNamespace !== bodyNamespace) {
    throw createError({ statusCode: 403, statusMessage: 'Namespace mismatch' })
  }

  const existing = await getWorkflowInstance(namespace, id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Instance not found' })

  const updated = await updateWorkflowInstanceStatus(namespace, id, body.status)
  return updated
})
