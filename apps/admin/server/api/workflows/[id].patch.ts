import { updatePlatformWorkflow } from 'db/platform'
import { requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  return updatePlatformWorkflow(id, {
    name: body.name,
    xstateConfig: body.xstateConfig
  })
})
