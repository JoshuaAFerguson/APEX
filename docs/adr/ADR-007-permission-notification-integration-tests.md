# ADR-007: Permission Notification Integration Test Architecture

## Status
Accepted

## Date
2025-01-15

## Context

We need integration tests that verify the complete end-to-end permission notification flow:
1. Permission change is triggered
2. Orchestrator emits events
3. CLI receives and displays notifications
4. WebSocket clients receive notifications
5. Notification content is accurate and actionable

### Current State Analysis

Existing infrastructure already provides significant scaffolding:

**Test Helpers (packages/core/src/__tests__/helpers/)**:
- `MockPermissionTrigger` - Simulates permission events with full flow support
- `EventCollector` - Captures and queries events from an EventEmitter
- `WSTestClient` - WebSocket client for testing real-time notifications

**Existing Per-Package Integration Tests**:
- `packages/core/src/__tests__/permission-notification.integration.test.ts` (INT-01, INT-02, INT-03)
- `packages/orchestrator/src/__tests__/permission-notification-orchestrator.integration.test.ts` (INT-04, INT-05)
- `packages/cli/src/__tests__/permission-notification-cli.integration.test.ts` (INT-06, INT-07)
- `packages/api/src/__tests__/permission-notification-api.integration.test.ts` (INT-08, INT-09)

### Critical Issues Found

1. **Wrong Import Paths**: The orchestrator, CLI, and API integration tests import from `@apex/core` and `@apex/orchestrator`, but actual package names are `@apexcli/core` and `@apexcli/orchestrator`. These tests cannot currently compile.

2. **Missing WebSocket Broadcasting**: The API server (`packages/api/src/index.ts`) does NOT broadcast `permission:notification`, `permission:request`, `permission:granted`, `permission:denied`, `dangerous:detected`, `dangerous:confirmed`, or `dangerous:blocked` events. Only `approval:*` events are forwarded. The existing API integration test uses a `MockApexAPIServer` which won't catch this gap.

3. **Mock vs Real**: The orchestrator and CLI integration tests instantiate `ApexOrchestrator` with constructor signatures (`{workingDirectory, claudeApiKey}`) that don't match the actual constructor, and call `orchestrator.destroy()` which may not exist. These tests use mock configurations that don't align with the real API.

4. **No True Cross-Package E2E Test**: Current tests verify per-package behavior but no single test verifies the complete chain: trigger → orchestrator → CLI + WebSocket simultaneously.

## Decision

### Architecture for Integration Test Suite

We will implement a **layered testing approach** with three test tiers:

#### Tier 1: Fix Existing Package-Level Integration Tests
Fix the broken import paths and constructor calls in existing tests so they actually compile and run. This is prerequisite to any new work.

**Files to fix:**
- `packages/orchestrator/src/__tests__/permission-notification-orchestrator.integration.test.ts`
- `packages/cli/src/__tests__/permission-notification-cli.integration.test.ts`
- `packages/api/src/__tests__/permission-notification-api.integration.test.ts`

**Changes needed:**
- Replace `@apex/core` → `@apexcli/core`
- Replace `@apex/orchestrator` → `@apexcli/orchestrator`
- Replace `@apex/core/src/__tests__/helpers` → relative path `../../core/src/__tests__/helpers` or direct source import
- Fix `ApexOrchestrator` constructor calls to match actual API
- Fix method calls (`destroy()` → `shutdown()` or appropriate method)

#### Tier 2: Add Permission Event Broadcasting to API
The API server needs to forward permission-related events to WebSocket clients. Without this, the WebSocket integration tests are testing mock behavior, not real behavior.

**File to modify:**
- `packages/api/src/index.ts` - Add event listeners for:
  - `permission:request`
  - `permission:granted`
  - `permission:denied`
  - `permission:notification`
  - `dangerous:detected`
  - `dangerous:confirmed`
  - `dangerous:blocked`

**Pattern**: Follow the existing pattern used for `approval:*` and `tool:*` events.

#### Tier 3: Create Cross-Package E2E Integration Test
Create a single end-to-end test that validates the complete notification pipeline.

**File**: `tests/integration/permission-notification-e2e.integration.test.ts`

