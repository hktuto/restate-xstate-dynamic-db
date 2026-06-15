---
title: Authentication & Authorization
type: note
status: in-progress
area: architecture
created: 2026-06-14
updated: 2026-06-14
related:
  - [[20-Architecture/Decision Log/ADR-004 Bcrypt for password hashing]]
  - [[Multi-tenancy]]
  - [[30-Apps/Admin App/Overview]]
  - [[30-Apps/Web App/Overview]]
  - [[50-Features/Tenant Authentication & Authorization]]
---

# Authentication & Authorization

## Admin app

- Superadmin users are stored in `platform_users` in the `platform/admin` namespace.
- Passwords are hashed with bcrypt (see [[20-Architecture/Decision Log/ADR-004 Bcrypt for password hashing|ADR-004]]).
- Session is cookie-based.
- Global auth middleware guards all non-login routes.

## Web app

- Tenant users authenticate through global `account` records linked to a single `user_profile`.
- Each company namespace holds a `member` record that connects the profile to the company and defines role and status.
- Sessions are cookie-based.
- See [[50-Features/Tenant Authentication & Authorization|Tenant Authentication & Authorization]] for details.

## Runtime

- Restate service-to-service calls identify the company via the `x-company-namespace` header.
- No user-level auth in runtime; authorization happens at the ingress/app layer.

## Related

- [[Multi-tenancy]]
- [[30-Apps/Admin App/Overview|Admin App]]
- [[30-Apps/Web App/Overview|Web App]]
