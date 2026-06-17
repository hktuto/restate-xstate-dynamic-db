---
title: Restate Operations
type: runbook
status: planned
area: ops
created: 2026-06-14
updated: 2026-06-17
related:
  - [[30-Apps/Workflow Runtime/Overview]]
  - [[Docker Compose]]
---

# Restate Operations

## Register services

After starting the workflow runtime, register it with Restate. The endpoint speaks HTTP/2:

```bash
curl -X POST http://localhost:9070/endpoints -H 'content-type: application/json' -d '{"uri": "http://host.docker.internal:9080"}'
```

In Docker Compose this is handled automatically by the `restate-register` service.

## Inspect services

- Restate UI: http://localhost:9070
- List services: `curl http://localhost:9070/services`

## Related

- [[30-Apps/Workflow Runtime/Overview|Workflow Runtime App]]
- [[Docker Compose]]
