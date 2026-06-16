import { listTriggers, getWorkflow } from 'db/tenant'
import { requireTenantMember } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantMember(event)

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Company context missing' })
  }

  const triggers = await listTriggers(company.namespace)
  return await Promise.all(
    triggers.map(async (t) => {
      const workflow = await getWorkflow(company.namespace, t.workflowId)
      return { ...t, workflowName: workflow?.name ?? 'Unknown' }
    })
  )
})
