---
title: Workflow Runtime Bun + Docker Compose Design
type: note
status: in-progress
area: docs
created: 2026-06-16
updated: 2026-06-16
related:
  - [[Workflow Runtime]]
  - [[30-Apps/Workflow Runtime/Overview]]
  - [[20-Architecture/Decision Log/ADR-002 Restate for workflow runtime]]
  - [[50-Features/Workflow Engine]]
---

# Workflow Runtime Bun + Docker Compose Design

Migrate `apps/workflow-runtime` from Node.js + tsx to Bun, and add it as a service in `docker-compose.yml` so the full local stack starts with one command.

## Goal

- Run `apps/workflow-runtime` with Bun (TypeScript-native, no tsx).
- Add a `workflow-runtime` service to Docker Compose for local development.
- Keep the existing `web` app on the host; handle container-to-host networking.
- Preserve the current test setup while verifying Bun compatibility.

## Context

`apps/workflow-runtime` currently:

- Runs on Node.js via `tsx` (`dev`: `tsx watch src/index.ts`, `start`: `tsx src/index.ts`).
- Builds with `tsc --noEmit`.
- Tests with `vitest` + `@restatedev/restate-sdk-testcontainers`.
- Uses `node:http` and `node:crypto`.
- Is not containerized; local dev requires `pnpm --filter workflow-runtime dev` in a separate terminal.

`apps/health-monitor` already uses Bun and has a working Dockerfile + Compose service, so there is a proven pattern to follow.

The Restate TypeScript SDK officially supports Bun as a runtime (prerequisites list "NodeJS >= v22 or Bun or Deno").

## Decision

Adopt Option A: switch `apps/workflow-runtime` to Bun **and** add it to Docker Compose.

## Approach

### 1. Bun migration

Update `apps/workflow-runtime/package.json`:

- `dev`: `bun --watch src/index.ts`
- `start`: `bun src/index.ts`
- `typecheck`: `tsc --noEmit` (Bun runs TS without typechecking)
- `build`: alias for `typecheck`
- `test`: keep `vitest run` as the primary test command
- `test:bun`: add `bunx vitest run` to verify the existing tests under the Bun runtime without rewriting them
- Add `bun-types` to `devDependencies`.
- Remove `tsx` from `devDependencies` (it may remain via the root workspace).

Keep `typescript` for typechecking. Bun is used only as the runtime/script runner; pnpm remains the workspace package manager.

Update `apps/workflow-runtime/tsconfig.json` to use Bun types, following `apps/health-monitor`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": ".",
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

### 2. Dockerfile

Create `apps/workflow-runtime/Dockerfile` modeled on `apps/health-monitor/Dockerfile`:

- Base: `node:22-slim`.
- Install pnpm and Bun.
- Copy root workspace manifests and lockfile for a cacheable install layer.
- Copy package manifests for all workspace packages.
- Run `pnpm install --frozen-lockfile`.
- Copy and build workspace dependencies (`shared`, `db`, `workflow-actions`).
- Copy `apps/workflow-runtime` source.
- Set workdir to `/app/apps/workflow-runtime`.
- `CMD ["bun", "src/index.ts"]`.

### 3. Docker Compose service

Add to `docker-compose.yml`:

```yaml
workflow-runtime:
  build:
    context: .
    dockerfile: apps/workflow-runtime/Dockerfile
  env_file: .env
  environment:
    - NITRO_API_URL=http://host.docker.internal:3002
  ports:
    - "9080:9080"
  depends_on:
    - restate
  restart: unless-stopped
```

Update `health-monitor` environment:

```yaml
- WORKFLOW_RUNTIME_URL=http://workflow-runtime:9080
```

Keep `WEB_API_URL=http://host.docker.internal:3000` because `web` remains on the host.

### 4. Restate registration

Update the root `package.json` `restate:register` script to use the Docker-internal service name:

```bash
docker compose exec restate restate dp add http://workflow-runtime:9080 --yes
```

This keeps traffic inside the Docker network. Port `9080` remains mapped to the host for direct access and health checks from the host.

### 5. Networking summary

| Caller | Target | URL |
|--------|--------|-----|
| workflow-runtime (container) | web (host) | `http://host.docker.internal:3000` |
| health-monitor (container) | workflow-runtime (container) | `http://workflow-runtime:9080` |
| Restate (container) | workflow-runtime (container) | `http://workflow-runtime:9080` |
| Host / browser | workflow-runtime | `http://localhost:9080` |
| Host / browser | Restate ingress | `http://localhost:8080` |

### 6. Verification

- `pnpm --filter workflow-runtime build` passes (typecheck with Bun types).
- `pnpm --filter workflow-runtime test` passes (vitest + testcontainers on Node).
- `pnpm --filter workflow-runtime test:bun` passes (vitest under Bun).
- `docker compose up -d --build` starts all services.
- `pnpm restate:register` registers the runtime.
- End-to-end workflow create/send reaches the web API and persists state.

## Trade-offs

- **Pros:** Simpler toolchain (no tsx), faster startup, consistent with health-monitor, one-command local stack.
- **Cons:** Bun does not typecheck, so `tsc --noEmit` must remain. Testcontainers/vitest under Bun need verification. Container-to-host networking adds slight complexity on Linux without Docker Desktop.

## Files changed

- `apps/workflow-runtime/package.json`
- `apps/workflow-runtime/tsconfig.json`
- `apps/workflow-runtime/Dockerfile` (new)
- `docker-compose.yml`
- `package.json` (`restate:register` script)
- `docs/30-Apps/Workflow Runtime/Overview.md` (update ports/networking notes)

## Out of scope

- Containerizing `apps/web` or `apps/admin`.
- Switching the whole monorepo to Bun's package manager.
- Production deployment beyond local Docker Compose.

## Related

- [[Workflow Runtime]]
- [[30-Apps/Workflow Runtime/Overview]]
- [[20-Architecture/Decision Log/ADR-002 Restate for workflow runtime]]
- [[50-Features/Workflow Engine]]
