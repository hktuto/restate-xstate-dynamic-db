---
title: User Management
type: feature
status: planned
area: admin
created: 2026-06-14
updated: 2026-06-16
app:
  - admin
  - web
related:
  - [[Tenant Authentication & Authorization]]
  - [[Company Management]]
  - [[30-Apps/Web App/Overview]]
---

# User Management

## Overview

Tenant users are managed inside each company namespace. Members can be invited by owners or admins and accept invites through a public URL.

## Types of users

- **Platform users** — superadmin accounts stored in `platform/admin`.
- **Tenant users** — company-specific `member` records linked to global `accounts` and `user_profiles`.

## Member lifecycle

1. **Invite** — an owner/admin calls `POST /api/users` with an email and role. A pending `member` record is created with a random `inviteCode`.
2. **Invite URL** — the endpoint returns `inviteUrl` of the form `/accept-invite?code=<code>&company=<slug>`.
3. **Accept** — the invitee visits the URL, enters name, email, and password. The API looks up the company by slug, validates the code and email, then activates the member.
4. **Activation** — existing accounts can accept with their current password; new accounts create a `user_profile` and `account` first.
5. **Management** — owners/admins can list, update, or delete members via `/api/users` and `/api/users/:id`.

## Roles

- `owner` — full control; can invite other owners and change roles.
- `admin` — can manage workflows, triggers, members, and user tasks.
- `member` — standard user; can interact with assigned user tasks.

## Related

- [[Tenant Authentication & Authorization]]
- [[Company Management]]
- [[30-Apps/Web App/Overview|Web App]]
