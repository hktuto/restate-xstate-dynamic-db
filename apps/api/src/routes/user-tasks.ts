import { Hono } from 'hono'
import {
  listUserTasks,
  getMemberById,
  createUserTask,
  getUserTaskById,
  updateUserTaskStatus,
} from 'db/tenant'
import type { UserTaskType } from 'db/tenant'
import { tenantAuth } from '../middleware/tenant.js'
import type { TenantScope } from '../types.js'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'
const VALID_TYPES: UserTaskType[] = ['approval', 'review', 'manual']

export function userTasksRoutes() {
  const app = new Hono()

  app.get('/', tenantAuth, async (c) => {
    const scope = c.get('scope') as TenantScope
    const tasks = await listUserTasks(scope.namespace)
    return c.json(
      await Promise.all(
        tasks.map(async (t) => {
          if (t.tableName !== 'members') return t
          const member = await getMemberById(scope.namespace, t.recordId)
          return { ...t, member }
        })
      )
    )
  })

  app.post('/', async (c) => {
    let body: {
      instanceId?: string
      type?: UserTaskType
      tableName?: string
      recordId?: string
      designId?: string
      namespace?: string
      database?: string
    }
    try {
      body = await c.req.json<{
        instanceId?: string
        type?: UserTaskType
        tableName?: string
        recordId?: string
        designId?: string
        namespace?: string
        database?: string
      }>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    const { instanceId, type, tableName, recordId, designId } = body
    if (!instanceId || !type || !tableName || !recordId || !designId) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    if (!VALID_TYPES.includes(type)) {
      return c.json({ error: 'Invalid task type' }, 400)
    }

    const namespace = body.namespace
    if (!namespace) {
      return c.json({ error: 'Namespace required' }, 400)
    }
    // Database is accepted for symmetry but tenant DB helpers currently use 'main'.
    void body.database

    const task = await createUserTask(namespace, { instanceId, type, tableName, recordId, designId })
    return c.json(task)
  })

  app.post('/:id/approve', tenantAuth, async (c) => {
    const scope = c.get('scope') as TenantScope
    const id = c.req.param('id')
    if (!id) {
      return c.json({ error: 'ID required' }, 400)
    }

    const task = await getUserTaskById(scope.namespace, id)
    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    if (task.status !== 'pending') {
      return c.json({ error: `Task is already ${task.status}` }, 409)
    }

    const res = await fetch(`${RESTATE_INGRESS}/workflow/${task.instanceId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'approve' }),
    })
    if (!res.ok) {
      return c.json({ error: `Workflow send failed: ${res.status}` }, 502)
    }

    await updateUserTaskStatus(scope.namespace, id, 'completed')
    return c.json({ ok: true })
  })

  app.post('/:id/reject', tenantAuth, async (c) => {
    const scope = c.get('scope') as TenantScope
    const id = c.req.param('id')
    if (!id) {
      return c.json({ error: 'ID required' }, 400)
    }

    const task = await getUserTaskById(scope.namespace, id)
    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    if (task.status !== 'pending') {
      return c.json({ error: `Task is already ${task.status}` }, 409)
    }

    const res = await fetch(`${RESTATE_INGRESS}/workflow/${task.instanceId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'reject' }),
    })
    if (!res.ok) {
      return c.json({ error: `Workflow send failed: ${res.status}` }, 502)
    }

    await updateUserTaskStatus(scope.namespace, id, 'rejected')
    return c.json({ ok: true })
  })

  return app
}
