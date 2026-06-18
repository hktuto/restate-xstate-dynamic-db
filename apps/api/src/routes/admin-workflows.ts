import { Hono } from 'hono'
import type { WorkflowDefinition } from 'shared'
import {
  listPlatformWorkflows,
  createPlatformWorkflow,
  getPlatformWorkflow,
  updatePlatformWorkflow,
  deletePlatformWorkflow,
} from 'db/platform'
import { adminAuth } from '../middleware/admin.js'

export function adminWorkflowsRoutes() {
  const app = new Hono()
  app.use(adminAuth('nsdb'))

  app.get('/', async (c) => {
    return c.json(await listPlatformWorkflows())
  })

  app.post('/', async (c) => {
    let body: { name?: string; xstateConfig?: WorkflowDefinition }
    try {
      body = await c.req.json<{ name?: string; xstateConfig?: WorkflowDefinition }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    if (!body.name) {
      return c.json({ error: 'Name required' }, 400)
    }
    return c.json(
      await createPlatformWorkflow({
        name: body.name,
        xstateConfig: body.xstateConfig as WorkflowDefinition,
      })
    )
  })

  app.get('/:id', async (c) => {
    const id = c.req.param('id')
    const workflow = await getPlatformWorkflow(id)
    if (!workflow) {
      return c.json({ error: 'Workflow not found' }, 404)
    }
    return c.json(workflow)
  })

  app.patch('/:id', async (c) => {
    const id = c.req.param('id')
    let body: { name?: string; xstateConfig?: WorkflowDefinition }
    try {
      body = await c.req.json<{ name?: string; xstateConfig?: WorkflowDefinition }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    return c.json(
      await updatePlatformWorkflow(id, {
        name: body.name,
        xstateConfig: body.xstateConfig as WorkflowDefinition,
      })
    )
  })

  app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    await deletePlatformWorkflow(id)
    return c.json({ ok: true })
  })

  return app
}
