import { describe, it, expect, beforeEach } from 'vitest'
import {
  listPlatformWorkflowDesigns, createPlatformWorkflowDesign, getPlatformWorkflowDesign, updatePlatformWorkflowDesign, deletePlatformWorkflowDesign,
  listPlatformWorkflowInstances, createPlatformWorkflowInstance, getPlatformWorkflowInstance,
  updatePlatformWorkflowInstanceStatus, deletePlatformWorkflowInstance,
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

const sampleWorkflowWithTrigger = {
  name: 'Triggered Workflow',
  xstateConfig: { id: 'triggered', initial: 'idle', states: { idle: {} } },
  starts: [{ type: 'db_trigger' as const, startState: 'idle', options: { tableName: 'orders', event: 'created' } }],
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

  describe('platform workflow designs', () => {
    it('creates, lists, gets, updates and deletes a workflow design', async () => {
      const created = await createPlatformWorkflowDesign(sampleWorkflow)
      expect(created.id).toMatch(/^workflow_designs:/)

      const list = await listPlatformWorkflowDesigns()
      expect(list).toHaveLength(1)

      const found = await getPlatformWorkflowDesign(created.id)
      expect(found?.id).toBe(created.id)

      const updated = await updatePlatformWorkflowDesign(created.id, { name: 'Renamed' })
      expect(updated?.name).toBe('Renamed')

      await deletePlatformWorkflowDesign(created.id)
      const after = await listPlatformWorkflowDesigns()
      expect(after).toHaveLength(0)
    })

    it('stores db_trigger starts inside a workflow design', async () => {
      const created = await createPlatformWorkflowDesign(sampleWorkflowWithTrigger)
      const found = await getPlatformWorkflowDesign(created.id)
      expect(found?.starts).toHaveLength(1)
      expect(found?.starts?.[0].type).toBe('db_trigger')
      expect(found?.starts?.[0].startState).toBe('idle')
    })
  })

  describe('platform workflow instances', () => {
    it('creates, gets, updates status and deletes', async () => {
      const design = await createPlatformWorkflowDesign(sampleWorkflow)
      const instance = await createPlatformWorkflowInstance({
        designId: design.id,
        status: 'running',
        triggerBy: { type: 'user_trigger', startState: 'idle' },
      })
      expect(instance.id).toMatch(/^workflow_instances:/)

      const found = await getPlatformWorkflowInstance(instance.id)
      expect(found?.id).toBe(instance.id)

      const updated = await updatePlatformWorkflowInstanceStatus(instance.id, 'done')
      expect(updated?.status).toBe('done')

      await deletePlatformWorkflowInstance(instance.id)
      const after = await listPlatformWorkflowInstances()
      expect(after).toHaveLength(0)
    })
  })

  describe('platform user tasks', () => {
    it('creates, gets, updates status and deletes a task', async () => {
      const design = await createPlatformWorkflowDesign(sampleWorkflow)
      const instance = await createPlatformWorkflowInstance({
        designId: design.id,
        status: 'running',
      })
      const task = await createPlatformUserTask({
        instanceId: instance.id,
        type: 'approval',
        tableName: 'orders',
        recordId: 'orders:2',
        workflowId: design.id,
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
