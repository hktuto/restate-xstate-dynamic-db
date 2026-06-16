import { deleteTrigger } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await deleteTrigger(event.context.company.namespace, id)
  return { ok: true }
})
