import { Hono } from 'hono'
import type { WorkflowDefinition, StartRule } from 'shared'
import {
  listPlatformWorkflowDesigns,
  createPlatformWorkflowDesign,
  getPlatformWorkflowDesign,
  updatePlatformWorkflowDesign,
  deletePlatformWorkflowDesign,
} from 'db/platform'
import { adminAuth } from '../middleware/admin.js'

export function adminWorkflowDesignsRoutes() {
  const app = new Hono()
  app.use(adminAuth())

  app.get('/', async (c) => {
    return c.json(await listPlatformWorkflowDesigns())
  })

  app.post('/', async (c) => {
    let body: { name?: string; xstateConfig?: WorkflowDefinition; starts?: StartRule[] }
    try {
      body = await c.req.json<{ name?: string; xstateConfig?: WorkflowDefinition; starts?: StartRule[] }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    if (!body.name) {
      return c.json({ error: 'Name required' }, 400)
    }
    return c.json(await createPlatformWorkflowDesign({
      name: body.name,
      xstateConfig: body.xstateConfig as WorkflowDefinition,
      starts: body.starts ?? []
    }))
  })

  app.get('/:id', async (c) => {
    const id = c.req.param('id')
    const workflow = await getPlatformWorkflowDesign(id)
    if (!workflow) {
      return c.json({ error: 'Workflow design not found' }, 404)
    }
    return c.json(workflow)
  })

  app.patch('/:id', async (c) => {
    const id = c.req.param('id')
    const existing = await getPlatformWorkflowDesign(id)
    if (!existing) {
      return c.json({ error: 'Workflow design not found' }, 404)
    }
    let body: { name?: string; xstateConfig?: WorkflowDefinition; starts?: StartRule[] }
    try {
      body = await c.req.json<{ name?: string; xstateConfig?: WorkflowDefinition; starts?: StartRule[] }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    return c.json(
      await updatePlatformWorkflowDesign(id, {
        name: body.name,
        xstateConfig: body.xstateConfig as WorkflowDefinition,
        starts: body.starts,
      })
    )
  })

  app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    const existing = await getPlatformWorkflowDesign(id)
    if (!existing) {
      return c.json({ error: 'Workflow design not found' }, 404)
    }
    await deletePlatformWorkflowDesign(id)
    return c.json({ ok: true })
  })

  return app
}
