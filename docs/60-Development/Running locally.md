---
title: Running locally
type: runbook
status: done
area: docs
created: 2026-06-14
updated: 2026-06-25
related:
  - [[Getting Started]]
  - [[Troubleshooting]]
---

# Running locally

## Full stack

```bash
# 1. Infrastructure and services (SurrealDB, Restate, health-monitor, workflow-runtime)
docker compose up -d

# 2. Seed
pnpm --filter db seed

# 3. Apps (in separate terminals)
pnpm --filter api dev
pnpm --filter admin dev
pnpm --filter web dev
```

## Verify

- API: http://localhost:3002
- Admin: http://localhost:3001
- Web: http://localhost:3000
- SurrealDB: http://localhost:8000
- SurrealDB test instance: http://localhost:8001
- Restate UI: http://localhost:9070
- Health monitor HTTP endpoint: http://localhost:3010

## Run tests locally

```bash
# Start the test SurrealDB instance
docker compose up -d surrealdb-test

# Run all tests
pnpm -r test
```

Tests are isolated from the dev database via the shared Vitest base config and `.env.test`.

## Related

- [[Getting Started]]
- [[Troubleshooting]]
