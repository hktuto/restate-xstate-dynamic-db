import { describe, it, expect } from 'vitest'
import { createPlatformWorkflowDesign, getPlatformWorkflowDesign, createPlatformWorkflowInstance } from '../src/platform.js'

describe('platform workflow designs', () => {
  it('stores starts array', async () => {
    const design = await createPlatformWorkflowDesign('main', {
      name: 'Onboarding',
      xstateConfig: { id: 'onboarding', initial: 'start', states: { start: { type: 'final' } } },
      starts: [{ type: 'user_trigger', startState: 'start', options: {} }]
    })
    const loaded = await getPlatformWorkflowDesign('main', design.id)
    expect(loaded?.starts).toHaveLength(1)
    expect(loaded?.starts?.[0].type).toBe('user_trigger')
  })

  it('creates instance with designId and triggerBy', async () => {
    const design = await createPlatformWorkflowDesign('main', {
      name: 'Onboarding',
      xstateConfig: { id: 'onboarding', initial: 'start', states: { start: { type: 'final' } } }
    })
    const instance = await createPlatformWorkflowInstance('main', {
      designId: design.id,
      namespace: 'main',
      triggerBy: { type: 'user_trigger', startState: 'start' }
    })
    expect(instance.designId).toBe(design.id)
    expect(instance.triggerBy?.type).toBe('user_trigger')
  })
})
