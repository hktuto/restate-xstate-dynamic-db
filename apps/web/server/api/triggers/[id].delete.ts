import { deleteTrigger } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id', { decode: true })!
  await deleteTrigger(event.context.company.namespace, id)
  return { ok: true }
})
