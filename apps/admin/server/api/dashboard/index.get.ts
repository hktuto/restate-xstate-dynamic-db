import { listCompanies, listPlatformWorkflows, listPlatformTriggers } from 'db/platform'
import { requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const [companies, workflows, triggers] = await Promise.all([
    listCompanies(),
    listPlatformWorkflows(),
    listPlatformTriggers()
  ])
  return {
    companies: companies.length,
    workflows: workflows.length,
    triggers: triggers.length
  }
})
