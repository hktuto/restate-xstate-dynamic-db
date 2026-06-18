import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createWorkflowDesign, getWorkflowDesign, createWorkflowInstance } from '../src/tenant.js'
import { createTenantNamespace, removeTenantNamespace } from './helpers.js'

describe('workflow designs', () => {
  beforeAll(async () => {
    await createTenantNamespace('test')
  })

  afterAll(async () => {
    await removeTenantNamespace('test')
  })

  it('stores starts array', async () => {
    const design = await createWorkflowDesign('test', {
      name: 'Onboarding',
      xstateConfig: { id: 'onboarding', initial: 'start', states: { start: { type: 'final' } } },
      starts: [{ type: 'user_trigger', startState: 'start', options: {} }]
    })
    const loaded = await getWorkflowDesign('test', design.id)
    expect(loaded?.starts).toHaveLength(1)
    expect(loaded?.starts?.[0].type).toBe('user_trigger')
  })

  it('creates instance with designId and triggerBy', async () => {
    const design = await createWorkflowDesign('test', {
      name: 'Onboarding',
      xstateConfig: { id: 'onboarding', initial: 'start', states: { start: { type: 'final' } } }
    })
    const instance = await createWorkflowInstance('test', {
      designId: design.id,
      namespace: 'test',
      triggerBy: { type: 'user_trigger', startState: 'start' }
    })
    expect(instance.designId).toBe(design.id)
    expect(instance.triggerBy?.type).toBe('user_trigger')
  })
})
