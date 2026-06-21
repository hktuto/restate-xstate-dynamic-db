---
title: permission-poc package (retired)
type: note
status: done
area: db
created: 2026-06-20
updated: 2026-06-21
package: permission-poc
related:
  - [[db package]]
  - [[20-Architecture/Decision Log/ADR-005 compound-bitmask-permissions]]
---

# permission-poc package (retired)

The proof-of-concept logic has been ported into `packages/db/src/permission-resolver.ts` and `packages/shared/src/resource-catalog.ts`. The `packages/permission-poc` directory has been removed.

For the current design, see [[20-Architecture/Decision Log/ADR-005 compound-bitmask-permissions|ADR-005]] and [[db package]].
