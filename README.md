# Restate + XState + Nuxt + SurrealDB POC

A proof-of-concept SaaS platform that combines:

- **Nuxt 4** frontend — separate tenant app (`apps/web`) and superadmin site (`apps/admin`)
- **Restate** durable workflow engine
- **XState** state machines authored via a shared drag-drop editor layer
- **SurrealDB** as the dynamic-schema database, with one namespace per company

## Documentation

Project documentation lives in the `docs/` folder as an Obsidian vault. Open `docs/` in Obsidian or start at [`docs/00-Atlas/README.md`](docs/00-Atlas/README.md).

AI assistants and contributors should also read [`AGENTS.md`](AGENTS.md) for mandatory instructions on using and updating the documentation system.

## What it proves

1. A reusable **workflow editor Nuxt layer** (`layers/workflow-editor`) powers workflow authoring in both admin and tenant apps.
2. A shared **workflow actions catalog** (`packages/workflow-actions`) defines actions/guards once and consumes them from both the UI metadata and the Restate runtime.
3. **Company-based multi-tenancy**: the superadmin creates companies; a Restate workflow provisions a SurrealDB namespace per company.
4. The tenant app resolves the active company from a `company_slug` cookie (or `x-company-namespace` header), so the same URLs serve different tenants.
5. Create a workflow, add **guards** to transitions, and attach it to CRUD events (`users.create`, `companies.create`, etc.).
6. Restate executes the XState machine durably.
7. **Human-in-the-loop**: if the workflow enters a state named `awaitingApproval`, a pending approval is created and the workflow pauses until approved/rejected.
8. Demonstrate **XOR** logic with mutually exclusive guarded transitions and **AND** logic with multiple concurrent entry actions.

## Project structure

This is a pnpm workspaces monorepo:

```
apps/
  web/                     # Nuxt 4 tenant app
    app/                   # pages + CompanySwitcher
    server/middleware/     # company resolution from cookie/header
    server/api/            # tenant CRUD (users, workflows, triggers, approvals)
  admin/                   # Nuxt 4 superadmin site
    app/pages/             # login, dashboard, companies, platform workflows/triggers
    server/api/            # auth, companies, platform workflows/triggers
    server/utils/dispatch.ts
  workflow-runtime/        # Restate service that runs XState machines
packages/
  db/                      # SurrealDB client + platform + tenant + provisioning
    src/client.ts
    src/platform.ts
    src/tenant.ts
    src/provision.ts
    src/seed.ts
    src/seed-workflows.ts
  shared/                  # shared TypeScript types
  workflow-actions/        # shared action/guard catalog
    src/catalog/actions.ts
    src/catalog/guards.ts
    src/runtime/           # executor implementations for Restate
    src/meta.ts            # UI metadata
layers/
  workflow-editor/         # reusable Nuxt layer
    components/WorkflowEditor.vue
    components/ActionPicker.vue
    components/GuardEditor.vue
    composables/
docker-compose.yml         # Restate + SurrealDB
pnpm-workspace.yaml
```

## Getting started

1. Install dependencies:

```bash
pnpm install
```

2. Build the workspace packages:

```bash
pnpm -r build
```

3. Start Restate and SurrealDB:

```bash
pnpm restate:up
```

4. Seed the platform namespace, admin user, and provisioning workflow:

```bash
pnpm db:seed
pnpm db:seed:workflows
```

5. Start the Restate workflow service:

```bash
pnpm -F workflow-runtime dev
```

6. Register the service with Restate:

```bash
pnpm restate:register
```

7. Start the apps:

```bash
pnpm dev:admin   # http://localhost:3001
pnpm dev:web     # http://localhost:3000
```

Log in to the admin site with `admin@example.com` / `admin`.

To run all dev servers in parallel: `pnpm -r --parallel dev`.

## Test company provisioning

1. In the admin site, go to **Companies > New company** and create a company (e.g. `Acme` / `acme`).
2. Restate runs the `provisionCompany` workflow and creates the `company_<id>` namespace in SurrealDB.
3. In the tenant app, use the **Company switcher** to select the new company. The cookie `company_slug` is set.

## Test the happy path (tenant auto-approval)

1. In the tenant app, make sure a company is selected.
2. Go to **Workflows > New workflow**.
3. Build a simple flat machine:
   - States: `pending` (entry action: `log`) and `active` (entry action: `setStatusActive`)
   - Initial state: `pending`
   - Transition: `pending --create--> active`
4. Save the workflow.
5. Go to **Triggers** and attach the workflow to `users.create`.
6. Go to **Users** and create a user with status `pending`.
7. Within a few seconds the workflow runs and the user status becomes `active`.

## Test conditional logic + human approval

1. Go to **Workflows > New workflow** in the tenant app.
2. Build a machine:
   - States: `pending`, `awaitingApproval`, `active` (entry action: `setStatusActive`), `rejected`
   - Initial state: `pending`
   - Transition: `pending --create--> awaitingApproval` with guard type `emailContains` and value `@example.com`
   - Transitions from `awaitingApproval`: `approve --> active`, `reject --> rejected`
3. Save the workflow and attach it to `users.create`.
4. Create a user with email `someone@example.com` and status `pending`.
   - An approval request appears in **Approvals**.
   - The user stays `pending`.
5. Click **Approve** → the user becomes `active`.
6. Create a user with email `someone@gmail.com`.
   - The guard returns false, so no approval is created and the user stays `pending`.

## Test XOR + AND

Same as above, but add a second transition on `create` from `pending` with guard `emailNotContains` `@example.com` targeting `active`. Then:

- A `@gmail.com` user skips approval and goes directly to `active`.
- An `@example.com` user goes to `awaitingApproval`; after approval, `setStatusActive` and `sendWebhook` run concurrently.

## Adding a new workflow action or guard

Actions and guards live in `packages/workflow-actions`:

1. Add metadata to `src/catalog/actions.ts` or `src/catalog/guards.ts` (label, description, param schema).
2. Add the executor/evaluator to `src/runtime/actions.ts` or `src/runtime/guards.ts`.
3. The editor will automatically show the new action/guard; the Restate runtime will automatically run it.

No UI or runtime wiring changes are required.

## Notes / limitations

- The drag-drop editor is scoped to flat state machines (no nested/parallel states).
- Predefined actions: `log`, `setStatusActive`, `sendWebhook`, `provisionCompanyNamespace`.
- Predefined guards: `emailContains`, `emailNotContains`, `recordHasField`.
- A state can have multiple entry actions; Restate runs them concurrently via `CombineablePromise.all`.
- Multiple transitions from the same source/event with different guards are supported for XOR logic.
- Human-in-the-loop is triggered by entering a state named exactly `awaitingApproval`.
- The tenant app resolves company context from a `company_slug` cookie or `x-company-namespace` header; Restate calls use the header.
- The callback URL from Restate to the tenant API defaults to `http://localhost:3000`. Set `NITRO_API_URL` if you run the service elsewhere.
- `host.docker.internal` is used by the Restate container to reach the service; on some Windows setups this may need Docker Desktop.
