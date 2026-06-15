import { createWorkflow } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const record = await createWorkflow(event.context.company.namespace, {
    name: body.name,
    xstateConfig: body.xstateConfig
  })
  return record
})
