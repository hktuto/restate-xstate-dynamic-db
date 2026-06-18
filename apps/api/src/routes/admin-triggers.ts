import { Hono } from 'hono'
import {
  listPlatformTriggers,
  createPlatformTrigger,
  deletePlatformTrigger,
  getPlatformWorkflow,
} from 'db/platform'
import { adminAuth } from '../middleware/admin.js'

export function adminTriggersRoutes() {
  const app = new Hono()
  app.use(adminAuth('nsdb'))

  app.get('/', async (c) => {
    const triggers = await listPlatformTriggers()
    return c.json(
      await Promise.all(
        triggers.map(async (t) => {
          const workflow = await getPlatformWorkflow(t.workflowId)
          return { ...t, workflowName: workflow?.name ?? 'Unknown' }
        })
      )
    )
  })

  app.post('/', async (c) => {
    let body: { tableName?: string; event?: string; workflowId?: string }
    try {
      body = await c.req.json<{ tableName?: string; event?: string; workflowId?: string }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    if (!body.tableName || !body.event || !body.workflowId) {
      return c.json({ error: 'tableName, event, and workflowId required' }, 400)
    }
    return c.json(
      await createPlatformTrigger({
        tableName: body.tableName,
        event: body.event,
        workflowId: body.workflowId,
      })
    )
  })

  app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    await deletePlatformTrigger(id)
    return c.json({ ok: true })
  })

  return app
}
