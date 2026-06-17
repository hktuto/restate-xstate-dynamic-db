---
title: DB Package Test Suite Implementation Plan
type: note
status: done
area: docs
created: 2026-06-16
updated: 2026-06-16
related:
  - [[Getting Started]]
  - [[DB Package]]
  - [[Testing]]
---

# DB Package Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a comprehensive Vitest test suite for every exported function in `packages/db` that runs against the Docker Compose SurrealDB service, catching SQL syntax errors and unexpected output.

**Architecture:** Each test creates real records through the DB helpers and asserts the returned shape/values. Tenant tests use isolated namespaces provisioned at runtime. Platform tests clean the shared `platform/admin` tables before each run. A shared helper module centralizes setup, teardown, and cleanup.

**Tech Stack:** Vitest, `surrealdb` JS SDK, Docker Compose, `tsx`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/db/package.json` | Add `test` script and `vitest` dev dependency. |
| `packages/db/vitest.config.ts` | Per-package Vitest config with `setupFiles` and `fileParallelism: false`. |
| `packages/db/test/setup.ts` | Global setup: ensure SurrealDB is reachable and platform namespace exists. |
| `packages/db/test/helpers.ts` | Shared helpers: `ensurePlatformNamespace`, `resetPlatformTables`, `createTenantNamespace`, `removeTenantNamespace`. |
| `packages/db/test/client.test.ts` | Tests for `getSurreal` / `closeSurreal`. |
| `packages/db/test/provision.test.ts` | Tests for `provisionCompanyNamespace`. |
| `packages/db/test/platform.test.ts` | Tests for every exported function in `src/platform.ts`. |
| `packages/db/test/tenant.test.ts` | Tests for every exported function in `src/tenant.ts`. |
| `packages/db/test/health-checks.test.ts` | Tests for every exported function in `src/health-checks.ts`. |
| `packages/db/test/normalize.test.ts` | Unit tests for the `normalizeId` / `normalizeIds` helper. |
| `docs/60-Development/Testing.md` (or add section) | Document how to run DB tests and requirements. |

---

### Task 1: Add test script and Vitest dependency to `packages/db`

**Files:**
- Modify: `packages/db/package.json`
- Modify: `packages/db/vitest.config.ts` (create)

- [ ] **Step 1: Update `packages/db/package.json`**

```json
{
  "name": "db",
  "type": "module",
  "exports": { ... },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "seed": "tsx src/seed.ts",
    "seed:workflows": "tsx src/seed-workflows.ts"
  },
  "dependencies": { ... },
  "devDependencies": {
    "@types/node": "^22.15.17",
    "tsx": "^4.22.4",
    "typescript": "^5.8.3",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 2: Create `packages/db/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
  },
})
```

- [ ] **Step 3: Install dependency**

Run:

```bash
pnpm install
```

Expected: lockfile updated, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/package.json packages/db/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(db): add vitest test harness"
```

---

### Task 2: Create shared test setup and helpers

**Files:**
- Create: `packages/db/test/setup.ts`
- Create: `packages/db/test/helpers.ts`

- [ ] **Step 1: Create `packages/db/test/helpers.ts`**

```ts
import { getSurreal, closeSurreal } from '../src/client.js'

export async function ensurePlatformNamespace() {
  const surreal = await getSurreal()
  try {
    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS platform;
      USE NS platform DB admin;
      DEFINE DATABASE IF NOT EXISTS admin;
      USE NS platform DB admin;
      DEFINE TABLE IF NOT EXISTS companies SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS platform_users SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS accounts SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS user_profiles SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS workflows SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS triggers SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS workflow_instances SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS user_tasks SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_companies_slug ON companies FIELDS slug UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_accounts_provider_key ON accounts FIELDS provider, providerKey UNIQUE;
    `)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function resetPlatformTables() {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query(`
      DELETE companies;
      DELETE accounts;
      DELETE user_profiles;
      DELETE workflows;
      DELETE triggers;
      DELETE workflow_instances;
      DELETE user_tasks;
    `)
  } finally {
    await closeSurreal(surreal)
  }
}

export function uniqueTenantName() {
  return `test_tenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function createTenantNamespace(namespace: string) {
  const surreal = await getSurreal()
  try {
    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS ${namespace};
      USE NS ${namespace} DB main;
      DEFINE DATABASE IF NOT EXISTS main;
      USE NS ${namespace} DB main;
      DEFINE TABLE IF NOT EXISTS members SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS workflows SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS triggers SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS workflow_instances SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS user_tasks SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_members_profileId ON members FIELDS profileId;
      DEFINE INDEX IF NOT EXISTS idx_members_inviteCode ON members FIELDS inviteCode UNIQUE;
    `)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function removeTenantNamespace(namespace: string) {
  const surreal = await getSurreal()
  try {
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${namespace};`)
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 2: Create `packages/db/test/setup.ts`**

```ts
import { beforeAll } from 'vitest'
import { ensurePlatformNamespace } from './helpers.js'

beforeAll(async () => {
  await ensurePlatformNamespace()
})
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/test/setup.ts packages/db/test/helpers.ts
git commit -m "test(db): add shared test setup and helpers"
```

---

### Task 3: Test `src/client.ts`

**Files:**
- Create: `packages/db/test/client.test.ts`

- [ ] **Step 1: Create `packages/db/test/client.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { getSurreal, closeSurreal } from '../src/client.js'

describe('client', () => {
  it('connects to SurrealDB and signs in', async () => {
    const surreal = await getSurreal()
    expect(surreal).toBeDefined()
    await closeSurreal(surreal)
  })

  it('connects to a specific namespace and database', async () => {
    const surreal = await getSurreal('platform', 'admin')
    expect(surreal).toBeDefined()
    await closeSurreal(surreal)
  })
})
```

- [ ] **Step 2: Run the test**

Ensure SurrealDB is running:

```bash
docker compose up -d surrealdb
```

Run:

```bash
pnpm --filter db test -- client.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/db/test/client.test.ts
git commit -m "test(db): add client connection tests"
```

---

### Task 4: Test `src/provision.ts`

**Files:**
- Create: `packages/db/test/provision.test.ts`

- [ ] **Step 1: Create `packages/db/test/provision.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { provisionCompanyNamespace } from '../src/provision.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'
import { createMember, getMemberById } from '../src/tenant.js'

describe('provisionCompanyNamespace', () => {
  let namespace: string

  beforeEach(async () => {
    namespace = uniqueTenantName()
    await createTenantNamespace(namespace)
  })

  afterEach(async () => {
    await removeTenantNamespace(namespace)
  })

  it('provisions a namespace that supports members', async () => {
    const member = await createMember(namespace, {
      email: 'member@example.com',
      role: 'member',
    })
    expect(member.id).toMatch(/^members:/)

    const found = await getMemberById(namespace, member.id)
    expect(found).toBeDefined()
    expect(found?.email).toBe('member@example.com')
  })
})
```

- [ ] **Step 2: Run the test**

```bash
pnpm --filter db test -- provision.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/db/test/provision.test.ts
git commit -m "test(db): add provision tests"
```

---

### Task 5: Test `src/platform.ts`

**Files:**
- Create: `packages/db/test/platform.test.ts`

- [ ] **Step 1: Create `packages/db/test/platform.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  listPlatformWorkflows, createPlatformWorkflow, getPlatformWorkflow, updatePlatformWorkflow, deletePlatformWorkflow,
  listPlatformTriggers, createPlatformTrigger, deletePlatformTrigger,
  listPlatformWorkflowInstances, createPlatformWorkflowInstance, getPlatformWorkflowInstance,
  findActivePlatformWorkflowInstance, updatePlatformWorkflowInstanceStatus, deletePlatformWorkflowInstance,
  listPlatformUserTasks, createPlatformUserTask, getPlatformUserTaskById, updatePlatformUserTaskStatus, deletePlatformUserTask,
  listCompanies, createCompany, getCompanyBySlug, getCompanyByNamespace, listCompaniesForProfile,
  createUserProfile, getUserProfileById, getUserProfilesByIds, updateUserProfile,
  createAccount, getAccountByProviderKey, updateAccountCredential,
} from '../src/platform.js'
import { resetPlatformTables, createTenantNamespace, removeTenantNamespace } from './helpers.js'
import { createMember } from '../src/tenant.js'

const sampleWorkflow = {
  name: 'Test Workflow',
  xstateConfig: { id: 'test', initial: 'idle', states: { idle: {} } },
}

describe('platform', () => {
  beforeEach(async () => {
    await resetPlatformTables()
  })

  describe('companies', () => {
    it('creates and lists companies', async () => {
      const company = await createCompany({ name: 'Acme', slug: 'acme', namespace: 'acme' })
      expect(company.id).toMatch(/^companies:/)
      expect(company.slug).toBe('acme')

      const companies = await listCompanies()
      expect(companies).toHaveLength(1)
      expect(companies[0].slug).toBe('acme')
    })

    it('gets a company by slug and namespace', async () => {
      const created = await createCompany({ name: 'Acme', slug: 'acme', namespace: 'acme' })
      const bySlug = await getCompanyBySlug('acme')
      expect(bySlug?.id).toBe(created.id)

      const byNs = await getCompanyByNamespace('acme')
      expect(byNs?.id).toBe(created.id)
    })

    it('lists companies for a profile', async () => {
      const company = await createCompany({ name: 'Acme', slug: 'acme', namespace: 'acme' })
      const profile = await createUserProfile({ name: 'Alice' })
      await createTenantNamespace(company.namespace)
      try {
        await createMember(company.namespace, {
          email: '',
          profileId: profile.id,
          role: 'owner',
          status: 'active',
          inviteCode: null,
        })
        const companies = await listCompaniesForProfile(profile.id)
        expect(companies.map(c => c.id)).toContain(company.id)
      } finally {
        await removeTenantNamespace(company.namespace)
      }
    })
  })

  describe('user profiles', () => {
    it('creates and gets a profile', async () => {
      const profile = await createUserProfile({ name: 'Alice' })
      expect(profile.id).toMatch(/^user_profiles:/)

      const found = await getUserProfileById(profile.id)
      expect(found?.id).toBe(profile.id)
    })

    it('gets profiles by ids', async () => {
      const p1 = await createUserProfile({ name: 'A' })
      const p2 = await createUserProfile({ name: 'B' })
      const profiles = await getUserProfilesByIds([p1.id, p2.id])
      expect(profiles).toHaveLength(2)
    })

    it('updates a profile', async () => {
      const profile = await createUserProfile({ name: 'Alice' })
      const updated = await updateUserProfile(profile.id, { name: 'Alicia' })
      expect(updated?.name).toBe('Alicia')
    })
  })

  describe('accounts', () => {
    it('creates and finds an account by provider key', async () => {
      const profile = await createUserProfile({ name: 'Alice' })
      const account = await createAccount({
        profileId: profile.id,
        provider: 'email',
        providerKey: 'alice@example.com',
      })
      expect(account.id).toMatch(/^accounts:/)

      const found = await getAccountByProviderKey('email', 'alice@example.com')
      expect(found?.id).toBe(account.id)
    })

    it('updates account credential', async () => {
      const profile = await createUserProfile({ name: 'Alice' })
      const account = await createAccount({
        profileId: profile.id,
        provider: 'email',
        providerKey: 'alice@example.com',
      })
      const updated = await updateAccountCredential(account.id, 'new-secret')
      expect(updated?.credential).toBe('new-secret')
    })
  })

  describe('platform workflows', () => {
    it('creates, lists, gets, updates and deletes a workflow', async () => {
      const created = await createPlatformWorkflow(sampleWorkflow)
      expect(created.id).toMatch(/^workflows:/)

      const list = await listPlatformWorkflows()
      expect(list).toHaveLength(1)

      const found = await getPlatformWorkflow(created.id)
      expect(found?.id).toBe(created.id)

      const updated = await updatePlatformWorkflow(created.id, { name: 'Renamed' })
      expect(updated?.name).toBe('Renamed')

      await deletePlatformWorkflow(created.id)
      const after = await listPlatformWorkflows()
      expect(after).toHaveLength(0)
    })
  })

  describe('platform triggers', () => {
    it('creates, lists and deletes a trigger', async () => {
      const workflow = await createPlatformWorkflow(sampleWorkflow)
      const trigger = await createPlatformTrigger({
        workflowId: workflow.id,
        tableName: 'orders',
        event: 'created',
      })
      expect(trigger.id).toMatch(/^triggers:/)

      const list = await listPlatformTriggers()
      expect(list).toHaveLength(1)

      await deletePlatformTrigger(trigger.id)
      const after = await listPlatformTriggers()
      expect(after).toHaveLength(0)
    })
  })

  describe('platform workflow instances', () => {
    it('creates, gets, finds active, updates status and deletes', async () => {
      const workflow = await createPlatformWorkflow(sampleWorkflow)
      const instance = await createPlatformWorkflowInstance({
        workflowId: workflow.id,
        tableName: 'orders',
        recordId: 'orders:2',
        namespace: 'test',
        status: 'running',
      })
      expect(instance.id).toMatch(/^workflow_instances:/)

      const found = await getPlatformWorkflowInstance(instance.id)
      expect(found?.id).toBe(instance.id)

      const active = await findActivePlatformWorkflowInstance(workflow.id, 'orders', 'orders:1')
      expect(active).toBeUndefined()

      const updated = await updatePlatformWorkflowInstanceStatus(instance.id, 'done')
      expect(updated?.status).toBe('done')

      await deletePlatformWorkflowInstance(instance.id)
      const after = await listPlatformWorkflowInstances()
      expect(after).toHaveLength(0)
    })
  })

  describe('platform user tasks', () => {
    it('creates, gets, updates status and deletes a task', async () => {
      const workflow = await createPlatformWorkflow(sampleWorkflow)
      const instance = await createPlatformWorkflowInstance({
        workflowId: workflow.id,
        tableName: 'orders',
        recordId: 'orders:2',
        namespace: 'test',
        status: 'running',
      })
      const task = await createPlatformUserTask({
        instanceId: instance.id,
        type: 'approval',
        tableName: 'orders',
        recordId: 'orders:2',
        workflowId: workflow.id,
      })
      expect(task.id).toMatch(/^user_tasks:/)

      const found = await getPlatformUserTaskById(task.id)
      expect(found?.id).toBe(task.id)

      const updated = await updatePlatformUserTaskStatus(task.id, 'completed')
      expect(updated?.status).toBe('completed')

      await deletePlatformUserTask(task.id)
      const after = await listPlatformUserTasks()
      expect(after).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
pnpm --filter db test -- platform.test.ts
```

Expected: any SQL syntax errors will surface here. Fix them before moving on.

- [ ] **Step 3: Commit**

```bash
git add packages/db/test/platform.test.ts
git commit -m "test(db): add platform query tests"
```

**Implementation notes:**
- Fixed parameterized record IDs in platform queries.
- Normalized SurrealDB `RecordId` objects to strings across all helpers for stable assertions.
- Aligned platform test inputs with the real TypeScript interfaces.
- `listCompaniesForProfile` continues to query per-company `members` tables in tenant namespaces, matching production data model.

---

### Task 6: Test `src/tenant.ts`

**Files:**
- Create: `packages/db/test/tenant.test.ts`

- [ ] **Step 1: Create `packages/db/test/tenant.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  listMembers, createMember, getMemberById, getMemberByProfileId, getMemberByInviteCode, updateMember, deleteMember,
  listWorkflows, createWorkflow, getWorkflow, updateWorkflow, deleteWorkflow,
  listTriggers, createTrigger, deleteTrigger,
  listWorkflowInstances, createWorkflowInstance, getWorkflowInstance, findActiveWorkflowInstance, updateWorkflowInstanceStatus, deleteWorkflowInstance,
  listUserTasks, createUserTask, getUserTaskById, updateUserTaskStatus, deleteUserTask,
} from '../src/tenant.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'

const sampleWorkflow = {
  name: 'Tenant Workflow',
  xstateConfig: { id: 'wf', initial: 'idle', states: { idle: {} } },
}

describe('tenant', () => {
  let namespace: string

  beforeEach(async () => {
    namespace = uniqueTenantName()
    await createTenantNamespace(namespace)
  })

  afterEach(async () => {
    await removeTenantNamespace(namespace)
  })

  describe('members', () => {
    it('creates, lists, gets, updates and deletes a member', async () => {
      const member = await createMember(namespace, { email: 'a@example.com', role: 'admin' })
      expect(member.id).toMatch(/^members:/)

      const list = await listMembers(namespace)
      expect(list).toHaveLength(1)

      const found = await getMemberById(namespace, member.id)
      expect(found?.id).toBe(member.id)

      const byProfile = await getMemberByProfileId(namespace, member.profileId || 'none')
      expect(byProfile).toBeUndefined()

      const updated = await updateMember(namespace, member.id, { role: 'owner' })
      expect(updated?.role).toBe('owner')

      await deleteMember(namespace, member.id)
      const after = await listMembers(namespace)
      expect(after).toHaveLength(0)
    })

    it('finds a member by invite code', async () => {
      const member = await createMember(namespace, {
        email: 'invited@example.com',
        role: 'member',
        inviteCode: 'ABC123',
      })
      const found = await getMemberByInviteCode(namespace, 'ABC123')
      expect(found?.id).toBe(member.id)
    })

    it('finds a member by profile id', async () => {
      const member = await createMember(namespace, {
        email: 'profiled@example.com',
        role: 'member',
        profileId: 'profiles:1',
      })
      const found = await getMemberByProfileId(namespace, 'profiles:1')
      expect(found?.id).toBe(member.id)
    })
  })

  describe('workflows', () => {
    it('creates, lists, gets, updates and deletes a workflow', async () => {
      const created = await createWorkflow(namespace, sampleWorkflow)
      expect(created.id).toMatch(/^workflows:/)

      const list = await listWorkflows(namespace)
      expect(list).toHaveLength(1)

      const found = await getWorkflow(namespace, created.id)
      expect(found?.id).toBe(created.id)

      const updated = await updateWorkflow(namespace, created.id, { name: 'Renamed' })
      expect(updated?.name).toBe('Renamed')

      await deleteWorkflow(namespace, created.id)
      const after = await listWorkflows(namespace)
      expect(after).toHaveLength(0)
    })
  })

  describe('triggers', () => {
    it('creates, lists and deletes a trigger', async () => {
      const workflow = await createWorkflow(namespace, sampleWorkflow)
      const trigger = await createTrigger(namespace, { workflowId: workflow.id, tableName: 'orders', event: 'created' })
      expect(trigger.id).toMatch(/^triggers:/)

      const list = await listTriggers(namespace)
      expect(list).toHaveLength(1)

      await deleteTrigger(namespace, trigger.id)
      const after = await listTriggers(namespace)
      expect(after).toHaveLength(0)
    })
  })

  describe('workflow instances', () => {
    it('creates, gets, finds active, updates status and deletes', async () => {
      const workflow = await createWorkflow(namespace, sampleWorkflow)
      const instance = await createWorkflowInstance(namespace, { workflowId: workflow.id, status: 'running', tableName: 'orders', recordId: 'orders:1', namespace })
      expect(instance.id).toMatch(/^workflow_instances:/)

      const found = await getWorkflowInstance(namespace, instance.id)
      expect(found?.id).toBe(instance.id)

      const active = await findActiveWorkflowInstance(namespace, workflow.id, 'orders', 'orders:1')
      expect(active?.id).toBe(instance.id)

      const updated = await updateWorkflowInstanceStatus(namespace, instance.id, 'done')
      expect(updated?.status).toBe('done')

      await deleteWorkflowInstance(namespace, instance.id)
      const after = await listWorkflowInstances(namespace)
      expect(after).toHaveLength(0)
    })

    it('does not find an active instance for a different record', async () => {
      const workflow = await createWorkflow(namespace, sampleWorkflow)
      await createWorkflowInstance(namespace, { workflowId: workflow.id, status: 'running', tableName: 'other', recordId: 'other:1', namespace })

      const active = await findActiveWorkflowInstance(namespace, workflow.id, 'orders', 'orders:1')
      expect(active).toBeUndefined()
    })
  })

  describe('user tasks', () => {
    it('creates, gets, updates status and deletes a task', async () => {
      const workflow = await createWorkflow(namespace, sampleWorkflow)
      const instance = await createWorkflowInstance(namespace, { workflowId: workflow.id, status: 'running', tableName: 'orders', recordId: 'orders:1', namespace })
      const task = await createUserTask(namespace, {
        instanceId: instance.id,
        type: 'approval',
        tableName: 'orders',
        recordId: 'orders:1',
        workflowId: workflow.id,
      })
      expect(task.id).toMatch(/^user_tasks:/)

      const found = await getUserTaskById(namespace, task.id)
      expect(found?.id).toBe(task.id)

      const updated = await updateUserTaskStatus(namespace, task.id, 'completed')
      expect(updated?.status).toBe('completed')

      await deleteUserTask(namespace, task.id)
      const after = await listUserTasks(namespace)
      expect(after).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
pnpm --filter db test -- tenant.test.ts
```

Expected: any SQL syntax errors will surface here. Fix them before moving on.

- [ ] **Step 3: Commit**

```bash
git add packages/db/test/tenant.test.ts
git commit -m "test(db): add tenant query tests"
```

**Implementation notes:**
- Restored strict tenant input types and status unions in `src/tenant.ts`.
- Aligned tenant test inputs with the real input shapes.

---

### Task 7: Test `src/health-checks.ts`

**Files:**
- Create: `packages/db/test/health-checks.test.ts`

- [ ] **Step 1: Create `packages/db/test/health-checks.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createHealthCheck, listLatestHealthChecks, listHealthCheckHistory,
  listHealthCheckHistoryForService, pruneHealthChecks, pruneHealthChecksByAge,
} from '../src/health-checks.js'
import { resetPlatformTables } from './helpers.js'

describe('health-checks', () => {
  beforeEach(async () => {
    await resetPlatformTables()
  })

  it('creates and lists latest health checks', async () => {
    await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: 10, checkedAt: new Date().toISOString() })
    await createHealthCheck({ service: 'api', status: 'unhealthy', responseTimeMs: 20, checkedAt: new Date().toISOString() })

    const latest = await listLatestHealthChecks()
    expect(latest).toHaveLength(1)
    expect(latest[0].service).toBe('api')
  })

  it('lists history and history for a service', async () => {
    for (let i = 0; i < 5; i++) {
      await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: i, checkedAt: new Date().toISOString() })
    }
    const history = await listHealthCheckHistory(10)
    expect(history.length).toBeGreaterThanOrEqual(5)

    const forService = await listHealthCheckHistoryForService('api', 10)
    expect(forService.length).toBeGreaterThanOrEqual(5)
  })

  it('prunes by count', async () => {
    for (let i = 0; i < 5; i++) {
      await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: i, checkedAt: new Date().toISOString() })
    }
    await pruneHealthChecks('api', 2)
    const history = await listHealthCheckHistoryForService('api', 10)
    expect(history.length).toBeLessThanOrEqual(2)
  })

  it('prunes by age', async () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: 1, checkedAt: old })
    await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: 2, checkedAt: new Date().toISOString() })

    await pruneHealthChecksByAge('api', 60 * 60)
    const history = await listHealthCheckHistoryForService('api', 10)
    expect(history.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
pnpm --filter db test health-checks.test.ts
```

> Note: test files run sequentially (`fileParallelism: false`) because they share the same SurrealDB instance. The `--` separator is omitted so Vitest receives the file pattern directly.

Expected: all tests pass; any SQL errors surface here.

- [ ] **Step 3: Commit**

```bash
git add packages/db/test/health-checks.test.ts
git commit -m "test(db): add health-check query tests"
```

**Implementation notes:**
- Made `WorkflowInstanceInput.status` optional.
- Allowed arbitrary health-check service names and dynamic "latest" lookup.
- Strengthened health-check assertions and edge cases.
- Added `packages/db/test/normalize.test.ts` for the RecordId-to-string normalize helper.
- Made health-check timestamps deterministic to avoid flaky ordering assertions.
- Added a `checkedAt` index on the `health_checks` table.

---

### Task 8: Run the full DB test suite and fix issues

- [ ] **Step 1: Run all DB tests**

```bash
pnpm --filter db test
```

> Note: `fileParallelism: false` was added to `packages/db/vitest.config.ts` so the shared SurrealDB instance is not accessed concurrently.

**Implementation notes:**
- Set `fileParallelism: false` in `packages/db/vitest.config.ts`.
- Fixed SQL/query issues discovered while running platform, tenant, and health-check tests (see implementation notes in Tasks 5–7).

- [ ] **Step 2: Fix any failures**

For each failure:
1. Identify whether it is a SQL syntax error, type mismatch, or assertion failure.
2. Fix the source query in `packages/db/src/*` (not the test, unless the test expectation is wrong).
3. Re-run the affected test file until it passes.
4. Commit each fix independently with a message like `fix(db): correct DELETE/UPDATE/SELECT syntax in <function>`.

- [ ] **Step 3: Run `pnpm -r build`**

```bash
pnpm -r build
```

Expected: build passes with no new TypeScript errors.

---

### Task 9: Update documentation

**Files:**
- Create or modify: `docs/60-Development/Testing.md`

- [ ] **Step 1: Add a DB testing section**

If `docs/60-Development/Testing.md` does not exist, create it with frontmatter:

```yaml
---
title: Testing
type: runbook
status: done
area: docs
created: 2026-06-16
updated: 2026-06-16
related:
  - [[Getting Started]]
  - [[DB Package]]
---
```

Add content:

```markdown
# Testing

## DB package tests

The `packages/db` tests run against a real SurrealDB instance via Docker Compose. They exercise every exported query helper to catch SQL syntax errors and unexpected output.

### Prerequisites

```bash
docker compose up -d surrealdb
```

### Run all DB tests

```bash
pnpm --filter db test
```

### Run one test file

```bash
pnpm --filter db test client.test.ts
```

### Test isolation

- Platform tests clean the shared `platform/admin` tables before each test.
- Tenant tests create uniquely-named namespaces and remove them after each test.
- Test files run sequentially (`fileParallelism: false`) because they share the same SurrealDB instance.
```

- [ ] **Step 2: Update `docs/40-Packages/db.md`**

Add a "Testing" subsection under an appropriate heading:

```markdown
## Testing

See [[Testing]] for how to run the DB test suite.
```

- [ ] **Step 3: Run frontmatter script if needed**

```bash
node docs/scripts/apply-frontmatter.cjs
```

- [ ] **Step 4: Run typecheck and build**

```bash
pnpm --filter db typecheck
pnpm -r build
```

Expected: both pass with no new TypeScript errors.

- [ ] **Step 5: Commit**

Create separate commits:

```bash
git add docs/60-Development/Testing.md
git commit -m "docs: add DB testing runbook"

git add docs/40-Packages/db.md
git commit -m "docs: update db package note with testing section"

git add docs/superpowers/plans/2026-06-16-test-db-package.md
git commit -m "docs: update db test plan to match implementation"
```

---

## Self-review

**Spec coverage:** The plan tests every exported function in `packages/db/src/client.ts`, `provision.ts`, `platform.ts`, `tenant.ts`, and `health-checks.ts`.

**Placeholder scan:** No TBD/TODO placeholders remain. Every task includes exact file paths, code, and commands.

**Type consistency:** Type and function names match the current `packages/db/src` exports. Test helpers use the same `getSurreal`/`closeSurreal` connection pattern as production code.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-16-test-db-package.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?