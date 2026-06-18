---
title: Benchmarking
type: runbook
status: in-progress
area: docs
created: 2026-06-16
updated: 2026-06-17
related:
  - [[db package]]
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

### Verify the run

After the command exits, check that these files were created:

- `docs/60-Development/SurrealDB Performance Benchmark.md`
- `packages/db/benchmark-results/latest.json`

### Cleanup

Stop the SurrealDB container when finished:

```bash
docker compose down surrealdb
```
