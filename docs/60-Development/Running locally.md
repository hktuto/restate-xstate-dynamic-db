---
title: Running locally
type: runbook
status: done
area: docs
created: 2026-06-14
updated: 2026-06-16
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
pnpm --filter admin dev
pnpm --filter web dev
```

## Verify

- Admin: http://localhost:3001
- Web: http://localhost:3000
- SurrealDB: http://localhost:8000
- Restate UI: http://localhost:9070

## Related

- [[Getting Started]]
- [[Troubleshooting]]
