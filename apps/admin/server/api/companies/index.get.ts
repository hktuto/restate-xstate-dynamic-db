import { listCompanies } from 'db/platform'
import { requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  return listCompanies()
})
