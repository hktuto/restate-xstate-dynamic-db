import { getWorkflow } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const workflow = await getWorkflow(event.context.company.namespace, id)
  if (!workflow) throw createError({ statusCode: 404, statusMessage: `Workflow not found. ns=${event.context.company.namespace} id=${id}` })
  return workflow
})
