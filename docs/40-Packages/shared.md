---
title: shared package
type: package
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-21
package: shared
related:
  - [[Authentication & Authorization]]
  - [[20-Architecture/Decision Log/ADR-004 Bcrypt for password hashing]]
  - [[20-Architecture/Decision Log/ADR-005 compound-bitmask-permissions]]
  - [[Tenant Permission System]]
---

# shared package

## Purpose

Shared utilities used across apps and packages.

## Location

`packages/shared`

## Key modules

- `src/index.ts` — isomorphic exports: permissions/resource catalog and shared type definitions.
- `src/server.ts` — Node-only exports: `hashPassword()`, `comparePassword()`, session signing (`signObject`, `verifyAccessToken`), and token helpers. Imported via `shared/server`.

## Build

`shared` is imported directly as TypeScript source. Consumers (Vite, Bun, tsc) resolve `packages/shared/src/index.ts` via the package `exports` field. There is no build step.

```bash
pnpm --filter shared typecheck
```

## Tests

```bash
pnpm --filter shared test
```

## Related

- [[Authentication & Authorization]]
- [[20-Architecture/Decision Log/ADR-004 Bcrypt for password hashing|ADR-004]]
