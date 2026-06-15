import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RestateTestEnvironment } from '@restatedev/restate-sdk-testcontainers'
import * as clients from '@restatedev/restate-sdk-clients'
import { randomUUID } from 'node:crypto'
import type { WorkflowDefinition } from 'shared'
import { workflowObject } from '../src/workflow.js'

describe('workflow runtime', () => {
  let env: RestateTestEnvironment
  let rs: clients.Ingress

  beforeAll(async () => {
    env = await RestateTestEnvironment.start({
      services: [workflowObject]
    })
    rs = clients.connect({ url: env.baseUrl() })
  }, 20000)

  afterAll(async () => {
    if (env !== undefined) {
      await env.stop()
    }
  })

  it('creates and sends events to a workflow instance', async () => {
    const instanceId = randomUUID()
    const client = rs.objectClient(workflowObject, instanceId)

    const config = {
      id: 'test',
      initial: 'idle',
      states: {
        idle: { on: { start: 'running' } },
        running: { on: { finish: 'done' } },
        done: { type: 'final' }
      }
    } as unknown as WorkflowDefinition

    const afterStart = await client.create({ config, event: 'start', tableName: 'tests', record: { id: '1' }, workflowId: 'test' })
    expect(afterStart.value).toBe('running')

    const afterFinish = await client.send({ event: 'finish' })
    expect(afterFinish.value).toBe('done')
    expect(afterFinish.status).toBe('done')
  })

  it('returns 404 when sending to a missing instance', async () => {
    const client = rs.objectClient(workflowObject, randomUUID())
    await expect(client.send({ event: 'start' })).rejects.toThrow()
  })
})
