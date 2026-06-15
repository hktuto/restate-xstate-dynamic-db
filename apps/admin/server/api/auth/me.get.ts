import { getAdminSession } from '#server/utils/session'

export default defineEventHandler((event) => {
  const session = getAdminSession(event)
  return { authenticated: !!session, user: session }
})
