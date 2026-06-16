import { deletePlatformTrigger } from 'db/platform'
import { requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const id = getRouterParam(event, 'id')!
  await deletePlatformTrigger(id)
  return { ok: true }
})
