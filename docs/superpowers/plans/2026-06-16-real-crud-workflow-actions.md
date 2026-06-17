# Real CRUD Workflow Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the POC workflow actions with real CRUD building blocks (`getRecord`, `createRecord`, `updateRecord`, `deleteRecord`) plus a `condition` action/guard, wired through XState `invoke` so action states can emit `ok`/`error`/`true`/`false` result events.

**Architecture:** Each workflow state that has `meta.action` is compiled into an XState state with an `invoke` actor. The actor runs the action inside `objectCtx.run`, then raises a result event. Success results are assigned to `context[<outputKey>]`, failures to `context.lastError`. A shared MongoDB-style expression evaluator powers both the `condition` action and a generic `condition` guard. The visual editor edits `state.meta` through a new `ActionConfigPanel`.

**Tech Stack:** TypeScript, XState 5, Restate SDK, SurrealDB, Vue 3, Nuxt UI, Vitest.

---

## Baseline & warnings

Before touching code, run the baseline verification. The repo has **pre-existing** `nuxt typecheck` failures in `layers/workflow-editor`, `apps/web/pages/workflows/[id].vue`, `apps/admin/pages/workflows/[id].vue`, `server/utils/platform-status.ts`, and strict-null returns in `packages/db`. Do **not** try to fix them in this plan. Production build should still pass.

```bash
pnpm install
pnpm -r build
```

Expected: `pnpm -r build` exits `0`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/workflow-actions/src/types.ts` | Executor context types; add `context` to action/guard contexts. |
| `packages/workflow-actions/src/runtime/expression.ts` | MongoDB-style expression evaluator (`$eq`, `$ne`, `$exists`, `$in`, `$nin`, `$and`, `$or`, `$not`) with `$context.` ref resolution. |
| `packages/workflow-actions/src/runtime/query-builder.ts` | Convert a MongoDB-style filter into a parameterized SurrealQL `SELECT` query. |
| `packages/workflow-actions/src/runtime/actions.ts` | CRUD + `condition` runtime handlers. |
| `packages/workflow-actions/src/runtime/guards.ts` | Generic `condition` guard using the expression evaluator. |
| `packages/workflow-actions/src/runtime/index.ts` | Build XState `invoke` actors from runtime actions and a guard registry. |
| `packages/workflow-actions/src/catalog/actions.ts` | Metadata for CRUD + `condition` actions. |
| `packages/workflow-actions/src/catalog/guards.ts` | Metadata for the `condition` guard. |
| `apps/workflow-runtime/src/compile.ts` | Compile `state.meta.action` into XState `invoke`, `raise`, and `assign`. |
| `apps/workflow-runtime/src/workflow.ts` | Remove the obsolete `promises` awaiting now that actions use `invoke`. |
| `packages/db/package.json` | Add `./normalize` export so `workflow-actions` can reuse `normalizeId`. |
| `packages/db/src/seed-workflows.ts` | Update the seeded `provisionCompany` workflow to use `updateRecord`. |
| `layers/workflow-editor/composables/useWorkflowGraph.ts` | Read/write `state.meta` into node `data.meta`. |
| `layers/workflow-editor/components/ActionConfigPanel.vue` | New: form builder for action params and output key. |
| `layers/workflow-editor/components/DetailsPanel.vue` | Use `ActionConfigPanel`; edge event dropdown for result events. |
| `layers/workflow-editor/components/StateNode.vue` | Display the configured action id. |
| `docs/50-Features/Workflow Actions Catalog.md` | Document new actions. |
| `docs/50-Features/Guards & Conditions.md` | Document the `condition` guard. |
| `docs/40-Packages/workflow-actions.md` | Update registry description. |

---

## Task 1: Update executor context types

**Files:**
- Modify: `packages/workflow-actions/src/types.ts`
- Test: `packages/workflow-actions/tests/types.test.ts`

- [ ] **Step 1: Write the failing type-test**

Create `packages/workflow-actions/tests/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { ActionExecutorContext, GuardExecutorContext } from '../src/types.js'

