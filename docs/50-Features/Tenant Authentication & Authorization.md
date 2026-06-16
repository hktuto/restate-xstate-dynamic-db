---
title: Tenant Authentication & Authorization
type: feature
status: in-progress
area: web
created: 2026-06-14
updated: 2026-06-15
app:
  - web
related:
  - [[Data Model]]
  - [[Company Management]]
  - [[30-Apps/Web App/Overview]]
---

# Tenant Authentication & Authorization

Tenant users authenticate through global `account` records linked to a single `user_profile`. Each company namespace holds a `member` record that connects the profile to the company and defines role and status.
