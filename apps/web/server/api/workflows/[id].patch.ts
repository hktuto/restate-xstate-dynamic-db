import { updateWorkflow } from 'db/tenant'
import { requireTenantRole } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantRole(event, ['owner', 'admin'])

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Company context missing' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const record = await updateWorkflow(company.namespace, id, {
    name: body.name,
    xstateConfig: body.xstateConfig
  })
  return record
})
