---
title: SurrealDB Performance Benchmark Implementation Plan
type: note
status: planned
area: db
created: 2026-06-16
updated: 2026-06-16
related:
  - [[DB Package]]
  - [[Testing]]
  - [[SurrealDB Conventions]]
---

# SurrealDB Performance Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reproducible, custom Node.js benchmark harness for `packages/db` that measures SurrealDB query latency and throughput at different concurrency levels and writes a Markdown report into `docs/`.

**Architecture:** A small TypeScript runner uses `perf_hooks` to time each operation, spawns configurable concurrent workers, and aggregates p50/p95/p99 latency and ops/sec. Scenarios call the existing `packages/db` helpers exactly as production code does, so the numbers reflect real helper overhead plus SurrealDB response time. Results are written to a Markdown note for the vault and a JSON file for tooling.

**Tech Stack:** Node.js `perf_hooks`, `tsx`, the existing `surrealdb` JS SDK, Docker Compose SurrealDB, no extra load-generator dependencies.

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/db/package.json` | Add `benchmark` script. |
| `packages/db/scripts/benchmark/runner.ts` | Worker spawning, timing, percentile calculation, and result aggregation. |
| `packages/db/scripts/benchmark/scenarios.ts` | Scenario definitions for platform and tenant CRUD operations. |
| `packages/db/scripts/benchmark/report.ts` | Markdown + JSON report writers. |
| `packages/db/scripts/benchmark.ts` | Main entry point that wires levels, scenarios, and reporting. |
| `docs/60-Development/SurrealDB Performance Benchmark.md` | Generated report (output). |
| `packages/db/benchmark-results/latest.json` | Machine-readable latest results (output). |
| `docs/60-Development/Benchmarking.md` | Runbook for running and interpreting the benchmark. |

---

### Task 1: Add benchmark script and runner utilities

**Files:**
- Modify: `packages/db/package.json`
- Create: `packages/db/scripts/benchmark/runner.ts`

- [ ] **Step 1: Update `packages/db/package.json`**

Add a `benchmark` script:

```json
{
  "name": "db",
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "seed": "tsx src/seed.ts",
    "seed:workflows": "tsx src/seed-workflows.ts",
    "benchmark": "tsx scripts/benchmark.ts"
  },
  "dependencies": { ... },
  "devDependencies": { ... }
}
```

- [ ] **Step 2: Update `packages/db/tsconfig.json`**

Add `scripts/**/*.ts` to `include` so the benchmark files are type-checked:

```json
{
  "compilerOptions": { ... },
  "include": ["src/**/*", "test/**/*.ts", "scripts/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/db/scripts/benchmark/runner.ts`**

```ts
import { performance } from 'node:perf_hooks'

export interface BenchmarkResult {
  concurrency: number
  durationMs: number
  totalOps: number
  opsPerSecond: number
  latencyMs: {
    p50: number
    p95: number
    p99: number
    min: number
    max: number
  }
  errors: number
}

export interface Scenario<TState> {
  name: string
  group: string
  setup?: () => Promise<TState>
  fn: (state: TState) => Promise<void>
  teardown?: (state: TState) => Promise<void>
}

export async function runBenchmark<TState>(
  scenario: Scenario<TState>,
  concurrency: number,
  durationMs: number,
  warmupMs = 1000,
): Promise<BenchmarkResult> {
  const state = await scenario.setup?.()
  try {
    await runWorkers(scenario.fn, state, concurrency, warmupMs)
    const { totalOps, errors, latencies } = await runWorkers(
      scenario.fn,
      state,
      concurrency,
      durationMs,
    )
    const sorted = latencies.slice().sort((a, b) => a - b)
    return {
      concurrency,
      durationMs,
      totalOps,
      opsPerSecond: (totalOps / durationMs) * 1000,
      latencyMs: {
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        p99: percentile(sorted, 0.99),
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
      },
      errors,
    }
  } finally {
    await scenario.teardown?.(state)
  }
}

async function runWorkers<TState>(
  fn: (state: TState) => Promise<void>,
  state: TState,
  concurrency: number,
  durationMs: number,
): Promise<{ totalOps: number; errors: number; latencies: number[] }> {
  const endTime = performance.now() + durationMs
  const workers = Array.from({ length: concurrency }, () => worker(fn, state, endTime))
  const outputs = await Promise.all(workers)
  return outputs.reduce(
    (acc, cur) => ({
      totalOps: acc.totalOps + cur.ops,
      errors: acc.errors + cur.errors,
      latencies: acc.latencies.concat(cur.latencies),
    }),
    { totalOps: 0, errors: 0, latencies: [] as number[] },
  )
}

async function worker<TState>(
  fn: (state: TState) => Promise<void>,
  state: TState,
  endTime: number,
): Promise<{ ops: number; errors: number; latencies: number[] }> {
  let ops = 0
  let errors = 0
  const latencies: number[] = []
  while (performance.now() < endTime) {
    const start = performance.now()
    try {
      await fn(state)
      ops++
    } catch {
      errors++
    } finally {
      latencies.push(performance.now() - start)
    }
  }
  return { ops, errors, latencies }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil(sorted.length * p) - 1
  return sorted[Math.max(0, idx)]
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:

```bash
pnpm --filter db typecheck
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/package.json packages/db/tsconfig.json packages/db/scripts/benchmark/runner.ts
git commit -m "chore(db): add benchmark script and runner"
```

---

### Task 2: Create benchmark scenarios

**Files:**
- Create: `packages/db/scripts/benchmark/scenarios.ts`

- [ ] **Step 1: Create `packages/db/scripts/benchmark/scenarios.ts`**

```ts
import { randomUUID } from 'node:crypto'
import * as platform from '../../src/platform.js'
import * as tenant from '../../src/tenant.js'
import * as health from '../../src/health-checks.js'
import {
  ensurePlatformNamespace,
  resetPlatformTables,
  createTenantNamespace,
  removeTenantNamespace,
} from '../../test/helpers.js'
import type { Scenario } from './runner.js'

const sampleWorkflow = {
  name: 'Benchmark',
  xstateConfig: { id: 'benchmark', initial: 'idle', states: { idle: {} } },
}

let slugCounter = 0
let emailCounter = 0

function uniqueSlug() {
  slugCounter++
  return `bench-${Date.now()}-${slugCounter}`
}

function uniqueEmail() {
  emailCounter++
  return `bench-${Date.now()}-${emailCounter}@example.com`
}

async function setupPlatform() {
  await ensurePlatformNamespace()
  await resetPlatformTables()
  const company = await platform.createCompany({
    name: 'Benchmark Co',
    slug: 'bench-co',
    namespace: 'bench_co',
  })
  const workflow = await platform.createPlatformWorkflow(sampleWorkflow)
  const instance = await platform.createPlatformWorkflowInstance({
    workflowId: workflow.id,
    status: 'running',
    tableName: 'orders',
    recordId: 'orders:1',
    namespace: company.namespace,
  })
  const task = await platform.createPlatformUserTask({
    instanceId: instance.id,
    type: 'approval',
    tableName: 'orders',
    recordId: 'orders:1',
    workflowId: workflow.id,
  })
  return { company, workflow, instance, task }
}

async function setupTenant(namespace: string) {
  await createTenantNamespace(namespace)
  const member = await tenant.createMember(namespace, {
    email: uniqueEmail(),
    role: 'admin',
  })
  const workflow = await tenant.createWorkflow(namespace, sampleWorkflow)
  const instance = await tenant.createWorkflowInstance(namespace, {
    workflowId: workflow.id,
    status: 'running',
    tableName: 'orders',
    recordId: 'orders:1',
    namespace,
  })
  const task = await tenant.createUserTask(namespace, {
    instanceId: instance.id,
    type: 'approval',
    tableName: 'orders',
    recordId: 'orders:1',
    workflowId: workflow.id,
  })
  return { member, workflow, instance, task }
}

export const platformScenarios: Scenario<unknown>[] = [
  {
    name: 'createCompany',
    group: 'platform',
    setup: async () => {
      await ensurePlatformNamespace()
      await resetPlatformTables()
    },
    fn: async () => {
      await platform.createCompany({
        name: 'Benchmark Co',
        slug: uniqueSlug(),
        namespace: uniqueSlug(),
      })
    },
  },
  {
    name: 'getCompanyBySlug',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state.company.slug
    },
    fn: async (slug: unknown) => {
      await platform.getCompanyBySlug(slug as string)
    },
  },
  {
    name: 'createPlatformWorkflow',
    group: 'platform',
    setup: async () => {
      await ensurePlatformNamespace()
      await resetPlatformTables()
    },
    fn: async () => {
      await platform.createPlatformWorkflow({
        ...sampleWorkflow,
        name: `Benchmark ${Date.now()}`,
      })
    },
  },
  {
    name: 'getPlatformWorkflow',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state.workflow.id
    },
    fn: async (id: unknown) => {
      await platform.getPlatformWorkflow(id as string)
    },
  },
  {
    name: 'createPlatformWorkflowInstance',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state.workflow.id
    },
    fn: async (workflowId: unknown) => {
      await platform.createPlatformWorkflowInstance({
        workflowId: workflowId as string,
        status: 'running',
        tableName: 'orders',
        recordId: `orders:${randomUUID()}`,
        namespace: 'bench_co',
      })
    },
  },
  {
    name: 'getPlatformWorkflowInstance',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state.instance.id
    },
    fn: async (id: unknown) => {
      await platform.getPlatformWorkflowInstance(id as string)
    },
  },
  {
    name: 'createPlatformUserTask',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state
    },
    fn: async (state: unknown) => {
      const { workflow, instance } = state as Awaited<ReturnType<typeof setupPlatform>>
      await platform.createPlatformUserTask({
        instanceId: instance.id,
        type: 'approval',
        tableName: 'orders',
        recordId: `orders:${randomUUID()}`,
        workflowId: workflow.id,
      })
    },
  },
  {
    name: 'getPlatformUserTaskById',
    group: 'platform',
    setup: async () => {
      const state = await setupPlatform()
      return state.task.id
    },
    fn: async (id: unknown) => {
      await platform.getPlatformUserTaskById(id as string)
    },
  },
  {
    name: 'createHealthCheck',
    group: 'platform',
    setup: async () => {
      await ensurePlatformNamespace()
      await resetPlatformTables()
    },
    fn: async () => {
      await health.createHealthCheck({
        service: 'api',
        status: 'healthy',
        responseTimeMs: 10,
        checkedAt: new Date().toISOString(),
      })
    },
  },
  {
    name: 'listLatestHealthChecks',
    group: 'platform',
    setup: async () => {
      await ensurePlatformNamespace()
      await resetPlatformTables()
      for (let i = 0; i < 100; i++) {
        await health.createHealthCheck({
          service: i % 2 === 0 ? 'api' : 'worker',
          status: 'healthy',
          responseTimeMs: i,
          checkedAt: new Date().toISOString(),
        })
      }
    },
    fn: async () => {
      await health.listLatestHealthChecks()
    },
  },
]

