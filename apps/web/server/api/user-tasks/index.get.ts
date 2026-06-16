import { listUserTasks, getMemberById } from 'db/tenant'
import { requireTenantMember } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantMember(event)

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Company context missing' })
  }

  const namespace = company.namespace
  const tasks = await listUserTasks(namespace)
  return await Promise.all(
    tasks.map(async (t) => {
      if (t.tableName !== 'members') return t
      const member = await getMemberById(namespace, t.recordId)
      return { ...t, member }
    })
  )
})
