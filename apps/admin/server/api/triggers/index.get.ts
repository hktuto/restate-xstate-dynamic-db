import { listPlatformTriggers, getPlatformWorkflow } from 'db/platform'
import { requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const triggers = await listPlatformTriggers()
  return await Promise.all(
    triggers.map(async (t) => {
      const workflow = await getPlatformWorkflow(t.workflowId)
      return { ...t, workflowName: workflow?.name ?? 'Unknown' }
    })
  )
})
