import { createPlatformWorkflow } from 'db/platform'
import { requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const body = await readBody(event)
  return createPlatformWorkflow({
    name: body.name,
    xstateConfig: body.xstateConfig
  })
})
