---
title: Getting Started
type: runbook
status: done
area: docs
created: 2026-06-14
updated: 2026-06-16
related:
  - [[Environment Setup]]
  - [[Running locally]]
  - [[Scripts & Commands]]
---

# Getting Started

## Prerequisites

- Node.js 22+
- pnpm 10+
- Bun 1.3+
- Docker 29+

## Install dependencies

```bash
pnpm install
```

## Start infrastructure and services

```bash
docker compose up -d
```

This starts SurrealDB, Restate, health-monitor, and workflow-runtime. The `restate-register` service automatically registers the workflow runtime.

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
```

## Default credentials

- Admin: `admin@example.com` / `admin`

## Related

- [[Environment Setup]]
- [[Running locally]]
- [[Scripts & Commands]]