export const tenantScenarios: Scenario<unknown>[] = [
  {
    name: 'createMember',
    group: 'tenant',
    setup: async () => {
      const namespace = `bench_tenant_${randomUUID().replaceAll('-', '_')}`
      await createTenantNamespace(namespace)
      return namespace
    },
    teardown: async (namespace: unknown) => {
      await removeTenantNamespace(namespace as string)
    },
    fn: async (namespace: unknown) => {
      await tenant.createMember(namespace as string, {
        email: uniqueEmail(),
        role: 'admin',
      })
    },
  },
  {
    name: 'getMemberById',
    group: 'tenant',
    setup: async () => {
      const namespace = `bench_tenant_${randomUUID().replaceAll('-', '_')}`
      const state = await setupTenant(namespace)
      return { namespace, id: state.member.id }
    },
    teardown: async (state: unknown) => {
      await removeTenantNamespace((state as { namespace: string }).namespace)
    },
    fn: async (state: unknown) => {
      const { namespace, id } = state as { namespace: string; id: string }
      await tenant.getMemberById(namespace, id)
    },
  },
  {
    name: 'createWorkflow',
    group: 'tenant',
    setup: async () => {
      const namespace = `bench_tenant_${randomUUID().replaceAll('-', '_')}`
      await createTenantNamespace(namespace)
      return namespace
    },
    teardown: async (namespace: unknown) => {
      await removeTenantNamespace(namespace as string)
    },
    fn: async (namespace: unknown) => {
      await tenant.createWorkflow(namespace as string, {
        ...sampleWorkflow,
        name: `Benchmark ${Date.now()}`,
      })
    },
  },
  {
    name: 'getWorkflow',
    group: 'tenant',
    setup: async () => {
      const namespace = `bench_tenant_${randomUUID().replaceAll('-', '_')}`
      const state = await setupTenant(namespace)
      return { namespace, id: state.workflow.id }
    },
    teardown: async (state: unknown) => {
      await removeTenantNamespace((state as { namespace: string }).namespace)
    },
    fn: async (state: unknown) => {
      const { namespace, id } = state as { namespace: string; id: string }
      await tenant.getWorkflow(namespace, id)
    },
  },
  {
    name: 'createWorkflowInstance',
    group: 'tenant',
    setup: async () => {
      const namespace = `bench_tenant_${randomUUID().replaceAll('-', '_')}`
      const state = await setupTenant(namespace)
      return { namespace, workflowId: state.workflow.id }
    },
    teardown: async (state: unknown) => {
      await removeTenantNamespace((state as { namespace: string }).namespace)
    },
    fn: async (state: unknown) => {
      const { namespace, workflowId } = state as { namespace: string; workflowId: string }
      await tenant.createWorkflowInstance(namespace, {
        workflowId,
        status: 'running',
        tableName: 'orders',
        recordId: `orders:${randomUUID()}`,
        namespace,
      })
    },
  },
  {
    name: 'getWorkflowInstance',
    group: 'tenant',
    setup: async () => {
      const namespace = `bench_tenant_${randomUUID().replaceAll('-', '_')}`
      const state = await setupTenant(namespace)
      return { namespace, id: state.instance.id }
    },
    teardown: async (state: unknown) => {
      await removeTenantNamespace((state as { namespace: string }).namespace)
    },
    fn: async (state: unknown) => {
      const { namespace, id } = state as { namespace: string; id: string }
      await tenant.getWorkflowInstance(namespace, id)
    },
  },
  {
    name: 'createUserTask',
    group: 'tenant',
    setup: async () => {
      const namespace = `bench_tenant_${randomUUID().replaceAll('-', '_')}`
      const state = await setupTenant(namespace)
      return { namespace, workflowId: state.workflow.id, instanceId: state.instance.id }
    },
    teardown: async (state: unknown) => {
      await removeTenantNamespace((state as { namespace: string }).namespace)
    },
    fn: async (state: unknown) => {
      const { namespace, workflowId, instanceId } = state as {
        namespace: string
        workflowId: string
        instanceId: string
      }
      await tenant.createUserTask(namespace, {
        instanceId,
        type: 'approval',
        tableName: 'orders',
        recordId: `orders:${randomUUID()}`,
        workflowId,
      })
    },
  },
  {
    name: 'getUserTaskById',
    group: 'tenant',
    setup: async () => {
      const namespace = `bench_tenant_${randomUUID().replaceAll('-', '_')}`
      const state = await setupTenant(namespace)
      return { namespace, id: state.task.id }
    },
    teardown: async (state: unknown) => {
      await removeTenantNamespace((state as { namespace: string }).namespace)
    },
    fn: async (state: unknown) => {
      const { namespace, id } = state as { namespace: string; id: string }
      await tenant.getUserTaskById(namespace, id)
    },
  },
]
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:

