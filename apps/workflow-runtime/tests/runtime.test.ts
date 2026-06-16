import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { RestateTestEnvironment } from '@restatedev/restate-sdk-testcontainers'
import * as clients from '@restatedev/restate-sdk-clients'
import { randomUUID } from 'node:crypto'
import type { WorkflowDefinition } from 'shared'
import { workflowObject } from '../src/workflow.js'

describe('workflow runtime', () => {
  let env: RestateTestEnvironment
  let rs: clients.Ingress

  beforeAll(() => {
    const originalFetch = globalThis.fetch
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.startsWith('http://localhost:3000/api/')) {
          return { ok: true, status: 200, json: async () => ({}) } as Response
        }
        return originalFetch(input, init)
      })
    )
  })

  beforeAll(async () => {
    env = await RestateTestEnvironment.start({
      services: [workflowObject]
    })
    rs = clients.connect({ url: env.baseUrl() })
  }, 20000)

  afterAll(async () => {
    vi.unstubAllGlobals()
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
