import { getPlatformWorkflow } from 'db/platform'
import { requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const id = getRouterParam(event, 'id', { decode: true })!
  const workflow = await getPlatformWorkflow(id)
  if (!workflow) throw createError({ statusCode: 404, statusMessage: 'Workflow not found' })
  return workflow
})
