import { getPlatformStatus } from '#server/utils/platform-status'

export default defineEventHandler(async () => {
  return await getPlatformStatus()
})
