import { fileURLToPath } from 'node:url'
import { hashPassword } from 'shared'
import { getSurreal, closeSurreal, closeSurrealPool } from '../src/client.js'
import {
  createCompany,
  getCompanyBySlug,
  deleteCompanyBySlug,
  createAccount,
  createUserProfile,
  type UserProfileRecord,
  type AccountRecord,
} from '../src/platform.js'
import { createMember, type MemberRecord } from '../src/tenant.js'
import { provisionCompanyNamespace } from '../src/provision.js'
import { provisionDefaultCompanyGroups } from '../src/permissions.js'

const COMPANY = {
  name: 'SeedCo Test',
  slug: 'seedco-test',
  namespace: 'company_seedco_test',
}

const PASSWORD = 'SeedPass123!'

interface SeedPerson {
  name: string
  email: string
  role: 'owner' | 'member'
  status: 'pending' | 'active' | 'inactive'
}

async function createPersonAccount(person: SeedPerson): Promise<{ profile: UserProfileRecord; account: AccountRecord }> {
  const profile = await createUserProfile({ name: person.name })
  const passwordHash = await hashPassword(PASSWORD)
  const account = await createAccount({
    provider: 'email',
    providerKey: person.email,
    credential: passwordHash,
    profileId: profile.id,
  })
  return { profile, account }
}

async function createCompanyMember(
  namespace: string,
  person: SeedPerson,
  profileId: string
): Promise<MemberRecord> {
  return createMember(namespace, {
    email: person.email,
    profileId,
    role: person.role,
    status: person.status,
    inviteCode: null,
  })
}

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

  const ownerPerson: SeedPerson = { name: 'Owner', email: 'owner@seedco.test', role: 'owner', status: 'active' }
  const { profile: ownerProfile, account: ownerAccount } = await createPersonAccount(ownerPerson)
  const ownerMember = await createCompanyMember(company.namespace, ownerPerson, ownerProfile.id)
  await provisionDefaultCompanyGroups(company.namespace, ownerMember.id)

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
