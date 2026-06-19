import { Hono } from 'hono'
import { getPlatformWorkflowDesign } from 'db/platform'
import { adminAuth } from '../middleware/admin.js'
import type { AdminScope } from '../types.js'
import { dispatchPlatformUserTrigger } from '../lib/start-user-trigger.js'

export function adminWorkflowInstancesRoutes() {
  const app = new Hono()
  app.use(adminAuth())

  app.post('/', async (c) => {
    const scope = c.get('scope') as AdminScope
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

    const design = await getPlatformWorkflowDesign(body.designId)
    if (!design) return c.json({ error: 'Design not found' }, 404)

    const rule = design.starts?.find((s) => s.type === 'user_trigger')
    if (!rule) return c.json({ error: 'Design has no user trigger' }, 400)

    try {
      const instance = await dispatchPlatformUserTrigger(scope.namespace, design, rule, body.values as Record<string, unknown>, scope.userId, scope.database)
      return c.json({ id: instance.id })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.startsWith('Missing required input:')) {
        return c.json({ error: message }, 400)
      }
      throw err
    }
  })

  return app
}