**Test Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                   Test Harness                          │
│                                                          │
│  ┌──────────────┐    ┌──────────────────┐               │
│  │MockPermission│───→│ ApexOrchestrator │               │
│  │  Trigger     │    │ (EventEmitter)   │               │
│  └──────────────┘    └────┬────────┬────┘               │
│                           │        │                     │
│                    ┌──────┘        └──────┐              │
│                    ▼                      ▼              │
│            ┌──────────────┐    ┌─────────────────┐      │
│            │EventCollector│    │ API Server       │      │
│            │(CLI proxy)   │    │ (Fastify+WS)     │      │
│            └──────────────┘    └───────┬─────────┘      │
│                                        │                 │
│                                        ▼                 │
│                                ┌──────────────┐         │
│                                │ WSTestClient │         │
│                                │ (WS receiver)│         │
│                                └──────────────┘         │
│                                                          │
│  Assertions verify:                                      │
│  1. EventCollector received correct events               │
│  2. WSTestClient received same events via WebSocket      │
│  3. Notification content is accurate & actionable        │
│  4. Event ordering is maintained                         │
│  5. All notification types are supported                 │
└─────────────────────────────────────────────────────────┘
```

**Key Test Scenarios:**

1. **Happy Path - Permission Granted Flow** (INT-E2E-01):
   - Trigger permission request → verify both CLI collector and WS client receive notification
   - Grant permission → verify both endpoints receive granted notification
   - Validate notification content (title, message, severity, actions)

2. **Permission Denied Flow** (INT-E2E-02):
   - Trigger request → deny → verify both endpoints receive accurate denial
   - Verify error severity and reason are propagated

3. **Dangerous Operation Flow** (INT-E2E-03):
   - Trigger dangerous operation → verify critical severity notification
   - Block operation → verify blocked notification reaches both endpoints

4. **Concurrent Multi-Agent Flow** (INT-E2E-04):
   - Multiple agents request permissions simultaneously
   - Verify all notifications are received by both CLI and WS
   - Verify no notifications are lost or duplicated

5. **Notification Content Accuracy** (INT-E2E-05):
   - Verify all notification fields match schema
   - Verify `requiresAction` flag is correct
   - Verify `actions` array contains valid options
   - Verify `severity` correctly maps to event type
   - Verify `metadata` is preserved end-to-end

6. **Event Ordering** (INT-E2E-06):
   - Verify chronological ordering across both CLI and WS channels
   - Verify request always precedes grant/deny

### Design Principles

1. **Use Real Orchestrator EventEmitter**: Tests use the actual `ApexOrchestrator` event system (extends EventEmitter) - not mocked.

2. **Mock External Dependencies Only**: Only Claude SDK API calls are mocked. Event emission, collection, and WebSocket transport use real implementations.

3. **Shared Test Helpers**: Reuse existing `EventCollector`, `WSTestClient`, and `MockPermissionTrigger` from `packages/core/src/__tests__/helpers/`.

4. **Test Framework**: Vitest with `describe`/`it`/`expect` patterns consistent with existing codebase.

5. **Cleanup**: Each test suite uses `beforeEach`/`afterEach` for setup and teardown of temp directories, event listeners, and WebSocket connections.

6. **Timeouts**: All event waiting operations use configurable timeouts (default 5000ms) with clear timeout error messages.

## Consequences

### Positive
- Comprehensive verification of the complete notification pipeline
- Early detection of cross-package integration issues
- Tests validate real event flow rather than mocked behavior
- Fixes existing broken tests that were silently failing

### Negative
- WebSocket tests add ~200ms latency per test for connection setup
- Requires `@fastify/websocket` and `ws` as test dependencies (already in devDeps)
- Fixing the API to broadcast permission events is a code change beyond pure testing

### Risks
- The `ApexOrchestrator` constructor may have evolved since the existing tests were written; need to verify actual constructor signature
- WebSocket tests can be flaky in CI if ports aren't properly randomized (mitigated by using port 0)

## Implementation Plan for Next Stage (Development)

1. **Fix import paths** in all 3 existing per-package integration tests
2. **Add permission event broadcasting** to `packages/api/src/index.ts`
3. **Create E2E integration test** at `tests/integration/permission-notification-e2e.integration.test.ts`
4. **Run `npm run build`** to verify compilation
5. **Run `npm run test`** to verify all tests pass

### Estimated Files Modified/Created
- `packages/orchestrator/src/__tests__/permission-notification-orchestrator.integration.test.ts` (fix imports)
- `packages/cli/src/__tests__/permission-notification-cli.integration.test.ts` (fix imports)
- `packages/api/src/__tests__/permission-notification-api.integration.test.ts` (fix imports)
- `packages/api/src/index.ts` (add permission event broadcasting)
- `tests/integration/permission-notification-e2e.integration.test.ts` (new)
