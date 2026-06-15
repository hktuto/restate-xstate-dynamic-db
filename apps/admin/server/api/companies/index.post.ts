import { createCompany } from 'db/platform'
import { requireAdminSession } from '#server/utils/session'
import { dispatchTrigger } from '#server/utils/dispatch'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const body = await readBody(event)
  const company = await createCompany(body)
  await dispatchTrigger(event, 'companies', 'create', company)
  return company
})
