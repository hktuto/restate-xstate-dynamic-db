---
title: Troubleshooting
type: runbook
status: done
area: ops
created: 2026-06-14
updated: 2026-06-19
related:
  - [[Getting Started]]
  - [[Running locally]]
---

# Troubleshooting

## Company not found (web app)

- Check that the `company_slug` cookie is set.
- Verify the company exists in the `platform/admin` namespace.
- Check that `apps/web/server/middleware/company.ts` allows `/` and `/api/companies`.

## Admin login fails

- Ensure the platform database is seeded: `pnpm --filter db seed`.
- Verify the admin password is hashed, not plaintext.
- Check browser cookies are not blocked.

## `Error: SESSION_SECRET is required` (API startup)

- Ensure the root `.env` file exists and defines `SESSION_SECRET`.
- Ensure you are starting the API with one of its package scripts (`pnpm --filter api dev` or `pnpm --filter api start`). The scripts load the root `.env` via `--env-file ../../.env`.
- If you run `tsx src/index.ts` directly from `apps/api`, the env file is not loaded; use `tsx --env-file ../../.env src/index.ts` instead.

## DB/API tests fail to connect to SurrealDB

- Ensure the test SurrealDB instance is running: `docker compose up -d surrealdb-test`.
- Ensure port `8001` is free.
- The shared `vitest.base.config.ts` loads `.env.test`, which sets `SURREAL_URL=ws://127.0.0.1:8001/rpc`. If a test somehow points at the dev instance, `packages/db/test/setup.ts` throws a hard error.

## Type or build errors

- Run `pnpm install` to refresh workspace links.
- Run `pnpm -r typecheck` to surface package-level type errors.
- Clear `.nuxt` / `.output` folders if stale.

## Related

- [[Getting Started]]
- [[Running locally]]
