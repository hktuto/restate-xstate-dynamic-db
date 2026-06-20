---
title: Scripts & Commands
type: runbook
status: done
area: docs
created: 2026-06-14
updated: 2026-06-19
related:
  - [[Getting Started]]
  - [[Running locally]]
---

# Scripts & Commands

## Root

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install workspace dependencies. |
| `pnpm -r build` | Build apps and packages that define a `build` script. |
| `pnpm -r typecheck` | Typecheck packages that define a `typecheck` script. |
| `pnpm -r dev` | Dev mode for apps (not recommended concurrently without filters). |

## Per package

| Command | Purpose |
|---------|---------|
| `pnpm --filter db typecheck` | Typecheck the `db` package. |
| `pnpm --filter shared typecheck` | Typecheck the `shared` package. |
| `pnpm --filter workflow-actions typecheck` | Typecheck the `workflow-actions` package. |
| `pnpm --filter db clean-db` | Remove every namespace from SurrealDB. |
| `pnpm --filter db seed` | Clean DB and seed platform namespace. |
| `pnpm --filter db seed-company` | Seed the `SeedCo Test` tenant company. |
| `pnpm --filter api dev` | Run API service (loads root `.env`). |
| `pnpm --filter admin dev` | Run admin app. |
| `pnpm --filter web dev` | Run web app. |
| `pnpm --filter db test` | Run DB tests against the test SurrealDB instance. |
| `pnpm --filter api test` | Run API tests against the test SurrealDB instance. |
| `pnpm --filter workflow-runtime test` | Run workflow-runtime tests against the test SurrealDB instance. |
| `pnpm --filter shared test` | Run shared package tests. |
| `pnpm --filter workflow-actions test` | Run workflow-actions tests. |
| `pnpm -r test` | Run all package/app tests. |

## Docker

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start SurrealDB, Restate, health-monitor, workflow-runtime, and surrealdb-test. |
| `docker compose up -d surrealdb-test` | Start only the test SurrealDB instance on port `8001`. |
| `docker compose down` | Stop all services. |
| `docker compose logs -f surrealdb` | Tail SurrealDB logs. |
| `docker compose logs -f surrealdb-test` | Tail test SurrealDB logs. |
| `docker compose logs -f workflow-runtime` | Tail workflow-runtime logs. |

## Related

- [[Getting Started]]
- [[Running locally]]
