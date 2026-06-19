import { Hono } from 'hono'
import { listCompaniesForProfile, createCompany, getCompanyBySlug } from 'db/platform'
import { createMember } from 'db/tenant'
import { provisionCompanyNamespace } from 'db/provision'
import { provisionDefaultCompanyGroups } from 'db/permissions'
import { tenantAuth, tenantSession } from '../middleware/tenant.js'
import { dispatchTrigger } from '../lib/dispatch.js'
import { dispatchPlatformTrigger } from '../lib/dispatch-platform.js'
import type { TenantScope } from '../types.js'

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

export function companiesRoutes() {
  const app = new Hono()

  app.get('/', tenantAuth, async (c) => {
    const scope = c.get('scope') as TenantScope
    const companies = await listCompaniesForProfile(scope.profileId)
    return c.json(companies)
  })

  app.post('/', tenantSession, async (c) => {
    const scope = c.get('scope') as TenantScope
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    const { name } = body || {}
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'Company name required' }, 400)
    }

    const slug = await generateUniqueSlug(name)
    const company = await createCompany({ name: name.trim(), slug })

    await provisionCompanyNamespace(company.namespace)

    const ownerMember = await createMember(company.namespace, {
      email: '',
      profileId: scope.profileId,
      role: 'owner',
      status: 'active',
      inviteCode: null,
    })

    await provisionDefaultCompanyGroups(company.namespace, ownerMember.id)

    const skipTrigger = c.req.header('x-restate-skip-trigger') === 'true'
    await dispatchTrigger(company.namespace, 'companies', 'create', company, {
      skip: skipTrigger,
      companyId: company.id,
    })
    await dispatchPlatformTrigger('companies', 'create', company, { skip: skipTrigger })

    return c.json(company)
  })

  return app
}