```bash
pnpm --filter db typecheck
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/db/scripts/benchmark/scenarios.ts
git commit -m "feat(db): add benchmark scenarios"
```

---

### Task 3: Wire up main benchmark orchestrator and report writer

**Files:**
- Create: `packages/db/scripts/benchmark/report.ts`
- Create: `packages/db/scripts/benchmark.ts`

- [ ] **Step 1: Create `packages/db/scripts/benchmark/report.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BenchmarkResult } from './runner.js'

interface ReportRow extends BenchmarkResult {
  scenario: string
  group: string
}

const __filename = fileURLToPath(import.meta.url)
const root = resolve(__filename, '..', '..', '..', '..')

export function writeReport(rows: ReportRow[], durationSeconds: number, concurrencyLevels: number[]) {
  const md = generateMarkdown(rows, durationSeconds, concurrencyLevels)
  const mdPath = resolve(root, 'docs', '60-Development', 'SurrealDB Performance Benchmark.md')
  writeFileSync(mdPath, md)

  const jsonDir = resolve(root, 'packages', 'db', 'benchmark-results')
  mkdirSync(jsonDir, { recursive: true })
  const jsonPath = resolve(jsonDir, 'latest.json')
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        durationSeconds,
        concurrencyLevels,
        results: rows,
      },
      null,
      2,
    ),
  )

  console.log(`Wrote Markdown report to ${mdPath}`)
  console.log(`Wrote JSON results to ${jsonPath}`)
}

function generateMarkdown(
  rows: ReportRow[],
  durationSeconds: number,
  concurrencyLevels: number[],
): string {
  const groups = Array.from(new Set(rows.map((r) => r.group)))
  const sections = groups
    .map((group) => {
      const groupRows = rows.filter((r) => r.group === group)
      const scenarios = Array.from(new Set(groupRows.map((r) => r.scenario)))
      const table = [
        `## ${group}`,
        '',
        '| Scenario | Concurrency | Ops/sec | p50 (ms) | p95 (ms) | p99 (ms) | Errors |',
        '|----------|------------:|--------:|---------:|---------:|---------:|-------:|',
        ...scenarios.flatMap((scenario) => {
          const scenarioRows = groupRows
            .filter((r) => r.scenario === scenario)
            .sort((a, b) => a.concurrency - b.concurrency)
          return scenarioRows.map(
            (r) =>
              `| ${scenario} | ${r.concurrency} | ${r.opsPerSecond.toFixed(2)} | ${r.latencyMs.p50.toFixed(2)} | ${r.latencyMs.p95.toFixed(2)} | ${r.latencyMs.p99.toFixed(2)} | ${r.errors} |`,
          )
        }),
      ].join('\n')
      return table
    })
    .join('\n\n')

  return `---
title: SurrealDB Performance Benchmark
type: note
status: done
area: db
created: 2026-06-16
updated: ${new Date().toISOString().slice(0, 10)}
related:
  - [[Benchmarking]]
  - [[DB Package]]
---

# SurrealDB Performance Benchmark

> Generated automatically by \`packages/db/scripts/benchmark.ts\`.

- **Duration per concurrency level:** ${durationSeconds}s
- **Concurrency levels:** ${concurrencyLevels.join(', ')}
- **Generated at:** ${new Date().toISOString()}

${sections}
`
}
```

- [ ] **Step 2: Create `packages/db/scripts/benchmark.ts`**

```ts
import { platformScenarios, tenantScenarios } from './benchmark/scenarios.js'
import { runBenchmark } from './benchmark/runner.js'
import { writeReport } from './benchmark/report.js'

