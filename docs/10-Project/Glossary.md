---
title: Glossary
type: project
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
related:
  - [[System Overview]]
  - [[Data Model]]
---

# Glossary

| Term | Definition |
|------|------------|
| **Workflow** | An XState state machine that defines a business process. |
| **Action** | A side effect executed during a workflow transition or entry/exit. |
| **Guard** | A condition that determines whether a transition is allowed. |
| **Trigger** | An event that starts or resumes a workflow instance. |
| **Company** | A tenant in the system, identified by a slug and namespace. |
| **Namespace** | SurrealDB namespace used to isolate a company's data. |
| **Platform** | The global admin context, stored in the `platform/admin` SurrealDB namespace. |
| **Restate** | Durable runtime for async and long-running services. |
| **SurrealDB** | Multi-model database used for tenant and platform data. |
| **Workflow Editor Layer** | Shared Nuxt layer providing the visual editor component. |
| **Workflow Runtime** | Restate service that executes workflow definitions. |

## Related

- [[System Overview]]
- [[Data Model]]
