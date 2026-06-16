import { updateWorkflow } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const record = await updateWorkflow(event.context.company.namespace, id, {
    name: body.name,
    xstateConfig: body.xstateConfig
  })
  return record
})
