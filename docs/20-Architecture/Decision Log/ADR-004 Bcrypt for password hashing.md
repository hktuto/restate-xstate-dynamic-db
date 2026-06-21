---
title: ADR-004: Password hashing with Node crypto
type: adr
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-21
related:
  - [[Authentication & Authorization]]
  - [[40-Packages/shared]]
---

# ADR-004: Password hashing with Node crypto

## Context

Admin users need password-based authentication. Storing plaintext passwords is unacceptable.

## Decision

Use Node `crypto.scrypt` to hash passwords (`N=16384, r=8, p=1`, 16-byte salt, 32-byte key).

## Rationale

- Node ships a native scrypt implementation, removing a dependency (`bcryptjs`).
- scrypt is a memory-hard password hashing function suitable for credentials.
- A random salt per hash prevents rainbow-table attacks.

## Consequences

- Existing bcrypt hashes will not verify; dev/test/production credentials must be reset or re-hashed.
- `packages/shared/src/auth.ts` stores hashes as `$scrypt$N=...,r=...,p=...$salt$hash`.
- `bcryptjs` and `@types/bcryptjs` were removed from `packages/shared`.

## Related

- [[Authentication & Authorization]]
- [[40-Packages/shared|shared package]]
