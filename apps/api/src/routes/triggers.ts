import { Hono } from 'hono'
import { listTriggers, getWorkflow, createTrigger, deleteTrigger } from 'db/tenant'
import { tenantAuth } from '../middleware/tenant.js'
import type { TenantScope } from '../types.js'

function requireRole(scope: TenantScope, roles: Array<'owner' | 'admin' | 'member'>) {
  if (!roles.includes(scope.role)) {
    return { error: 'Forbidden', status: 403 } as const
  }
  return null
}

export function triggersRoutes() {
  const app = new Hono()
  app.use(tenantAuth)

  app.get('/', async (c) => {
    const scope = c.get('scope') as TenantScope
    const triggers = await listTriggers(scope.namespace)
    return c.json(
      await Promise.all(
        triggers.map(async (t) => {
          const workflow = await getWorkflow(scope.namespace, t.workflowId)
          return { ...t, workflowName: workflow?.name ?? 'Unknown' }
        })
      )
    )
  })

  app.post('/', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    let body: { tableName?: string; event?: string; workflowId?: string }
    try {
      body = await c.req.json<{ tableName?: string; event?: string; workflowId?: string }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    if (!body.tableName || !body.event || !body.workflowId) {
      return c.json({ error: 'tableName, event, and workflowId required' }, 400)
    }

    const record = await createTrigger(scope.namespace, {
      tableName: body.tableName,
      event: body.event,
      workflowId: body.workflowId,
    })
    return c.json(record)
  })

  app.delete('/:id', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    const id = c.req.param('id')
    await deleteTrigger(scope.namespace, id)
    return c.json({ ok: true })
  })

  return app
}
