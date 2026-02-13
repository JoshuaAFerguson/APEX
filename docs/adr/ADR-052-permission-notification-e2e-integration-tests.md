# ADR-052: End-to-End Permission Notification Flow Integration Tests

## Status
Proposed

## Context

The APEX permission notification system needs a comprehensive end-to-end integration test that validates the complete flow:
1. Permission change is triggered (in orchestrator)
2. Orchestrator emits appropriate event(s)
3. CLI receives and displays accurate, actionable notifications
4. WebSocket clients receive accurate, actionable notifications
5. All components work together seamlessly

### Acceptance Criteria

**AC1**: End-to-end test verifies the complete flow: permission change triggered → orchestrator emits event → both CLI and WebSocket clients receive accurate, actionable notifications.

**AC2**: All tests pass with `npm run test`.

### Current Architecture Analysis

#### 1. Orchestrator Event Emission

The `ApexOrchestrator` (packages/orchestrator/src/index.ts) extends `EventEmitter3` and emits the following permission-related events:

| Event Type | Event Data Interface | Purpose |
|------------|---------------------|---------|
| `permission:request` | `PermissionRequestEventData` | Permission request initiated |
| `permission:granted` | `PermissionGrantedEventData` | Permission approved |
| `permission:denied` | `PermissionDeniedEventData` | Permission denied |
| `dangerous:detected` | `DangerousOperationDetectedEventData` | Dangerous operation detected |
| `dangerous:confirmed` | `DangerousOperationConfirmedEventData` | Dangerous operation confirmed |
| `dangerous:blocked` | `DangerousOperationBlockedEventData` | Dangerous operation blocked |

#### 2. CLI Event Handling

The `useOrchestratorEvents` hook (packages/cli/src/ui/hooks/useOrchestratorEvents.ts) subscribes to permission events and:
- Displays formatted console output with colors and symbols
- Differentiates between dangerous and regular operations
- Provides actionable information (reason, scope, risk level)

#### 3. WebSocket Broadcasting

The `setupEventBroadcasting` function (packages/api/src/index.ts) forwards events to WebSocket clients:
- Broadcasts to task-specific channels (`taskId` or `permission-global`)
- Supports event filtering per client
- JSON-serializes event data for transport

#### 4. Existing Test Coverage

Existing E2E tests located at:
- `tests/integration/permission-notification-complete-e2e.integration.test.ts`
- `tests/integration/permission-e2e-complete-flow.test.ts`

Current gaps identified:
- Tests don't verify CLI notification content accuracy
- Tests don't verify WebSocket message actionability
- Tests don't verify full event data propagation integrity

## Decision

### 1. Test Architecture Overview

Create a focused end-to-end integration test that validates the complete permission notification flow across all components.

```
tests/integration/
└── permission-flow-complete-e2e.integration.test.ts   # New comprehensive E2E test
```

### 2. Test Design Principles

#### 2.1 Complete Flow Validation

Each test scenario must validate:
1. **Trigger**: Permission event is triggered correctly
2. **Emission**: Orchestrator emits with correct event type and data
3. **CLI Receipt**: CLI handler receives and processes the event
4. **CLI Display**: CLI generates accurate, actionable notification
5. **WebSocket Receipt**: WebSocket client receives the message
6. **WebSocket Content**: WebSocket message contains accurate, complete data
7. **Data Consistency**: CLI and WebSocket received identical core data

#### 2.2 Notification Accuracy Criteria

A notification is considered **accurate** if it contains:
- Valid request/operation ID
- Correct tool name
- Appropriate agent/user attribution
- Valid timestamp
- Type-specific required fields (scope, reason, risk level, etc.)

#### 2.3 Notification Actionability Criteria

A notification is considered **actionable** if it:
- Provides clear context for decision-making
- Includes available actions (approve, deny, confirm, block)
- Contains sufficient information to understand the impact
- Uses appropriate severity level

### 3. Technical Implementation

#### 3.1 Test Helpers

Leverage existing helpers from `packages/core/src/__tests__/helpers/`:

| Helper | Purpose |
|--------|---------|
| `EventCollector` | Capture and analyze permission events from orchestrator |
| `WSTestClient` | WebSocket test client with message validation |
| `MockPermissionTrigger` | Simulate permission scenarios |

#### 3.2 Test Structure

