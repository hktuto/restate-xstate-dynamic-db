import { createCompany, getCompanyBySlug } from 'db/platform'
import { createMember } from 'db/tenant'
import { requireTenantSession } from '#server/utils/auth'
import { dispatchTrigger } from '#server/utils/dispatch'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function generateUniqueSlug(name: string): Promise<string> {
  let slug = slugify(name) || 'company'
  let candidate = slug
  let suffix = 2
  while (await getCompanyBySlug(candidate)) {
    candidate = `${slug}-${suffix++}`
  }
  return candidate
}

export default defineEventHandler(async (event) => {
  const session = requireTenantSession(event)
  const body = await readBody(event)
  const { name } = body || {}

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Company name required' })
  }

  const slug = await generateUniqueSlug(name)
  const company = await createCompany({ name: name.trim(), slug })

  await createMember(company.namespace, {
    email: '',
    profileId: session.profileId,
    role: 'owner',
    status: 'active',
    inviteCode: null
  })

  event.context.company = { id: company.id, slug: company.slug, namespace: company.namespace }
  await dispatchTrigger(event, 'companies', 'create', company)

  return company
})
