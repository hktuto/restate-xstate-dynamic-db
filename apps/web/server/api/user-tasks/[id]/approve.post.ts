import { getUserTaskById, updateUserTaskStatus } from 'db/tenant'
import { requireTenantSession } from '#server/utils/auth'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

export default defineEventHandler(async (event) => {
  requireTenantSession(event)

  const id = getRouterParam(event, 'id', { decode: true })
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID required' })
  }
  const namespace = event.context.company.namespace

  const task = await getUserTaskById(namespace, id)
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  // The workflow's XState machine ignores events that don't match a transition from the current state,
  // but we avoid duplicate sends by rejecting non-pending tasks.
  if (task.status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: `Task is already ${task.status}` })
  }

  const res = await fetch(`${RESTATE_INGRESS}/workflow/${task.instanceId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'approve' })
  })
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `Workflow send failed: ${res.status}` })
  }

  await updateUserTaskStatus(namespace, id, 'completed')
  return { ok: true }
})
