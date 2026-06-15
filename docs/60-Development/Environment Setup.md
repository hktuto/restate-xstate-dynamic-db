---
title: Environment Setup
type: runbook
status: done
area: docs
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Getting Started]]
  - [[Docker Compose]]
---

# Environment Setup

## Required environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SURREAL_URL` | `ws://localhost:8000/rpc` | SurrealDB connection URL. |
| `SURREAL_USER` | `root` | SurrealDB root user. |
| `SURREAL_PASS` | `root` | SurrealDB root password. |
| `RESTATE_INGRESS` | `http://localhost:8080` | Restate ingress URL. |
| `NITRO_API_URL` | — | Optional external API URL. |

## Per-app env files

Each app can load `.env` or `.env.local` files via Nuxt / Nitro conventions.

## Related

- [[Getting Started]]
- [[Docker Compose]]
