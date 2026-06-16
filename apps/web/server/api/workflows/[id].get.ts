import { getWorkflow } from 'db/tenant'
import { requireTenantMember } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantMember(event)

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Company context missing' })
  }

  const id = getRouterParam(event, 'id')!
  const workflow = await getWorkflow(company.namespace, id)
  if (!workflow) throw createError({ statusCode: 404, statusMessage: `Workflow not found. ns=${company.namespace} id=${id}` })
  return workflow
})
