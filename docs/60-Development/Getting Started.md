---
title: Getting Started
type: runbook
status: done
area: docs
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Environment Setup]]
  - [[Running locally]]
  - [[Scripts & Commands]]
---

# Getting Started

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker 29+

## Install dependencies

```bash
pnpm install
```

## Start infrastructure

```bash
docker compose up -d
```

This starts SurrealDB and Restate.

## Seed the platform database

```bash
pnpm --filter db seed
```

## Run apps

```bash
# Admin app
pnpm --filter admin dev

# Web app
pnpm --filter web dev

# Workflow runtime
pnpm --filter workflow-runtime dev
```

## Default credentials

- Admin: `admin@example.com` / `admin`

## Related

- [[Environment Setup]]
- [[Running locally]]
- [[Scripts & Commands]]
