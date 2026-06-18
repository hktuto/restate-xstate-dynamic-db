import { describe, it, expect } from 'vitest'
import type { WorkflowDefinition } from 'shared'
import { useWorkflowGraph } from '../useWorkflowGraph.js'

const sample: WorkflowDefinition = {
  id: 'provisionCompany',
  initial: 'getCompany',
  states: {
    getCompany: {
      meta: { action: 'getRecord', params: { table: 'companies', filter: { id: { $context: 'record.id' } }, result: { type: 'first' } }, outputKey: 'company' },
      on: { ok: { target: 'checkExists' }, error: { target: 'failed' } }
    },
    checkExists: {
      meta: { action: 'condition', params: { expression: { $ne: [{ $context: 'company' }, null] } } },
      on: { true: { target: 'done' }, false: { target: 'approveProvision' } }
    },
    approveProvision: {
      tags: ['waiting'],
      meta: { taskType: 'approval', taskInstructions: 'Approve provisioning' },
      on: { approved: { target: 'done' }, rejected: { target: 'failed' } }
    },
    done: { type: 'final' },
    failed: { type: 'final' }
  },
  context: {},
  meta: { editorPositions: { getCompany: { x: 10, y: 20 } } }
}

describe('useWorkflowGraph', () => {
  const { definitionToGraph, graphToDefinition, START_NODE_ID } = useWorkflowGraph()

  it('converts a definition to a graph with a start node', () => {
    const { nodes, edges } = definitionToGraph(sample)
    expect(nodes.find(n => n.id === START_NODE_ID)).toBeDefined()
    expect(nodes.find(n => n.id === 'getCompany')?.type).toBe('action')
    expect(nodes.find(n => n.id === 'checkExists')?.type).toBe('condition')
    expect(nodes.find(n => n.id === 'approveProvision')?.type).toBe('task')
    expect(nodes.find(n => n.id === 'done')?.type).toBe('final')
  })

  it('round-trips a definition', () => {
    const { nodes, edges } = definitionToGraph(sample)
    const rebuilt = graphToDefinition(nodes, edges, sample)
    expect(rebuilt.initial).toBe('getCompany')
    expect(rebuilt.states.getCompany.meta).toEqual(sample.states.getCompany.meta)
    expect(rebuilt.states.approveProvision.tags).toEqual(['waiting'])
    expect(rebuilt.states.done.type).toBe('final')
  })

  it('drops legacy entry/exit and transition actions, keeping meta.action', () => {
    const legacy: WorkflowDefinition = {
      id: 'legacy',
      initial: 'a',
      states: {
        a: {
          entry: ['getRecord'],
          exit: [{ id: 'createRecord', params: {} }],
          meta: { action: 'getRecord', params: {} },
          on: { ok: { target: 'b', actions: ['foo'] } }
        },
        b: { type: 'final' }
      }
    }
    const { nodes, edges } = definitionToGraph(legacy)
    const a = nodes.find(n => n.id === 'a')
    expect(a?.type).toBe('action')
    if (a?.type !== 'action') throw new Error('expected action node')
    expect(a.data.actionId).toBe('getRecord')

    const rebuilt = graphToDefinition(nodes, edges, legacy)
    expect(rebuilt.states.a).not.toHaveProperty('entry')
    expect(rebuilt.states.a).not.toHaveProperty('exit')
    expect(rebuilt.states.a.on?.ok).not.toHaveProperty('actions')
    expect(rebuilt.states.a.meta?.action).toBe('getRecord')
  })

  it('preserves editor positions through a round-trip', () => {
    const { nodes, edges } = definitionToGraph(sample)
    const rebuilt = graphToDefinition(nodes, edges, sample)
    expect(rebuilt.meta?.editorPositions?.getCompany).toEqual(sample.meta?.editorPositions?.getCompany)
  })

  it('produces only a start node for an empty definition', () => {
    const empty: WorkflowDefinition = { id: 'empty', initial: '', states: {}, context: {} }
    const { nodes, edges } = definitionToGraph(empty)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.id).toBe(START_NODE_ID)
    expect(edges).toHaveLength(0)
  })

  it('turns a state tagged with waiting into a task node', () => {
    const def: WorkflowDefinition = {
      id: 'task',
      initial: 't',
      states: {
        t: { tags: ['waiting'], meta: { taskType: 'review' } }
      },
      context: {}
    }
    const { nodes } = definitionToGraph(def)
    expect(nodes.find(n => n.id === 't')?.type).toBe('task')
  })
})
