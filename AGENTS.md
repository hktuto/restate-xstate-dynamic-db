# Agent Instructions

This file contains mandatory instructions for any AI assistant or coding agent working on the `restate-xstate` project.

## You MUST use the documentation system

This project maintains a structured Obsidian documentation vault under `docs/`. You are required to read and follow it. Do not rely solely on this file or on codebase exploration.

### Required reading order

Before making significant changes, read these notes in this order:

1. **`docs/00-Atlas/Project Brief.md`** — What the project is, current phase, active work, key decisions, and quick commands.
2. **`docs/00-Atlas/Status Board.md`** — Current status of features, runbooks, and ADRs.
3. **`docs/00-Atlas/Documentation Conventions.md`** — How every note must be structured and updated.

### When updating documentation

If your work adds, removes, or changes any of the following, you MUST update the corresponding documentation note:

- Architecture or data model changes → `20-Architecture/`
- New or changed app behavior → `30-Apps/<app>/`
- New or changed package → `40-Packages/`
- New or changed feature → `50-Features/`
- New or changed development/operational procedure → `60-Development/` or `70-Operations/`
- New architecture decision → `20-Architecture/Decision Log/`

Every documentation note MUST:

- Start with YAML frontmatter as defined in `docs/00-Atlas/Documentation Conventions.md`.
- Use the exact status values: `idle`, `planned`, `in-progress`, `done`.
- Include accurate `app`, `area`, and `type` values.
- Link related notes in the `related:` frontmatter array and inline with `[[...]]` wikilinks.
- Update the `updated:` date when edited.

If a feature status changes, update the feature note. The Status Board will reflect it automatically if Dataview is used.

### Re-apply frontmatter conventions

If documentation conventions change or you are unsure whether frontmatter is consistent, run:

```bash
node docs/scripts/apply-frontmatter.cjs --force
```

This script skips `docs/90-Templates/` to preserve template placeholders.

## General coding rules

- Make minimal changes to achieve the goal.
- Follow existing code style in the monorepo.
- Do not change existing test logic unless the interface changes.
- Do not run `git commit`, `git push`, `git reset`, `git rebase`, or similar mutations unless explicitly asked.

## Project quick reference

```bash
pnpm install
pnpm -r build
docker compose up -d
pnpm --filter db seed
pnpm --filter admin dev   # http://localhost:3001
pnpm --filter web dev     # http://localhost:3000
pnpm --filter workflow-runtime dev
```

For full details, see `docs/00-Atlas/Project Brief.md` and `docs/60-Development/Getting Started.md`.
