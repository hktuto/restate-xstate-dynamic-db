import { Hono } from 'hono'
import { createCorsMiddleware } from './middleware/cors.js'
import { authRoutes } from './routes/auth.js'
import { tablesRoutes } from './routes/tables.js'
import { companiesRoutes } from './routes/companies.js'
import { usersRoutes } from './routes/users.js'
import { workflowDesignsRoutes } from './routes/workflow-designs.js'
import { triggersRoutes } from './routes/triggers.js'
import { adminWorkflowsRoutes } from './routes/admin-workflows.js'
import { adminTriggersRoutes } from './routes/admin-triggers.js'
import { workflowInstancesRoutes } from './routes/workflow-instances.js'
import { userTasksRoutes } from './routes/user-tasks.js'
import { platformRoutes } from './routes/platform.js'
import { adminRoutes } from './routes/admin.js'

export function createApp() {
  const app = new Hono()
  app.use(createCorsMiddleware())
  app.get('/health', (c) => c.json({ ok: true }))
  app.route('/api', authRoutes())
  app.route('/api', tablesRoutes())
  app.route('/api', companiesRoutes())
  app.route('/api', usersRoutes())
  app.route('/api/workflow-designs', workflowDesignsRoutes())
  app.route('/api', triggersRoutes())
  app.route('/api', adminWorkflowsRoutes())
  app.route('/api', adminTriggersRoutes())
  app.route('/api', workflowInstancesRoutes())
  app.route('/api', userTasksRoutes())
  app.route('/api', platformRoutes())
  app.route('/api', adminRoutes())
  return app
}
