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

  it('normalizes a legacy entry/exit definition', () => {
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
    const { nodes } = definitionToGraph(legacy)
    const a = nodes.find(n => n.id === 'a')
    expect(a?.type).toBe('action')
    expect((a?.data as any).actionId).toBe('getRecord')
  })
})
