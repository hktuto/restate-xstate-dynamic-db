---
title: ADR-004: Bcrypt for password hashing
type: adr
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Authentication & Authorization]]
  - [[40-Packages/shared]]
---

# ADR-004: Bcrypt for password hashing

## Context

Admin users need password-based authentication. Storing plaintext passwords is unacceptable.

## Decision

Use `bcryptjs` to hash passwords with a cost factor of 12.

## Rationale

- `bcryptjs` is a pure-JavaScript implementation, avoiding native dependency issues on Windows.
- bcrypt is a well-understood, slow hashing algorithm suitable for passwords.
- A cost factor of 12 balances security and performance.

## Consequences

- Existing plaintext passwords in seeds/dev data must be re-hashed.
- Login flow must compare hashes instead of doing string equality.

## Related

- [[Authentication & Authorization]]
- [[40-Packages/shared|shared package]]
