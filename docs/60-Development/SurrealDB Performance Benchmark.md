---
title: SurrealDB Performance Benchmark
type: runbook
status: in-progress
area: docs
created: 2026-06-16
updated: 2026-06-17
related:
  - [[Benchmarking]]
  - [[db package]]
---

# SurrealDB Performance Benchmark

> Generated automatically by `packages/db/scripts/benchmark.ts`.

The benchmark exercises the public helpers from [[db package]].

- **Duration per concurrency level:** 5s
- **Concurrency levels:** 1, 10, 50, 100
- **Generated at:** 2026-06-17T06:10:52.636Z

## platform

| Scenario | Concurrency | Ops/sec | p50 (ms) | p95 (ms) | p99 (ms) | Errors |
|----------|------------:|--------:|---------:|---------:|---------:|-------:|
| createCompany | 1 | 235.60 | 4.10 | 5.52 | 7.02 | 0 |
| createCompany | 10 | 1522.20 | 6.45 | 8.77 | 10.10 | 0 |
| createCompany | 50 | 2354.40 | 8.13 | 12.35 | 16.73 | 0 |
| createCompany | 100 | 2343.20 | 8.09 | 13.47 | 18.51 | 0 |
| getCompanyBySlug | 1 | 611.40 | 1.50 | 2.58 | 3.26 | 0 |
| getCompanyBySlug | 10 | 2263.20 | 3.92 | 7.52 | 9.83 | 0 |
| getCompanyBySlug | 50 | 2265.80 | 8.08 | 13.56 | 16.93 | 0 |
| getCompanyBySlug | 100 | 2297.20 | 8.04 | 13.42 | 18.62 | 0 |
| createPlatformWorkflow | 1 | 255.60 | 3.81 | 5.07 | 5.97 | 0 |
| createPlatformWorkflow | 10 | 1580.20 | 6.19 | 8.35 | 9.96 | 0 |
| createPlatformWorkflow | 50 | 2479.40 | 7.53 | 13.01 | 16.37 | 0 |
| createPlatformWorkflow | 100 | 2345.60 | 7.95 | 13.92 | 28.38 | 0 |
| getPlatformWorkflow | 1 | 650.40 | 1.42 | 2.38 | 3.17 | 0 |
| getPlatformWorkflow | 10 | 3245.00 | 2.83 | 5.15 | 6.55 | 0 |
| getPlatformWorkflow | 50 | 3224.80 | 5.74 | 9.55 | 12.76 | 0 |
| getPlatformWorkflow | 100 | 3223.00 | 5.76 | 10.03 | 13.63 | 0 |
| createPlatformWorkflowInstance | 1 | 266.40 | 3.66 | 4.76 | 5.54 | 0 |
| createPlatformWorkflowInstance | 10 | 1472.00 | 6.73 | 9.01 | 10.40 | 0 |
| createPlatformWorkflowInstance | 50 | 2144.00 | 8.69 | 15.21 | 18.62 | 0 |
| createPlatformWorkflowInstance | 100 | 2160.60 | 8.72 | 15.12 | 19.56 | 0 |
| getPlatformWorkflowInstance | 1 | 637.60 | 1.45 | 2.45 | 3.06 | 0 |
| getPlatformWorkflowInstance | 10 | 2757.40 | 3.30 | 6.34 | 8.54 | 0 |
| getPlatformWorkflowInstance | 50 | 2344.60 | 8.07 | 13.14 | 16.20 | 0 |
| getPlatformWorkflowInstance | 100 | 3026.80 | 6.13 | 11.09 | 15.60 | 0 |
| createPlatformUserTask | 1 | 174.40 | 5.76 | 7.05 | 7.68 | 0 |
| createPlatformUserTask | 10 | 1154.80 | 8.01 | 12.28 | 16.75 | 0 |
| createPlatformUserTask | 50 | 1898.00 | 9.85 | 16.42 | 21.03 | 0 |
| createPlatformUserTask | 100 | 2222.20 | 8.57 | 14.54 | 18.78 | 0 |
| getPlatformUserTaskById | 1 | 616.20 | 1.48 | 2.55 | 3.23 | 0 |
| getPlatformUserTaskById | 10 | 3350.80 | 2.75 | 4.98 | 6.29 | 0 |
| getPlatformUserTaskById | 50 | 3044.20 | 6.20 | 9.76 | 11.85 | 0 |
| getPlatformUserTaskById | 100 | 3222.20 | 5.88 | 9.63 | 12.22 | 0 |
| createHealthCheck | 1 | 168.80 | 5.94 | 7.45 | 8.19 | 0 |
| createHealthCheck | 10 | 1135.80 | 8.32 | 11.78 | 15.41 | 0 |
| createHealthCheck | 50 | 1875.60 | 9.91 | 17.25 | 21.72 | 0 |
| createHealthCheck | 100 | 2146.00 | 8.72 | 15.21 | 19.72 | 0 |
| listLatestHealthChecks | 1 | 14.20 | 70.94 | 75.12 | 77.41 | 0 |
| listLatestHealthChecks | 10 | 134.40 | 73.86 | 85.86 | 90.84 | 0 |
| listLatestHealthChecks | 50 | 214.60 | 96.36 | 116.13 | 5155.33 | 0 |
| listLatestHealthChecks | 100 | 216.60 | 100.76 | 5249.76 | 5463.89 | 0 |