describe('executor contexts', () => {
  it('includes the full machine context', () => {
    const ctx: ActionExecutorContext = {
      event: { type: 'create' },
      context: { record: { id: '1' }, tableName: 'members' },
      record: { id: '1' },
      tableName: 'members',
      params: {}
    }
    expect(ctx.context.record).toEqual({ id: '1' })
  })

  it('guard context includes machine context', () => {
    const ctx: GuardExecutorContext = {
      event: { type: 'create' },
      context: { record: { status: 'active' } },
      record: { status: 'active' },
      params: {}
    }
    expect(ctx.context.record.status).toBe('active')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm --filter workflow-actions typecheck
```

Expected: type errors because `context` is missing from `ActionExecutorContext` and `GuardExecutorContext`.

- [ ] **Step 3: Update the types**

Replace the contents of `packages/workflow-actions/src/types.ts` with:

```ts
import type { ActionMetadata, GuardMetadata } from 'shared'

export type { ActionMetadata, GuardMetadata }

export interface ActionExecutorContext {
  event: any
  context: Record<string, unknown>
  record: Record<string, unknown>
  tableName: string
  companyId?: string
  namespace?: string
  params?: Record<string, unknown>
}

export type ActionExecutor = (ctx: ActionExecutorContext) => Promise<unknown> | unknown

export interface RuntimeAction {
  meta: ActionMetadata
  execute: ActionExecutor
}

export interface GuardExecutorContext {
  event: any
  context: Record<string, unknown>
  record: Record<string, unknown>
  params?: Record<string, unknown>
}

export type GuardExecutor = (ctx: GuardExecutorContext) => boolean

export interface RuntimeGuard {
  meta: GuardMetadata
  evaluate: GuardExecutor
}
```

- [ ] **Step 4: Re-run typecheck**

```bash
pnpm --filter workflow-actions typecheck
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add packages/workflow-actions/src/types.ts packages/workflow-actions/tests/types.test.ts
git commit -m "feat(workflow-actions): include machine context in executor contexts"
```

---

## Task 2: Implement the expression evaluator

**Files:**
- Create: `packages/workflow-actions/src/runtime/expression.ts`
- Test: `packages/workflow-actions/tests/expression.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/workflow-actions/tests/expression.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveValue, evaluateExpression } from '../src/runtime/expression.js'

describe('resolveValue', () => {
  it('resolves $context refs', () => {
    expect(resolveValue('$context.record.status', { record: { status: 'active' } })).toBe('active')
  })

  it('returns literals', () => {
    expect(resolveValue('active', { record: {} })).toBe('active')
    expect(resolveValue(42, {})).toBe(42)
  })
})

describe('evaluateExpression', () => {
  const context = {
    record: { status: 'active', role: 'owner', tags: ['a', 'b'] }
  }

  it('evaluates $eq', () => {
    expect(evaluateExpression({ $eq: ['$context.record.status', 'active'] }, context)).toBe(true)
    expect(evaluateExpression({ $eq: ['$context.record.status', 'inactive'] }, context)).toBe(false)
  })

  it('evaluates $ne', () => {
    expect(evaluateExpression({ $ne: ['$context.record.status', 'inactive'] }, context)).toBe(true)
  })

  it('evaluates $exists', () => {
    expect(evaluateExpression({ $exists: '$context.record.status' }, context)).toBe(true)
    expect(evaluateExpression({ $exists: '$context.record.missing' }, context)).toBe(false)
  })

  it('evaluates $in', () => {
    expect(evaluateExpression({ $in: ['$context.record.role', ['owner', 'admin']] }, context)).toBe(true)
    expect(evaluateExpression({ $in: ['$context.record.role', ['member']] }, context)).toBe(false)
  })

  it('evaluates $nin', () => {
    expect(evaluateExpression({ $nin: ['$context.record.role', ['member']] }, context)).toBe(true)
  })

  it('evaluates boolean combinators', () => {
    expect(evaluateExpression({
      $and: [
        { $eq: ['$context.record.status', 'active'] },
        { $in: ['$context.record.role', ['owner', 'admin']] }
      ]
    }, context)).toBe(true)

    expect(evaluateExpression({
      $or: [
        { $eq: ['$context.record.status', 'inactive'] },
        { $eq: ['$context.record.role', 'owner'] }
      ]
    }, context)).toBe(true)

    expect(evaluateExpression({
      $not: { $eq: ['$context.record.status', 'active'] }
    }, context)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
pnpm test packages/workflow-actions/tests/expression.test.ts
```

Expected: `FAIL` — `expression.ts` not found.

- [ ] **Step 3: Implement the evaluator**

Create `packages/workflow-actions/src/runtime/expression.ts`:

```ts
export function resolveValue(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('$context.')) {
    const path = value.slice('$context.'.length)
    return path.split('.').reduce((obj: any, key) => obj?.[key], context)
  }
  return value
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

export function evaluateExpression(
  expression: unknown,
  context: Record<string, unknown>
): boolean {
  if (expression === null || expression === undefined) return true

  if (Array.isArray(expression)) {
    return expression.every((item) => evaluateExpression(item, context))
  }

  if (typeof expression !== 'object') {
    return Boolean(expression)
  }

  const expr = expression as Record<string, unknown>
  const keys = Object.keys(expr)
  if (keys.length === 0) return true

  if ('$and' in expr) {
    const clauses = expr['$and'] as unknown[]
    return clauses.every((clause) => evaluateExpression(clause, context))
  }

  if ('$or' in expr) {
    const clauses = expr['$or'] as unknown[]
    return clauses.some((clause) => evaluateExpression(clause, context))
  }

  if ('$not' in expr) {
    return !evaluateExpression(expr['$not'], context)
  }

  if ('$eq' in expr) {
    const [left, right] = (expr['$eq'] as unknown[]).map((v) => resolveValue(v, context))
    return left === right
  }

  if ('$ne' in expr) {
    const [left, right] = (expr['$ne'] as unknown[]).map((v) => resolveValue(v, context))
    return left !== right
  }

  if ('$exists' in expr) {
    const value = resolveValue(expr['$exists'], context)
    return !isEmpty(value)
  }

  if ('$in' in expr) {
    const [left, list] = (expr['$in'] as unknown[]).map((v) => resolveValue(v, context))
    return Array.isArray(list) && list.includes(left)
  }

  if ('$nin' in expr) {
    const [left, list] = (expr['$nin'] as unknown[]).map((v) => resolveValue(v, context))
    return Array.isArray(list) && !list.includes(left)
  }

  throw new Error(`Unsupported expression operator: ${JSON.stringify(expr)}`)
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test packages/workflow-actions/tests/expression.test.ts
```

Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/workflow-actions/src/runtime/expression.ts packages/workflow-actions/tests/expression.test.ts
git commit -m "feat(workflow-actions): add mongo-style expression evaluator"
```

---

## Task 3: Implement the SurrealQL query builder

**Files:**
- Create: `packages/workflow-actions/src/runtime/query-builder.ts`
- Test: `packages/workflow-actions/tests/query-builder.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/workflow-actions/tests/query-builder.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildSelectQuery } from '../src/runtime/query-builder.js'

describe('buildSelectQuery', () => {
  it('builds a simple equality query', () => {
    const { sql, params } = buildSelectQuery('members', { status: { $eq: 'active' } })
    expect(sql).toContain('FROM type::table($table)')
    expect(sql).toContain('status = $p0')
    expect(params).toEqual({ table: 'members', p0: 'active' })
  })

  it('builds a list query with limit 1 for first', () => {
    const { sql } = buildSelectQuery('members', { status: { $eq: 'active' } }, { resultType: 'first' })
    expect(sql).toContain('LIMIT 1')
  })

  it('supports $ne, $exists, $in, $nin', () => {
    const { sql, params } = buildSelectQuery('members', {
      status: { $ne: 'deleted' },
      role: { $exists: true },
      tier: { $in: ['free', 'pro'] },
      group: { $nin: ['blocked'] }
    })
    expect(sql).toContain('status != $p0')
    expect(sql).toContain('role IS NOT NONE')
    expect(sql).toContain('tier IN $p1')
    expect(sql).toContain('group NOT IN $p2')
    expect(params).toMatchObject({ p0: 'deleted', p1: ['free', 'pro'], p2: ['blocked'] })
  })

  it('supports $and and $or', () => {
    const { sql } = buildSelectQuery('members', {
      $and: [
        { status: { $eq: 'active' } },
        { $or: [{ role: { $eq: 'owner' } }, { role: { $eq: 'admin' } }] }
      ]
    })
    expect(sql).toContain('(status = $p0)')
    expect(sql).toContain('((role = $p1) OR (role = $p2))')
  })

  it('resolves $context values', () => {
    const { params } = buildSelectQuery('members', { ownerId: { $eq: '$context.record.id' } }, undefined, {
      record: { id: 'rec-123' }
    })
    expect(params.p0).toBe('rec-123')
  })
})
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
pnpm test packages/workflow-actions/tests/query-builder.test.ts
```

Expected: `FAIL` — file not found.

- [ ] **Step 3: Implement the query builder**

Create `packages/workflow-actions/src/runtime/query-builder.ts`:

```ts
import { resolveValue } from './expression.js'

export interface QueryOptions {
  resultType?: 'first' | 'list'
}

interface WhereResult {
  where: string
  nextIndex: number
}

export function buildSelectQuery(
  table: string,
  filter: Record<string, unknown>,
  options?: QueryOptions,
  context?: Record<string, unknown>
): { sql: string; params: Record<string, unknown> } {
  const params: Record<string, unknown> = { table }
  const { where } = buildWhere(filter, params, 0, context ?? {})

  let sql = 'SELECT * FROM type::table($table)'
  if (where) sql += ` WHERE ${where}`
  if (options?.resultType === 'first') sql += ' LIMIT 1'

  return { sql, params }
}

function buildWhere(
  filter: unknown,
  params: Record<string, unknown>,
  index: number,
  context: Record<string, unknown>
): WhereResult {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return { where: '', nextIndex: index }
  }

  const entries = Object.entries(filter as Record<string, unknown>)
  if (entries.length === 0) return { where: '', nextIndex: index }

  const clauses: string[] = []

  for (const [key, value] of entries) {
    if (key === '$and') {
      const parts: string[] = []
      for (const sub of value as unknown[]) {
        const res = buildWhere(sub, params, index, context)
        if (res.where) parts.push(res.where)
        index = res.nextIndex
      }
      if (parts.length) clauses.push(`(${parts.join(' AND ')})`)
    } else if (key === '$or') {
      const parts: string[] = []
      for (const sub of value as unknown[]) {
        const res = buildWhere(sub, params, index, context)
        if (res.where) parts.push(res.where)
        index = res.nextIndex
      }
      if (parts.length) clauses.push(`(${parts.join(' OR ')})`)
    } else if (key === '$not') {
      const res = buildWhere(value, params, index, context)
      if (res.where) clauses.push(`NOT (${res.where})`)
      index = res.nextIndex
    } else {
      const res = buildFieldClause(key, value as Record<string, unknown>, params, index, context)
      if (res.where) clauses.push(res.where)
      index = res.nextIndex
    }
  }

  return { where: clauses.join(' AND '), nextIndex: index }
}

function buildFieldClause(
  field: string,
  ops: Record<string, unknown>,
  params: Record<string, unknown>,
  index: number,
  context: Record<string, unknown>
): WhereResult {
  const clauses: string[] = []

  for (const [op, raw] of Object.entries(ops)) {
    if (op === '$exists') {
      clauses.push(raw === true || raw === 'true' ? `${field} IS NOT NONE` : `${field} IS NONE`)
      continue
    }

    const paramKey = `p${index++}`
    const value = resolveValue(raw, context)

    if (op === '$eq') {
      clauses.push(`${field} = $${paramKey}`)
    } else if (op === '$ne') {
      clauses.push(`${field} != $${paramKey}`)
    } else if (op === '$in') {
      clauses.push(`${field} IN $${paramKey}`)
    } else if (op === '$nin') {
      clauses.push(`${field} NOT IN $${paramKey}`)
    } else {
      throw new Error(`Unsupported filter operator: ${op}`)
    }

    params[paramKey] = value
  }

  return { where: clauses.join(' AND '), nextIndex: index }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test packages/workflow-actions/tests/query-builder.test.ts
```

Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/workflow-actions/src/runtime/query-builder.ts packages/workflow-actions/tests/query-builder.test.ts
git commit -m "feat(workflow-actions): add mongo-style filter to SurrealQL builder"
```

---

## Task 4: Add `db/normalize` export

**Files:**
- Modify: `packages/db/package.json`
- Test: `pnpm --filter db typecheck`

- [ ] **Step 1: Add the export**

Edit `packages/db/package.json` exports to include:

```json
"./normalize": {
  "types": "./src/normalize.ts",
  "default": "./src/normalize.ts"
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter db typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add packages/db/package.json
git commit -m "feat(db): export normalize helpers"
```

---

## Task 5: Implement CRUD runtime actions

**Files:**
- Modify: `packages/workflow-actions/src/runtime/actions.ts`
- Test: `packages/workflow-actions/tests/actions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/workflow-actions/tests/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('db/client', () => ({
  getSurreal: vi.fn(),
  closeSurreal: vi.fn()
}))

import { getSurreal, closeSurreal } from 'db/client'
import { runtimeActions } from '../src/runtime/actions.js'

function mockSurreal(queryResult: unknown) {
  const query = vi.fn().mockResolvedValue(queryResult)
  ;(getSurreal as any).mockResolvedValue({ query })
  return query
}

const baseCtx = {
  event: { type: 'create' },
  context: { record: { id: 'rec-1' }, tableName: 'members', namespace: 'ns-1' },
  record: { id: 'rec-1' },
  tableName: 'members',
  namespace: 'ns-1',
  companyId: 'co-1'
}

describe('getRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the first matching record', async () => {
    mockSurreal([[{ id: 'members:1', status: 'active' }]])
    const result = await runtimeActions.getRecord.execute({
      ...baseCtx,
      params: { table: 'members', filter: { status: { $eq: 'active' } }, result: { type: 'first' } }
    })
    expect(result).toEqual({ id: 'members:1', status: 'active' })
  })

  it('returns a list of records', async () => {
    mockSurreal([[{ id: 'members:1' }, { id: 'members:2' }]])
    const result = await runtimeActions.getRecord.execute({
      ...baseCtx,
      params: { table: 'members', filter: {}, result: { type: 'list' } }
    })
    expect(Array.isArray(result)).toBe(true)
    expect((result as any[]).length).toBe(2)
  })
})

describe('createRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a record and returns it', async () => {
    mockSurreal([[{ id: 'members:new' }]])
    const result = await runtimeActions.createRecord.execute({
      ...baseCtx,
      params: { table: 'members', fields: { email: 'a@b.com' } }
    })
    expect(result).toEqual({ id: 'members:new' })
  })
})

describe('updateRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates by explicit id', async () => {
    mockSurreal([[{ id: 'members:1', status: 'active' }]])
    const result = await runtimeActions.updateRecord.execute({
      ...baseCtx,
      params: { table: 'members', id: 'members:1', fields: { status: 'active' } }
    })
    expect(result).toEqual({ id: 'members:1', status: 'active' })
  })

  it('falls back to context.record.id', async () => {
    mockSurreal([[{ id: 'rec-1', status: 'active' }]])
    const result = await runtimeActions.updateRecord.execute({
      ...baseCtx,
      params: { table: 'members', fields: { status: 'active' } }
    })
    expect(result).toEqual({ id: 'rec-1', status: 'active' })
  })
})

describe('deleteRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes by default', async () => {
    mockSurreal([[{ id: 'rec-1', status: 'deleted' }]])
    const result = await runtimeActions.deleteRecord.execute({
      ...baseCtx,
      params: { table: 'members', id: 'rec-1' }
    })
    expect(result).toEqual({ id: 'rec-1', status: 'deleted' })
  })

  it('hard-deletes when mode is hard', async () => {
    const query = mockSurreal([])
    await runtimeActions.deleteRecord.execute({
      ...baseCtx,
      params: { table: 'members', id: 'rec-1', mode: 'hard' }
    })
    expect(query).toHaveBeenCalledWith('DELETE type::record($id)', { id: 'rec-1' })
  })
})
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
pnpm test packages/workflow-actions/tests/actions.test.ts
```

Expected: `FAIL` — runtime actions not implemented.

- [ ] **Step 3: Implement the actions**

Replace `packages/workflow-actions/src/runtime/actions.ts` with:

```ts
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
```

- [ ] **Step 4: Run tests**

```bash
pnpm test packages/workflow-actions/tests/actions.test.ts
```

Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/workflow-actions/src/runtime/actions.ts packages/workflow-actions/tests/actions.test.ts
git commit -m "feat(workflow-actions): implement CRUD and condition runtime actions"
```

---

## Task 6: Implement the `condition` guard

**Files:**
- Modify: `packages/workflow-actions/src/runtime/guards.ts`
- Test: `packages/workflow-actions/tests/guards.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/workflow-actions/tests/guards.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { runtimeGuards } from '../src/runtime/guards.js'

describe('condition guard', () => {
  it('evaluates a mongo-style expression', () => {
    const result = runtimeGuards.condition.evaluate({
      event: { type: 'create' },
      context: { record: { status: 'active' } },
      record: { status: 'active' },
      params: {
        expression: { $eq: ['$context.record.status', 'active'] }
      }
    })
    expect(result).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
pnpm test packages/workflow-actions/tests/guards.test.ts
```

Expected: `FAIL`.

- [ ] **Step 3: Replace the guard registry**

Replace `packages/workflow-actions/src/runtime/guards.ts` with:

```ts
import type { GuardExecutor, RuntimeGuard } from '../types.js'
import { evaluateExpression } from './expression.js'

const condition: GuardExecutor = ({ context, params }) => {
  return evaluateExpression(params?.expression, context ?? {})
}

export const runtimeGuards: Record<string, RuntimeGuard> = {
  condition: {
    meta: { id: 'condition', label: 'Condition expression', description: 'Evaluates a MongoDB-style expression' },
    evaluate: condition
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test packages/workflow-actions/tests/guards.test.ts
```

Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/workflow-actions/src/runtime/guards.ts packages/workflow-actions/tests/guards.test.ts
git commit -m "feat(workflow-actions): replace POC guards with condition guard"
```

---

## Task 7: Build XState invoke actors and guard registry

**Files:**
- Modify: `packages/workflow-actions/src/runtime/index.ts`
- Test: `packages/workflow-actions/tests/registry.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/workflow-actions/tests/registry.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createActionActors, createGuardRegistry } from '../src/runtime/index.js'

describe('createActionActors', () => {
  it('returns an actor for every runtime action', () => {
    const run = vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn())
    const { actors } = createActionActors({ run }, { record: {}, tableName: 'members' })
    expect(actors.getRecord).toBeDefined()
    expect(actors.createRecord).toBeDefined()
    expect(actors.updateRecord).toBeDefined()
    expect(actors.deleteRecord).toBeDefined()
    expect(actors.condition).toBeDefined()
  })
})

