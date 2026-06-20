---
title: Getting Started
type: runbook
status: done
area: docs
created: 2026-06-14
updated: 2026-06-19
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
# API service
pnpm --filter api dev

# Admin app
pnpm --filter admin dev

# Web app
pnpm --filter web dev
```

The API service loads environment variables from the root `.env` file via `--env-file ../../.env`.

## Run tests

Tests use a dedicated SurrealDB instance on port `8001` so they never touch development data.

```bash
# Start the test SurrealDB instance
docker compose up -d surrealdb-test

# Run all package/app tests
pnpm -r test
```

The shared `vitest.base.config.ts` loads `.env.test` and sets `SURREAL_URL=ws://127.0.0.1:8001/rpc` for every test suite.

## Default credentials

- Admin: `admin@example.com` / `admin`

## Related

- [[Environment Setup]]
- [[Running locally]]
- [[Scripts & Commands]]
