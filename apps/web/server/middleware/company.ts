import { getTenantCompany } from '#server/utils/auth'

declare module 'h3' {
  interface H3EventContext {
    company?: {
      id: string
      slug: string
      namespace: string
    }
  }
}

export default defineEventHandler(async (event) => {
  const path = getRequestPath(event)

  // Public auth and health routes do not need a resolved company.
  const publicPrefixes = ['/api/auth/', '/api/health']
  if (publicPrefixes.some(prefix => path.startsWith(prefix))) {
    return
  }

  const company = getTenantCompany(event)
  if (company) {
    event.context.company = company
  }
})
