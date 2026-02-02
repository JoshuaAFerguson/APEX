# ADR: End-to-End Integration Tests for Permission Notification Flow

## Status
Accepted

## Context

APEX has a permission notification system that spans three layers:
1. **Orchestrator** (`@apex/orchestrator`) - Emits permission events via `EventEmitter`
2. **CLI** (`@apex/cli`) - Listens to orchestrator events and renders notifications to terminal
3. **API/WebSocket** (`@apex/api`) - Forwards orchestrator events to WebSocket clients in real-time

Existing integration tests cover each layer in isolation:
- `packages/core/src/__tests__/permission-notification.integration.test.ts` (INT-01 to INT-03: schema validation, event flow, type safety)
- `packages/orchestrator/src/__tests__/permission-notification-orchestrator.integration.test.ts` (INT-04 to INT-05: orchestrator event emission)
- `packages/cli/src/__tests__/permission-notification-cli.integration.test.ts` (INT-06 to INT-07: CLI event handling)
- `packages/api/src/__tests__/permission-notification-api.integration.test.ts` (INT-08 to INT-09: WebSocket streaming)

**What's missing**: A true end-to-end test that verifies the **complete flow** from permission change trigger through orchestrator emission to simultaneous CLI and WebSocket client delivery, validating content accuracy and actionability at each stage.

## Decision

### Test Architecture

Create a single end-to-end integration test file at `packages/core/src/__tests__/permission-notification-e2e.integration.test.ts` that:

1. **Lives in `@apex/core`** to avoid circular dependency issues and because it tests cross-package behavior using the existing shared test helpers (`EventCollector`, `MockPermissionTrigger`, `WSTestClient`) already exported from `@apex/core/src/__tests__/helpers/`.

2. **Uses mock implementations** of CLI and WebSocket layers (consistent with existing test patterns) rather than spinning up real servers, since:
   - Existing tests already establish this pattern
   - It avoids flaky network-dependent tests
   - The focus is on event flow correctness, not HTTP/WS transport

3. **Tests the complete flow** as specified in the acceptance criteria:
   - Permission change triggered → orchestrator emits event
   - Both CLI and WebSocket clients receive notification simultaneously
   - Notification content is accurate and actionable
   - All permission notification types are covered

### Test Structure (INT-10 through INT-14)

```
INT-10: Complete Permission Request → Approval Flow
  - MockPermissionTrigger triggers permission request
  - Orchestrator emits permission:request, then permission:notification
  - CLI handler receives and formats notification correctly
  - WebSocket client receives notification with identical content
  - Both receivers validate notification is actionable (requiresAction: true, actions present)

INT-11: Complete Permission Denial Flow
  - Full cycle: request → notification → denial → denial notification
  - Both CLI and WS clients receive all events in correct order
  - Denial notification has correct severity and message

INT-12: Dangerous Operation Detection → Resolution Flow
  - dangerous:detected → permission:notification → confirm/block
  - Verifies both CLI and WS clients receive danger alerts
  - Validates risk-appropriate severity (error/critical)

INT-13: Multi-Client Simultaneous Delivery
  - Multiple WS clients + CLI handler all subscribe
  - Single permission event triggers delivery to ALL clients
  - Content identical across all receivers
  - Validates notification ID consistency

INT-14: Notification Content Accuracy & Actionability
  - Validates all PermissionNotification fields are populated correctly
  - Verifies actions array contains appropriate options
  - Confirms metadata flows through pipeline intact
  - Tests scope information is preserved end-to-end
  - Tests expiration timestamp handling
```

### Key Design Decisions

#### 1. Mock Orchestrator via EventEmitter
Reuse the existing pattern from orchestrator tests: instantiate `ApexOrchestrator` with a test config, connect `MockPermissionTrigger` to pipe events through it.

#### 2. Mock CLI Handler
Reuse the `MockCLINotificationHandler` pattern from `permission-notification-cli.integration.test.ts` which captures formatted output strings for assertion.

#### 3. Mock WebSocket via EventEmitter
Rather than spinning up a real WebSocket server, simulate the WS forwarding layer by having the test directly wire orchestrator events → captured messages (matching the existing `WSTestClient` API pattern). This is consistent with how the API tests work.

#### 4. Shared Test Helpers
All three test helpers from `@apex/core/src/__tests__/helpers/` are reused:
- `EventCollector` - captures all events from the orchestrator
- `MockPermissionTrigger` - simulates permission scenarios
- `WSTestClient` interface - validated against (mock WS layer captures messages in same format)

#### 5. Assertion Strategy
Each test validates:
- **Delivery**: Both CLI and WS clients received the event
- **Content accuracy**: Notification fields match expected values (tool, agent, scope, severity, type)
- **Actionability**: `requiresAction` and `actions` array are correct for the scenario
- **Ordering**: Events arrive in the correct sequence (request before granted/denied)
- **Timing**: Events are delivered within reasonable timeframes

### File Layout

```
packages/core/src/__tests__/
  permission-notification-e2e.integration.test.ts   # NEW - end-to-end flow tests
  helpers/
    EventCollector.ts          # existing
    MockPermissionTrigger.ts   # existing
    WSTestClient.ts            # existing
    index.ts                   # existing
```

No new test helper files needed - existing infrastructure is sufficient.

### Dependencies

- `vitest` (test framework - already used across all packages)
- `eventemitter3` (event bus - already a dependency)
- `@apex/core` types and schemas (for validation)
- Existing test helpers from `@apex/core/src/__tests__/helpers/`

No new dependencies required.

## Consequences

### Positive
- Complete end-to-end coverage of permission notification flow
- Validates cross-layer integration without real network dependencies
- Uses established patterns - minimal learning curve for maintainers
- Fast execution (no real servers/network) while still testing the full event pipeline
- Single test file covers the gap between existing per-layer tests

### Negative
- Mock-based testing doesn't catch real WebSocket transport issues (covered by existing API integration tests)
- Test file in `@apex/core` tests behavior of `@apex/orchestrator` and `@apex/cli` patterns (but this is consistent with how `@apex/core` already hosts cross-package integration tests)

### Risks
- If the event forwarding pattern in the real API/CLI changes, these tests may need updates
- Mitigated by the tests being pattern-based (testing event flow, not implementation details)
