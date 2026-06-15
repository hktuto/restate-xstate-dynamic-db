import { createPlatformTrigger } from 'db/platform'
import { requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const body = await readBody(event)
  return createPlatformTrigger({
    tableName: body.tableName,
    event: body.event,
    workflowId: body.workflowId
  })
})
