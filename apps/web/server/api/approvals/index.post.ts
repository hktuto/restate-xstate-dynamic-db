import { createApproval } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const record = await createApproval(event.context.company.namespace, {
    tableName: body.tableName,
    recordId: body.recordId,
    workflowId: body.workflowId,
    awakeableId: body.awakeableId
  })
  return record
})
