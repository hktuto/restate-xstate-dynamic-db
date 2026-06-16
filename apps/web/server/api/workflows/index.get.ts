import { listWorkflows } from 'db/tenant'
import { requireTenantMember } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantMember(event)

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Company context missing' })
  }

  return listWorkflows(company.namespace)
})
