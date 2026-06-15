---
title: Workflow Engine
type: feature
status: planned
area: workflow
created: 2026-06-14
updated: 2026-06-14
app:
  - runtime
related:
  - [[Workflow Runtime]]
  - [[30-Apps/Workflow Runtime/Overview]]
  - [[50-Features/Workflow Actions Catalog]]
  - [[50-Features/Guards & Conditions]]
---

# Workflow Engine

## Overview

Executes XState workflows durably using Restate.

## Responsibilities

- Load workflow definition.
- Start instance from trigger.
- Evaluate guards.
- Execute actions.
- Persist instance state.
- Handle failures and retries.

## Related

- [[Workflow Runtime]]
- [[30-Apps/Workflow Runtime/Overview|Workflow Runtime App]]
- [[50-Features/Workflow Actions Catalog|Workflow Actions Catalog]]
- [[50-Features/Guards & Conditions|Guards & Conditions]]
