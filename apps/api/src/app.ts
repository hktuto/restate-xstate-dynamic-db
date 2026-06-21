import { Hono } from 'hono'
import { createCorsMiddleware } from './middleware/cors.js'
import { authRoutes } from './routes/auth.js'
import { tablesRoutes } from './routes/tables.js'
import { viewsRoutes } from './routes/views.js'
import { companiesRoutes } from './routes/companies.js'
import { usersRoutes } from './routes/users.js'
import { workflowDesignsRoutes } from './routes/workflow-designs.js'
import { adminWorkflowDesignsRoutes } from './routes/admin-workflow-designs.js'
import { adminWorkflowInstancesRoutes } from './routes/admin-workflow-instances.js'
import { workflowInstancesRoutes } from './routes/workflow-instances.js'
import { userTasksRoutes } from './routes/user-tasks.js'
import { platformRoutes } from './routes/platform.js'
import { adminRoutes } from './routes/admin.js'
import { userGroupsRoutes } from './routes/user-groups.js'
import { permissionsRoutes } from './routes/permissions.js'

export function createApp() {
  const app = new Hono()
  app.use(createCorsMiddleware())
  app.get('/health', (c) => c.json({ ok: true }))
  app.route('/api/permissions', permissionsRoutes)
  app.route('/api', authRoutes)
  app.route('/api', tablesRoutes)
  app.route('/api', viewsRoutes)
  app.route('/api/companies', companiesRoutes)
  app.route('/api/users', usersRoutes)
  app.route('/api/workflow-designs', workflowDesignsRoutes)
  app.route('/api/admin/workflow-designs', adminWorkflowDesignsRoutes)
  app.route('/api/admin/workflow-instances', adminWorkflowInstancesRoutes)
  app.route('/api/workflow-instances', workflowInstancesRoutes)
  app.route('/api', userTasksRoutes)
  app.route('/api', platformRoutes)
  app.route('/api/user-groups', userGroupsRoutes)
  app.route('/api/admin', adminRoutes)
  return app
}
