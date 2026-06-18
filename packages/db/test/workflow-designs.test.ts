import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createWorkflowDesign, getWorkflowDesign, createWorkflowInstance } from '../src/tenant.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'

describe('workflow designs', () => {
  let namespace: string

  beforeEach(async () => {
    namespace = uniqueTenantName()
    await createTenantNamespace(namespace)
  })

  afterEach(async () => {
    await removeTenantNamespace(namespace)
  })

  it('stores starts array', async () => {
    const design = await createWorkflowDesign(namespace, {
      name: 'Onboarding',
      xstateConfig: { id: 'onboarding', initial: 'start', states: { start: { type: 'final' } } },
      starts: [{ type: 'user_trigger', startState: 'start', options: {} }]
    })
    const loaded = await getWorkflowDesign(namespace, design.id)
    expect(loaded?.starts).toHaveLength(1)
    expect(loaded?.starts?.[0].type).toBe('user_trigger')
  })

  it('creates instance with designId and triggerBy', async () => {
    const design = await createWorkflowDesign(namespace, {
      name: 'Onboarding',
      xstateConfig: { id: 'onboarding', initial: 'start', states: { start: { type: 'final' } } }
    })
    const instance = await createWorkflowInstance(namespace, {
      designId: design.id,
      namespace,
      triggerBy: { type: 'user_trigger', startState: 'start' }
    })
    expect(instance.designId).toBe(design.id)
    expect(instance.triggerBy?.type).toBe('user_trigger')
  })
})
