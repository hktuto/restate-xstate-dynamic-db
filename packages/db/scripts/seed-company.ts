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
import { assignPermissionGroup, listPermissionGroups, provisionDefaultCompanyGroups } from '../src/permissions.js'

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

async function createPersonAccount(
  person: SeedPerson,
  credential: string
): Promise<{ profile: UserProfileRecord; account: AccountRecord }> {
  const profile = await createUserProfile({ name: person.name })
  const account = await createAccount({
    provider: 'email',
    providerKey: person.email,
    credential,
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

const MEMBERS: SeedPerson[] = [
  { name: 'Alice', email: 'alice@seedco.test', role: 'member', status: 'active' },
  { name: 'Bob', email: 'bob@seedco.test', role: 'member', status: 'active' },
  { name: 'Charlie', email: 'charlie@seedco.test', role: 'member', status: 'active' },
  { name: 'Diana', email: 'diana@seedco.test', role: 'member', status: 'active' },
  { name: 'Evan', email: 'evan@seedco.test', role: 'member', status: 'active' },
  { name: 'Fiona', email: 'fiona@seedco.test', role: 'member', status: 'active' },
  { name: 'George', email: 'george@seedco.test', role: 'member', status: 'active' },
  { name: 'Hannah', email: 'hannah@seedco.test', role: 'member', status: 'active' },
  { name: 'Ian', email: 'ian@seedco.test', role: 'member', status: 'active' },
  { name: 'Judy', email: 'judy@seedco.test', role: 'member', status: 'active' },
  { name: 'Pending Pat', email: 'pending@seedco.test', role: 'member', status: 'pending' },
  { name: 'Inactive Ira', email: 'inactive@seedco.test', role: 'member', status: 'inactive' },
]

const ADMIN_EMAILS = new Set(['alice@seedco.test', 'bob@seedco.test'])

async function seedMembers(
  namespace: string,
  ownerMember: MemberRecord,
  credential: string
) {
  const groups = await listPermissionGroups(namespace, 'company')
  const adminGroup = groups.find((g) => g.name === 'Admin')!
  const memberGroup = groups.find((g) => g.name === 'Member')!

  const seeded: Array<{ person: SeedPerson; member: MemberRecord }> = []

  for (const person of MEMBERS) {
    const { profile } = await createPersonAccount(person, credential)
    const member = await createCompanyMember(namespace, person, profile.id)
    const group = ADMIN_EMAILS.has(person.email) ? adminGroup : memberGroup
    await assignPermissionGroup(namespace, member.id, group.id)
    seeded.push({ person, member })
  }

  return seeded
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

  const passwordHash = await hashPassword(PASSWORD)

  const ownerPerson: SeedPerson = { name: 'Owner', email: 'owner@seedco.test', role: 'owner', status: 'active' }
  const { profile: ownerProfile } = await createPersonAccount(ownerPerson, passwordHash)
  const ownerMember = await createCompanyMember(company.namespace, ownerPerson, ownerProfile.id)
  await provisionDefaultCompanyGroups(company.namespace, ownerMember.id)

  await seedMembers(company.namespace, ownerMember, passwordHash)

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
