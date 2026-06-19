# Seed Company Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable `pnpm --filter db seed-company` command that creates a fully populated tenant company with an owner, members, user groups, and permission assignments for manual and automated testing.

**Architecture:** A single TypeScript script under `packages/db/scripts/seed-company.ts` orchestrates existing DB helpers (platform, tenant, permissions, user-groups, provision). The script overwrites a fixed `seedco-test` company on repeat runs and prints a login summary.

**Tech Stack:** TypeScript, SurrealDB, pnpm workspace scripts, Vitest.

---

### Task 1: Add the package script

**Files:**
- Modify: `packages/db/package.json`

- [ ] **Step 1: Add `seed-company` script**

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "seed": "tsx src/seed.ts",
    "seed-company": "tsx scripts/seed-company.ts"
  }
}
```

Only add the `seed-company` line; do not change existing scripts.

- [ ] **Step 2: Verify package.json is valid JSON**

Run: `pnpm --filter db seed-company --help`

Expected: pnpm tries to run the script (it will fail because the file does not exist yet).

- [ ] **Step 3: Commit**

```bash
git add packages/db/package.json
git commit -m "chore(db): add seed-company script entry"
```

---

### Task 2: Create the cleanup helper and company seed function skeleton

**Files:**
- Create: `packages/db/scripts/seed-company.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/test/seed-company.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { seedCompany } from '../scripts/seed-company.js'
import { getCompanyBySlug } from '../src/platform.js'
import { listMembers } from '../src/tenant.js'
import { listUserGroups } from '../src/user-groups.js'
import { createTenantNamespace, removeTenantNamespace } from './helpers.js'

describe('seedCompany', () => {
  beforeEach(async () => {
    await createTenantNamespace('platform')
  })

  afterEach(async () => {
    await removeTenantNamespace('company_seedco_test')
    await removeTenantNamespace('platform')
  })

  it('creates the seed company', async () => {
    await seedCompany()
    const company = await getCompanyBySlug('seedco-test')
    expect(company).toBeDefined()
    expect(company?.name).toBe('SeedCo Test')
  })
})
```

Run: `pnpm --filter db test seed-company.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 2: Create the script skeleton with cleanup**

Create `packages/db/scripts/seed-company.ts`:

```ts
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
  // Called unconditionally in Task 2 so the missing helper triggers a runtime test failure.
  // In Task 3 this becomes the supported cleanup path.
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
```

Note: `deleteCompanyBySlug` does not exist yet. We will add it in Task 3.

- [ ] **Step 3: Run the test**

Run: `pnpm --filter db test seed-company.test.ts`

Expected: FAIL — `deleteCompanyBySlug` is not exported from `platform.js`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/scripts/seed-company.ts packages/db/test/seed-company.test.ts packages/db/package.json
git commit -m "feat(db): seed-company script skeleton and failing test"
```

---

### Task 3: Add `deleteCompanyBySlug` platform helper

**Files:**
- Modify: `packages/db/src/platform.ts`

- [ ] **Step 1: Add the helper**

After `deletePlatformUserTask` (around line 294), add:

```ts
export async function deleteCompanyBySlug(slug: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE companies WHERE slug = $slug', { slug })
  } finally {
    await closeSurreal(surreal)
  }
}
```

> **Note:** `seed-company.ts` already imports and calls `deleteCompanyBySlug` from Task 2, so no script changes are required in this task.

- [ ] **Step 2: Run the test**

Run: `pnpm --filter db test seed-company.test.ts`

Expected: PASS — company is created and has the right name.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/platform.ts packages/db/scripts/seed-company.ts
git commit -m "feat(db): add deleteCompanyBySlug helper and wire reset"
```

---

### Task 4: Seed the owner account, profile, and member

**Files:**
- Modify: `packages/db/scripts/seed-company.ts`

- [ ] **Step 1: Extend the test**

Add assertions to `packages/db/test/seed-company.test.ts` inside the existing test:

