# Event Capture Test Utilities

This directory contains test utilities for capturing and asserting on orchestrator events.

## EventCapture

The `EventCapture` class provides comprehensive event capture and assertion capabilities specifically designed for testing confirmation-related events in the APEX orchestrator.

### Features

- **Event Capture**: Automatically captures events from EventEmitter instances
- **Event Filtering**: Filter events by type or custom predicates
- **Comprehensive Assertions**: Built-in assertion methods for common testing scenarios
- **Confirmation Event Helpers**: Specialized methods for approval, gate, and permission events
- **Async Support**: Wait for events to be emitted with timeout support
- **Event Sequencing**: Assert on event ordering and sequences
- **Data Validation**: Validate event payloads and properties

### Basic Usage

```typescript
import { EventCapture, createEventCapture } from './tests/utils/event-capture';
import { ApexOrchestrator } from '@apexcli/orchestrator';

// Create orchestrator instance
const orchestrator = new ApexOrchestrator();

// Create event capture with auto-start
const eventCapture = createEventCapture(orchestrator);

// Perform action that triggers events
await orchestrator.executeTask(task);

// Assert on events
eventCapture.expectEventEmitted('task:started');
eventCapture.expectEventSequence(['task:started', 'approval:required', 'task:paused']);

// Check event data
const approvalEvent = eventCapture.getApprovalRequiredEvents()[0];
eventCapture.expectEventData(approvalEvent, { taskId: 'test-task' });

// Clean up
eventCapture.dispose();
```

### Confirmation Events

The EventCapture provides specialized helpers for confirmation-related events:

```typescript
// Get approval events
const approvalRequiredEvents = eventCapture.getApprovalRequiredEvents();
const approvalGrantedEvents = eventCapture.getApprovalGrantedEvents();
const approvalDeniedEvents = eventCapture.getApprovalDeniedEvents();

// Get gate events
const gateEvents = eventCapture.getGateEvents();

// Get all confirmation-related events
const confirmationEvents = eventCapture.getConfirmationEvents();
```

### Async Event Waiting

```typescript
// Wait for a specific event
const event = await eventCapture.waitForEvent('approval:required', 5000);

// Wait for a sequence of events
const events = await eventCapture.waitForEventSequence([
  'task:started',
  'approval:required',
  'approval:granted'
], 10000);
```

### Configuration Options

```typescript
const eventCapture = new EventCapture(emitter, {
  autoStart: true,           // Start capturing immediately
  maxEvents: 1000,          // Maximum events to keep in memory
  filterTypes: [            // Only capture specific event types
    'approval:required',
    'approval:granted',
    'task:started'
  ]
});
```

### Helper Functions

#### `createEventCapture(emitter, options)`

Creates an EventCapture instance with sensible defaults:
- `autoStart: true`
- `maxEvents: 500`

#### `createConfirmationEventCapture(emitter, options)`

Creates an EventCapture that only captures confirmation-related events:
- All approval events (`approval:*`)
- All gate events (`gate:*`)
- All permission events (`permission:*`)
- Dangerous operation events (`dangerous:*`)

### Supported Confirmation Events

The EventCapture supports all APEX confirmation-related events:

- `approval:required` - When approval is needed
- `approval:resolved` - When approval is resolved
- `approval:granted` - When approval is granted
- `approval:denied` - When approval is denied
- `gate:required` - When a gate checkpoint is reached
- `gate:approved` - When a gate is approved
- `gate:rejected` - When a gate is rejected
- `permission:request` - When permission is requested
- `permission:granted` - When permission is granted
- `permission:denied` - When permission is denied
- `dangerous:detected` - When dangerous operation is detected
- `dangerous:confirmed` - When dangerous operation is confirmed
- `dangerous:blocked` - When dangerous operation is blocked

### Testing Best Practices

1. **Always dispose**: Call `eventCapture.dispose()` to clean up listeners
2. **Use specific assertions**: Prefer specific assertion methods over manual checks
3. **Test event sequences**: Verify not just that events occur, but in the right order
4. **Validate event data**: Check that events contain expected data
5. **Use timeouts for async**: Set appropriate timeouts when waiting for events
6. **Reset between tests**: Use `eventCapture.reset()` to clear state between tests

### Example Test Structure

```typescript
describe('Task Approval Flow', () => {
  let orchestrator: ApexOrchestrator;
  let eventCapture: EventCapture;

  beforeEach(() => {
    orchestrator = new ApexOrchestrator();
    eventCapture = createConfirmationEventCapture(orchestrator);
  });

  afterEach(() => {
    eventCapture.dispose();
  });

  it('should require approval for destructive operations', async () => {
    // Setup task with approval gate
    const task = await orchestrator.createTask({
      title: 'Test task',
      workflow: 'destructive-workflow'
    });

    // Execute task
    await orchestrator.executeTask(task.id);

    // Assert on approval flow
    eventCapture.expectEventSequence([
      'task:started',
      'approval:required',
      'task:paused'
    ]);

    // Validate approval event data
    const approvalEvent = eventCapture.getApprovalRequiredEvents()[0];
    eventCapture.expectEventData(approvalEvent, {
      taskId: task.id,
      gateName: 'destructive-operation-gate'
    });
  });

  it('should complete task after approval', async () => {
    // ... test implementation
  });
});
```

## Type Safety

The EventCapture utility is fully typed and integrates with the APEX type system:

```typescript
// Typed event data
const approvalEvent = eventCapture.getLastEventOfType<ApprovalRequiredEventData>('approval:required');
if (approvalEvent) {
  console.log(approvalEvent.data.taskId); // Type-safe access
}

// Typed assertions
eventCapture.expectEventData<ApprovalRequiredEventData>('approval:required', {
  taskId: 'expected-task-id'
});
```