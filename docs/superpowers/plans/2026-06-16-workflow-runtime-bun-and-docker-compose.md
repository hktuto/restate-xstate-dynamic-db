# Workflow Runtime Bun + Docker Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/workflow-runtime` from Node.js + tsx to Bun and add it as a Docker Compose service so `docker compose up -d` starts the full local stack.

**Architecture:** Keep pnpm as the workspace package manager and Bun only as the runtime/script runner for `apps/workflow-runtime`. Add a Dockerfile following the existing `apps/health-monitor/Dockerfile` pattern. Add a `workflow-runtime` service to `docker-compose.yml` and update `health-monitor` and `restate:register` to use Docker-internal networking.

**Tech Stack:** Bun, pnpm, TypeScript, Vitest, Restate SDK, Docker Compose.

## Prerequisites

Bun must be installed on the host for the `dev`, `start`, and `test:bun` scripts to work. Verify with:

```bash
bun --version
```

If it is not installed, follow the instructions at https://bun.sh/docs/installation (e.g. `curl -fsSL https://bun.sh/install | bash` on macOS/Linux or `powershell -c "irm bun.sh/install.ps1 | iex"` on Windows).

---

## File structure

| File | Responsibility |
|------|----------------|
| `apps/workflow-runtime/package.json` | Bun scripts, add `bun-types`, remove `tsx` and `@types/node`. |
| `apps/workflow-runtime/tsconfig.json` | Use `bun-types` instead of `@types/node`. |
| `apps/workflow-runtime/Dockerfile` | Multi-stage Docker image installing pnpm + Bun, building workspace deps, running runtime with Bun. |
| `docker-compose.yml` | Add `workflow-runtime` service; update `health-monitor` URL. |
| `package.json` | Update `restate:register` to use `http://workflow-runtime:9080`. |
| `pnpm-lock.yaml` | Updated by `pnpm install` after `package.json` changes. |
| `docs/30-Apps/Workflow Runtime/Overview.md` | Document Bun runtime and Docker Compose networking. |

---

### Task 1: Update `apps/workflow-runtime/package.json` for Bun

**Files:**
- Modify: `apps/workflow-runtime/package.json`

- [ ] **Step 1: Replace scripts and dependencies**

Replace the entire file content with:

```json
{
  "name": "workflow-runtime",
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "test": "vitest run",
    "test:bun": "bunx vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@restatedev/restate-sdk": "^1.14.5",
    "db": "workspace:*",
    "shared": "workspace:*",
    "workflow-actions": "workspace:*",
    "xstate": "^5.32.1"
  },
  "devDependencies": {
    "@restatedev/restate-sdk-clients": "^1.14.5",
    "@restatedev/restate-sdk-testcontainers": "^1.14.5",
    "bun-types": "^1.3.14",
    "typescript": "^5.8.3",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 2: Update lockfile**

Run:

```bash
pnpm install
```

Expected: lockfile updates without errors; `bun-types` is added and `tsx`/`@types/node` are removed from `apps/workflow-runtime` entries.

- [ ] **Step 3: Commit**

```bash
git add apps/workflow-runtime/package.json pnpm-lock.yaml
git commit -m "chore(workflow-runtime): switch package scripts and types to Bun"
```

---

### Task 2: Update `apps/workflow-runtime/tsconfig.json` to use Bun types

**Files:**
- Modify: `apps/workflow-runtime/tsconfig.json`

- [ ] **Step 1: Replace tsconfig**

Replace the entire file content with:

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

- [ ] **Step 2: Verify typecheck passes**

Run:

```bash
pnpm --filter workflow-runtime build
```

Expected: command exits with code 0 and no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/workflow-runtime/tsconfig.json
git commit -m "chore(workflow-runtime): use bun-types in tsconfig"
```

---

### Task 3: Create `apps/workflow-runtime/Dockerfile`

**Files:**
- Create: `apps/workflow-runtime/Dockerfile`

- [ ] **Step 1: Write the Dockerfile**

Create `apps/workflow-runtime/Dockerfile` with:

```dockerfile
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app

# Copy workspace manifests and lockfile for a cacheable install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/health-monitor/package.json ./apps/health-monitor/
COPY apps/web/package.json ./apps/web/
COPY apps/workflow-runtime/package.json ./apps/workflow-runtime/
COPY layers/workflow-editor/package.json ./layers/workflow-editor/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/workflow-actions/package.json ./packages/workflow-actions/

RUN pnpm install --frozen-lockfile

# Copy and build workspace dependencies.
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/workflow-actions ./packages/workflow-actions

RUN pnpm --filter shared build && pnpm --filter db build && pnpm --filter workflow-actions build

# Copy only the runtime service source.
COPY apps/workflow-runtime ./apps/workflow-runtime

WORKDIR /app/apps/workflow-runtime

CMD ["bun", "src/index.ts"]
```

- [ ] **Step 2: Build the image**

Run:

```bash
docker build -f apps/workflow-runtime/Dockerfile -t workflow-runtime:latest .
```

Expected: image builds successfully through `RUN pnpm --filter shared build ...` and ends with `CMD ["bun", "src/index.ts"]`.

- [ ] **Step 3: Commit**

```bash
git add apps/workflow-runtime/Dockerfile
git commit -m "feat(workflow-runtime): add Dockerfile using Bun runtime"
```

---

### Task 4: Add `workflow-runtime` service to `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Replace the compose file**

Replace the entire file content with:

