---
title: DB Test Results
type: runbook
status: in-progress
area: docs
created: 2026-06-16
updated: 2026-06-17
related:
  - [[Testing]]
  - [[DB Package]]
---

# DB Test Results

This note shows example inputs and the actual SurrealDB return values for the public helpers in `packages/db`. It was generated automatically by `packages/db/scripts/generate-test-results.ts`.

> **Note:** Record IDs are normalized to strings before returning to callers.

## client

| Function | Input | Output / Error |
|----------|-------|----------------|
| `getSurreal()` | `{}` | `{}` |

## provision

| Function | Input | Output / Error |
|----------|-------|----------------|
| `provisionCompanyNamespace` | `"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd"` | `{"ok":true,"namespace":"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd"}` |

## platform

| Function | Input | Output / Error |
|----------|-------|----------------|
| `createCompany` | `{"name":"Acme","slug":"acme","namespace":"acme"}` | `{"createdAt":"2026-06-16T17:12:17.121Z","id":"companies:rm948fx1bj67hfpfaw9k","name":"Acme","namespace":"acme","slug":"acme"}` |
| `listCompanies` | `{}` | `[{"createdAt":"2026-06-16T17:12:17.121Z","id":"companies:rm948fx1bj67hfpfaw9k","name":"Acme","namespace":"acme","slug":"acme"}]` |
| `getCompanyBySlug` | `"acme"` | `{"createdAt":"2026-06-16T17:12:17.121Z","id":"companies:rm948fx1bj67hfpfaw9k","name":"Acme","namespace":"acme","slug":"acme"}` |
| `createUserProfile` | `{"name":"Alice"}` | `{"createdAt":"2026-06-16T17:12:17.240Z","id":"user_profiles:32xyt9cznm5e0t4uibc5","name":"Alice","updatedAt":"2026-06-16T17:12:17.240Z"}` |
| `getUserProfileById` | `"user_profiles:32xyt9cznm5e0t4uibc5"` | `{"createdAt":"2026-06-16T17:12:17.240Z","id":"user_profiles:32xyt9cznm5e0t4uibc5","name":"Alice","updatedAt":"2026-06-16T17:12:17.240Z"}` |
| `createPlatformWorkflow` | `{"name":"Onboarding","xstateConfig":{"id":"onboarding","initial":"idle","states":{"idle":{}}}}` | `{"id":"workflows:8kn13j6akocr5xikjpcw","name":"Onboarding","xstateConfig":{"id":"onboarding","initial":"idle","states":{"idle":{}}}}` |
| `getPlatformWorkflow` | `"workflows:8kn13j6akocr5xikjpcw"` | `{"id":"workflows:8kn13j6akocr5xikjpcw","name":"Onboarding","xstateConfig":{"id":"onboarding","initial":"idle","states":{"idle":{}}}}` |
| `listPlatformWorkflows` | `{}` | `[{"id":"workflows:8kn13j6akocr5xikjpcw","name":"Onboarding","xstateConfig":{"id":"onboarding","initial":"idle","states":{"idle":{}}}}]` |
| `createPlatformTrigger` | `{"workflowId":"workflows:8kn13j6akocr5xikjpcw","tableName":"orders","event":"created"}` | `{"event":"created","id":"triggers:uiv3y558d9t1gxj4qvom","tableName":"orders","workflowId":"workflows:8kn13j6akocr5xikjpcw"}` |
| `listPlatformTriggers` | `{}` | `[{"event":"created","id":"triggers:uiv3y558d9t1gxj4qvom","tableName":"orders","workflowId":"workflows:8kn13j6akocr5xikjpcw"}]` |
| `createPlatformWorkflowInstance` | `{"workflowId":"workflows:8kn13j6akocr5xikjpcw","status":"running","tableName":"orders","recordId":"orders:1"}` | `{"createdAt":"2026-06-16T17:12:17.549Z","id":"workflow_instances:e99z50xbymm18z9dngm3","recordId":"orders:1","status":"running","tableName":"orders","updatedAt":"2026-06-16T17:12:17.549Z","workflowId":"workflows:8kn13j6akocr5xikjpcw"}` |
| `getPlatformWorkflowInstance` | `"workflow_instances:e99z50xbymm18z9dngm3"` | `{"createdAt":"2026-06-16T17:12:17.549Z","id":"workflow_instances:e99z50xbymm18z9dngm3","recordId":"orders:1","status":"running","tableName":"orders","updatedAt":"2026-06-16T17:12:17.549Z","workflowId":"workflows:8kn13j6akocr5xikjpcw"}` |
| `createPlatformUserTask` | `{"instanceId":"workflow_instances:e99z50xbymm18z9dngm3","type":"approval","tableName":"orders","recordId":"orders:1","workflowId":"workflows:8kn13j6akocr5xikjpcw"}` | `{"createdAt":"2026-06-16T17:12:17.643Z","id":"user_tasks:mvfuwvg9mszouwqegxr1","instanceId":"workflow_instances:e99z50xbymm18z9dngm3","recordId":"orders:1","status":"pending","tableName":"orders","type":"approval","workflowId":"workflows:8kn13j6akocr5xikjpcw"}` |
| `getPlatformUserTaskById` | `"user_tasks:mvfuwvg9mszouwqegxr1"` | `{"createdAt":"2026-06-16T17:12:17.643Z","id":"user_tasks:mvfuwvg9mszouwqegxr1","instanceId":"workflow_instances:e99z50xbymm18z9dngm3","recordId":"orders:1","status":"pending","tableName":"orders","type":"approval","workflowId":"workflows:8kn13j6akocr5xikjpcw"}` |

