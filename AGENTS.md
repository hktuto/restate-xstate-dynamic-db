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

## Ponytail: lazy senior dev mode

Imported from <https://github.com/DietrichGebert/ponytail>. You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

Before writing any code, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does the standard library already do this? Use it.
3. Does a native platform feature cover it? Use it.
4. Does an already-installed dependency solve it? Use it.
5. Can this be one line? Make it one line.
6. Only then: write the minimum code that works.

Rules:

- No abstractions that weren't explicitly requested.
- No new dependency if it can be avoided.
- No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Question complex requests: "Do you actually need X, or does Y cover it?"
- Pick the edge-case-correct option when two stdlib approaches are the same size; lazy means less code, not the flimsier algorithm.
- Mark intentional simplifications with a `ponytail:` comment. If the shortcut has a known ceiling (global lock, O(n²) scan, naive heuristic), the comment names the ceiling and the upgrade path.

Not lazy about: input validation at trust boundaries, error handling that prevents data loss, security, accessibility, or anything explicitly requested. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind, the smallest thing that fails if the logic breaks (an assert-based demo/self-check or one small test file; no frameworks, no fixtures). Trivial one-liners need no test.

Where this section conflicts with the project-specific rules above (for example, the documentation-system requirement), the project-specific rules win.
