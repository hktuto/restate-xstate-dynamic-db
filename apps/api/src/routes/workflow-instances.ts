import { Hono } from 'hono'
import { updateWorkflowInstanceStatus, getWorkflowInstance } from 'db/tenant'
import type { WorkflowInstanceStatus } from 'db/tenant'

const VALID_STATUSES: WorkflowInstanceStatus[] = ['pending', 'running', 'waiting', 'done', 'error']

export function workflowInstancesRoutes() {
  const app = new Hono()

  app.patch('/:id/status', async (c) => {
    const id = c.req.param('id')
    if (!id) {
      return c.json({ error: 'ID required' }, 400)
    }

    let body: { status?: WorkflowInstanceStatus; namespace?: string; database?: string }
    try {
      body = await c.req.json<{ status?: WorkflowInstanceStatus; namespace?: string; database?: string }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    const bodyNamespace = body.namespace
    if (!bodyNamespace) {
      return c.json({ error: 'Namespace required' }, 400)
    }
    // Database is accepted for symmetry but tenant DB helpers currently use 'main'.
    void body.database

    const existing = await getWorkflowInstance(bodyNamespace, id)
    if (!existing) {
      return c.json({ error: 'Instance not found' }, 404)
    }

    if (existing.namespace && existing.namespace !== bodyNamespace) {
      return c.json({ error: 'Namespace mismatch' }, 403)
    }

    const updated = await updateWorkflowInstanceStatus(bodyNamespace, id, body.status)
    return c.json(updated)
  })

  return app
}
