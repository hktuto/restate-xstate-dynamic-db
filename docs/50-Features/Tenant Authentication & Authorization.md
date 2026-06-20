---
title: Tenant Authentication & Authorization
type: feature
status: in-progress
area: web
created: 2026-06-14
updated: 2026-06-21
app:
  - web
related:
  - [[Data Model]]
  - [[Company Management]]
  - [[User Management]]
  - [[30-Apps/Web App/Overview]]
  - [[Admin Authentication & Authorization]]
---

# Tenant Authentication & Authorization

Tenant users authenticate through global `accounts` linked to a single `user_profile`. Each company namespace holds a `member` record that connects the profile to the company and defines role and status.

## Signed session cookies

- `tenant_session` — HMAC-SHA256 signed JSON cookie containing `accountId` and `profileId`.
- `company` — plain JSON cookie containing the active company's `id`, `slug`, and `namespace`.
- Both cookies are `httpOnly`, `sameSite: 'lax'`, and valid for 24 hours.
- `SESSION_SECRET` is required in the environment.

## Auth service

Tenant and admin auth endpoints live in the dedicated Hono API service (`apps/api`) under `/api/auth`. The Nuxt frontends call these endpoints through `useApi().fetch()`, and the API sets/clears the signed `tenant_session`, `company`, and `admin_session` cookies.

## Auth flows

1. **Register** (`/register`) — creates an `account` and `user_profile`, then redirects to `/companies`.
2. **Log in** (`/login`) — validates email/password and returns the list of companies the profile belongs to. If the list is empty, the user is redirected to `/companies` to create one.
3. **Company selector** (`/companies`) — lists companies and lets the user enter one by setting the `company` cookie.
4. **Company creation** (`/companies/new`) — creates a company and an `owner` member for the current profile.
5. **Invite accept** (`/accept-invite`) — a pending member follows an invite URL containing `code` and `company`, registers or logs in, and becomes an active member.

## Authorization

- `requireTenantSession(event)` — ensures a valid signed session exists.
- `requireTenantMember(event)` — ensures the session's profile is an active member of the selected company.
- `requireTenantRole(event, ['owner' | 'admin' | 'member'])` — ensures the active member has one of the allowed roles.
- Read-only routes require `requireTenantMember`.
- Mutation routes (workflows, triggers, user invites, member updates/deletes) require `requireTenantRole(['owner', 'admin'])`.

## Public pages

`/login`, `/register`, `/accept-invite`, and `/logout` are excluded from the global auth middleware.