```typescript
// tests/integration/permission-flow-complete-e2e.integration.test.ts

describe('Complete Permission Notification Flow E2E', () => {
  // Test fixtures
  let orchestrator: ApexOrchestrator;
  let cliEventCollector: EventCollector;
  let wsClient: WSTestClient;
  let testDir: string;
  let apiServer: FastifyInstance;

  beforeAll(async () => {
    // 1. Create temporary APEX project
    // 2. Initialize ApexOrchestrator
    // 3. Start API server with WebSocket support
    // 4. Connect WebSocket client
    // 5. Set up CLI event collector
  });

  afterAll(async () => {
    // Cleanup all resources
  });

  describe('Permission Request Flow', () => {
    it('should propagate permission:request from orchestrator to CLI and WebSocket', async () => {
      // 1. Trigger permission request
      // 2. Verify orchestrator emission
      // 3. Verify CLI received with accurate content
      // 4. Verify WebSocket received with accurate content
      // 5. Verify CLI notification is actionable
      // 6. Verify data consistency between CLI and WebSocket
    });
  });

  describe('Permission Grant Flow', () => { /* ... */ });
  describe('Permission Denial Flow', () => { /* ... */ });
  describe('Dangerous Operation Flow', () => { /* ... */ });
  describe('High-Frequency Events', () => { /* ... */ });
  describe('Multi-Client Broadcasting', () => { /* ... */ });
});
```

#### 3.3 Validation Functions

```typescript
interface NotificationValidationResult {
  accurate: boolean;
  actionable: boolean;
  missingFields: string[];
  errors: string[];
}

function validatePermissionRequestNotification(
  notification: any,
  expected: PermissionRequestEventData
): NotificationValidationResult {
  const errors: string[] = [];
  const missingFields: string[] = [];

  // Accuracy checks
  if (!notification.requestId) missingFields.push('requestId');
  if (!notification.tool) missingFields.push('tool');
  if (!notification.agent) missingFields.push('agent');
  if (!notification.timestamp) missingFields.push('timestamp');

  // Value verification
  if (notification.requestId !== expected.requestId) {
    errors.push(`requestId mismatch: ${notification.requestId} !== ${expected.requestId}`);
  }
  if (notification.tool !== expected.tool) {
    errors.push(`tool mismatch: ${notification.tool} !== ${expected.tool}`);
  }

  // Actionability checks
  const actionable =
    notification.description !== undefined &&
    notification.scope !== undefined;

  return {
    accurate: missingFields.length === 0 && errors.length === 0,
    actionable,
    missingFields,
    errors
  };
}
```

#### 3.4 Complete Test Scenario Matrix

| Scenario | Event Type | CLI Validation | WS Validation | Data Consistency |
|----------|------------|----------------|---------------|------------------|
| Basic permission request | `permission:request` | ✓ | ✓ | ✓ |
| Permission granted | `permission:granted` | ✓ | ✓ | ✓ |
| Permission denied | `permission:denied` | ✓ | ✓ | ✓ |
| Dangerous operation detected | `dangerous:detected` | ✓ | ✓ | ✓ |
| Dangerous operation confirmed | `dangerous:confirmed` | ✓ | ✓ | ✓ |
| Dangerous operation blocked | `dangerous:blocked` | ✓ | ✓ | ✓ |
| High-frequency events (50+) | Multiple | ✓ | ✓ | ✓ |
| Multi-client broadcast | Any | N/A | ✓ | ✓ |

### 4. Implementation Details

#### 4.1 Event Data Validation

For each event type, validate the complete data structure:

```typescript
// PermissionRequestEventData validation
const permissionRequestFields = [
  'requestId',    // Required: unique identifier
  'tool',         // Required: tool name
  'agent',        // Required: requesting agent
  'timestamp',    // Required: when request was made
  'scope',        // Optional: file/command scope
  'description',  // Optional: human-readable description
  'isDangerous',  // Optional: danger flag
  'metadata'      // Optional: additional context
];

// PermissionGrantedEventData validation
const permissionGrantedFields = [
  'requestId',    // Required: links to request
  'tool',         // Required: tool name
  'level',        // Required: 'allow-always' | 'allow-once' | 'deny'
  'timestamp',    // Required: when granted
  'grantedBy',    // Required: who granted
  'scope',        // Optional: scope of permission
  'reason'        // Optional: approval reason
];

// DangerousOperationDetectedEventData validation
const dangerousDetectedFields = [
  'operationId',     // Required: unique identifier
  'tool',            // Required: tool name
  'operation',       // Required: operation type
  'riskLevel',       // Required: 'low' | 'medium' | 'high' | 'critical'
  'riskDescription', // Required: risk explanation
  'agent',           // Required: agent performing operation
  'timestamp',       // Required: when detected
  'context'          // Optional: additional context
];
```

#### 4.2 CLI Handler Simulation

Create a test-friendly CLI handler that captures all notification data:

