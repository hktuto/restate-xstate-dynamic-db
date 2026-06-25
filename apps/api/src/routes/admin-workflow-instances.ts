import { Hono } from 'hono'
import { adminAuth } from '../middleware/admin.js'
import { handleWorkflowTrigger } from './workflow-instances.js'

const app = new Hono()
app.use(adminAuth())

app.post('/', async (c) => {
    return handleWorkflowTrigger(c, 'platform')
  })

export const adminWorkflowInstancesRoutes = app
