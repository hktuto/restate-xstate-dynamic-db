import { createTrigger } from 'db/tenant'
import { requireTenantRole } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantRole(event, ['owner', 'admin'])

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Company context missing' })
  }

  const body = await readBody(event)
  const record = await createTrigger(company.namespace, {
    tableName: body.tableName,
    event: body.event,
    workflowId: body.workflowId
  })
  return record
})