describe('createGuardRegistry', () => {
  it('registers the condition guard', () => {
    const { guards } = createGuardRegistry({ record: { status: 'active' }, tableName: 'members' })
    expect(guards.condition).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
pnpm test packages/workflow-actions/tests/registry.test.ts
```

Expected: `FAIL` — `createActionActors` does not exist.

- [ ] **Step 3: Rewrite the registry**

Replace `packages/workflow-actions/src/runtime/index.ts` with:

```ts
import type { ObjectContext } from '@restatedev/restate-sdk'
import { fromPromise } from 'xstate'
import type { CreateWorkflowRequest } from 'shared'
import type { ActionExecutorContext } from '../types.js'
import { runtimeActions } from './actions.js'
import { runtimeGuards } from './guards.js'

export { runtimeActions, runtimeGuards }

export interface ActionActorInput {
  params?: Record<string, unknown>
  outputKey?: string
  context: Record<string, unknown>
  event: any
}

export interface ActionActors {
  actors: Record<string, ReturnType<typeof fromPromise>>
}

export function createActionActors(
  objectCtx: Pick<ObjectContext, 'run'>,
  req: Pick<CreateWorkflowRequest, 'record' | 'tableName' | 'companyId' | 'namespace'>
): ActionActors {
  const actors: Record<string, ReturnType<typeof fromPromise>> = {}

  for (const [actionId, runtimeAction] of Object.entries(runtimeActions)) {
    actors[actionId] = fromPromise(async ({ input }: { input: ActionActorInput }) => {
      const executorCtx: ActionExecutorContext = {
        event: input.event,
        context: input.context,
        record: (input.context.record ?? req.record) as Record<string, unknown>,
        tableName: (input.context.tableName ?? req.tableName) as string,
        companyId: (input.context.companyId ?? req.companyId) as string | undefined,
        namespace: (input.context.namespace ?? req.namespace) as string | undefined,
        params: input.params
      }

      return objectCtx.run(actionId, async () => {
        return runtimeAction.execute(executorCtx)
      })
    })
  }

  return { actors }
}

export interface GuardRegistry {
  guards: Record<string, (args: { context: Record<string, unknown>; event: any }) => boolean>
}

function resolveGuardRef(
  guardId: string,
  config: CreateWorkflowRequest['config']
): { type: string; params?: Record<string, unknown> } | undefined {
  for (const state of Object.values(config.states)) {
    if (!state.on) continue
    for (const transitions of Object.values(state.on)) {
      const normalized = Array.isArray(transitions) ? transitions : [transitions]
      for (const t of normalized) {
        if (typeof t !== 'object' || !t.guard) continue
        const ref = typeof t.guard === 'string' ? { type: t.guard } : t.guard
        if (ref.type === guardId) return ref
      }
    }
  }
  return undefined
}

export function createGuardRegistry(
  req: Pick<CreateWorkflowRequest, 'record' | 'config'>
): GuardRegistry {
  const guards: GuardRegistry['guards'] = {}

  for (const [guardId, runtimeGuard] of Object.entries(runtimeGuards)) {
    guards[guardId] = ({ context, event }) => {
      const ref = resolveGuardRef(guardId, req.config)
      return runtimeGuard.evaluate({
        event,
        context,
        record: (context?.record ?? req.record) as Record<string, unknown>,
        params: ref?.params
      })
    }
  }

  return { guards }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test packages/workflow-actions/tests/registry.test.ts
```

Expected: `PASS`.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter workflow-actions typecheck
```

Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add packages/workflow-actions/src/runtime/index.ts packages/workflow-actions/tests/registry.test.ts
git commit -m "feat(workflow-actions): build invoke actors and guard registry"
```

---

## Task 8: Update action & guard catalogs

**Files:**
- Modify: `packages/workflow-actions/src/catalog/actions.ts`
- Modify: `packages/workflow-actions/src/catalog/guards.ts`
- Test: `pnpm --filter workflow-actions typecheck`

- [ ] **Step 1: Replace action metadata**

Replace `packages/workflow-actions/src/catalog/actions.ts` with:

```ts
import type { ActionMetadata } from 'shared'

export const actionsMetadata: ActionMetadata[] = [
  {
    id: 'getRecord',
    label: 'Get record(s)',
    description: 'Query records from a table.',
    category: 'Database',
    paramsSchema: {
      table: { type: 'string', label: 'Table', required: true },
      filter: { type: 'json', label: 'Filter', required: false, default: {} },
      result: { type: 'json', label: 'Result options', required: false, default: { type: 'first' } }
    }
  },
  {
    id: 'createRecord',
    label: 'Create record',
    description: 'Insert a new record into a table.',
    category: 'Database',
    paramsSchema: {
      table: { type: 'string', label: 'Table', required: true },
      fields: { type: 'json', label: 'Fields', required: true }
    }
  },
  {
    id: 'updateRecord',
    label: 'Update record',
    description: 'Update fields on an existing record.',
    category: 'Database',
    paramsSchema: {
      table: { type: 'string', label: 'Table', required: true },
      id: { type: 'string', label: 'Record ID', required: false },
      fields: { type: 'json', label: 'Fields', required: true }
    }
  },
  {
    id: 'deleteRecord',
    label: 'Delete record',
    description: 'Soft or hard delete a record.',
    category: 'Database',
    paramsSchema: {
      table: { type: 'string', label: 'Table', required: true },
      id: { type: 'string', label: 'Record ID', required: false },
      mode: {
        type: 'select',
        label: 'Mode',
        required: true,
        default: 'soft',
        options: [
          { label: 'Soft delete', value: 'soft' },
          { label: 'Hard delete', value: 'hard' }
        ]
      }
    }
  },
  {
    id: 'condition',
    label: 'Condition',
    description: 'Branch based on a MongoDB-style expression.',
    category: 'Logic',
    paramsSchema: {
      expression: { type: 'json', label: 'Expression', required: true }
    }
  }
]
```

- [ ] **Step 2: Replace guard metadata**

Replace `packages/workflow-actions/src/catalog/guards.ts` with:

```ts
import type { GuardMetadata } from 'shared'

export const guardsMetadata: GuardMetadata[] = [
  {
    id: 'condition',
    label: 'Condition expression',
    description: 'Allows the transition only when a MongoDB-style expression evaluates to true.',
    paramsSchema: {
      expression: { type: 'json', label: 'Expression', required: true }
    }
  }
]
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter workflow-actions typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/workflow-actions/src/catalog/actions.ts packages/workflow-actions/src/catalog/guards.ts
git commit -m "feat(workflow-actions): replace POC catalogs with CRUD + condition metadata"
```

---

## Task 9: Refactor `compile.ts` for invoke-based action states

**Files:**
- Modify: `apps/workflow-runtime/src/compile.ts`
- Test: `apps/workflow-runtime/tests/compile.test.ts`

- [ ] **Step 1: Write a failing compile test**

Create `apps/workflow-runtime/tests/compile.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createActor } from 'xstate'
import type { WorkflowDefinition } from 'shared'
import { compileWorkflow } from '../src/compile.js'

function fakeCtx() {
  return { run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()) }
}

describe('compileWorkflow with meta actions', () => {
  it('runs a condition action and branches true', () => new Promise<void>((done) => {
    const definition: WorkflowDefinition = {
      id: 'test',
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
            true: { target: 'activeBranch' },
            false: { target: 'inactiveBranch' }
          }
        },
        activeBranch: { type: 'final' },
        inactiveBranch: { type: 'final' }
      }
    }

    const { machine } = compileWorkflow(definition, {
      record: { id: '1', status: 'active' },
      tableName: 'members',
      namespace: 'ns-1'
    }, fakeCtx())

    const actor = createActor(machine)
    actor.subscribe((snapshot) => {
      if (snapshot.status === 'done' && (snapshot.value as any) === 'activeBranch') {
        done()
      }
    })
    actor.start()
  }))
})
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
pnpm test apps/workflow-runtime/tests/compile.test.ts
```

Expected: `FAIL` — compile still uses old action registry.

- [ ] **Step 3: Rewrite `compile.ts`**

Replace `apps/workflow-runtime/src/compile.ts` with:

```ts
import { assign, createMachine, raise } from 'xstate'
import type { AnyStateMachine } from 'xstate'
import type { ObjectContext } from '@restatedev/restate-sdk'
import type { WorkflowDefinition, CreateWorkflowRequest } from 'shared'
import { createActionActors, createGuardRegistry } from 'workflow-actions/runtime'
import type { RuntimeContext } from './types.js'