```ts
import { getMemberByProfileId } from '../src/tenant.js'
import { getAccountByProviderKey } from '../src/platform.js'

// inside the existing it() block, after the member count assertion:
const ownerAccount = await getAccountByProviderKey('email', 'owner@seedco.test')
expect(ownerAccount).toBeDefined()
const ownerMember = await getMemberByProfileId('company_seedco_test', ownerAccount!.profileId)
expect(ownerMember).toBeDefined()
expect(ownerMember?.role).toBe('owner')
```

Run: `pnpm --filter db test seed-company.test.ts`

Expected: FAIL — owner account/member not created yet.

- [ ] **Step 2: Add owner creation helpers**

Add to `seed-company.ts`:

```ts
import { createAccount, createUserProfile, type UserProfileRecord, type AccountRecord } from '../src/platform.js'
import { createMember, type MemberRecord } from '../src/tenant.js'
import { provisionDefaultCompanyGroups } from '../src/permissions.js'

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
```

Update `seedCompany`:

```ts
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
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter db test seed-company.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/scripts/seed-company.ts packages/db/test/seed-company.test.ts
git commit -m "feat(db): seed owner account, profile, and member"
```

---

### Task 5: Seed all members and company-level permission assignments

**Files:**
- Modify: `packages/db/scripts/seed-company.ts`

- [ ] **Step 1: Extend the test**

Add assertions:

```ts
import { getEffectivePermissions, listPermissionGroups } from '../src/permissions.js'

// inside the existing it() block:
const members = await listMembers('company_seedco_test')
expect(members).toHaveLength(13)

const companyGroups = await listPermissionGroups('company_seedco_test', 'company')
const adminGroup = companyGroups.find((g) => g.name === 'Admin')
const memberGroup = companyGroups.find((g) => g.name === 'Member')
expect(adminGroup).toBeDefined()
expect(memberGroup).toBeDefined()

const alice = members.find((m) => m.email === 'alice@seedco.test')
const charlie = members.find((m) => m.email === 'charlie@seedco.test')
expect(alice).toBeDefined()
expect(charlie).toBeDefined()

const aliceMask = await getEffectivePermissions('company_seedco_test', alice!.id, 'company', alice!.role)
const charlieMask = await getEffectivePermissions('company_seedco_test', charlie!.id, 'company', charlie!.role)
expect(aliceMask).toBe(adminGroup!.bitmask)
expect(charlieMask).toBe(memberGroup!.bitmask)
```

Run: `pnpm --filter db test seed-company.test.ts`

Expected: FAIL — only the owner exists.

- [ ] **Step 2: Add member list and company-level assignments**

Add to `seed-company.ts`:

```ts
import { assignPermissionGroup, listPermissionGroups } from '../src/permissions.js'

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

async function seedMembers(namespace: string, ownerMember: MemberRecord) {
  const groups = await listPermissionGroups(namespace, 'company')
  const adminGroup = groups.find((g) => g.name === 'Admin')!
  const memberGroup = groups.find((g) => g.name === 'Member')!

  const seeded: Array<{ person: SeedPerson; member: MemberRecord }> = []

  for (const person of MEMBERS) {
    const { profile } = await createPersonAccount(person)
    const member = await createCompanyMember(namespace, person, profile.id)
    const group = ADMIN_EMAILS.has(person.email) ? adminGroup : memberGroup
    await assignPermissionGroup(namespace, member.id, group.id)
    seeded.push({ person, member })
  }

  return seeded
}
```

Update `seedCompany`:

```ts
export async function seedCompany() {
  await resetSeedCompany()
  const company = await createCompany({ name: COMPANY.name, slug: COMPANY.slug, namespace: COMPANY.namespace })
  await provisionCompanyNamespace(company.namespace)

  const ownerPerson: SeedPerson = { name: 'Owner', email: 'owner@seedco.test', role: 'owner', status: 'active' }
  const { profile: ownerProfile } = await createPersonAccount(ownerPerson)
  const ownerMember = await createCompanyMember(company.namespace, ownerPerson, ownerProfile.id)
  await provisionDefaultCompanyGroups(company.namespace, ownerMember.id)

  await seedMembers(company.namespace, ownerMember)

  console.log(`Created company ${company.name} (${company.namespace})`)
}
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter db test seed-company.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/scripts/seed-company.ts packages/db/test/seed-company.test.ts
git commit -m "feat(db): seed all members and company-level permission groups"
```