```typescript
class TestCLIHandler extends EventEmitter {
  public receivedEvents: Array<{
    type: string;
    data: any;
    timestamp: Date;
    notification: {
      title: string;
      message: string;
      severity: string;
      accurate: boolean;
      actionable: boolean;
    };
  }> = [];

  constructor(orchestrator: ApexOrchestrator) {
    super();
    this.setupHandlers(orchestrator);
  }

  private setupHandlers(orchestrator: ApexOrchestrator): void {
    const eventTypes = [
      'permission:request',
      'permission:granted',
      'permission:denied',
      'dangerous:detected',
      'dangerous:confirmed',
      'dangerous:blocked'
    ];

    eventTypes.forEach(eventType => {
      orchestrator.on(eventType, (data) => {
        const notification = this.generateNotification(eventType, data);
        this.receivedEvents.push({
          type: eventType,
          data: { ...data },
          timestamp: new Date(),
          notification
        });
        this.emit('notification:generated', { eventType, notification });
      });
    });
  }

  private generateNotification(eventType: string, data: any): any {
    // Simulate real CLI notification generation
    // Returns notification with accuracy/actionability flags
  }
}
```

#### 4.3 WebSocket Validation

```typescript
class TestWebSocketValidator {
  validateMessage(message: any, expectedEvent: any): ValidationResult {
    return {
      hasCorrectType: message.type === expectedEvent.type,
      hasValidTimestamp: this.isValidTimestamp(message.timestamp),
      dataMatches: this.compareData(message.data, expectedEvent),
      isComplete: this.hasRequiredFields(message),
      isAccurate: this.verifyAccuracy(message, expectedEvent)
    };
  }

  private compareData(received: any, expected: any): boolean {
    // Deep comparison of core fields
    const coreFields = ['requestId', 'operationId', 'tool', 'agent', 'scope'];
    return coreFields.every(field => {
      if (expected[field] === undefined) return true;
      return received[field] === expected[field];
    });
  }
}
```

### 5. Test Implementation File

The complete test file should be implemented at:
`tests/integration/permission-flow-complete-e2e.integration.test.ts`

Key test cases:

1. **Basic Permission Request Flow**
   - Trigger permission request
   - Verify CLI receives with all required fields
   - Verify WebSocket receives with all required fields
   - Verify data consistency between both

2. **Permission Grant/Denial Flow**
   - Trigger request then grant/denial
   - Verify both events propagate correctly
   - Verify CLI shows appropriate success/failure indicators
   - Verify WebSocket messages contain correct status

3. **Dangerous Operation Flow**
   - Trigger dangerous operation detection
   - Verify critical severity level
   - Verify risk information is present
   - Verify actionable confirmation/block options

4. **High-Frequency Event Handling**
   - Send 50+ events rapidly
   - Verify no data loss
   - Verify correct ordering
   - Verify all events reach both CLI and WebSocket

5. **Multi-Client Broadcasting**
   - Connect multiple WebSocket clients
   - Verify all clients receive same events
   - Verify data consistency across clients

### 6. Success Criteria

The test suite is successful when:

1. ✅ All 6 event types are tested for complete flow
2. ✅ CLI notifications are validated for accuracy (all required fields present)
3. ✅ CLI notifications are validated for actionability (actions, context)
4. ✅ WebSocket messages are validated for accuracy
5. ✅ WebSocket messages are validated for completeness
6. ✅ Data consistency between CLI and WebSocket is verified
7. ✅ High-frequency events are handled without data loss
8. ✅ Multi-client broadcasting works correctly
9. ✅ `npm run build` passes
10. ✅ `npm run test` passes

## Consequences

### Positive

- Comprehensive validation of the entire permission notification flow
- Catches integration issues between orchestrator, CLI, and API
- Ensures notification accuracy and actionability
- Validates system behavior under load

### Negative

- Increases test suite runtime (E2E tests are slower)
- Requires careful cleanup to avoid resource leaks
- More complex test setup and teardown

### Risks

- Port conflicts during parallel test execution (mitigate with dynamic ports)
- Timing issues in async event propagation (mitigate with appropriate timeouts)
- Test flakiness from WebSocket connection issues (mitigate with retry logic)

## Implementation Notes

### File Structure

```
tests/
└── integration/
    └── permission-flow-complete-e2e.integration.test.ts

packages/core/src/__tests__/helpers/
├── EventCollector.ts         # Existing
├── WSTestClient.ts           # Existing
├── MockPermissionTrigger.ts  # Existing
└── index.ts                  # Existing
```

### Dependencies

- `vitest` - Test framework
- `ws` - WebSocket client
- `eventemitter3` - Event handling
- `@testing-library/react` - React hook testing (for CLI hook validation)
- `@fastify/websocket` - WebSocket server support

### Estimated Implementation Time

- Test implementation: 2-3 hours
- Validation and debugging: 1-2 hours
- Documentation: 30 minutes

## References

- Existing E2E tests: `tests/integration/permission-notification-complete-e2e.integration.test.ts`
- Event types: `packages/core/src/types.ts` (lines 5700-6247)
- CLI hook: `packages/cli/src/ui/hooks/useOrchestratorEvents.ts`
- API broadcasting: `packages/api/src/index.ts` (lines 2489-2600)
- Test helpers: `packages/core/src/__tests__/helpers/`
