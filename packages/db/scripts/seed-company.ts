import { fileURLToPath } from 'node:url'
import { hashPassword } from 'shared'
import { getSurreal, closeSurreal, closeSurrealPool } from '../src/client.js'
import { createCompany, getCompanyBySlug, deleteCompanyBySlug } from '../src/platform.js'
import { provisionCompanyNamespace } from '../src/provision.js'

const COMPANY = {
  name: 'SeedCo Test',
  slug: 'seedco-test',
  namespace: 'company_seedco_test',
}

const PASSWORD = 'SeedPass123!'

async function resetSeedCompany() {
  const existing = await getCompanyBySlug(COMPANY.slug)
  if (existing) {
    const surreal = await getSurreal()
    try {
      await surreal.query(`REMOVE NAMESPACE IF EXISTS ${COMPANY.namespace}`)
    } finally {
      await closeSurreal(surreal)
    }
  }
  await deleteCompanyBySlug(COMPANY.slug)
}

export async function seedCompany() {
  await resetSeedCompany()
  const company = await createCompany({ name: COMPANY.name, slug: COMPANY.slug, namespace: COMPANY.namespace })
  await provisionCompanyNamespace(company.namespace)
  console.log(`Created company ${company.name} (${company.namespace})`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedCompany()
    .then(async () => {
      await closeSurrealPool()
    })
    .catch((err) => {
      console.error('Seed company failed:', err)
      process.exit(1)
    })
}