---

### Task 6: Seed user groups and group memberships

**Files:**
- Modify: `packages/db/scripts/seed-company.ts`

- [ ] **Step 1: Extend the test**

Add assertions:

```ts
const groups = await listUserGroups('company_seedco_test')
expect(groups).toHaveLength(3)
expect(groups.map((g) => g.name).sort()).toEqual(['Engineering', 'Finance', 'Product'])
```

Run: `pnpm --filter db test seed-company.test.ts`

Expected: FAIL — no user groups yet.

- [ ] **Step 2: Add user group seeding**

Add to `seed-company.ts`:

```ts
import { createUserGroupWithDefaults, addUserGroupMember, listUserGroups } from '../src/user-groups.js'

const USER_GROUPS: Array<{ name: string; memberEmails: string[]; ownerEmails: string[] }> = [
  {
    name: 'Engineering',
    memberEmails: ['charlie@seedco.test', 'diana@seedco.test', 'evan@seedco.test'],
    ownerEmails: ['owner@seedco.test', 'alice@seedco.test'],
  },
  {
    name: 'Product',
    memberEmails: ['fiona@seedco.test', 'george@seedco.test'],
    ownerEmails: ['owner@seedco.test', 'bob@seedco.test'],
  },
  {
    name: 'Finance',
    memberEmails: ['hannah@seedco.test', 'ian@seedco.test'],
    ownerEmails: ['owner@seedco.test'],
  },
]

async function seedUserGroups(
  namespace: string,
  ownerMember: MemberRecord,
  emailToMember: Map<string, MemberRecord>
) {
  for (const groupDef of USER_GROUPS) {
    const group = await createUserGroupWithDefaults(namespace, { name: groupDef.name }, ownerMember.id)
    for (const email of groupDef.memberEmails) {
      const member = emailToMember.get(email)
      if (member) await addUserGroupMember(namespace, member.id, group.id)
    }
  }
}
```

Update `seedCompany` to build the email-to-member map and call `seedUserGroups`:

```ts
export async function seedCompany() {
  await resetSeedCompany()
  const company = await createCompany({ name: COMPANY.name, slug: COMPANY.slug, namespace: COMPANY.namespace })
  await provisionCompanyNamespace(company.namespace)

  const ownerPerson: SeedPerson = { name: 'Owner', email: 'owner@seedco.test', role: 'owner', status: 'active' }
  const { profile: ownerProfile } = await createPersonAccount(ownerPerson)
  const ownerMember = await createCompanyMember(company.namespace, ownerPerson, ownerProfile.id)
  await provisionDefaultCompanyGroups(company.namespace, ownerMember.id)

  const seeded = await seedMembers(company.namespace, ownerMember)
  const emailToMember = new Map<string, MemberRecord>(
    [{ person: ownerPerson, member: ownerMember }, ...seeded].map(({ person, member }) => [person.email, member])
  )

  await seedUserGroups(company.namespace, ownerMember, emailToMember)

  console.log(`Created company ${company.name} (${company.namespace})`)
}
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter db test seed-company.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/scripts/seed-company.ts packages/db/test/seed-company.test.ts
git commit -m "feat(db): seed user groups and memberships"
```

---

### Task 7: Assign record-level user-group owners (alice/bob)

**Files:**
- Modify: `packages/db/scripts/seed-company.ts`

- [ ] **Step 1: Extend the test**

Add assertions:

```ts
const engineering = groups.find((g) => g.name === 'Engineering')!
const aliceEngineeringMask = await getEffectivePermissions(
  'company_seedco_test',
  alice!.id,
  'user_group',
  alice!.role,
  engineering.id
)
expect(aliceEngineeringMask).not.toBe('0')
expect(await getEffectivePermissions('company_seedco_test', charlie!.id, 'user_group', charlie!.role, engineering.id)).not.toBe('0')
```

Run: `pnpm --filter db test seed-company.test.ts`

Expected: PASS already (alice inherits via group membership), but the test documents the behavior.

- [ ] **Step 2: Add explicit Owner assignments for alice and bob**

Add to `seedUserGroups`:

