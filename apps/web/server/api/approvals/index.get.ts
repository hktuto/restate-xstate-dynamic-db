import { listApprovals, getMemberById } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const approvals = await listApprovals(event.context.company.namespace)
  return await Promise.all(
    approvals.map(async (a) => {
      if (a.tableName !== 'members') return a
      const member = await getMemberById(event.context.company.namespace, a.recordId)
      return { ...a, member }
    })
  )
})
