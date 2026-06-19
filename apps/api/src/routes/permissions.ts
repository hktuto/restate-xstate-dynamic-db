import { Hono } from 'hono'
import { RESOURCE_ACTIONS } from 'shared'

export function permissionsRoutes() {
  const app = new Hono()

  app.get('/actions', (c) => {
    const resourceType = c.req.query('resourceType')
    if (!resourceType || !(resourceType in RESOURCE_ACTIONS)) {
      return c.json({ error: 'Invalid or missing resourceType' }, 400)
    }
    const actions = RESOURCE_ACTIONS[resourceType as keyof typeof RESOURCE_ACTIONS]
    const result = actions.map((action, i) => ({
      action,
      value: Number(1n << BigInt(i)),
    }))
    return c.json({ resourceType, actions: result })
  })

  return app
}