## tenant

| Scenario | Concurrency | Ops/sec | p50 (ms) | p95 (ms) | p99 (ms) | Errors |
|----------|------------:|--------:|---------:|---------:|---------:|-------:|
| createMember | 1 | 255.40 | 3.78 | 5.09 | 6.35 | 0 |
| createMember | 10 | 1495.20 | 6.66 | 8.76 | 10.01 | 0 |
| createMember | 50 | 2099.60 | 8.88 | 15.29 | 18.34 | 0 |
| createMember | 100 | 2156.20 | 8.68 | 15.12 | 19.14 | 0 |
| getMemberById | 1 | 653.40 | 1.43 | 2.30 | 2.78 | 0 |
| getMemberById | 10 | 3040.20 | 2.98 | 5.62 | 7.75 | 0 |
| getMemberById | 50 | 2340.00 | 8.02 | 13.57 | 18.46 | 0 |
| getMemberById | 100 | 2781.20 | 6.88 | 11.52 | 14.76 | 0 |
| createWorkflow | 1 | 248.60 | 3.83 | 5.61 | 6.39 | 0 |
| createWorkflow | 10 | 1499.20 | 6.22 | 10.27 | 13.09 | 0 |
| createWorkflow | 50 | 2092.80 | 8.90 | 15.28 | 19.21 | 0 |
| createWorkflow | 100 | 2151.40 | 8.66 | 15.30 | 22.11 | 0 |
| getWorkflow | 1 | 583.80 | 1.55 | 2.71 | 3.20 | 0 |
| getWorkflow | 10 | 3010.00 | 3.03 | 5.66 | 7.54 | 0 |
| getWorkflow | 50 | 3236.00 | 5.73 | 9.70 | 12.34 | 0 |
| getWorkflow | 100 | 3352.60 | 5.65 | 8.99 | 11.86 | 0 |
| createWorkflowInstance | 1 | 252.80 | 3.82 | 5.23 | 6.26 | 0 |
| createWorkflowInstance | 10 | 1507.20 | 6.60 | 8.84 | 10.05 | 0 |
| createWorkflowInstance | 50 | 2370.40 | 7.91 | 13.26 | 17.46 | 0 |
| createWorkflowInstance | 100 | 2363.80 | 8.06 | 13.38 | 17.56 | 0 |
| getWorkflowInstance | 1 | 660.00 | 1.41 | 2.31 | 2.85 | 0 |
| getWorkflowInstance | 10 | 3456.40 | 2.65 | 4.87 | 6.15 | 0 |
| getWorkflowInstance | 50 | 3295.80 | 5.63 | 9.52 | 11.68 | 0 |
| getWorkflowInstance | 100 | 3375.00 | 5.55 | 8.98 | 13.03 | 0 |
| createUserTask | 1 | 254.80 | 3.73 | 5.35 | 6.39 | 0 |
| createUserTask | 10 | 1551.60 | 6.33 | 8.72 | 10.14 | 0 |
| createUserTask | 50 | 2406.20 | 7.95 | 12.12 | 16.13 | 0 |
| createUserTask | 100 | 2382.00 | 7.94 | 13.44 | 18.65 | 0 |
| getUserTaskById | 1 | 671.80 | 1.39 | 2.22 | 2.77 | 0 |
| getUserTaskById | 10 | 3494.40 | 2.62 | 4.86 | 6.19 | 0 |
| getUserTaskById | 50 | 3294.20 | 5.65 | 9.21 | 12.48 | 0 |
| getUserTaskById | 100 | 3432.60 | 5.47 | 8.80 | 11.42 | 0 |
