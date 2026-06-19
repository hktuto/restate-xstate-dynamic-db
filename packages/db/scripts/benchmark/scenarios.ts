import { randomUUID } from 'node:crypto'
import type { WorkflowDefinition } from 'shared'
import * as platform from '../../src/platform.js'
import * as tenant from '../../src/tenant.js'
import * as health from '../../src/health-checks.js'
// The benchmark reuses the test helper infrastructure for namespace provisioning.
import {
  ensurePlatformNamespace,
  resetPlatformTables,
  createTenantNamespace,
  removeTenantNamespace,
} from '../../test/helpers.js'
import type { Scenario } from './runner.js'

const sampleWorkflow: WorkflowDefinition = {
  id: 'benchmark',
  initial: 'idle',
  states: { idle: {} },
}

let slugCounter = 0
let emailCounter = 0
let workflowNameCounter = 0

function uniqueSlug(): string {
  slugCounter++
  return `bench-${Date.now()}-${slugCounter}`
}

function uniqueEmail(): string {
  emailCounter++
  return `bench-${Date.now()}-${emailCounter}@example.com`
}

function uniqueWorkflowName(): string {
  workflowNameCounter++
  return `Benchmark ${Date.now()}-${workflowNameCounter}`
}

function uniqueTenantNamespace(): string {
  return `bench_tenant_${randomUUID().replaceAll('-', '_')}`
}

interface PlatformSetup {
  company: platform.CompanyRecord
  workflow: platform.PlatformWorkflowDesignRecord
  instance: platform.PlatformWorkflowInstanceRecord
  task: platform.PlatformUserTaskRecord
}

async function setupPlatform(): Promise<PlatformSetup> {
  await ensurePlatformNamespace()
  await resetPlatformTables()
  const company = await platform.createCompany({
    name: 'Benchmark Co',
    slug: 'bench-co',
    namespace: 'bench_co',
  })
  const workflow = await platform.createPlatformWorkflowDesign({
    name: uniqueWorkflowName(),
    xstateConfig: sampleWorkflow,
  })
  const instance = await platform.createPlatformWorkflowInstance({
    designId: workflow.id,
    status: 'running',
    triggerBy: { type: 'user_trigger', startState: 'idle' },
  })
  const task = await platform.createPlatformUserTask({
    instanceId: instance.id,
    type: 'approval',
    tableName: 'orders',
    recordId: 'orders:1',
    designId: workflow.id,
  })
  return { company, workflow, instance, task }
}

interface TenantSetup {
  member: tenant.MemberRecord
  design: tenant.WorkflowDesignRecord
  instance: tenant.WorkflowInstanceRecord
  task: tenant.UserTaskRecord
}

async function setupTenant(namespace: string): Promise<TenantSetup> {
  await createTenantNamespace(namespace)
  const member = await tenant.createMember(namespace, {
    email: uniqueEmail(),
    role: 'member',
  })
  const design = await tenant.createWorkflowDesign(namespace, {
    name: uniqueWorkflowName(),
    xstateConfig: sampleWorkflow,
  })
  const instance = await tenant.createWorkflowInstance(namespace, {
    designId: design.id,
    status: 'running',
    namespace,
    triggerBy: { type: 'user_trigger', startState: 'idle' },
  })
  const task = await tenant.createUserTask(namespace, {
    instanceId: instance.id,
    type: 'approval',
    tableName: 'orders',
    recordId: `orders:${randomUUID()}`,
    designId: design.id,
  })
  return { member, design, instance, task }
}

