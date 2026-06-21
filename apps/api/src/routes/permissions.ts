import { Hono } from 'hono'
import { RESOURCE_CATALOG } from 'shared'

const app = new Hono()

app.get('/actions', (c) => {
    const resourceType = c.req.query('resourceType')
    if (!resourceType || !(resourceType in RESOURCE_CATALOG)) {
      return c.json({ error: 'Invalid or missing resourceType' }, 400)
    }
    const def = RESOURCE_CATALOG[resourceType as keyof typeof RESOURCE_CATALOG]
    const result = def.bitMapping.map((entry) => ({
      action: entry.name,
      value: entry.bit,
    }))
    return c.json({ resourceType, actions: result })
  })

export const permissionsRoutes = app
