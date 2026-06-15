import { listUserTasks, getMemberById } from 'db/tenant'
import { requireTenantSession } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantSession(event)

  const namespace = event.context.company.namespace
  const tasks = await listUserTasks(namespace)
  return await Promise.all(
    tasks.map(async (t) => {
      if (t.tableName !== 'members') return t
      const member = await getMemberById(namespace, t.recordId)
      return { ...t, member }
    })
  )
})
