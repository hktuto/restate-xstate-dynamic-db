import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPlatformWorkflowDesign, getPlatformWorkflowDesign, createPlatformWorkflowInstance } from '../src/platform.js'
import { ensurePlatformNamespace, resetPlatformTables } from './helpers.js'

describe('platform workflow designs', () => {
  beforeEach(async () => {
    await ensurePlatformNamespace()
    await resetPlatformTables()
  })

  afterEach(async () => {
    await resetPlatformTables()
  })

  it('stores starts array', async () => {
    const design = await createPlatformWorkflowDesign('platform', {
      name: 'Onboarding',
      xstateConfig: { id: 'onboarding', initial: 'start', states: { start: { type: 'final' } } },
      starts: [{ type: 'user_trigger', startState: 'start', options: {} }]
    })
    const loaded = await getPlatformWorkflowDesign('platform', design.id)
    expect(loaded?.starts).toHaveLength(1)
    expect(loaded?.starts?.[0].type).toBe('user_trigger')
  })

  it('creates instance with designId and triggerBy', async () => {
    const design = await createPlatformWorkflowDesign('platform', {
      name: 'Onboarding',
      xstateConfig: { id: 'onboarding', initial: 'start', states: { start: { type: 'final' } } }
    })
    const instance = await createPlatformWorkflowInstance('platform', {
      designId: design.id,
      namespace: 'platform',
      triggerBy: { type: 'user_trigger', startState: 'start' }
    })
    expect(instance.designId).toBe(design.id)
    expect(instance.triggerBy?.type).toBe('user_trigger')
  })
})
