import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  listMembers, createMember, getMemberById, getMemberByProfileId, getMemberByInviteCode, updateMember, deleteMember,
  listWorkflowDesigns, createWorkflowDesign, getWorkflowDesign, updateWorkflowDesign, deleteWorkflowDesign,
  listWorkflowInstances, createWorkflowInstance, getWorkflowInstance, updateWorkflowInstanceStatus, deleteWorkflowInstance,
  listUserTasks, createUserTask, getUserTaskById, updateUserTaskStatus, deleteUserTask,
} from '../src/tenant.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'

const sampleWorkflowDesign = {
  name: 'Tenant Workflow Design',
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

  describe('workflow designs', () => {
    it('creates, lists, gets, updates and deletes a workflow design', async () => {
      const created = await createWorkflowDesign(namespace, sampleWorkflowDesign)
      expect(created.id).toMatch(/^workflow_designs:/)

      const list = await listWorkflowDesigns(namespace)
      expect(list).toHaveLength(1)

      const found = await getWorkflowDesign(namespace, created.id)
      expect(found?.id).toBe(created.id)

      const updated = await updateWorkflowDesign(namespace, created.id, { name: 'Renamed' })
      expect(updated?.name).toBe('Renamed')

      await deleteWorkflowDesign(namespace, created.id)
      const after = await listWorkflowDesigns(namespace)
      expect(after).toHaveLength(0)
    })

    it('stores db_trigger start rules on a workflow design', async () => {
      const design = await createWorkflowDesign(namespace, {
        ...sampleWorkflowDesign,
        starts: [{ type: 'db_trigger', startState: 'idle', options: { tableName: 'orders', event: 'created' } }],
      })
      const found = await getWorkflowDesign(namespace, design.id)
      expect(found?.starts).toHaveLength(1)
      expect(found?.starts?.[0].type).toBe('db_trigger')
    })
  })

  describe('workflow instances', () => {
    it('creates, gets, updates status and deletes', async () => {
      const design = await createWorkflowDesign(namespace, sampleWorkflowDesign)
      const instance = await createWorkflowInstance(namespace, {
        designId: design.id,
        status: 'running',
        namespace,
        triggerBy: { type: 'user_trigger', startState: 'idle' },
      })
      expect(instance.id).toMatch(/^workflow_instances:/)

      const found = await getWorkflowInstance(namespace, instance.id)
      expect(found?.id).toBe(instance.id)

      const updated = await updateWorkflowInstanceStatus(namespace, instance.id, 'done')
      expect(updated?.status).toBe('done')

      await deleteWorkflowInstance(namespace, instance.id)
      const after = await listWorkflowInstances(namespace)
      expect(after).toHaveLength(0)
    })
  })

  describe('user tasks', () => {
    it('creates, gets, updates status and deletes a task', async () => {
      const design = await createWorkflowDesign(namespace, sampleWorkflowDesign)
      const instance = await createWorkflowInstance(namespace, {
        designId: design.id,
        status: 'running',
        namespace,
        triggerBy: { type: 'user_trigger', startState: 'idle' },
      })
      const task = await createUserTask(namespace, {
        instanceId: instance.id,
        type: 'approval',
        tableName: 'orders',
        recordId: 'orders:1',
        designId: design.id,
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
