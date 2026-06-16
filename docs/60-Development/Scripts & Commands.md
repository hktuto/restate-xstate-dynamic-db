---
title: Scripts & Commands
type: runbook
status: done
area: docs
created: 2026-06-14
updated: 2026-06-15
related:
  - [[Getting Started]]
  - [[Running locally]]
---

# Scripts & Commands

## Root

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install workspace dependencies. |
| `pnpm -r build` | Build all packages and apps. |
| `pnpm -r dev` | Dev mode (not recommended concurrently without filters). |

## Per package

| Command | Purpose |
|---------|---------|
| `pnpm --filter db seed` | Seed platform namespace. |
| `pnpm --filter admin dev` | Run admin app. |
| `pnpm --filter web dev` | Run web app. |
| `pnpm --filter workflow-runtime dev` | Run workflow runtime. |
| `pnpm --filter health-monitor dev` | Run health monitor service. |

## Docker

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start infrastructure. |
| `docker compose down` | Stop infrastructure. |
| `docker compose logs -f surrealdb` | Tail SurrealDB logs. |

## Related

- [[Getting Started]]
- [[Running locally]]
