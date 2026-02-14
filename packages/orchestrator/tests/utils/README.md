# Event and Streaming Test Utilities

This directory contains comprehensive test utilities for capturing, asserting, and testing real-time event streams from the APEX orchestrator.

## EventCapture

The `EventCapture` class provides comprehensive event capture and assertion capabilities specifically designed for testing confirmation-related events in the APEX orchestrator.

## StreamingEventCapture

The `StreamingEventCapture` class extends `EventCapture` with real-time streaming capabilities for testing event streams, performance, and timing requirements.

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

# Streaming Test Utilities

## StreamingEventCapture

Extends `EventCapture` with real-time streaming capabilities for testing event streams, performance, and timing requirements.

### Key Features

- **Real-time Event Streaming**: Capture events with precise timing metadata
- **Performance Testing**: Measure throughput, latency, and consistency
- **Stream Assertions**: Assert on streaming behavior like event ordering, completeness, and timing
- **Scenario Testing**: Run predefined streaming test scenarios
- **Backpressure Handling**: Test behavior under high event loads
- **Integration Ready**: Works alongside existing EventCapture utilities

### Basic Streaming Usage

```typescript
import { createStreamingEventCapture, StreamingTestUtils } from './tests/utils';

describe('Event Streaming Tests', () => {
  let orchestrator: ApexOrchestrator;
  let streamingCapture: StreamingEventCapture;

  beforeEach(() => {
    orchestrator = new ApexOrchestrator();
    streamingCapture = createStreamingEventCapture(orchestrator, {}, {
      maxLatency: 100,
      expectedEventsPerSecond: 50
    });
  });

  afterEach(() => {
    streamingCapture.dispose();
  });

  it('should stream task execution events with low latency', async () => {
    const expectedEvents = [
      'task:started',
      'stage:changed',
      'task:completed'
    ];

    // Start streaming test
    streamingCapture.startStreamingTest(expectedEvents);

    // Execute task (triggers events)
    await orchestrator.executeTask(taskId);

    // Wait for streaming events
    await streamingCapture.waitForStreamingEvents(
      events => events.length === expectedEvents.length,
      2000
    );

    // Get performance metrics
    const metrics = streamingCapture.endStreamingTest();

    // Assert streaming requirements
    const latencyResult = streamingCapture.assertStreamLatency(100);
    expect(latencyResult.passed).toBe(true);

    const orderingResult = streamingCapture.assertStreamOrdering();
    expect(orderingResult.passed).toBe(true);

    // Verify performance
    expect(metrics.maxLatency).toBeLessThanOrEqual(100);
    expect(metrics.outOfOrderEvents).toBe(0);
  });
});
```

### Streaming Scenarios

Pre-built test scenarios for common streaming patterns:

```typescript
// High-throughput scenario
const highThroughputScenario = StreamingTestUtils.createHighThroughputScenario(100, 50);
const result = await streamingCapture.runStreamingScenario(highThroughputScenario);
expect(result.passed).toBe(true);

// Low-latency scenario
const lowLatencyScenario = StreamingTestUtils.createLowLatencyScenario(50);
const result = await streamingCapture.runStreamingScenario(lowLatencyScenario);
expect(result.metrics.maxLatency).toBeLessThanOrEqual(50);

// Mixed event types scenario
const mixedScenario = StreamingTestUtils.createMixedEventScenario();
const result = await streamingCapture.runStreamingScenario(mixedScenario);
```

### Performance Assertions

```typescript
import { StreamingAssertions } from './tests/utils';

// Assert performance requirements
const performanceResults = StreamingAssertions.assertPerformance(metrics, {
  minEventsPerSecond: 100,
  maxLatency: 50,
  maxBackpressure: 5
});

// Assert stream consistency
const consistencyResult = StreamingAssertions.assertConsistency(streamingEvents);
expect(consistencyResult.passed).toBe(true);
```

### Custom Streaming Scenarios

