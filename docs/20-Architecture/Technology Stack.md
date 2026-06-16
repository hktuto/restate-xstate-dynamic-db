---
title: Technology Stack
type: note
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-15
related:
  - [[System Overview]]
  - [[Monorepo Layout]]
---

# Technology Stack

## Runtime

| Layer | Choice | Purpose |
|-------|--------|---------|
| Language | TypeScript / Node 22 | Unified language across apps and packages. |
| Framework | Nuxt 4 (Vue 3) | Web app, admin app, and shared layers. |
| Workflow engine | XState | State-machine definition and runtime model. |
| Durable runtime | Restate | Retries, timers, service-to-service calls. |
| Database | SurrealDB 3.x | Platform and tenant data. |
| Styling | Tailwind CSS + Nuxt UI | UI components and theming. |
| Package manager | pnpm 10.x | Monorepo workspaces. |
| Auth | bcrypt + cookie sessions | Password hashing and session-based auth. |

## Tooling

- `tsx` for running TypeScript scripts.
- Bun for the `health-monitor` service (direct TypeScript execution, no build step).
- Docker Compose for local infrastructure.
- Vitest for tests (planned).

## Related

- [[System Overview]]
- [[Monorepo Layout]]
