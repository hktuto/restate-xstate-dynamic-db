---
title: Scripts & Commands
type: runbook
status: done
area: docs
created: 2026-06-14
updated: 2026-06-16
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
| `pnpm --filter db seed` | Seed platform namespace. |
| `pnpm --filter admin dev` | Run admin app. |
| `pnpm --filter web dev` | Run web app. |

## Docker

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start SurrealDB, Restate, health-monitor, and workflow-runtime. |
| `docker compose down` | Stop all services. |
| `docker compose logs -f surrealdb` | Tail SurrealDB logs. |
| `docker compose logs -f workflow-runtime` | Tail workflow-runtime logs. |

## Related

- [[Getting Started]]
- [[Running locally]]
