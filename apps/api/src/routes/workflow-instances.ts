import { Hono } from 'hono'
import { updateWorkflowInstanceStatus, getWorkflowInstance, getWorkflowDesign } from 'db/tenant'
import type { WorkflowInstanceStatus } from 'db/tenant'
import { tenantAuth } from '../middleware/tenant.js'
import type { TenantScope } from '../types.js'
import { dispatchUserTrigger } from '../lib/dispatch.js'

const VALID_STATUSES: WorkflowInstanceStatus[] = ['pending', 'running', 'waiting', 'done', 'error']

const app = new Hono()

app.post('/', tenantAuth, async (c) => {
    const scope = c.get('scope') as TenantScope
    let body: { designId?: string; values?: unknown }
    try {
      body = await c.req.json<{ designId?: string; values?: unknown }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    if (!body.designId) return c.json({ error: 'designId required' }, 400)
    if (typeof body.values !== 'object' || body.values === null) {
      return c.json({ error: 'values must be an object' }, 400)
    }

    const design = await getWorkflowDesign(scope.namespace, body.designId)
    if (!design) return c.json({ error: 'Design not found' }, 404)

    const rule = design.starts?.find((s) => s.type === 'user_trigger')
    if (!rule) return c.json({ error: 'Design has no user trigger' }, 400)

    try {
      const instance = await dispatchUserTrigger(scope.namespace, design, rule, body.values as Record<string, unknown>, scope.profileId, scope.database)
      return c.json({ id: instance.id })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.startsWith('Missing required input:')) {
        return c.json({ error: message }, 400)
      }
      throw err
    }
  })

app.patch('/:id/status', async (c) => {
    const id = c.req.param('id')
    if (!id) {
      return c.json({ error: 'ID required' }, 400)
    }

    let body: { status?: WorkflowInstanceStatus; currentState?: string; namespace?: string; database?: string }
    try {
      body = await c.req.json<{ status?: WorkflowInstanceStatus; currentState?: string; namespace?: string; database?: string }>()
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

    const updated = await updateWorkflowInstanceStatus(bodyNamespace, id, body.status, body.currentState)
    return c.json(updated)
  })

export const workflowInstancesRoutes = app
