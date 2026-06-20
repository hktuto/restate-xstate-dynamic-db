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
import { seed } from '../src/seed.js'
import { createMember, type MemberRecord } from '../src/tenant.js'
import { provisionCompanyNamespace } from '../src/provision.js'
import { assignPermissionGroup, listPermissionGroups, provisionDefaultCompanyGroups } from '../src/permissions.js'
import {
  createUserGroupWithDefaults,
  addUserGroupMember,
  listUserGroups,
  listUserGroupMembers,
} from '../src/user-groups.js'

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
  credential: string
): Promise<Map<string, MemberRecord>> {
  const groups = await listPermissionGroups(namespace, 'company')
  const adminGroup = groups.find((g) => g.name === 'Admin')!
  const memberGroup = groups.find((g) => g.name === 'Member')!

  const members = new Map<string, MemberRecord>()

  for (const person of MEMBERS) {
    const { profile } = await createPersonAccount(person, credential)
    const member = await createCompanyMember(namespace, person, profile.id)
    const group = ADMIN_EMAILS.has(person.email) ? adminGroup : memberGroup
    await assignPermissionGroup(namespace, member.id, group.id)
    members.set(person.email, member)
  }

  return members
}

interface SeedUserGroup {
  name: string
  description: string
  members: string[]
  extraOwners: string[]
}

const USER_GROUPS: SeedUserGroup[] = [
  {
    name: 'Engineering',
    description: 'Engineering team',
    members: ['charlie@seedco.test', 'diana@seedco.test', 'evan@seedco.test'],
    extraOwners: ['alice@seedco.test'],
  },
  {
    name: 'Product',
    description: 'Product team',
    members: ['fiona@seedco.test', 'george@seedco.test'],
    extraOwners: ['bob@seedco.test'],
  },
  {
    name: 'Finance',
    description: 'Finance team',
    members: ['hannah@seedco.test', 'ian@seedco.test'],
    extraOwners: [],
  },
]

async function seedUserGroups(
  namespace: string,
  ownerMember: MemberRecord,
  members: Map<string, MemberRecord>
) {
  for (const groupDef of USER_GROUPS) {
    const group = await createUserGroupWithDefaults(namespace, { name: groupDef.name, description: groupDef.description }, ownerMember.id)

    const recordGroups = await listPermissionGroups(namespace, 'user_group', group.id)
    const ownerGroup = recordGroups.find((g) => g.name === 'Owner')!

    await addUserGroupMember(namespace, ownerMember.id, group.id)

    for (const email of groupDef.members) {
      const member = members.get(email)
      if (member) {
        await addUserGroupMember(namespace, member.id, group.id)
      }
    }

    for (const email of groupDef.extraOwners) {
      const member = members.get(email)
      if (member) {
        await addUserGroupMember(namespace, member.id, group.id)
        await assignPermissionGroup(namespace, member.id, ownerGroup.id)
      }
    }
  }
}

async function resetSeedCompany() {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query(
      `LET $accounts = (SELECT id, profileId FROM accounts WHERE provider = 'email' AND providerKey CONTAINS '@seedco.test');
       DELETE FROM accounts WHERE id IN $accounts.id;
       DELETE FROM user_profiles WHERE id IN $accounts.profileId;`
    )
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${COMPANY.namespace}`)
  } finally {
    await closeSurreal(surreal)
  }
  await deleteCompanyBySlug(COMPANY.slug)
}

export async function seedCompany() {
  await seed()
  await resetSeedCompany()
  const company = await createCompany({ name: COMPANY.name, slug: COMPANY.slug, namespace: COMPANY.namespace })
  await provisionCompanyNamespace(company.namespace)

  const passwordHash = await hashPassword(PASSWORD)

  const ownerPerson: SeedPerson = { name: 'Owner', email: 'owner@seedco.test', role: 'owner', status: 'active' }
  const { profile: ownerProfile } = await createPersonAccount(ownerPerson, passwordHash)
  const ownerMember = await createCompanyMember(company.namespace, ownerPerson, ownerProfile.id)
  await provisionDefaultCompanyGroups(company.namespace, ownerMember.id)

  const members = await seedMembers(company.namespace, passwordHash)
  await seedUserGroups(company.namespace, ownerMember, members)

  const summary = await buildSummary(company, ownerMember, members)
  printSummary(summary)
  return summary
}

interface SeedSummary {
  company: { name: string; slug: string; namespace: string }
  password: string
  logins: Array<{ email: string; role: string; status: string }>
  userGroups: Array<{ name: string; members: string[] }>
}

async function buildSummary(
  company: { name: string; slug: string; namespace: string },
  ownerMember: MemberRecord,
  members: Map<string, MemberRecord>
): Promise<SeedSummary> {
  const memberEmailById = new Map<string, string>()
  memberEmailById.set(ownerMember.id, ownerMember.email)
  for (const [email, member] of members) {
    memberEmailById.set(member.id, email)
  }

  const logins: SeedSummary['logins'] = [
    { email: ownerMember.email, role: 'owner', status: 'active' },
    ...MEMBERS.map((person) => {
      const member = members.get(person.email)!
      let role = 'member'
      if (ADMIN_EMAILS.has(person.email)) role = 'admin'
      return { email: person.email, role, status: member.status }
    }),
  ]

  const groups = await listUserGroups(company.namespace)
  const userGroups: SeedSummary['userGroups'] = []
  for (const group of groups) {
    const memberIds = await listUserGroupMembers(company.namespace, group.id)
    const emails = memberIds
      .map((m) => memberEmailById.get(m.id))
      .filter((email): email is string => email !== undefined)
      .sort()
    userGroups.push({ name: group.name, members: emails })
  }

  return { company, password: PASSWORD, logins, userGroups }
}

function printSummary(summary: SeedSummary) {
  const lines: string[] = [
    '',
    `Seeded company: ${summary.company.name}`,
    `  slug:      ${summary.company.slug}`,
    `  namespace: ${summary.company.namespace}`,
    `  password:  ${summary.password}`,
    '',
    'Logins:',
    ...summary.logins.map((l) => `  ${l.email.padEnd(28)} ${l.role.padEnd(8)} ${l.status}`),
    '',
    'User groups:',
    ...summary.userGroups.map((g) => `  ${g.name}: ${g.members.join(', ')}`),
    '',
  ]
  console.log(lines.join('\n'))
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
