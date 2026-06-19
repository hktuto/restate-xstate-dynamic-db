import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { RestateTestEnvironment } from '@restatedev/restate-sdk-testcontainers'
import * as clients from '@restatedev/restate-sdk-clients'
import { randomUUID } from 'node:crypto'
import type { AnyMachineSnapshot } from 'xstate'
import type { WorkflowDefinition } from 'shared'
import { getSurreal, closeSurreal } from 'db/client'
import { listWorkflowActionsByInstance } from 'db/workflow-actions'
import { workflowObject } from '../src/workflow.js'

function ctx(snapshot: AnyMachineSnapshot): Record<string, unknown> {
  return snapshot.context as Record<string, unknown>
}

const mockDesigns = new Map<string, { xstateConfig: WorkflowDefinition }>()

function setMockDesign(designId: string, xstateConfig: WorkflowDefinition) {
  mockDesigns.set(designId, { xstateConfig })
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
        if (url.startsWith('http://localhost:3002/api/workflow-designs/')) {
          const designId = url.split('/').pop()!
          return { ok: true, status: 200, json: async () => mockDesigns.get(designId) ?? {} } as Response
        }
        if (url.startsWith('http://localhost:3002/api/')) {
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

  afterEach(() => {
    mockDesigns.clear()
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    if (env !== undefined) {
      await env.stop()
    }
  })

  it('creates and sends events to a workflow instance', async () => {
    const instanceId = randomUUID()
    const client = rs.objectClient(workflowObject, instanceId)

    const designId = 'test'
    const config = {
      id: designId,
      initial: 'idle',
      states: {
        idle: { on: { start: 'running' } },
        running: { on: { finish: 'done' } },
        done: { type: 'final' }
      }
    } as unknown as WorkflowDefinition
    setMockDesign(designId, config)

    const afterStart = await client.create({
      designId,
      trigger: { type: 'user_trigger', startState: 'running' },
      context: {},
      createdBy: 'test'
    })
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
    const designId = 'condition-test'
    const config: WorkflowDefinition = {
      id: designId,
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
    setMockDesign(designId, config)

    const snapshot = await client.create({
      designId,
      trigger: { type: 'user_trigger', startState: 'check' },
      context: { record: { id: '1', status: 'active' } },
      createdBy: 'test'
    })

    expect(snapshot.value).toBe('active')
  })

  it('branches false on a condition action', async () => {
    const instanceId = randomUUID()
    const client = rs.objectClient(workflowObject, instanceId)
    const designId = 'condition-test'
    const config: WorkflowDefinition = {
      id: designId,
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
    setMockDesign(designId, config)

    const snapshot = await client.create({
      designId,
      trigger: { type: 'user_trigger', startState: 'check' },
      context: { record: { id: '2', status: 'inactive' } },
      createdBy: 'test'
    })

    expect(snapshot.value).toBe('inactive')
  })

  it('creates a record via createRecord action', async () => {
    const ns = await createTestNamespace()
    try {
      const instanceId = randomUUID()
      const client = rs.objectClient(workflowObject, instanceId)
      const designId = 'create-test'
      const config: WorkflowDefinition = {
        id: designId,
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
      setMockDesign(designId, config)

      const snapshot = await client.create({
        designId,
        trigger: { type: 'user_trigger', startState: 'create' },
        context: { record: {} },
        createdBy: 'test',
        namespace: ns
      })

      expect(snapshot.value).toBe('done')
      expect(ctx(snapshot).newRecord).toMatchObject({ name: 'Alice', status: 'pending' })
    } finally {
      await removeNamespace(ns)
    }
  })

  it('records workflow_actions audit rows', async () => {
    const ns = await createTestNamespace()
    try {
      const instanceId = randomUUID()
      const client = rs.objectClient(workflowObject, instanceId)
      const designId = 'audit-test'
      const config: WorkflowDefinition = {
        id: designId,
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
      setMockDesign(designId, config)

      const snapshot = await client.create({
        designId,
        trigger: { type: 'user_trigger', startState: 'create' },
        context: { record: {} },
        createdBy: 'test',
        namespace: ns
      })

      expect(snapshot.value).toBe('done')

      const actions = await listWorkflowActionsByInstance(ns, instanceId)
      expect(actions.length).toBe(1)
      expect(actions[0].action).toBe('createRecord')
      expect(actions[0].status).toBe('completed')
      expect(actions[0].resultEvent).toBe('ok')
      expect(actions[0].outputData).toMatchObject({ name: 'Alice', status: 'pending' })
    } finally {
      await removeNamespace(ns)
    }
  })

  it('records condition audit rows with true and false result events', async () => {
    const ns = await createTestNamespace()
    try {
      const instanceIdTrue = randomUUID()
      const clientTrue = rs.objectClient(workflowObject, instanceIdTrue)
      const designIdTrue = 'condition-audit-true'
      const trueConfig: WorkflowDefinition = {
        id: designIdTrue,
        initial: 'check',
        states: {
          check: {
            meta: {
              action: 'condition',
              params: { expression: { $eq: ['$context.record.status', 'active'] } }
            },
            on: { true: { target: 'done' }, false: { target: 'done' } }
          },
          done: { type: 'final' }
        }
      }
      setMockDesign(designIdTrue, trueConfig)

      const trueSnapshot = await clientTrue.create({
        designId: designIdTrue,
        trigger: { type: 'user_trigger', startState: 'check' },
        context: { record: { id: '1', status: 'active' } },
        createdBy: 'test',
        namespace: ns
      })

      expect(trueSnapshot.value).toBe('done')

      const trueActions = await listWorkflowActionsByInstance(ns, instanceIdTrue)
      expect(trueActions.length).toBe(1)
      expect(trueActions[0].action).toBe('condition')
      expect(trueActions[0].status).toBe('completed')
      expect(trueActions[0].resultEvent).toBe('true')

      const instanceIdFalse = randomUUID()
      const clientFalse = rs.objectClient(workflowObject, instanceIdFalse)
      const designIdFalse = 'condition-audit-false'
      const falseConfig: WorkflowDefinition = {
        id: designIdFalse,
        initial: 'check',
        states: {
          check: {
            meta: {
              action: 'condition',
              params: { expression: { $eq: ['$context.record.status', 'active'] } }
            },
            on: { true: { target: 'done' }, false: { target: 'done' } }
          },
          done: { type: 'final' }
        }
      }
      setMockDesign(designIdFalse, falseConfig)

      const falseSnapshot = await clientFalse.create({
        designId: designIdFalse,
        trigger: { type: 'user_trigger', startState: 'check' },
        context: { record: { id: '2', status: 'inactive' } },
        createdBy: 'test',
        namespace: ns
      })

      expect(falseSnapshot.value).toBe('done')

      const falseActions = await listWorkflowActionsByInstance(ns, instanceIdFalse)
      expect(falseActions.length).toBe(1)
      expect(falseActions[0].resultEvent).toBe('false')
    } finally {
      await removeNamespace(ns)
    }
  })

  it('records audit rows for a multi-state workflow', async () => {
    const ns = await createTestNamespace()
    try {
      const root = await getSurreal(ns, 'main')
      await root.query('CREATE e2e_records CONTENT $data', { data: { name: 'Bob', status: 'active' } })
      await closeSurreal(root)

      const instanceId = randomUUID()
      const client = rs.objectClient(workflowObject, instanceId)
      const designId = 'multi-audit-test'
      const config: WorkflowDefinition = {
        id: designId,
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
      setMockDesign(designId, config)

      const snapshot = await client.create({
        designId,
        trigger: { type: 'user_trigger', startState: 'fetch' },
        context: { record: {} },
        createdBy: 'test',
        namespace: ns
      })

      expect(snapshot.value).toBe('done')

      const actions = await listWorkflowActionsByInstance(ns, instanceId)
      expect(actions.length).toBe(2)

      const fetchAction = actions.find((a) => a.stateId === 'fetch')
      const updateAction = actions.find((a) => a.stateId === 'update')

      expect(fetchAction).toBeDefined()
      expect(fetchAction!.action).toBe('getRecord')
      expect(fetchAction!.status).toBe('completed')
      expect(fetchAction!.resultEvent).toBe('ok')
      expect(fetchAction!.outputData).toMatchObject({ name: 'Bob', status: 'active' })

      expect(updateAction).toBeDefined()
      expect(updateAction!.action).toBe('updateRecord')
      expect(updateAction!.status).toBe('completed')
      expect(updateAction!.resultEvent).toBe('ok')
      expect(updateAction!.inputContext).toMatchObject({ record: { name: 'Bob', status: 'active' } })
      expect(updateAction!.outputContext).toMatchObject({
        record: { name: 'Bob', status: 'active' },
        updatedRecord: { status: 'processed' }
      })
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
      const designId = 'get-update-test'
      const config: WorkflowDefinition = {
        id: designId,
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
      setMockDesign(designId, config)

      const snapshot = await client.create({
        designId,
        trigger: { type: 'user_trigger', startState: 'fetch' },
        context: { record: {} },
        createdBy: 'test',
        namespace: ns
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
      const designId = 'delete-test'
      const config: WorkflowDefinition = {
        id: designId,
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
      setMockDesign(designId, config)

      const snapshot = await client.create({
        designId,
        trigger: { type: 'user_trigger', startState: 'fetch' },
        context: { record: {} },
        createdBy: 'test',
        namespace: ns
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
