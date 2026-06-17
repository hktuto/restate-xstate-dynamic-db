---
title: SurrealDB Performance Benchmark
type: note
status: done
area: db
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
- **Generated at:** 2026-06-17T04:17:36.575Z

## platform

| Scenario | Concurrency | Ops/sec | p50 (ms) | p95 (ms) | p99 (ms) | Errors |
|----------|------------:|--------:|---------:|---------:|---------:|-------:|
| createCompany | 1 | 26.80 | 34.47 | 47.75 | 49.70 | 0 |
| createCompany | 10 | 179.80 | 54.48 | 70.29 | 81.29 | 0 |
| createCompany | 50 | 238.60 | 211.86 | 263.37 | 291.36 | 0 |
| createCompany | 100 | 253.60 | 393.99 | 514.41 | 600.46 | 0 |
| getCompanyBySlug | 1 | 31.00 | 31.22 | 44.04 | 44.80 | 0 |
| getCompanyBySlug | 10 | 194.40 | 50.68 | 65.11 | 70.52 | 0 |
| getCompanyBySlug | 50 | 253.40 | 199.11 | 254.84 | 273.54 | 0 |
| getCompanyBySlug | 100 | 253.20 | 403.52 | 522.81 | 650.46 | 0 |
| createPlatformWorkflow | 1 | 27.80 | 33.14 | 48.02 | 52.16 | 0 |
| createPlatformWorkflow | 10 | 183.60 | 53.65 | 68.52 | 79.09 | 0 |
| createPlatformWorkflow | 50 | 230.40 | 218.87 | 279.34 | 324.31 | 0 |
| createPlatformWorkflow | 100 | 237.00 | 418.95 | 569.52 | 680.12 | 0 |
| getPlatformWorkflow | 1 | 31.60 | 30.88 | 41.62 | 46.11 | 0 |
| getPlatformWorkflow | 10 | 188.40 | 52.37 | 68.29 | 79.24 | 0 |
| getPlatformWorkflow | 50 | 244.60 | 205.95 | 273.14 | 311.77 | 0 |
| getPlatformWorkflow | 100 | 228.20 | 453.01 | 613.27 | 696.87 | 0 |
| createPlatformWorkflowInstance | 1 | 21.60 | 46.45 | 56.22 | 62.94 | 0 |
| createPlatformWorkflowInstance | 10 | 178.80 | 55.04 | 66.52 | 93.52 | 0 |
| createPlatformWorkflowInstance | 50 | 218.20 | 234.11 | 299.83 | 336.77 | 0 |
| createPlatformWorkflowInstance | 100 | 204.00 | 502.87 | 662.70 | 795.70 | 0 |
| getPlatformWorkflowInstance | 1 | 29.00 | 31.83 | 49.17 | 56.69 | 0 |
| getPlatformWorkflowInstance | 10 | 194.20 | 50.96 | 66.38 | 76.72 | 0 |
| getPlatformWorkflowInstance | 50 | 240.80 | 207.19 | 270.46 | 319.02 | 0 |
| getPlatformWorkflowInstance | 100 | 244.60 | 417.33 | 537.31 | 638.16 | 0 |
| createPlatformUserTask | 1 | 22.20 | 45.88 | 51.68 | 55.71 | 0 |
| createPlatformUserTask | 10 | 179.20 | 54.60 | 69.78 | 86.39 | 0 |
| createPlatformUserTask | 50 | 248.80 | 198.76 | 286.84 | 316.29 | 0 |
| createPlatformUserTask | 100 | 257.00 | 393.01 | 544.79 | 636.85 | 0 |
| getPlatformUserTaskById | 1 | 29.60 | 31.52 | 46.08 | 49.20 | 0 |
| getPlatformUserTaskById | 10 | 193.80 | 50.06 | 67.61 | 76.73 | 0 |
| getPlatformUserTaskById | 50 | 216.80 | 230.93 | 310.44 | 361.76 | 0 |
| getPlatformUserTaskById | 100 | 241.80 | 425.72 | 575.15 | 679.67 | 0 |
| createHealthCheck | 1 | 31.40 | 31.10 | 42.72 | 48.89 | 0 |
| createHealthCheck | 10 | 197.80 | 49.98 | 61.75 | 69.99 | 0 |
| createHealthCheck | 50 | 250.40 | 197.86 | 254.62 | 293.59 | 0 |
| createHealthCheck | 100 | 260.20 | 389.62 | 503.24 | 636.80 | 0 |
| listLatestHealthChecks | 1 | 5.40 | 185.87 | 196.39 | 199.43 | 0 |
| listLatestHealthChecks | 10 | 47.00 | 216.24 | 243.27 | 256.68 | 0 |
| listLatestHealthChecks | 50 | 83.20 | 637.21 | 802.43 | 874.92 | 0 |
| listLatestHealthChecks | 100 | 90.80 | 1232.61 | 1713.06 | 1878.37 | 0 |

