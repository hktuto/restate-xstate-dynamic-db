import { createTrigger } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const record = await createTrigger(event.context.company.namespace, {
    tableName: body.tableName,
    event: body.event,
    workflowId: body.workflowId
  })
  return record
})
