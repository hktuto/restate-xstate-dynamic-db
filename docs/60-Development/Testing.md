---
title: Testing
type: runbook
status: done
area: docs
created: 2026-06-16
updated: 2026-06-19
related:
  - [[Getting Started]]
  - [[DB Package]]
---

# Testing

## DB package tests

The `packages/db` tests run against a real SurrealDB instance via Docker Compose. They exercise every exported query helper to catch SQL syntax errors and unexpected output.

### Prerequisites

```bash
docker compose up -d surrealdb-test
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

### Test database isolation

The DB, API, and workflow-runtime test suites connect to a dedicated test SurrealDB instance on port `8001` so they never touch development data. The test URL is loaded from the root `.env.test` file by the shared Vitest base config.

```bash
# Start the test SurrealDB instance
docker compose up -d surrealdb-test

# Run tests against the isolated instance
pnpm --filter db test
pnpm --filter api test
pnpm --filter workflow-runtime test
```

`packages/db/test/setup.ts` also asserts that `SURREAL_URL` is exactly `ws://127.0.0.1:8001/rpc`; if it is not, the suite fails fast instead of touching the dev database.

## API E2E tests

The `apps/api` E2E tests run against a real SurrealDB instance via Docker Compose. They seed a full company with owner, admin, and member users, then exercise the API endpoints through Hono's test client.

### Prerequisites

```bash
docker compose up -d surrealdb-test
```

### Run the full API suite

```bash
pnpm --filter api test
```

### Run one E2E file

```bash
pnpm --filter api test <file>.e2e.test.ts
```

### Test isolation

- Tests create unique `e2e_*` namespaces and clean them up in `afterAll`.
