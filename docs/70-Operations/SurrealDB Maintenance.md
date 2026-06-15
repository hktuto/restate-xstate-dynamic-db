---
title: SurrealDB Maintenance
type: runbook
status: planned
area: ops
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Docker Compose]]
  - [[Data Model]]
---

# SurrealDB Maintenance

## Backup

```bash
# Example using surreal backup (adjust paths)
surreal backup http://localhost:8000 backup.surql
```

## Restore

```bash
surreal import --conn http://localhost:8000 --user root --pass root --ns platform --db admin backup.surql
```

## List namespaces

Connect via Surrealist or `surreal sql` and run:

```surql
INFO FOR KV;
```

## Related

- [[Docker Compose]]
- [[Data Model]]
