---
title: Docker Compose
type: runbook
status: done
area: ops
created: 2026-06-14
updated: 2026-06-14
related:
  - [[SurrealDB Maintenance]]
  - [[Restate Operations]]
---

# Docker Compose

## Services

- **surrealdb** — Database on port `8000`.
- **restate** — Durable runtime on ports `8080` and `9070`.

## Volumes

- SurrealDB data is persisted in `./data/surreal`.

## Common operations

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Reset database (destructive)
docker compose down -v
rm -rf data/surreal
```

## Related

- [[SurrealDB Maintenance]]
- [[Restate Operations]]