export const platformScenarios = [
  {
    name: 'createCompany',
    group: 'platform',
    setup: async () => {
      await ensurePlatformNamespace()
      await resetPlatformTables()
    },
    teardown: async () => {
      await resetPlatformTables()
    },
    fn: async () => {
      await platform.createCompany({
        name: 'Benchmark Co',
        slug: uniqueSlug(),
        namespace: uniqueSlug(),
      })
    },
  } satisfies Scenario<void>,
  {
    name: 'getCompanyBySlug',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state.company.slug
    },
    teardown: async () => {
      await resetPlatformTables()
    },
    fn: async (slug) => {
      if (!slug) throw new Error('getCompanyBySlug scenario state missing')
      await platform.getCompanyBySlug(slug)
    },
  } satisfies Scenario<string>,
  {
    name: 'createPlatformWorkflowDesign',
    group: 'platform',
    setup: async () => {
      await ensurePlatformNamespace()
      await resetPlatformTables()
    },
    teardown: async () => {
      await resetPlatformTables()
    },
    fn: async () => {
      await platform.createPlatformWorkflowDesign({
        name: uniqueWorkflowName(),
        xstateConfig: sampleWorkflow,
      })
    },
  } satisfies Scenario<void>,
  {
    name: 'getPlatformWorkflowDesign',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state.workflow.id
    },
    teardown: async () => {
      await resetPlatformTables()
    },
    fn: async (id) => {
      if (!id) throw new Error('getPlatformWorkflowDesign scenario state missing')
      await platform.getPlatformWorkflowDesign(id)
    },
  } satisfies Scenario<string>,
  {
    name: 'createPlatformWorkflowInstance',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state.workflow.id
    },
    teardown: async () => {
      await resetPlatformTables()
    },
    fn: async (designId) => {
      if (!designId) throw new Error('createPlatformWorkflowInstance scenario state missing')
      await platform.createPlatformWorkflowInstance({
        designId,
        status: 'running',
        triggerBy: { type: 'user_trigger', startState: 'idle' },
      })
    },
  } satisfies Scenario<string>,
  {
    name: 'getPlatformWorkflowInstance',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state.instance.id
    },
    teardown: async () => {
      await resetPlatformTables()
    },
    fn: async (id) => {
      if (!id) throw new Error('getPlatformWorkflowInstance scenario state missing')
      await platform.getPlatformWorkflowInstance(id)
    },
  } satisfies Scenario<string>,
  {
    name: 'createPlatformUserTask',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state
    },
    teardown: async () => {
      await resetPlatformTables()
    },
    fn: async (state) => {
      if (!state) throw new Error('createPlatformUserTask scenario state missing')
      const { workflow, instance } = state
      await platform.createPlatformUserTask({
        instanceId: instance.id,
        type: 'approval',
        tableName: 'orders',
        recordId: `orders:${randomUUID()}`,
        designId: workflow.id,
      })
    },
  } satisfies Scenario<PlatformSetup>,
  {
    name: 'getPlatformUserTaskById',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state.task.id
    },
    teardown: async () => {
      await resetPlatformTables()
    },
    fn: async (id) => {
      if (!id) throw new Error('getPlatformUserTaskById scenario state missing')
      await platform.getPlatformUserTaskById(id)
    },
  } satisfies Scenario<string>,
  {
    name: 'createHealthCheck',
    group: 'platform',
    setup: async () => {
      await ensurePlatformNamespace()
      await resetPlatformTables()
    },
    teardown: async () => {
      await resetPlatformTables()
    },
    fn: async () => {
      await health.createHealthCheck({
        service: 'api',
        status: 'healthy',
        responseTimeMs: 10,
        checkedAt: new Date().toISOString(),
      })
    },
  } satisfies Scenario<void>,
  {
    name: 'listLatestHealthChecks',
    group: 'platform',
    setup: async () => {
      await ensurePlatformNamespace()
      await resetPlatformTables()
      for (let i = 0; i < 100; i++) {
        await health.createHealthCheck({
          service: i % 2 === 0 ? 'api' : 'worker',
          status: 'healthy',
          responseTimeMs: i,
          checkedAt: new Date(Date.now() - i * 1000).toISOString(),
        })
      }
    },
    teardown: async () => {
      await resetPlatformTables()
    },
    fn: async () => {
      await health.listLatestHealthChecks()
    },
  } satisfies Scenario<void>,
]

interface TenantMemberState {
  namespace: string
  id: string
}

interface TenantWorkflowDesignState {
  namespace: string
  id: string
}

interface TenantWorkflowInstanceCreateState {
  namespace: string
  designId: string
}

interface TenantWorkflowInstanceGetState {
  namespace: string
  id: string
}

interface TenantUserTaskCreateState {
  namespace: string
  designId: string
  instanceId: string
}

interface TenantUserTaskGetState {
  namespace: string
  id: string
}

