import { getCompanyBySlug, getCompanyByNamespace } from 'db/platform'

declare module 'h3' {
  interface H3EventContext {
    company: {
      id: string
      slug: string
      namespace: string
    }
  }
}

export default defineEventHandler(async (event) => {
  const path = getRequestPath(event)

  // The index page lets the user pick a company, and /api/companies is the
  // list used by the switcher — neither needs a resolved company.
  if (path === '/' || path.startsWith('/api/companies')) {
    return
  }

  const slug = getCookie(event, 'company_slug')
  const namespace = getHeader(event, 'x-company-namespace')

  let company
  if (slug) {
    company = await getCompanyBySlug(slug)
  } else if (namespace) {
    company = await getCompanyByNamespace(namespace)
  }

  if (!company) {
    if (path.startsWith('/api/')) {
      throw createError({ statusCode: 404, statusMessage: 'Company not found' })
    }
    // For page requests, redirect to the index so the user can select a company.
    return sendRedirect(event, '/', 302)
  }

  event.context.company = {
    id: company.id,
    slug: company.slug,
    namespace: company.namespace
  }
})
