import { deleteTrigger } from 'db/tenant'
import { requireTenantRole } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantRole(event, ['owner', 'admin'])

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Company context missing' })
  }

  const id = getRouterParam(event, 'id')!
  await deleteTrigger(company.namespace, id)
  return { ok: true }
})