export const tenantScenarios = [
  {
    name: 'createMember',
    group: 'tenant',
    setup: async () => {
      const namespace = uniqueTenantNamespace()
      await createTenantNamespace(namespace)
      return namespace
    },
    teardown: async (namespace) => {
      if (!namespace) return
      await removeTenantNamespace(namespace)
    },
    fn: async (namespace) => {
      if (!namespace) throw new Error('createMember scenario state missing')
      await tenant.createMember(namespace, {
        email: uniqueEmail(),
        role: 'member',
      })
    },
  } satisfies Scenario<string>,
  {
    name: 'getMemberById',
    group: 'tenant',
    setup: async () => {
      const namespace = uniqueTenantNamespace()
      const state = await setupTenant(namespace)
      return { namespace, id: state.member.id }
    },
    teardown: async (state) => {
      if (!state) return
      await removeTenantNamespace(state.namespace)
    },
    fn: async (state) => {
      if (!state) throw new Error('getMemberById scenario state missing')
      const { namespace, id } = state
      await tenant.getMemberById(namespace, id)
    },
  } satisfies Scenario<TenantMemberState>,
  {
    name: 'createWorkflowDesign',
    group: 'tenant',
    setup: async () => {
      const namespace = uniqueTenantNamespace()
      await createTenantNamespace(namespace)
      return namespace
    },
    teardown: async (namespace) => {
      if (!namespace) return
      await removeTenantNamespace(namespace)
    },
    fn: async (namespace) => {
      if (!namespace) throw new Error('createWorkflowDesign scenario state missing')
      await tenant.createWorkflowDesign(namespace, {
        name: uniqueWorkflowName(),
        xstateConfig: sampleWorkflow,
      })
    },
  } satisfies Scenario<string>,
  {
    name: 'getWorkflowDesign',
    group: 'tenant',
    setup: async () => {
      const namespace = uniqueTenantNamespace()
      const state = await setupTenant(namespace)
      return { namespace, id: state.design.id }
    },
    teardown: async (state) => {
      if (!state) return
      await removeTenantNamespace(state.namespace)
    },
    fn: async (state) => {
      if (!state) throw new Error('getWorkflowDesign scenario state missing')
      const { namespace, id } = state
      await tenant.getWorkflowDesign(namespace, id)
    },
  } satisfies Scenario<TenantWorkflowDesignState>,
  {
    name: 'createWorkflowInstance',
    group: 'tenant',
    setup: async () => {
      const namespace = uniqueTenantNamespace()
      const state = await setupTenant(namespace)
      return { namespace, designId: state.design.id }
    },
    teardown: async (state) => {
      if (!state) return
      await removeTenantNamespace(state.namespace)
    },
    fn: async (state) => {
      if (!state) throw new Error('createWorkflowInstance scenario state missing')
      const { namespace, designId } = state
      await tenant.createWorkflowInstance(namespace, {
        designId,
        status: 'running',
        namespace,
        triggerBy: { type: 'user_trigger', startState: 'idle' },
      })
    },
  } satisfies Scenario<TenantWorkflowInstanceCreateState>,
  {
    name: 'getWorkflowInstance',
    group: 'tenant',
    setup: async () => {
      const namespace = uniqueTenantNamespace()
      const state = await setupTenant(namespace)
      return { namespace, id: state.instance.id }
    },
    teardown: async (state) => {
      if (!state) return
      await removeTenantNamespace(state.namespace)
    },
    fn: async (state) => {
      if (!state) throw new Error('getWorkflowInstance scenario state missing')
      const { namespace, id } = state
      await tenant.getWorkflowInstance(namespace, id)
    },
  } satisfies Scenario<TenantWorkflowInstanceGetState>,
  {
    name: 'createUserTask',
    group: 'tenant',
    setup: async () => {
      const namespace = uniqueTenantNamespace()
      const state = await setupTenant(namespace)
      return { namespace, designId: state.design.id, instanceId: state.instance.id }
    },
    teardown: async (state) => {
      if (!state) return
      await removeTenantNamespace(state.namespace)
    },
    fn: async (state) => {
      if (!state) throw new Error('createUserTask scenario state missing')
      const { namespace, designId, instanceId } = state
      await tenant.createUserTask(namespace, {
        instanceId,
        type: 'approval',
        tableName: 'orders',
        recordId: `orders:${randomUUID()}`,
        designId,
      })
    },
  } satisfies Scenario<TenantUserTaskCreateState>,
  {
    name: 'getUserTaskById',
    group: 'tenant',
    setup: async () => {
      const namespace = uniqueTenantNamespace()
      const state = await setupTenant(namespace)
      return { namespace, id: state.task.id }
    },
    teardown: async (state) => {
      if (!state) return
      await removeTenantNamespace(state.namespace)
    },
    fn: async (state) => {
      if (!state) throw new Error('getUserTaskById scenario state missing')
      const { namespace, id } = state
      await tenant.getUserTaskById(namespace, id)
    },
  } satisfies Scenario<TenantUserTaskGetState>,
]
