import { Hono } from 'hono'
import {
  listWorkflowDesigns,
  createWorkflowDesign,
  getWorkflowDesign,
  updateWorkflowDesign,
  deleteWorkflowDesign,
} from 'db/tenant'
import type { WorkflowDefinition, StartRule } from 'shared'
import { tenantAuth } from '../middleware/tenant.js'
import type { TenantScope } from '../types.js'

function requireRole(scope: TenantScope, roles: Array<'owner' | 'admin' | 'member'>) {
  if (!roles.includes(scope.role)) {
    return { error: 'Forbidden', status: 403 } as const
  }
  return null
}

export function workflowDesignsRoutes() {
  const app = new Hono()
  app.use(tenantAuth)

  app.get('/', async (c) => {
    const scope = c.get('scope') as TenantScope
    return c.json(await listWorkflowDesigns(scope.namespace))
  })

  app.post('/', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    let body: { name?: string; xstateConfig?: WorkflowDefinition; starts?: StartRule[] }
    try {
      body = await c.req.json<{ name?: string; xstateConfig?: WorkflowDefinition; starts?: StartRule[] }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    if (!body.name) return c.json({ error: 'Name required' }, 400)
    return c.json(await createWorkflowDesign(scope.namespace, {
      name: body.name,
      xstateConfig: body.xstateConfig as WorkflowDefinition,
      starts: body.starts ?? []
    }))
  })

  app.get('/:id', async (c) => {
    const scope = c.get('scope') as TenantScope
    const id = c.req.param('id')
    const workflowDesign = await getWorkflowDesign(scope.namespace, id)
    if (!workflowDesign) {
      return c.json({ error: 'Workflow design not found' }, 404)
    }
    return c.json(workflowDesign)
  })

  app.patch('/:id', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    const id = c.req.param('id')
    const existing = await getWorkflowDesign(scope.namespace, id)
    if (!existing) {
      return c.json({ error: 'Workflow design not found' }, 404)
    }

    let body: { name?: string; xstateConfig?: WorkflowDefinition; starts?: StartRule[] }
    try {
      body = await c.req.json<{ name?: string; xstateConfig?: WorkflowDefinition; starts?: StartRule[] }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    return c.json(await updateWorkflowDesign(scope.namespace, id, {
      name: body.name,
      xstateConfig: body.xstateConfig as WorkflowDefinition,
      starts: body.starts,
    }))
  })

  app.delete('/:id', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    const id = c.req.param('id')
    const existing = await getWorkflowDesign(scope.namespace, id)
    if (!existing) {
      return c.json({ error: 'Workflow design not found' }, 404)
    }

    await deleteWorkflowDesign(scope.namespace, id)
    return c.json({ ok: true })
  })

  return app
}
