---
title: Troubleshooting
type: runbook
status: done
area: ops
created: 2026-06-14
updated: 2026-06-14
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

## Build errors

- Run `pnpm install` to refresh workspace links.
- Run `pnpm -r build` to surface package-level errors.
- Clear `.nuxt` / `.output` / `dist` folders if stale.

## Related

- [[Getting Started]]
- [[Running locally]]
