import { getSurreal, closeSurreal } from 'db/client'
import { normalizeId, normalizeIds } from 'db/normalize'
import type { ActionExecutor, ActionExecutorContext, RuntimeAction } from '../types.js'
import { buildSelectQuery } from './query-builder.js'
import { evaluateExpression } from './expression.js'

function requireNamespace(ctx: ActionExecutorContext): string {
  if (!ctx.namespace) throw new Error('namespace is required for CRUD actions')
  return ctx.namespace
}

function resolveTable(ctx: ActionExecutorContext): string {
  return String(ctx.params?.table ?? ctx.tableName)
}

function resolveRecordId(ctx: ActionExecutorContext): string {
  return String(ctx.params?.id ?? ctx.record?.id ?? '')
}

const getRecord: ActionExecutor = async (ctx) => {
  const namespace = requireNamespace(ctx)
  const table = resolveTable(ctx)
  const filter = (ctx.params?.filter as Record<string, unknown>) ?? {}
  const resultType = ((ctx.params?.result as { type?: string })?.type ?? 'first') as 'first' | 'list'
  const { sql, params } = buildSelectQuery(table, filter, { resultType }, ctx.context)

  const surreal = await getSurreal(namespace, 'main')
  try {
    const [records] = await surreal.query<[{ id: string }[]]>(sql, params)
    const normalized = normalizeIds(records)
    return resultType === 'first' ? (normalized[0] ?? null) : normalized
  } finally {
    await closeSurreal(surreal)
  }
}

const createRecord: ActionExecutor = async (ctx) => {
  const namespace = requireNamespace(ctx)
  const table = resolveTable(ctx)
  const fields = (ctx.params?.fields as Record<string, unknown>) ?? {}

  const surreal = await getSurreal(namespace, 'main')
  try {
    const [created] = await surreal.query<[{ id: string }[]]>(
      'CREATE type::table($table) CONTENT $data',
      { table, data: fields }
    )
    return normalizeId(created[0])
  } finally {
    await closeSurreal(surreal)
  }
}

const updateRecord: ActionExecutor = async (ctx) => {
  const namespace = requireNamespace(ctx)
  const id = resolveRecordId(ctx)
  if (!id) throw new Error('updateRecord requires an id or context.record.id')
  const fields = (ctx.params?.fields as Record<string, unknown>) ?? {}

  const surreal = await getSurreal(namespace, 'main')
  try {
    const [updated] = await surreal.query<[{ id: string }[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data: fields }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

const deleteRecord: ActionExecutor = async (ctx) => {
  const namespace = requireNamespace(ctx)
  const id = resolveRecordId(ctx)
  if (!id) throw new Error('deleteRecord requires an id or context.record.id')
  const mode = String(ctx.params?.mode ?? 'soft')

  const surreal = await getSurreal(namespace, 'main')
  try {
    if (mode === 'hard') {
      await surreal.query('DELETE type::record($id)', { id })
      return { id }
    }
    const [updated] = await surreal.query<[{ id: string }[]]>(
      'UPDATE type::record($id) SET status = "deleted"',
      { id }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

const condition: ActionExecutor = (ctx) => {
  const expression = ctx.params?.expression
  return evaluateExpression(expression, ctx.context)
}

export const runtimeActions: Record<string, RuntimeAction> = {
  getRecord: {
    meta: { id: 'getRecord', label: 'Get record(s)', category: 'Database' },
    execute: getRecord
  },
  createRecord: {
    meta: { id: 'createRecord', label: 'Create record', category: 'Database' },
    execute: createRecord
  },
  updateRecord: {
    meta: { id: 'updateRecord', label: 'Update record', category: 'Database' },
    execute: updateRecord
  },
  deleteRecord: {
    meta: { id: 'deleteRecord', label: 'Delete record', category: 'Database' },
    execute: deleteRecord
  },
  condition: {
    meta: { id: 'condition', label: 'Condition', category: 'Logic' },
    execute: condition
  }
}
