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

export interface BenchmarkScenario {
  name: string
  group: string
  setup?(): Promise<unknown>
  fn(state: unknown): Promise<void>
  teardown?(state: unknown): Promise<void>
}

export interface Scenario<TState> extends BenchmarkScenario {
  setup?(): Promise<TState>
  fn(state: TState | undefined): Promise<void>
  teardown?(state: TState | undefined): Promise<void>
}

export async function runBenchmark(
  scenario: BenchmarkScenario,
  concurrency: number,
  durationMs: number,
  warmupMs = 1000,
): Promise<BenchmarkResult> {
  let state: unknown = undefined
  let benchmarkError: unknown = undefined
  try {
    state = await scenario.setup?.()
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
  } catch (err) {
    benchmarkError = err
  } finally {
    try {
      await scenario.teardown?.(state)
    } catch (teardownErr) {
      if (benchmarkError) {
        console.error('Teardown failed after benchmark error:', teardownErr)
      } else {
        benchmarkError = teardownErr
      }
    }
  }
  if (benchmarkError) {
    throw benchmarkError
  }
  // This should be unreachable; throw to satisfy TypeScript's return-path check
  throw new Error('Benchmark ended without result')
}

async function runWorkers(
  fn: (state: unknown) => Promise<void>,
  state: unknown,
  concurrency: number,
  durationMs: number,
): Promise<{ totalOps: number; errors: number; latencies: number[] }> {
  const endTime = performance.now() + durationMs
  const workers = Array.from({ length: concurrency }, () => worker(fn, state, endTime))
  const outputs = await Promise.all(workers)
  return outputs.reduce(
    (acc, cur) => {
      acc.totalOps += cur.ops
      acc.errors += cur.errors
      for (const latency of cur.latencies) {
        acc.latencies.push(latency)
      }
      return acc
    },
    { totalOps: 0, errors: 0, latencies: [] as number[] },
  )
}

async function worker(
  fn: (state: unknown) => Promise<void>,
  state: unknown,
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
      latencies.push(performance.now() - start)
    } catch {
      errors++
    }
  }
  return { ops, errors, latencies }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil(sorted.length * p) - 1
  return sorted[Math.max(0, idx)]
}