const CONCURRENCY_LEVELS = [1, 10, 50, 100]
const DURATION_MS = 5000
const WARMUP_MS = 1000

async function main() {
  const allScenarios = [...platformScenarios, ...tenantScenarios]
  const results = []

  for (const scenario of allScenarios) {
    for (const concurrency of CONCURRENCY_LEVELS) {
      console.log(`[${scenario.group}] ${scenario.name} @ ${concurrency} clients...`)
      const result = await runBenchmark(scenario, concurrency, DURATION_MS, WARMUP_MS)
      results.push({ scenario: scenario.name, group: scenario.group, ...result })
    }
  }

  writeReport(results, DURATION_MS / 1000, CONCURRENCY_LEVELS)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:

```bash
pnpm --filter db typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/scripts/benchmark/report.ts packages/db/scripts/benchmark.ts
git commit -m "feat(db): add benchmark orchestrator and report writer"
```

---

### Task 4: Run benchmark and validate output

**Files:**
- Output: `docs/60-Development/SurrealDB Performance Benchmark.md`
- Output: `packages/db/benchmark-results/latest.json`

- [ ] **Step 1: Ensure SurrealDB is running**

```bash
docker compose up -d surrealdb
```

- [ ] **Step 2: Run the benchmark**

```bash
pnpm --filter db benchmark
```

Expected: console prints progress for each scenario and concurrency level, then writes the two output files.

- [ ] **Step 3: Inspect generated report**

Open `docs/60-Development/SurrealDB Performance Benchmark.md` and confirm:

- Frontmatter is valid.
- Each group has a table with rows for every scenario × concurrency level.
- Ops/sec and latency numbers are present and errors are 0 (or near 0).

- [ ] **Step 4: Inspect JSON output**

Open `packages/db/benchmark-results/latest.json` and confirm it contains `generatedAt`, `durationSeconds`, `concurrencyLevels`, and an array of results.

- [ ] **Step 5: Add `packages/db/benchmark-results/` to `.gitignore`**

Generated JSON should not be committed unless the user explicitly wants it. Add to `packages/db/.gitignore` (create if missing):

```gitignore
benchmark-results/
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/.gitignore docs/60-Development/SurrealDB\ Performance\ Benchmark.md
git commit -m "feat(db): run initial SurrealDB benchmark and store report"
```

---

### Task 5: Add Benchmarking runbook

**Files:**
- Create: `docs/60-Development/Benchmarking.md`

- [ ] **Step 1: Create `docs/60-Development/Benchmarking.md`**

```markdown
---
title: Benchmarking
type: runbook
status: done
area: docs
created: 2026-06-16
updated: 2026-06-16
related:
  - [[DB Package]]
  - [[Testing]]
  - [[SurrealDB Performance Benchmark]]
---

# Benchmarking

## SurrealDB performance benchmark

The `packages/db` benchmark measures latency and throughput of the public DB helpers against the Docker Compose SurrealDB service.

### Prerequisites

```bash
docker compose up -d surrealdb
```

### Run the benchmark

```bash
pnpm --filter db benchmark
```

This executes every scenario at 1, 10, 50, and 100 concurrent clients for 5 seconds each (plus 1 second warmup). Results are written to:

- `docs/60-Development/SurrealDB Performance Benchmark.md` — human-readable report
- `packages/db/benchmark-results/latest.json` — machine-readable raw data

### Interpreting results

- **Ops/sec:** higher is better. Compare across concurrency levels to spot saturation.
- **p50/p95/p99 latency:** lower is better. Watch for p95/p99 climbing faster than p50 — that indicates queueing or lock contention.
- **Errors:** should be 0. Non-zero errors usually mean connection limits or timeouts.

### Customizing the run

Edit `packages/db/scripts/benchmark.ts`:

- `CONCURRENCY_LEVELS` — array of concurrent client counts.
- `DURATION_MS` — milliseconds to measure per level.
- `WARMUP_MS` — milliseconds to discard before measuring.

### Adding a scenario

Add a new `Scenario` object to `packages/db/scripts/benchmark/scenarios.ts`:

```ts
{
  name: 'myScenario',
  group: 'platform',
  setup: async () => { /* create fixture */ },
  fn: async (state) => { /* run operation */ },
  teardown: async (state) => { /* cleanup */ },
}
```

The scenario will be picked up automatically on the next run.
```

- [ ] **Step 2: Link from `docs/40-Packages/db.md`**

Add a "Benchmarking" subsection:

```markdown
## Benchmarking

See [[Benchmarking]] for how to run the SurrealDB performance benchmark.
```

- [ ] **Step 3: Run frontmatter script if needed**

```bash
node docs/scripts/apply-frontmatter.cjs
```

- [ ] **Step 4: Commit**

```bash
git add docs/60-Development/Benchmarking.md docs/40-Packages/db.md
git commit -m "docs: add benchmarking runbook"
```

---

## Self-review

**Spec coverage:** The plan benchmarks core CRUD for the main `platform` tables (`companies`, `workflows`, `workflow_instances`, `user_tasks`, `health_checks`) and the main `tenant` tables (`members`, `workflows`, `workflow_instances`, `user_tasks`). It reports p50/p95/p99 latency, ops/sec, and errors at 1, 10, 50, and 100 concurrent clients.

**Placeholder scan:** No TBD/TODO placeholders remain. Every task includes exact file paths, complete code, and exact commands.

**Type consistency:** Scenario types, helper signatures, and state shapes match the current `packages/db/src` exports and the existing `test/helpers.ts` setup/teardown helpers.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-16-surrealdb-performance-benchmark.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
