import { deletePlatformWorkflow } from 'db/platform'
import { requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const id = getRouterParam(event, 'id')!
  await deletePlatformWorkflow(id)
  return { ok: true }
})