## tenant

| Function | Input | Output / Error |
|----------|-------|----------------|
| `createMember` | `{"namespace":"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd","email":"admin@example.com","role":"admin"}` | `{"createdAt":"2026-06-16T17:12:17.792Z","email":"admin@example.com","id":"members:drbreiaobrxvf4u3r7gm","role":"admin","status":"pending","updatedAt":"2026-06-16T17:12:17.792Z"}` |
| `getMemberById` | `{"namespace":"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd","id":"members:drbreiaobrxvf4u3r7gm"}` | `{"createdAt":"2026-06-16T17:12:17.792Z","email":"admin@example.com","id":"members:drbreiaobrxvf4u3r7gm","role":"admin","status":"pending","updatedAt":"2026-06-16T17:12:17.792Z"}` |
| `listMembers` | `"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd"` | `[{"createdAt":"2026-06-16T17:12:17.792Z","email":"admin@example.com","id":"members:drbreiaobrxvf4u3r7gm","role":"admin","status":"pending","updatedAt":"2026-06-16T17:12:17.792Z"}]` |
| `createWorkflow` | `{"namespace":"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd","name":"Approval","xstateConfig":{"id":"approval","initial":"idle","states":{"idle":{}}}}` | `{"id":"workflows:tkkf4bd6fu1q6zalo704","name":"Approval","xstateConfig":{"id":"approval","initial":"idle","states":{"idle":{}}}}` |
| `getWorkflow` | `{"namespace":"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd","id":"workflows:tkkf4bd6fu1q6zalo704"}` | `{"id":"workflows:tkkf4bd6fu1q6zalo704","name":"Approval","xstateConfig":{"id":"approval","initial":"idle","states":{"idle":{}}}}` |
| `listWorkflows` | `"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd"` | `[{"id":"workflows:tkkf4bd6fu1q6zalo704","name":"Approval","xstateConfig":{"id":"approval","initial":"idle","states":{"idle":{}}}}]` |
| `createTrigger` | `{"namespace":"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd","workflowId":"workflows:tkkf4bd6fu1q6zalo704","tableName":"orders","event":"created"}` | `{"event":"created","id":"triggers:5mvldmvtsjiirgr1ojm9","tableName":"orders","workflowId":"workflows:tkkf4bd6fu1q6zalo704"}` |
| `listTriggers` | `"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd"` | `[{"event":"created","id":"triggers:5mvldmvtsjiirgr1ojm9","tableName":"orders","workflowId":"workflows:tkkf4bd6fu1q6zalo704"}]` |
| `createWorkflowInstance` | `{"namespace":"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd","workflowId":"workflows:tkkf4bd6fu1q6zalo704","status":"running","tableName":"orders","recordId":"orders:1"}` | `{"createdAt":"2026-06-16T17:12:18.164Z","id":"workflow_instances:q3yk2pb3u1zdn8xvr36h","recordId":"orders:1","status":"running","tableName":"orders","updatedAt":"2026-06-16T17:12:18.164Z","workflowId":"workflows:tkkf4bd6fu1q6zalo704"}` |
| `getWorkflowInstance` | `{"namespace":"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd","id":"workflow_instances:q3yk2pb3u1zdn8xvr36h"}` | `{"createdAt":"2026-06-16T17:12:18.164Z","id":"workflow_instances:q3yk2pb3u1zdn8xvr36h","recordId":"orders:1","status":"running","tableName":"orders","updatedAt":"2026-06-16T17:12:18.164Z","workflowId":"workflows:tkkf4bd6fu1q6zalo704"}` |
| `createUserTask` | `{"namespace":"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd","instanceId":"workflow_instances:q3yk2pb3u1zdn8xvr36h","type":"approval","tableName":"orders","recordId":"orders:1","workflowId":"workfl` | `{"createdAt":"2026-06-16T17:12:18.257Z","id":"user_tasks:k2ek0q192g6s6pmn6tz3","instanceId":"workflow_instances:q3yk2pb3u1zdn8xvr36h","recordId":"orders:1","status":"pending","tableName":"orders","type":"approval","workflowId":"workflows:tkkf4bd6fu1q6zalo704"}` |
| `getUserTaskById` | `{"namespace":"test_tenant_dfa87d1d_a42c_477c_adc4_095017b0bacd","id":"user_tasks:k2ek0q192g6s6pmn6tz3"}` | `{"createdAt":"2026-06-16T17:12:18.257Z","id":"user_tasks:k2ek0q192g6s6pmn6tz3","instanceId":"workflow_instances:q3yk2pb3u1zdn8xvr36h","recordId":"orders:1","status":"pending","tableName":"orders","type":"approval","workflowId":"workflows:tkkf4bd6fu1q6zalo704"}` |

## health-checks

| Function | Input | Output / Error |
|----------|-------|----------------|
| `createHealthCheck` | `{"service":"api","status":"healthy","responseTimeMs":42}` | `{"checkedAt":"2026-06-16T17:12:18.301Z","id":"health_checks:3muqjxu1dapyu8c276s1","responseTimeMs":42,"service":"api","status":"healthy"}` |
| `listLatestHealthChecks` | `{}` | `[{"checkedAt":"2026-06-16T17:12:18.301Z","id":"health_checks:3muqjxu1dapyu8c276s1","responseTimeMs":42,"service":"api","status":"healthy"}]` |
| `listHealthCheckHistory` | `10` | `[{"checkedAt":"2026-06-16T17:12:18.301Z","id":"health_checks:3muqjxu1dapyu8c276s1","responseTimeMs":42,"service":"api","status":"healthy"}]` |
