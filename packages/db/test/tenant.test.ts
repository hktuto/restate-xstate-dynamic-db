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