```yaml
services:
  restate:
    image: docker.io/restatedev/restate:latest
    ports:
      - "8080:8080"
      - "9070:9070"
    environment:
      - RESTATE_OBSERVABILITY__JAEGER__ENDPOINT=http://host.docker.internal:4317

  surrealdb:
    image: surrealdb/surrealdb:latest
    ports:
      - "8000:8000"
    command: start --user root --pass root surrealkv:///data/surreal.db
    volumes:
      - ./data/surreal:/data

  workflow-runtime:
    build:
      context: .
      dockerfile: apps/workflow-runtime/Dockerfile
    env_file: .env
    environment:
      - NITRO_API_URL=http://host.docker.internal:3000
    ports:
      - "9080:9080"
    depends_on:
      - restate
    restart: unless-stopped

  health-monitor:
    build:
      context: .
      dockerfile: apps/health-monitor/Dockerfile
    env_file: .env
    environment:
      - SURREAL_URL=http://surrealdb:8000/rpc
      - RESTATE_META_URL=http://restate:9070
      - WORKFLOW_RUNTIME_URL=http://workflow-runtime:9080
      - WEB_API_URL=http://host.docker.internal:3000
      - HEALTH_CHECK_INTERVAL_MS=1800000
      - HEALTH_CHECK_RETENTION_DAYS=365
    depends_on:
      - surrealdb
      - restate
      - workflow-runtime
    restart: unless-stopped
```

- [ ] **Step 2: Validate compose syntax**

Run:

```bash
docker compose config
```

Expected: command exits with code 0 and prints the merged compose config.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(compose): add workflow-runtime service and update health-monitor URLs"
```

---

### Task 5: Update root `package.json` `restate:register` script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update the script**

Change:

```json
"restate:register": "docker compose exec restate restate dp add http://host.docker.internal:9080 --yes"
```

to:

```json
"restate:register": "docker compose exec restate restate dp add http://workflow-runtime:9080 --yes"
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: register workflow-runtime via Docker-internal URL"
```

---

### Task 6: Update `docs/30-Apps/Workflow Runtime/Overview.md`

**Files:**
- Modify: `docs/30-Apps/Workflow Runtime/Overview.md`

- [ ] **Step 1: Update frontmatter `updated` date**

Change `updated: 2026-06-15` to `updated: 2026-06-16`.

- [ ] **Step 2: Add a Runtime section after Key behaviors**

Insert after the Key behaviors section:

```markdown
## Runtime

`apps/workflow-runtime` runs on [Bun](https://bun.sh/) for TypeScript-native execution. Local development uses `bun --watch src/index.ts`; type checking remains `tsc --noEmit` because Bun does not typecheck.

For a one-command local stack, start the service with Docker Compose:

```bash
docker compose up -d
pnpm restate:register
```

The container exposes port `9080` and reaches the host-based `web` API at `http://host.docker.internal:3000`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/30-Apps/Workflow\ Runtime/Overview.md
git commit -m "docs(workflow-runtime): document Bun runtime and Docker Compose"
```

---

### Task 7: Verify tests still pass on Node

**Files:**
- Test: `apps/workflow-runtime/tests/runtime.test.ts`

- [ ] **Step 1: Run existing tests**

Run:

```bash
pnpm --filter workflow-runtime test
```

Expected: vitest runs both tests and they pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm --filter workflow-runtime build
```

Expected: exits with code 0.

---

### Task 8: Verify Bun runtime

**Files:**
- Test: `apps/workflow-runtime/tests/runtime.test.ts`

- [ ] **Step 1: Start the runtime with Bun on the host**

In one terminal, run:

```bash
pnpm --filter workflow-runtime dev
```

Expected: logs `Workflow runtime listening on 9080`.

- [ ] **Step 2: Register with Restate**

Ensure Restate is running (`docker compose up -d restate`), then:

```bash
pnpm restate:register
```

Expected: command succeeds and registers the `workflow` object.

- [ ] **Step 3: Run a quick smoke via the web app**

Start `apps/web` (`pnpm --filter web dev`), create a workflow instance through the UI or API, and confirm it transitions states and creates user tasks correctly.

- [ ] **Step 4: Run tests under Bun (optional)**

Run:

```bash
pnpm --filter workflow-runtime test:bun
```

Expected: tests pass, or document any failures in a note. This is experimental.

---

### Task 9: Verify Docker Compose path

**Files:**
- Test: end-to-end via Docker Compose

- [ ] **Step 1: Start the full stack**

Run:

```bash
docker compose down
docker compose up -d --build
```

Expected: all four services (`restate`, `surrealdb`, `workflow-runtime`, `health-monitor`) start.

- [ ] **Step 2: Register the runtime**

```bash
pnpm restate:register
```

Expected: succeeds with `http://workflow-runtime:9080`.

- [ ] **Step 3: Check health endpoints**

```bash
curl http://localhost:9080/health
curl http://localhost:3001/api/health  # admin health endpoint if available
```

Expected: both return `{"status":"ok"}` or similar.

- [ ] **Step 4: Run an end-to-end workflow**

Start `apps/web` on the host, trigger a workflow, and verify the runtime container processes it (state updates, user tasks created).

---

## Self-review checklist

- [x] Spec coverage: Bun scripts, tsconfig, Dockerfile, compose, registration, docs, tests, and Docker verification are all covered.
- [x] Placeholder scan: no TBD, TODO, or vague steps; every code block is complete.
- [x] Type consistency: `bun-types` is used in both package.json and tsconfig; URLs match between compose and package.json.
