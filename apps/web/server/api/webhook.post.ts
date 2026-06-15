export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  console.log('[webhook received]', body)
  return { ok: true }
})
