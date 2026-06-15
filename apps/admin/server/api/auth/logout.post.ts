import { clearAdminSession, requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  clearAdminSession(event)
  return { ok: true }
})
