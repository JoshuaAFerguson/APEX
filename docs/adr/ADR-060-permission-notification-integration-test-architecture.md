# ADR-060: Permission Notification Integration Test Architecture

## Status
Accepted

## Date
2025-02-02

## Context

APEX requires end-to-end integration tests that verify the complete permission notification flow:

1. Permission change is triggered
2. Orchestrator emits the correct event
3. CLI clients receive the notification
4. WebSocket clients receive the notification
5. Notification content is accurate and actionable

The system already has:
- A rich type system for permission events (`PermissionRequestEventData`, `PermissionGrantedEventData`, `PermissionDeniedEventData`, `DangerousOperationDetectedEventData`, etc.) defined in `@apexcli/core` types
- An `OrchestratorEvents` interface with typed event signatures in `@apexcli/orchestrator`
- A `PermissionNotificationSchema` (Zod) for structured notifications
- Existing per-package unit/integration tests for permission subsystems
- An existing E2E integration test at `tests/integration/permission-notification-flow-end-to-end.integration.test.ts`
- Shared test utilities in `tests/test-utils/`

## Decision

### 1. Test Architecture: Layered Integration Testing

We adopt a **three-layer integration test architecture** that maps to the existing package structure:

```
Layer 3: End-to-End Flow (tests/integration/)
  └── Full pipeline: trigger → orchestrator → CLI + WebSocket → verify content

Layer 2: Cross-Package Integration (packages/*/src/__tests__/)
  └── Per-package tests verifying inter-package contracts

Layer 1: Component Integration (packages/*/src/__tests__/)
  └── Per-component tests verifying internal event handling
```

### 2. Test Components and Contracts

#### 2.1 Event Data Type Conformance

All integration tests MUST use the **official typed event data interfaces** from `@apexcli/core`:

| Event Type | Interface | Key Fields |
|---|---|---|
| `permission:request` | `PermissionRequestEventData` | `requestId`, `tool`, `scope`, `description`, `isDangerous`, `agent`, `timestamp` |
| `permission:granted` | `PermissionGrantedEventData` | `requestId`, `tool`, `scope`, `level`, `grantedBy`, `timestamp`, `reason` |
| `permission:denied` | `PermissionDeniedEventData` | `requestId`, `tool`, `scope`, `deniedBy`, `timestamp`, `reason` |
| `dangerous:detected` | `DangerousOperationDetectedEventData` | `operationId`, `tool`, `operation`, `riskLevel`, `riskDescription`, `agent`, `timestamp` |
| `dangerous:confirmed` | `DangerousOperationConfirmedEventData` | `operationId`, `tool`, `operation`, `confirmedBy`, `timestamp`, `reason` |
| `dangerous:blocked` | `DangerousOperationBlockedEventData` | `operationId`, `tool`, `operation`, `blockedBy`, `timestamp`, `reason` |

**NOTE**: The existing E2E test uses ad-hoc field names (`toolName`, `agentName`, `taskId`) that do NOT match the official typed interfaces (`tool`, `agent`, `requestId`). The implementation stage MUST align the test data factories with the official types.

#### 2.2 Mock CLI Handler Contract

The `MockCLIHandler` simulates the CLI's event subscription pattern:
- Subscribes to all 6 permission event types on the orchestrator
- Captures raw event data
- Transforms events into user-facing notifications with:
  - `title`: Formatted summary (e.g., "Permission Required: Write")
  - `message`: Actionable description including agent, scope, and reason
  - `severity`: Mapped from event type (`info`, `warning`, `error`, `critical`)

#### 2.3 Mock WebSocket Client Contract

The `MockWebSocketClient` simulates browser/UI clients:
- Connects to Fastify WebSocket endpoint (`/ws`)
- Receives JSON-serialized event messages with `{ type, timestamp, data }` envelope
- Verifies content fidelity (all event fields preserved through serialization)

#### 2.4 API Server (Fastify + WebSocket Bridge)

The test API server acts as the bridge between orchestrator events and WebSocket clients:
- Registers `@fastify/websocket` plugin
- Forwards orchestrator events to all connected WebSocket clients
- Handles client disconnection gracefully (removes event listeners)

### 3. Test Coverage Matrix

The integration test suite MUST cover these acceptance criteria:

| Test ID | Acceptance Criteria | Verification |
|---|---|---|
| INT-E2E-01 | Complete flow: trigger → orchestrator → CLI + WS | Emit event, verify both receivers |
| INT-E2E-02 | Simultaneous multi-client delivery | Multiple WS clients, verify all receive |
| INT-E2E-03 | Content accuracy and actionability | Verify fields, messages, severity levels |
| INT-E2E-04 | Multiple event types | All 6 permission event types tested |
| INT-E2E-05 | Error handling and resilience | Disconnections, malformed data, high frequency |