```ts
async function seedUserGroups(
  namespace: string,
  ownerMember: MemberRecord,
  emailToMember: Map<string, MemberRecord>
) {
  for (const groupDef of USER_GROUPS) {
    const group = await createUserGroupWithDefaults(namespace, { name: groupDef.name }, ownerMember.id)

    const recordGroups = await listPermissionGroups(namespace, 'user_group', group.id)
    const ownerGroup = recordGroups.find((g) => g.name === 'Owner')!

    for (const email of groupDef.ownerEmails) {
      const member = emailToMember.get(email)
      if (member && member.id !== ownerMember.id) {
        await assignPermissionGroup(namespace, member.id, ownerGroup.id)
      }
    }

    for (const email of groupDef.memberEmails) {
      const member = emailToMember.get(email)
      if (member) await addUserGroupMember(namespace, member.id, group.id)
    }
  }
}
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter db test seed-company.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/scripts/seed-company.ts packages/db/test/seed-company.test.ts
git commit -m "feat(db): assign record-level user-group owners"
```

---

### Task 8: Add the summary output

**Files:**
- Modify: `packages/db/scripts/seed-company.ts`

- [ ] **Step 1: Add a printSummary function**

Add to `seed-company.ts`:

```ts
function printSummary(namespace: string, members: MemberRecord[], groups: Awaited<ReturnType<typeof listUserGroups>>) {
  console.log('\n✅ Seed company ready\n')
  console.log(`Company:    SeedCo Test`)
  console.log(`Slug:       seedco-test`)
  console.log(`Namespace:  ${namespace}`)
  console.log(`Password:   ${PASSWORD}\n`)

  console.log('Login emails:')
  console.table(members.map((m) => ({ email: m.email, role: m.role, status: m.status })))

  console.log('\nUser groups:')
  console.table(groups.map((g) => ({ name: g.name, id: g.id })))
}
```

Update `seedCompany` to collect members/groups and call `printSummary`:

```ts
import { listUserGroups } from '../src/user-groups.js'
import { listMembers } from '../src/tenant.js'

// at the end of seedCompany, before the console.log:
const allMembers = [ownerMember, ...seeded.map((s) => s.member)]
const groups = await listUserGroups(company.namespace)
printSummary(company.namespace, allMembers, groups)
```

Remove the old `console.log` line.

- [ ] **Step 2: Run the script manually**

Run:

```bash
pnpm --filter db seed
pnpm --filter db seed-company
```

Expected: prints the company details and a table of login emails.

- [ ] **Step 3: Run the test**

Run: `pnpm --filter db test seed-company.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/scripts/seed-company.ts
git commit -m "feat(db): add seed-company summary output"
```

---

### Task 9: Final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-06-19-seed-company-design.md`

- [ ] **Step 1: Run full DB checks**

```bash
pnpm --filter db typecheck
pnpm --filter db test
```

Expected: all typecheck and tests pass.

- [ ] **Step 2: Smoke test via the API**

```bash
pnpm --filter db seed
pnpm --filter db seed-company
pnpm --filter api dev
```

In another terminal:

```bash
curl -s -X POST http://localhost:3002/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@seedco.test","password":"SeedPass123!"}'
```

Expected: `200 OK` with `{ ok: true, companies: [...] }`.

- [ ] **Step 3: Mark the spec as done**

Change `status: planned` to `status: done` in `docs/superpowers/specs/2026-06-19-seed-company-design.md` and update the `updated:` date.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-19-seed-company-design.md
pnpm --filter db typecheck
pnpm --filter db test
pnpm --filter api typecheck
git commit -m "docs: mark seed-company spec as done"
```

---

## Self-review

- **Spec coverage:**
  - Fixed company identity → Task 2
  - Owner + members → Tasks 4 and 5
  - User groups → Task 6
  - Company-level permissions → Task 5
  - Record-level user-group owners → Task 7
  - Summary output → Task 8
  - Overwrite behavior → Task 2
  - Manual and automated verification → Task 9
- **Placeholder scan:** no TBD/TODO; all code blocks are complete.
- **Type consistency:** `SeedPerson`, `MemberRecord`, `UserProfileRecord`, `AccountRecord` match existing DB types.
