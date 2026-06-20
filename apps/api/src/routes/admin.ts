import { Hono } from 'hono'
import {
  listPlatformWorkflowDesigns,
  listCompanies,
} from 'db/platform'
import { listLatestHealthChecks, listHealthCheckHistoryForService, type HealthCheckService } from 'db/health-checks'
import { adminAuth } from '../middleware/admin.js'

const DEFAULT_LIMIT = 20
const VALID_SERVICES: HealthCheckService[] = ['surrealdb', 'restate', 'workflow-runtime', 'api']

export function adminRoutes() {
  const app = new Hono()
  app.use(adminAuth())

  // Health checks
  app.get('/health-checks', async (c) => {
    const latest = await listLatestHealthChecks()
    return c.json({ latest })
  })

  app.get('/health-checks/history', async (c) => {
    const service = c.req.query('service')
    if (typeof service !== 'string' || !VALID_SERVICES.includes(service as HealthCheckService)) {
      return c.json({ error: 'Missing or invalid service query parameter' }, 400)
    }

    const limit = parseInt(String(c.req.query('limit') ?? DEFAULT_LIMIT), 10)
    if (!Number.isFinite(limit) || limit <= 0 || Number.isNaN(limit)) {
      return c.json({ error: 'Invalid limit query parameter' }, 400)
    }

    const history = await listHealthCheckHistoryForService(service as HealthCheckService, limit)
    return c.json({
      service: service as HealthCheckService,
      limit,
      history,
    })
  })

  // Dashboard
  app.get('/dashboard', async (c) => {
    const [companies, workflowDesigns] = await Promise.all([
      listCompanies(),
      listPlatformWorkflowDesigns(),
    ])
    const triggers = workflowDesigns.reduce(
      (sum, d) => sum + (d.starts?.filter((s) => s.type === 'db_trigger').length ?? 0),
      0
    )
    return c.json({
      companies: companies.length,
      workflowDesigns: workflowDesigns.length,
      triggers,
    })
  })

  return app
}
