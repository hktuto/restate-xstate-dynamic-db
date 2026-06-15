import { deleteApproval } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await deleteApproval(event.context.company.namespace, id)
  return { ok: true }
})
