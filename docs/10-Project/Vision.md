---
title: Vision
type: project
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Goals & Non-Goals]]
  - [[Roadmap]]
  - [[System Overview]]
---

# Vision

## Problem

Building durable, long-running workflows that survive restarts, retries, and failures is hard. XState gives us a powerful state-machine model, but running those workflows reliably at scale requires infrastructure for persistence, retries, and observability.

## Solution

`restate-xstate` combines:

- **XState** as the workflow modeling language.
- **Restate** as the durable runtime for retries, timers, and service-to-service calls.
- **SurrealDB** as the multi-model database for platform and tenant data.
- **Nuxt** for the tenant web app and superadmin app.

## Goal

Provide a multi-tenant platform where teams can design workflows visually, register custom actions/guards, and run them reliably with minimal operational overhead.

## Related

- [[Goals & Non-Goals]]
- [[Roadmap]]
- [[System Overview]]
