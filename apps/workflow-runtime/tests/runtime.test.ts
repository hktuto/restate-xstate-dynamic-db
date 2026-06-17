import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { RestateTestEnvironment } from '@restatedev/restate-sdk-testcontainers'
import * as clients from '@restatedev/restate-sdk-clients'
import { randomUUID } from 'node:crypto'
import type { AnyMachineSnapshot } from 'xstate'
import type { WorkflowDefinition } from 'shared'
import { getSurreal, closeSurreal } from 'db/client'
import { workflowObject } from '../src/workflow.js'

function ctx(snapshot: AnyMachineSnapshot): Record<string, unknown> {
  return snapshot.context as Record<string, unknown>
}

async function createTestNamespace() {
  const ns = `e2e_${randomUUID().replace(/-/g, '_')}`
  const surreal = await getSurreal(ns, 'main')
  try {
    await surreal.query(`DEFINE NAMESPACE IF NOT EXISTS ${ns}`)
    await surreal.query('DEFINE DATABASE IF NOT EXISTS main')
  } finally {
    await closeSurreal(surreal)
  }
  return ns
}

async function removeNamespace(ns: string) {
  const surreal = await getSurreal(ns, 'main')
  try {
    await surreal.query(`REMOVE NAMESPACE ${ns}`)
  } finally {
    await closeSurreal(surreal)
  }
}

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
    await expect(client.send({ event: 'start' })).rejects.toThrow('Workflow instance not found')
  })

  it('branches true on a condition action', async () => {
    const instanceId = randomUUID()
    const client = rs.objectClient(workflowObject, instanceId)
    const config: WorkflowDefinition = {
      id: 'condition-test',
      initial: 'check',
      states: {
        check: {
          meta: {
            action: 'condition',
            params: {
              expression: { $eq: ['$context.record.status', 'active'] }
            }
          },
          on: {
            true: { target: 'active' },
            false: { target: 'inactive' }
          }
        },
        active: { type: 'final' },
        inactive: { type: 'final' }
      }
    }

    const snapshot = await client.create({
      config,
      event: 'start',
      tableName: 'tests',
      record: { id: '1', status: 'active' },
      workflowId: 'condition-test'
    })

    expect(snapshot.value).toBe('active')
  })

  it('branches false on a condition action', async () => {
    const instanceId = randomUUID()
    const client = rs.objectClient(workflowObject, instanceId)
    const config: WorkflowDefinition = {
      id: 'condition-test',
      initial: 'check',
      states: {
        check: {
          meta: {
            action: 'condition',
            params: {
              expression: { $eq: ['$context.record.status', 'active'] }
            }
          },
          on: {
            true: { target: 'active' },
            false: { target: 'inactive' }
          }
        },
        active: { type: 'final' },
        inactive: { type: 'final' }
      }
    }

    const snapshot = await client.create({
      config,
      event: 'start',
      tableName: 'tests',
      record: { id: '2', status: 'inactive' },
      workflowId: 'condition-test'
    })

    expect(snapshot.value).toBe('inactive')
  })

  it('creates a record via createRecord action', async () => {
    const ns = await createTestNamespace()
    try {
      const instanceId = randomUUID()
      const client = rs.objectClient(workflowObject, instanceId)
      const config: WorkflowDefinition = {
        id: 'create-test',
        initial: 'create',
        states: {
          create: {
            meta: {
              action: 'createRecord',
              params: {
                table: 'e2e_records',
                fields: { name: 'Alice', status: 'pending' }
              },
              outputKey: 'newRecord'
            },
            on: { ok: { target: 'done' }, error: { target: 'failed' } }
          },
          done: { type: 'final' },
          failed: { type: 'final' }
        }
      }

      const snapshot = await client.create({
        config,
        event: 'start',
        tableName: 'e2e_records',
        record: {},
        namespace: ns,
        workflowId: 'create-test'
      })

      expect(snapshot.value).toBe('done')
      expect(ctx(snapshot).newRecord).toMatchObject({ name: 'Alice', status: 'pending' })
    } finally {
      await removeNamespace(ns)
    }
  })

  it('queries and updates a record via getRecord and updateRecord', async () => {
    const ns = await createTestNamespace()
    try {
      const root = await getSurreal(ns, 'main')
      await root.query('CREATE e2e_records CONTENT $data', { data: { name: 'Bob', status: 'active' } })
      await closeSurreal(root)

      const instanceId = randomUUID()
      const client = rs.objectClient(workflowObject, instanceId)
      const config: WorkflowDefinition = {
        id: 'get-update-test',
        initial: 'fetch',
        states: {
          fetch: {
            meta: {
              action: 'getRecord',
              params: { table: 'e2e_records', filter: { name: { $eq: 'Bob' } }, result: { type: 'first' } },
              outputKey: 'record'
            },
            on: { ok: { target: 'update' }, error: { target: 'failed' } }
          },
          update: {
            meta: {
              action: 'updateRecord',
              params: { table: 'e2e_records', fields: { status: 'processed' } },
              outputKey: 'updatedRecord'
            },
            on: { ok: { target: 'done' }, error: { target: 'failed' } }
          },
          done: { type: 'final' },
          failed: { type: 'final' }
        }
      }

      const snapshot = await client.create({
        config,
        event: 'start',
        tableName: 'e2e_records',
        record: {},
        namespace: ns,
        workflowId: 'get-update-test'
      })

      expect(snapshot.value).toBe('done')
      expect((ctx(snapshot).record as Record<string, unknown>).status).toBe('active')
      expect((ctx(snapshot).updatedRecord as Record<string, unknown>).status).toBe('processed')
    } finally {
      await removeNamespace(ns)
    }
  })

  it('soft deletes a record via deleteRecord action', async () => {
    const ns = await createTestNamespace()
    try {
      const root = await getSurreal(ns, 'main')
      const [created] = await root.query<[{ id: string }[]]>('CREATE e2e_records CONTENT $data', { data: { name: 'Charlie', status: 'active' } })
      const recordId = created[0].id
      await closeSurreal(root)

      const instanceId = randomUUID()
      const client = rs.objectClient(workflowObject, instanceId)
      const config: WorkflowDefinition = {
        id: 'delete-test',
        initial: 'fetch',
        states: {
          fetch: {
            meta: {
              action: 'getRecord',
              params: { table: 'e2e_records', filter: { name: { $eq: 'Charlie' } }, result: { type: 'first' } },
              outputKey: 'record'
            },
            on: { ok: { target: 'del' }, error: { target: 'failed' } }
          },
          del: {
            meta: {
              action: 'deleteRecord',
              params: { table: 'e2e_records', mode: 'soft' },
              outputKey: 'deletedRecord'
            },
            on: { ok: { target: 'done' }, error: { target: 'failed' } }
          },
          done: { type: 'final' },
          failed: { type: 'final' }
        }
      }

      const snapshot = await client.create({
        config,
        event: 'start',
        tableName: 'e2e_records',
        record: {},
        namespace: ns,
        workflowId: 'delete-test'
      })

      expect(snapshot.value).toBe('done')
      expect((ctx(snapshot).record as Record<string, unknown>).status).toBe('active')
      expect((ctx(snapshot).deletedRecord as Record<string, unknown>).status).toBe('deleted')

      const verify = await getSurreal(ns, 'main')
      try {
        const [rows] = await verify.query<[{ status: string }[]]>('SELECT status FROM type::record($id)', { id: recordId })
        expect(rows[0].status).toBe('deleted')
      } finally {
        await closeSurreal(verify)
      }
    } finally {
      await removeNamespace(ns)
    }
  })
})