### 4. Test Infrastructure Design

#### 4.1 Test Setup Flow

```
beforeAll:
  - Allocate random port for API server (50000-60000 range)

beforeEach:
  - Create temp directory (os.tmpdir)
  - Initialize APEX project (initializeApex)
  - Create agent definitions (.apex/agents/)
  - Create workflow definitions (.apex/workflows/)
  - Initialize ApexOrchestrator with projectPath
  - Create MockCLIHandler (subscribes to orchestrator events)
  - Start Fastify server with WebSocket support
  - Configure event forwarding from orchestrator to WebSocket

afterEach:
  - Disconnect all WebSocket clients
  - Close Fastify server
  - Shutdown orchestrator
  - Remove CLI handler listeners
  - Delete temp directory
```

#### 4.2 Event Propagation Timing

Since events propagate asynchronously through WebSocket:
- Use `setTimeout` delays (50-100ms) for single event propagation
- Use `setTimeout` delays (200-500ms) for high-frequency stress tests
- Consider extracting a `waitForEvents(client, expectedCount, timeout)` utility for more reliable async waiting

#### 4.3 File Organization

```
tests/integration/
  └── permission-notification-flow-end-to-end.integration.test.ts  (existing - needs alignment)

packages/core/src/__tests__/
  ├── permission-notification.integration.test.ts        (existing)
  └── permission-notification-events.test.ts             (existing)

packages/orchestrator/src/__tests__/
  └── permission-notification-orchestrator.integration.test.ts  (existing)

packages/api/src/__tests__/
  └── permission-notification-api.integration.test.ts    (existing)

packages/cli/src/__tests__/
  ├── permission-notification-cli.integration.test.ts    (existing)
  └── permission-notifications.test.ts                   (existing)
```

### 5. Key Architectural Decisions

#### 5.1 Event Emission Strategy

Tests emit events directly on the orchestrator instance (`orchestrator.emit(...)`) rather than triggering them through the permission manager pipeline. This is intentional for integration testing because:
- It isolates the **event propagation** layer from the **permission decision** layer
- It enables testing of event delivery without requiring Claude SDK or actual tool execution
- The permission decision logic is covered by per-package unit tests

#### 5.2 Type Safety in Test Data

Test data factories SHOULD:
- Import and conform to official event data interfaces from `@apexcli/core`
- Use `satisfies` or explicit type annotations for test event objects
- Validate PermissionNotification objects against `PermissionNotificationSchema`

#### 5.3 WebSocket Message Envelope

All WebSocket messages use a standard envelope:
```typescript
interface WebSocketMessage {
  type: string;           // Event type (e.g., 'permission:request')
  timestamp: string;      // ISO 8601 timestamp
  data: EventData;        // The original event data
}
```

#### 5.4 Resilience Testing Patterns

- **Disconnection handling**: Connect multiple clients, disconnect one, verify others still receive
- **Malformed data**: Emit events with missing/invalid fields, verify system stability
- **High-frequency streams**: Emit 100 events rapidly, verify zero data loss
- **Content integrity**: Verify all fields survive JSON serialization round-trip

### 6. Implementation Notes for Next Stage

1. **Type Alignment**: The existing E2E test uses field names (`toolName`, `agentName`, `taskId`) that don't match the official typed interfaces (`tool`, `agent`, `requestId`). Either:
   - (a) Update the test to use official types (preferred), or
   - (b) Update the MockCLIHandler to map between the two schemas

2. **Async Wait Utility**: Extract `waitForEvents()` to replace raw `setTimeout` calls for more deterministic tests

3. **Event Listener Cleanup**: The current `ws.on('close')` handler calls `orchestrator.removeAllListeners()` which could remove CLI handler listeners too. Use named functions and `removeListener()` instead.

4. **Port Allocation**: Consider using `getPort()` library or binding to port 0 to avoid port conflicts in CI

5. **Test Isolation**: Each `beforeEach` creates a fresh orchestrator and temp directory, ensuring test isolation. Maintain this pattern.

## Consequences

### Positive
- Complete E2E coverage of permission notification pipeline
- Type-safe test data using official interfaces
- Layered approach allows targeted debugging (which layer broke?)
- Resilience tests catch edge cases before production

### Negative
- WebSocket-based tests are inherently more flaky due to timing
- Test setup/teardown overhead (temp dirs, Fastify server, SQLite) adds test execution time
- Maintaining test infrastructure across 4 packages requires coordination

### Mitigations
- Use generous but bounded timeouts for async operations
- Share test utilities via `tests/test-utils/`
- Run integration tests separately from unit tests in CI (already configured via `vitest.config.ts` patterns)
