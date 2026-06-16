---
title: Testing
type: runbook
status: done
area: docs
created: 2026-06-16
updated: 2026-06-16
related:
  - [[Getting Started]]
  - [[DB Package]]
---

# Testing

## DB package tests

The `packages/db` tests run against a real SurrealDB instance via Docker Compose. They exercise every exported query helper to catch SQL syntax errors and unexpected output.

### Prerequisites

```bash
docker compose up -d surrealdb
```

### Run all DB tests

```bash
pnpm --filter db test
```

### Run one test file

```bash
pnpm --filter db test client.test.ts
```

### Test isolation

- Platform tests clean the shared `platform/admin` tables before each test.
- Tenant tests create uniquely-named namespaces and remove them after each test.
- Test files run sequentially (`fileParallelism: false`) because they share the same SurrealDB instance.
