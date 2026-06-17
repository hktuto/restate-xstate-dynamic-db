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
