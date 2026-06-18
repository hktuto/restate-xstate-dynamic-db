import { Hono } from 'hono'
import { listWorkflows, createWorkflow, getWorkflow, updateWorkflow, deleteWorkflow } from 'db/tenant'
import type { WorkflowDefinition } from 'shared'
import { tenantAuth } from '../middleware/tenant.js'
import type { TenantScope } from '../types.js'

function requireRole(scope: TenantScope, roles: Array<'owner' | 'admin' | 'member'>) {
  if (!roles.includes(scope.role)) {
    return { error: 'Forbidden', status: 403 } as const
  }
  return null
}

export function workflowsRoutes() {
  const app = new Hono()
  app.use(tenantAuth)

  app.get('/', async (c) => {
    const scope = c.get('scope') as TenantScope
    return c.json(await listWorkflows(scope.namespace))
  })

  app.post('/', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    let body: { name?: string; xstateConfig?: WorkflowDefinition }
    try {
      body = await c.req.json<{ name?: string; xstateConfig?: WorkflowDefinition }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    if (!body.name) {
      return c.json({ error: 'Name required' }, 400)
    }

    const record = await createWorkflow(scope.namespace, {
      name: body.name,
      xstateConfig: body.xstateConfig as WorkflowDefinition,
    })
    return c.json(record)
  })

  app.get('/:id', async (c) => {
    const scope = c.get('scope') as TenantScope
    const id = c.req.param('id')
    const workflow = await getWorkflow(scope.namespace, id)
    if (!workflow) {
      return c.json({ error: `Workflow not found. ns=${scope.namespace} id=${id}` }, 404)
    }
    return c.json(workflow)
  })

  app.patch('/:id', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    const id = c.req.param('id')
    let body: { name?: string; xstateConfig?: WorkflowDefinition }
    try {
      body = await c.req.json<{ name?: string; xstateConfig?: WorkflowDefinition }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    const record = await updateWorkflow(scope.namespace, id, {
      name: body.name,
      xstateConfig: body.xstateConfig as WorkflowDefinition,
    })
    return c.json(record)
  })

  app.delete('/:id', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    const id = c.req.param('id')
    await deleteWorkflow(scope.namespace, id)
    return c.json({ ok: true })
  })

  return app
}