```typescript
const customScenario: StreamTestScenario = {
  name: 'Custom Agent Handoff Test',
  events: [
    { type: 'agent:started', data: { agentId: 'planner' }, delay: 0 },
    { type: 'agent:handoff', data: { from: 'planner', to: 'architect' }, delay: 100 },
    { type: 'agent:started', data: { agentId: 'architect' }, delay: 150 },
    { type: 'agent:completed', data: { agentId: 'architect' }, delay: 300 }
  ],
  expectations: [
    {
      type: 'latency',
      description: 'Handoff latency should be low',
      condition: (metrics) => metrics.averageLatency <= 25
    },
    {
      type: 'completion',
      description: 'All agent events should be captured',
      condition: (metrics) => metrics.totalEvents === 4
    }
  ],
  timeout: 1000
};

const result = await streamingCapture.runStreamingScenario(customScenario);
```

### Streaming Configuration

```typescript
const streamingConfig: StreamingTestConfig = {
  streamTimeout: 10000,           // Max wait time for streaming operations
  expectedEventsPerSecond: 100,   // Expected throughput for performance tests
  maxLatency: 50,                 // Maximum acceptable latency in ms
  strictOrdering: true,           // Whether to enforce strict event ordering
  streamBufferSize: 1000,         // Buffer size for event capture
  concurrencyLevel: 4             // Concurrency level for multi-stream tests
};

const streamingCapture = createStreamingEventCapture(
  orchestrator,
  { maxEvents: 500 },  // EventCapture options
  streamingConfig      // Streaming-specific config
);
```

### Integration with Browser Streaming

For browser-related streaming tests, combine with `BrowserConsoleStream`:

```typescript
import { createConsoleStream } from '../browser-console-stream';

describe('Browser Event Streaming', () => {
  it('should capture browser events alongside orchestrator events', async () => {
    const consoleStream = createConsoleStream();
    const eventCapture = createStreamingEventCapture(orchestrator);

    // Setup browser streaming
    await consoleStream.startStream(page);
    eventCapture.startStreamingTest(['browser:console', 'task:progress']);

    // Browser console stream events can be tested alongside orchestrator events
    consoleStream.on('message', (message) => {
      orchestrator.emit('browser:console', message);
    });

    // ... test browser + orchestrator event coordination
  });
});
```

### Performance Benchmarking

```typescript
describe('Streaming Performance Benchmarks', () => {
  it('should maintain performance under sustained load', async () => {
    const benchmarkScenario = StreamingTestUtils.createHighThroughputScenario(1000, 200);

    const startTime = Date.now();
    const result = await streamingCapture.runStreamingScenario(benchmarkScenario);
    const duration = Date.now() - startTime;

    // Performance assertions
    expect(result.passed).toBe(true);
    expect(result.metrics.eventsPerSecond).toBeGreaterThan(150);
    expect(result.metrics.maxLatency).toBeLessThan(100);
    expect(duration).toBeLessThan(6000); // Should complete within 6 seconds
  });
});
```

## Streaming Utilities Reference

### StreamingEventCapture Methods

- `startStreamingTest(eventTypes)` - Begin streaming test with expected events
- `endStreamingTest()` - End streaming and get final metrics
- `waitForStreamingEvents(criteria, timeout)` - Wait for specific streaming conditions
- `assertStreamLatency(maxLatency)` - Assert latency requirements
- `assertStreamThroughput(minEventsPerSecond)` - Assert throughput requirements
- `assertStreamOrdering()` - Assert event ordering
- `assertStreamCompleteness()` - Assert all expected events captured
- `runStreamingScenario(scenario)` - Execute complete streaming test scenario
- `getStreamingEvents()` - Get events with timing metadata
- `getStreamMetrics()` - Get performance metrics

### StreamingTestUtils

- `createHighThroughputScenario(eventCount, eventsPerSecond)` - High-volume streaming test
- `createLowLatencyScenario(maxLatency)` - Low-latency streaming test
- `createMixedEventScenario()` - Multi-event-type streaming test

### StreamingAssertions

- `assertPerformance(metrics, requirements)` - Comprehensive performance assertions
- `assertConsistency(events)` - Stream consistency validation

## Testing Best Practices for Streaming

1. **Use Appropriate Timeouts**: Set realistic timeouts based on expected event rates
2. **Test Under Load**: Include high-throughput scenarios to test backpressure handling
3. **Verify Ordering**: Ensure events maintain correct sequence under concurrent loads
4. **Monitor Performance**: Include latency and throughput assertions in CI/CD
5. **Test Error Recovery**: Verify streaming continues after errors
6. **Combine with Integration Tests**: Use streaming utilities in end-to-end scenarios

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