## tenant

| Scenario | Concurrency | Ops/sec | p50 (ms) | p95 (ms) | p99 (ms) | Errors |
|----------|------------:|--------:|---------:|---------:|---------:|-------:|
| createMember | 1 | 29.60 | 31.64 | 45.98 | 50.47 | 0 |
| createMember | 10 | 192.60 | 51.00 | 65.33 | 78.22 | 0 |
| createMember | 50 | 241.80 | 208.40 | 269.78 | 308.98 | 0 |
| createMember | 100 | 244.00 | 410.55 | 553.77 | 625.49 | 0 |
| getMemberById | 1 | 31.80 | 31.08 | 40.33 | 42.44 | 0 |
| getMemberById | 10 | 195.60 | 50.38 | 66.96 | 71.98 | 0 |
| getMemberById | 50 | 264.40 | 189.79 | 255.26 | 272.26 | 0 |
| getMemberById | 100 | 259.00 | 395.82 | 488.92 | 602.02 | 0 |
| createWorkflow | 1 | 30.00 | 31.61 | 45.92 | 49.41 | 0 |
| createWorkflow | 10 | 189.80 | 51.73 | 65.65 | 76.95 | 0 |
| createWorkflow | 50 | 253.80 | 199.55 | 248.40 | 281.47 | 0 |
| createWorkflow | 100 | 258.40 | 399.25 | 492.21 | 588.75 | 0 |
| getWorkflow | 1 | 32.20 | 30.95 | 37.52 | 41.73 | 0 |
| getWorkflow | 10 | 185.20 | 52.64 | 74.65 | 83.16 | 0 |
| getWorkflow | 50 | 235.60 | 212.28 | 282.36 | 334.04 | 0 |
| getWorkflow | 100 | 261.60 | 392.31 | 523.88 | 577.24 | 0 |
| createWorkflowInstance | 1 | 28.00 | 32.26 | 48.08 | 50.92 | 0 |
| createWorkflowInstance | 10 | 194.20 | 50.40 | 64.40 | 79.14 | 0 |
| createWorkflowInstance | 50 | 254.60 | 195.72 | 264.01 | 295.98 | 0 |
| createWorkflowInstance | 100 | 263.40 | 387.22 | 538.33 | 584.09 | 0 |
| getWorkflowInstance | 1 | 32.00 | 30.88 | 34.38 | 43.14 | 0 |
| getWorkflowInstance | 10 | 193.60 | 49.85 | 69.01 | 80.70 | 0 |
| getWorkflowInstance | 50 | 262.60 | 190.02 | 262.06 | 284.49 | 0 |
| getWorkflowInstance | 100 | 260.00 | 389.31 | 563.04 | 642.94 | 0 |
| createUserTask | 1 | 29.00 | 31.74 | 46.23 | 48.94 | 0 |
| createUserTask | 10 | 193.60 | 50.96 | 63.47 | 80.11 | 0 |
| createUserTask | 50 | 256.00 | 188.38 | 278.95 | 314.38 | 0 |
| createUserTask | 100 | 260.00 | 387.70 | 552.58 | 625.27 | 0 |
| getUserTaskById | 1 | 32.20 | 30.70 | 34.19 | 44.98 | 0 |
| getUserTaskById | 10 | 197.60 | 49.48 | 64.88 | 75.05 | 0 |
| getUserTaskById | 50 | 263.00 | 190.63 | 258.89 | 285.71 | 0 |
| getUserTaskById | 100 | 268.20 | 380.81 | 532.52 | 600.31 | 0 |
