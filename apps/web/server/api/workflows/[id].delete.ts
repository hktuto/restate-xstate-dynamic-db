import { deleteWorkflow } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await deleteWorkflow(event.context.company.namespace, id)
  return { ok: true }
})