const assignOutput = assign(({ event }: any) => {
  const outputKey = event.output?.outputKey
  if (!outputKey) return {}
  return { [outputKey]: event.output.data }
})

const assignError = assign(({ event }: any) => ({
  lastError: {
    message: event.error?.message ?? String(event.error ?? 'unknown error')
  }
}))

export function compileWorkflow(
  definition: WorkflowDefinition,
  context: RuntimeContext,
  objectCtx: Pick<ObjectContext, 'run'>
): { machine: AnyStateMachine } {
  const registryContext: Pick<CreateWorkflowRequest, 'record' | 'tableName' | 'companyId' | 'namespace' | 'config'> = {
    config: definition,
    tableName: context.tableName,
    record: context.record,
    companyId: context.companyId,
    namespace: context.namespace
  }

  const { actors } = createActionActors(objectCtx, registryContext)
  const guardRegistry = createGuardRegistry(registryContext)

  const states: Record<string, Record<string, unknown>> = {}

  for (const [stateId, stateDef] of Object.entries(definition.states)) {
    states[stateId] = {}

    if (stateDef.on) states[stateId].on = stateDef.on
    if (stateDef.tags) states[stateId].tags = stateDef.tags
    if (stateDef.type === 'final') states[stateId].type = 'final'
    if (stateDef.meta) states[stateId].meta = stateDef.meta

    const actionId = stateDef.meta?.action as string | undefined
    if (actionId && actors[actionId]) {
      const isCondition = actionId === 'condition'

      states[stateId].invoke = {
        src: actionId,
        input: ({ context: machineContext, event }: any) => ({
          params: stateDef.meta?.params as Record<string, unknown> | undefined,
          outputKey: stateDef.meta?.outputKey as string | undefined,
          context: machineContext,
          event
        }),
        onDone: isCondition
          ? {
              actions: [
                raise(({ event }: any) => ({
                  type: event.output?.data === true ? 'true' : 'false'
                }))
              ]
            }
          : {
              actions: [
                assignOutput,
                raise({ type: 'ok' })
              ]
            },
        onError: isCondition
          ? {
              actions: [
                assignError,
                raise({ type: 'false' })
              ]
            }
          : {
              actions: [
                assignError,
                raise({ type: 'error' })
              ]
            }
      }
    }
  }

  return {
    machine: createMachine(
      {
        ...definition,
        context: { ...context },
        states
      },
      {
        actors,
        guards: guardRegistry.guards,
        actions: { assignOutput, assignError }
      }
    )
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test apps/workflow-runtime/tests/compile.test.ts
```

Expected: `PASS`.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter workflow-runtime build
```

Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add apps/workflow-runtime/src/compile.ts apps/workflow-runtime/tests/compile.test.ts
git commit -m "feat(workflow-runtime): compile action states as XState invokes"
```

---

## Task 10: Remove obsolete promise handling from `workflow.ts`

**Files:**
- Modify: `apps/workflow-runtime/src/workflow.ts`
- Test: `pnpm --filter workflow-runtime build`

- [ ] **Step 1: Update `create` handler**

In `apps/workflow-runtime/src/workflow.ts`, find:

```ts
const { machine, promises } = compileWorkflow(req.config, context, objectCtx)
const actor = createActor(machine)
actor.start()
if (req.event) {
  actor.send({ type: req.event, record: req.record } as any)
}
await Promise.all(promises)
const rawSnapshot = getSnapshot(actor)
```

Replace with:

```ts
const { machine } = compileWorkflow(req.config, context, objectCtx)
const actor = createActor(machine)
actor.start()
if (req.event) {
  actor.send({ type: req.event, record: req.record } as any)
}
const rawSnapshot = getSnapshot(actor)
```

- [ ] **Step 2: Update `runTransition`**

Find:

```ts
const { machine, promises } = compileWorkflow(state.config, context, objectCtx)
const actor = restoreActor(machine, state.snapshot)
actor.send(event as any)
await Promise.all(promises)
const snapshot = getSnapshot(actor)
```

Replace with:

```ts
const { machine } = compileWorkflow(state.config, context, objectCtx)
const actor = restoreActor(machine, state.snapshot)
actor.send(event as any)
const snapshot = getSnapshot(actor)
```

- [ ] **Step 3: Build**

```bash
pnpm --filter workflow-runtime build
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/workflow-runtime/src/workflow.ts
git commit -m "refactor(workflow-runtime): drop old action promise awaiting"
```

---

## Task 11: Update the seeded workflow

**Files:**
- Modify: `packages/db/src/seed-workflows.ts`
- Test: `pnpm --filter db typecheck`

- [ ] **Step 1: Rewrite the seed workflow**

Replace `packages/db/src/seed-workflows.ts` with:

```ts
import { getSurreal, closeSurreal } from './client.js'

async function seed() {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE triggers WHERE tableName = "companies" AND event = "create"')
    await surreal.query('DELETE workflows WHERE name = "provisionCompany"')

    const workflowConfig = {
      id: 'provisionCompany',
      initial: 'idle',
      states: {
        idle: {
          on: {
            create: { target: 'activating' }
          }
        },
        activating: {
          meta: {
            action: 'updateRecord',
            params: {
              table: 'companies',
              fields: { status: 'active' }
            },
            outputKey: 'updatedCompany'
          },
          on: {
            ok: { target: 'done' },
            error: { target: 'failed' }
          }
        },
        done: { type: 'final' },
        failed: { type: 'final' }
      }
    }

    const [workflows] = await surreal.query<[any[]]>(
      'CREATE workflows CONTENT $data RETURN id',
      { data: { name: 'provisionCompany', xstateConfig: workflowConfig } }
    )
    const workflow = workflows[0]

    await surreal.query(
      'CREATE triggers CONTENT $data',
      { data: { tableName: 'companies', event: 'create', workflowId: workflow.id } }
    )

    console.log('Workflow and trigger seeded')
  } finally {
    await closeSurreal(surreal)
  }
}

seed().catch((err) => {
  console.error('Workflow seed failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter db typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed-workflows.ts
git commit -m "feat(db): update provisionCompany seed to use updateRecord action"
```

---

## Task 12: Update graph conversion for `state.meta`

**Files:**
- Modify: `layers/workflow-editor/composables/useWorkflowGraph.ts`
- Test: `pnpm -r build` (catches TypeScript errors)

- [ ] **Step 1: Add `meta` to node data and graph conversion**

Replace the top of `layers/workflow-editor/composables/useWorkflowGraph.ts` with:

```ts
import type { WorkflowDefinition, WorkflowState, WorkflowTransition } from 'shared'

export interface EditorNode {
  id: string
  type: 'state'
  position: { x: number; y: number }
  data: {
    label: string
    entry: (string | { id: string; params?: Record<string, unknown> })[]
    exit: (string | { id: string; params?: Record<string, unknown> })[]
    meta?: Record<string, unknown>
  }
}

export interface EditorEdge {
  id: string
  source: string
  target: string
  label: string
  animated?: boolean
  data?: {
    guard?: { type: string; params?: Record<string, unknown> }
    actions?: (string | { id: string; params?: Record<string, unknown> })[]
  }
}
```

Then update `definitionToGraph` node creation to include meta:

```ts
const nodes: EditorNode[] = stateEntries.map(([stateId, stateDef], idx) => {
  const persisted = positions[stateId]
  return {
    id: stateId,
    type: 'state',
    position: persisted ?? { x: 100 + idx * 220, y: 100 + (idx % 2) * 120 },
    data: {
      label: stateId,
      entry: normalizeActions(stateDef.entry),
      exit: normalizeActions(stateDef.exit),
      meta: stateDef.meta
    }
  }
})
```

Then update `graphToDefinition` state building. Find the node loop:

```ts
for (const node of nodes) {
  positions[node.id] = node.position
  const original = originalStates?.[node.id] ?? {}
  states[node.id] = { ...original }
  if (node.data.entry.length) {
    states[node.id].entry = node.data.entry
  }
  if (node.data.exit.length) {
    states[node.id].exit = node.data.exit
  }
}
```

Replace with:

```ts
for (const node of nodes) {
  positions[node.id] = node.position
  const original = originalStates?.[node.id] ?? {}
  states[node.id] = { ...original }
  if (node.data.entry.length) {
    states[node.id].entry = node.data.entry
  } else {
    delete states[node.id].entry
  }
  if (node.data.exit.length) {
    states[node.id].exit = node.data.exit
  } else {
    delete states[node.id].exit
  }
  if (node.data.meta?.action) {
    states[node.id].meta = mergeMeta(original.meta ?? {}, node.data.meta)
  } else if (original.meta?.action) {
    delete states[node.id].meta
  }
}
```

Add a helper just before `graphToDefinition`:

```ts
function mergeMeta(
  original: Record<string, unknown>,
  update: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...original,
    ...update,
    params: update.params ?? original.params
  }
}
```

- [ ] **Step 2: Build**

```bash
pnpm -r build
```

Expected: passes (ignoring pre-existing `nuxt typecheck` failures). If `workflow-editor` typecheck fails, verify the new properties only.

- [ ] **Step 3: Commit**

```bash
git add layers/workflow-editor/composables/useWorkflowGraph.ts
git commit -m "feat(workflow-editor): read and write state.meta in graph conversion"
```

---

## Task 13: Build `ActionConfigPanel.vue`

**Files:**
- Create: `layers/workflow-editor/components/ActionConfigPanel.vue`
- Test: `pnpm -r build`

- [ ] **Step 1: Create the component**

Create `layers/workflow-editor/components/ActionConfigPanel.vue`:

```vue
<script setup lang="ts">
import type { ActionMetadata, ParamSchema } from 'shared'

export interface ActionConfig {
  action?: string
  params?: Record<string, unknown>
  outputKey?: string
}

const props = defineProps<{
  modelValue: ActionConfig
  actions: ActionMetadata[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ActionConfig): void
}>()

const activeAction = computed(() => props.actions.find((a) => a.id === props.modelValue.action))

function update(patch: Partial<ActionConfig>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function updateParam(key: string, value: unknown) {
  const next = { ...(props.modelValue.params ?? {}), [key]: value }
  emit('update:modelValue', { ...props.modelValue, params: next })
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

function defaultValue(schema: ParamSchema): unknown {
  if (schema.default !== undefined) return schema.default
  if (schema.type === 'json') return {}
  if (schema.type === 'boolean') return false
  if (schema.type === 'number') return 0
  return ''
}

function autoOutputKey(actionId: string, params?: Record<string, unknown>): string {
  const table = String(params?.table ?? '')
  const cap = table ? table.charAt(0).toUpperCase() + table.slice(1) : 'Record'
  if (actionId === 'getRecord') {
    const type = (params?.result as { type?: string })?.type ?? 'first'
    return type === 'list' ? `${table}List` : table
  }
  if (actionId === 'createRecord') return `new${cap}`
  if (actionId === 'updateRecord') return `updated${cap}`
  if (actionId === 'deleteRecord') return `deleted${cap}`
  return ''
}

function onSelectAction(actionId: string) {
  const action = props.actions.find((a) => a.id === actionId)
  const params: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(action?.paramsSchema ?? {})) {
    params[key] = defaultValue(schema)
  }
  update({
    action: actionId,
    params,
    outputKey: actionId === 'condition' ? undefined : autoOutputKey(actionId, params)
  })
}

function onUpdateTable() {
  if (!props.modelValue.action || props.modelValue.action === 'condition') return
  update({ outputKey: autoOutputKey(props.modelValue.action, props.modelValue.params) })
}
</script>

<template>
  <div class="space-y-3">
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Action</label>
      <select
        :value="modelValue.action"
        class="w-full border rounded px-2 py-1 text-sm"
        :disabled="readonly"
        @change="onSelectAction(($event.target as HTMLSelectElement).value)"
      >
        <option value="">No action</option>
        <option v-for="action in actions" :key="action.id" :value="action.id">{{ action.label }}</option>
      </select>
    </div>

    <template v-if="activeAction">
      <div v-for="(schema, key) in activeAction.paramsSchema" :key="key">
        <label class="block text-xs font-medium text-gray-600 mb-1">{{ schema.label }}</label>

        <input
          v-if="schema.type === 'string'"
          :value="(modelValue.params?.[key] as string) ?? ''"
          type="text"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @input="updateParam(key, ($event.target as HTMLInputElement).value)"
          @change="key === 'table' ? onUpdateTable() : undefined"
        />

        <input
          v-else-if="schema.type === 'number'"
          :value="(modelValue.params?.[key] as number) ?? 0"
          type="number"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @input="updateParam(key, Number(($event.target as HTMLInputElement).value))"
        />

        <select
          v-else-if="schema.type === 'boolean' || schema.type === 'select'"
          :value="String(modelValue.params?.[key] ?? '')"
          class="w-full border rounded px-2 py-1 text-sm"
          :disabled="readonly"
          @change="updateParam(key, ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="opt in schema.type === 'boolean'
              ? [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }]
              : (schema.options ?? [])"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>

        <textarea
          v-else-if="schema.type === 'json'"
          :value="formatJson(modelValue.params?.[key])"
          rows="4"
          class="w-full border rounded px-2 py-1 text-sm font-mono"
          :readonly="readonly"
          @blur="updateParam(key, parseJson(($event.target as HTMLTextAreaElement).value))"
        />
      </div>

      <div v-if="modelValue.action !== 'condition'">
        <label class="block text-xs font-medium text-gray-600 mb-1">Output key</label>
        <input
          :value="modelValue.outputKey ?? ''"
          type="text"
          class="w-full border rounded px-2 py-1 text-sm"
          :readonly="readonly"
          @input="update({ outputKey: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Build**

```bash
pnpm -r build
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add layers/workflow-editor/components/ActionConfigPanel.vue
git commit -m "feat(workflow-editor): add ActionConfigPanel for action params and outputKey"
```

---

## Task 14: Update `DetailsPanel.vue`

**Files:**
- Modify: `layers/workflow-editor/components/DetailsPanel.vue`
- Test: `pnpm -r build`

- [ ] **Step 1: Add action config section**

Replace the `<template v-if="selectedNode">` block in `layers/workflow-editor/components/DetailsPanel.vue` with:

```vue
<template v-if="selectedNode">
  <div>
    <label class="block text-xs font-medium text-gray-600 mb-1">State ID</label>
    <input v-model="nodeName" class="w-full border rounded px-2 py-1 text-sm" :readonly="readonly" />
  </div>

  <div>
    <label class="block text-xs font-medium text-gray-600 mb-1">Type</label>
    <input value="atomic" class="w-full border rounded px-2 py-1 text-sm bg-gray-50" readonly />
  </div>

  <div>
    <label class="block text-xs font-medium text-gray-600 mb-1">Action</label>
    <ActionConfigPanel
      :model-value="selectedNode.data.meta ?? {}"
      :actions="actions"
      :readonly="readonly"
      @update:model-value="emit('update:node', selectedNode.id, { meta: $event })"
    />
  </div>
</template>
```

Add the import at the top of `<script setup>`:

```ts
import ActionConfigPanel from './ActionConfigPanel.vue'
```

- [ ] **Step 2: Add result-event dropdown for edges**

Add a computed helper in `<script setup>`:

```ts
const sourceNode = computed(() =>
  props.selectedEdge
    ? undefined
    : undefined
)
```

Actually we don't have nodes in props. Add a helper function instead of computed:

```ts
function resultEventOptions(): { label: string; value: string }[] {
  const sourceId = props.selectedEdge?.source
  // DetailsPanel does not receive nodes, so the parent passes through selectedEdge data.
  // We rely on the edge's source state meta being provided via graph conversion in a later step.
  // For now, if the user has typed a known result event, keep the dropdown options generic.
  return [
    { label: 'ok', value: 'ok' },
    { label: 'error', value: 'error' },
    { label: 'true', value: 'true' },
    { label: 'false', value: 'false' }
  ]
}
```

This is too weak. Instead, pass the source state's action id via `selectedEdge.data?.sourceAction`. Update graph conversion in `useWorkflowGraph.ts` to store `sourceAction` on edge data. Do that now.

In `useWorkflowGraph.ts` `definitionToGraph`, when pushing edges, set:

```ts
data: {
  guard: targetDef.guard,
  actions: targetDef.actions,
  sourceAction: stateDef.meta?.action as string | undefined
}
```

In `graphToDefinition`, when building transitions, preserve `edge.data?.sourceAction` but don't include it in the XState transition (it's editor-only). The existing code keeps `data.guard` and `data.actions`; `sourceAction` will just travel along.

Now update `DetailsPanel.vue` edge event input. Replace the edge event `<input>` with:

```vue
<div>
  <label class="block text-xs font-medium text-gray-600 mb-1">Event</label>
  <select
    v-if="selectedEdge?.data?.sourceAction"
    v-model="eventName"
    class="w-full border rounded px-2 py-1 text-sm"
    :disabled="readonly"
  >
    <option
      v-for="opt in selectedEdge.data.sourceAction === 'condition'
        ? [{ label: 'true', value: 'true' }, { label: 'false', value: 'false' }]
        : [{ label: 'ok', value: 'ok' }, { label: 'error', value: 'error' }]"
      :key="opt.value"
      :value="opt.value"
    >
      {{ opt.label }}
    </option>
  </select>
  <input
    v-else
    v-model="eventName"
    class="w-full border rounded px-2 py-1 text-sm"
    :readonly="readonly"
  />
</div>
```

- [ ] **Step 3: Update guard input for JSON expression**

The `condition` guard's only param is a JSON `expression`. Replace the single guard input with a schema-aware input. Find the guard input block:

```vue
<input
  v-if="activeGuard"
  v-model="guardParamValue"
  class="w-full mt-2 border rounded px-2 py-1 text-sm"
  :placeholder="activeGuard.paramsSchema?.[Object.keys(activeGuard.paramsSchema)[0]]?.label ?? 'Value'"
  :readonly="readonly"
/>
```

Replace with:

```vue
<template v-if="activeGuard">
  <div class="mt-2">
    <label class="block text-xs font-medium text-gray-600 mb-1">
      {{ activeGuard.paramsSchema?.expression?.label ?? 'Value' }}
    </label>
    <textarea
      v-model="guardParamValue"
      rows="4"
      class="w-full border rounded px-2 py-1 text-sm font-mono"
      :readonly="readonly"
    />
  </div>
</template>
```

- [ ] **Step 4: Build**

```bash
pnpm -r build
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add layers/workflow-editor/components/DetailsPanel.vue layers/workflow-editor/composables/useWorkflowGraph.ts
git commit -m "feat(workflow-editor): wire ActionConfigPanel and result-event dropdown"
```

---

## Task 15: Update `StateNode.vue`

**Files:**
- Modify: `layers/workflow-editor/components/StateNode.vue`
- Test: `pnpm -r build`

- [ ] **Step 1: Show action id badge**

Replace the entry/exit badge block with:

```vue
<div v-if="data.meta?.action" class="mt-1 flex flex-wrap justify-center gap-1">
  <span class="text-[10px] px-1 bg-blue-100 text-blue-800 rounded">
    {{ data.meta.action }}
  </span>
  <span v-if="data.meta.outputKey" class="text-[10px] px-1 bg-gray-100 text-gray-700 rounded">
    → {{ data.meta.outputKey }}
  </span>
</div>
```

- [ ] **Step 2: Build**

```bash
pnpm -r build
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add layers/workflow-editor/components/StateNode.vue
git commit -m "feat(workflow-editor): display configured action on state node"
```

---

## Task 16: Add a runtime integration test for condition actions

**Files:**
- Modify: `apps/workflow-runtime/tests/runtime.test.ts`
- Test: `pnpm --filter workflow-runtime test`

- [ ] **Step 1: Append a condition workflow test**

Add to the end of `apps/workflow-runtime/tests/runtime.test.ts` (inside the `describe` block):

```ts
it('branches on a condition action', async () => {
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
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter workflow-runtime test
```

Expected: the original test plus the new test pass.

- [ ] **Step 3: Commit**

```bash
git add apps/workflow-runtime/tests/runtime.test.ts
git commit -m "test(workflow-runtime): add condition-action integration test"
```

---

## Task 17: Update documentation

**Files:**
- Modify: `docs/50-Features/Workflow Actions Catalog.md`
- Modify: `docs/50-Features/Guards & Conditions.md`
- Modify: `docs/40-Packages/workflow-actions.md`

- [ ] **Step 1: Rewrite Workflow Actions Catalog**

Replace `docs/50-Features/Workflow Actions Catalog.md` body with:

```markdown
---
title: Workflow Actions Catalog
type: feature
status: done
area: workflow
created: 2026-06-14
updated: 2026-06-16
app:
  - web
  - admin
  - runtime
related:
  - [[40-Packages/workflow-actions]]
  - [[50-Features/Guards & Conditions]]
  - [[50-Features/Workflow Engine]]
---

# Workflow Actions Catalog

## Overview

Reusable CRUD and logic actions that can be composed into tenant workflows. Each action is represented as a state on the canvas and emits named result events (`ok`/`error` or `true`/`false`).

## Action states

Action configuration lives in `state.meta`:

```ts
state.meta = {
  action: 'getRecord' | 'createRecord' | 'updateRecord' | 'deleteRecord' | 'condition',
  params: { ... },
  outputKey?: string
}
```

## CRUD actions

### `getRecord`

Query records from a table.

```ts
params: {
  table: string
  filter?: MongoDBStyleFilter
  result?: { type: 'first' | 'list' }
}
outputKey?: string
```

Results: `ok`, `error`.

### `createRecord`

Insert a new record.

```ts
params: {
  table: string
  fields: Record<string, unknown>
}
outputKey?: string
```

Results: `ok`, `error`.

### `updateRecord`

Update an existing record. `id` defaults to `context.record.id`.

```ts
params: {
  table: string
  id?: string
  fields: Record<string, unknown>
}
outputKey?: string
```

Results: `ok`, `error`.

### `deleteRecord`

Delete a record. `id` defaults to `context.record.id`; `mode` defaults to `soft`.

```ts
params: {
  table: string
  id?: string
  mode?: 'soft' | 'hard'
}
outputKey?: string
```

Results: `ok`, `error`.

## Logic actions

### `condition`

Evaluate a MongoDB-style expression and branch on `true`/`false`.

```ts
params: {
  expression: MongoDBStyleExpression
}
```

Results: `true`, `false`.

## Error handling

On any action failure the runtime sets `context.lastError.message`. Workflows should route the `error` result event to a handler or terminal state.

## Adding a new action

1. Add metadata to `packages/workflow-actions/src/catalog/actions.ts`.
2. Add a runtime handler to `packages/workflow-actions/src/runtime/actions.ts`.
3. Add a test to `packages/workflow-actions/tests/actions.test.ts`.

## Related

- [[40-Packages/workflow-actions|workflow-actions package]]
- [[50-Features/Guards & Conditions|Guards & Conditions]]
- [[50-Features/Workflow Engine|Workflow Engine]]
```

- [ ] **Step 2: Rewrite Guards & Conditions**

Replace `docs/50-Features/Guards & Conditions.md` body with:

```markdown
---
title: Guards & Conditions
type: feature
status: done
area: workflow
created: 2026-06-14
updated: 2026-06-16
app:
  - web
  - admin
  - runtime
related:
  - [[40-Packages/workflow-actions]]
  - [[50-Features/Workflow Engine]]
---

# Guards & Conditions

## Overview

Guards decide whether a transition is allowed. The default guard is `condition`, which evaluates the same MongoDB-style expression used by the `condition` action.

## `condition` guard

```ts
guard: {
  type: 'condition',
  params: {
    expression: { $eq: ['$context.record.status', 'active'] }
  }
}
```

The expression can use `$eq`, `$ne`, `$exists`, `$in`, `$nin`, `$and`, `$or`, and `$not`. Values prefixed with `$context.` are resolved from the machine context.

## Wait conditions

`waitFor` supports:

- `'done'` — resolved when the workflow reaches a final state.
- `'hasTag:<tag>'` — resolved when the current snapshot has the given tag, e.g. `hasTag:waiting`.

## Related

- [[40-Packages/workflow-actions|workflow-actions package]]
- [[50-Features/Workflow Engine|Workflow Engine]]
```

- [ ] **Step 3: Update workflow-actions package doc**

In `docs/40-Packages/workflow-actions.md`, update the **Runtime registries** section to:

```markdown
## Runtime registries

- `createActionActors(ctx, context)` returns XState `invoke` actor logic for every catalog action. Each actor runs inside `ctx.run` so side effects are durable and retried.
- `createGuardRegistry(context)` returns XState guard implementations.
```

Also bump `updated` to `2026-06-16` and `status` to `done`.

- [ ] **Step 4: Commit**

```bash
git add docs/50-Features/Workflow\ Actions\ Catalog.md docs/50-Features/Guards\ \&\ Conditions.md docs/40-Packages/workflow-actions.md
git commit -m "docs: document CRUD actions, condition action, and condition guard"
```

---

## Task 18: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
pnpm test
```

Expected: all new tests pass. Pre-existing DB tests may require a running SurrealDB and Docker.

- [ ] **Step 2: Run production build**

```bash
pnpm -r build
```

Expected: exits `0`.

- [ ] **Step 3: Run package typechecks**

```bash
pnpm --filter workflow-actions typecheck
pnpm --filter workflow-runtime build
pnpm --filter db typecheck
```

Expected: all pass.

- [ ] **Step 4: Commit any final fixes**

```bash
git commit -am "chore: final fixes for CRUD workflow actions" || echo "nothing to commit"
```

---

## Self-review

### Spec coverage

| Spec requirement | Task |
|------------------|------|
| Action = state, Result = transition | Task 9 compile refactor |
| `getRecord` / `createRecord` / `updateRecord` / `deleteRecord` | Task 5 |
| `condition` action with MongoDB expressions | Task 2, Task 5 |
| `outputKey` assignment | Task 9 `assignOutput` |
| `context.lastError` on failure | Task 9 `assignError` |
| CRUD defaults (id, soft delete) | Task 5 |
| MongoDB operators v1 | Task 2 |
| `$context.` ref resolution | Task 2 |
| Editor action config panel | Task 13, Task 14 |
| Result transition labels | Task 14 dropdown, Task 15 badges |
| Remove POC actions from catalog | Task 8 |
| Update seed workflow | Task 11 |
| Update docs | Task 17 |

### Placeholder scan

- No `TBD`, `TODO`, or "implement later" strings.
- Every task includes exact file paths and runnable code.
- Every test task includes expected output.

### Type consistency

- `ActionExecutorContext` and `GuardExecutorContext` both carry `context: Record<string, unknown>`.
- `state.meta.action`/`params`/`outputKey` shape is consistent across runtime, compile, graph conversion, and UI.
- Result event names are `ok`/`error` for CRUD and `true`/`false` for `condition` everywhere.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-16-real-crud-workflow-actions.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Which approach would you like?
