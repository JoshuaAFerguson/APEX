# Technical Design: event-coordination.e2e.test.ts

## Overview

This document provides the detailed technical design for the `event-coordination.e2e.test.ts` E2E test file that covers event coordination and concurrent operations across the tri-system integration.

## Test File Structure

```typescript
/**
 * Event Coordination E2E Tests
 *
 * Tests comprehensive event coordination and concurrent operations
 * across the Tool System, Permission System, and Browser System.
 *
 * Coverage:
 * 1. Event propagation across all three systems
 * 2. Concurrent operations with permission checks
 * 3. Event ordering validation
 * 4. System state consistency
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTriSystemTestEnvironment,
  createFullAutonomyScenario,
  createSupervisedModeScenario,
  assertTriSystemEventSequence,
  assertCrossSystemEventPropagation,
  assertTriSystemReady,
  assertPermissionEnforced,
  type TriSystemTestEnvironment,
  type SystemEvent,
  type SystemType,
  type CorrelatedEventGroup
} from './test-utils';
```

## Test Categories and Specifications

### 1. Event Propagation Across All Three Systems

#### Test 1.1: Full Lifecycle Event Flow
```typescript
it('should propagate events through complete tool-permission-browser lifecycle', async () => {
  // Setup: Create environment with full event capture
  env = await createTriSystemTestEnvironment({
    eventConfig: { captureAll: true, enableCorrelation: true }
  });

  // Execute: Perform browser operation that requires permission
  const result = await env.toolSystem.executor.executeWithPermissionCheck(
    'Browser',
    'navigate',
    { operation: 'navigate', params: { url: 'https://example.com' } }
  );

  // Verify: Full event sequence
  assertTriSystemEventSequence(env.systemEvents.getAllEvents(), [
    { type: 'permission:requested', system: 'permission' },
    { type: 'permission:granted', system: 'permission' },
    { type: 'tool:execution:start', system: 'tool' },
    { type: 'browser:operation:start', system: 'browser' },
    { type: 'browser:operation:complete', system: 'browser' },
    { type: 'tool:execution:complete', system: 'tool' }
  ]);
});
```

#### Test 1.2: Bidirectional Event Propagation
```typescript
it('should handle bidirectional event propagation between systems', async () => {
  // Browser operation triggers permission check, which triggers tool event
  // Verify events flow in both directions
});
```

#### Test 1.3: Event Correlation Across Systems
```typescript
it('should maintain event correlation across system boundaries', async () => {
  // Execute operation and verify correlation IDs link events
  const correlatedGroups = env.systemEvents.correlatedEvents;
  expect(correlatedGroups.some(g =>
    g.systems.has('tool') &&
    g.systems.has('permission') &&
    g.systems.has('browser')
  )).toBe(true);
});
```

#### Test 1.4: Permission Denial Event Flow
```typescript
it('should propagate permission denial events correctly', async () => {
  // Setup with denied permission
  // Verify denial event sequence
  assertTriSystemEventSequence(events, [
    { type: 'permission:requested', system: 'permission' },
    { type: 'permission:denied', system: 'permission' },
    { type: 'tool:execution:error', system: 'tool' }
  ]);
});
```

#### Test 1.5: Multiple System Event Chains
```typescript
it('should handle chained events across multiple operations', async () => {
  // Execute multiple operations in sequence
  // Verify each creates distinct but correlated event chains
});
```

### 2. Concurrent Operations with Permission Checks

#### Test 2.1: Parallel Permission Requests
```typescript
it('should handle concurrent permission requests without conflicts', async () => {
  // Execute: Multiple permission requests in parallel
  const operations = [
    env.toolSystem.executor.executeWithPermissionCheck('Browser', 'navigate', params1),
    env.toolSystem.executor.executeWithPermissionCheck('Browser', 'click', params2),
    env.toolSystem.executor.executeWithPermissionCheck('Read', 'file', params3),
    env.toolSystem.executor.executeWithPermissionCheck('Write', 'file', params4)
  ];

  const results = await Promise.all(operations);

  // Verify: No race condition artifacts
  results.forEach(result => {
    expect(result).toBeDefined();
    expect(result.metadata).toBeDefined();
  });
});
```

#### Test 2.2: Permission Race with Same Resource
```typescript
it('should handle permission races for the same resource', async () => {
  // Two operations requesting permission for same URL/file
  // Verify allow-once is properly consumed by only one
});
```

#### Test 2.3: Mixed Tool Concurrency
```typescript
it('should handle concurrent operations across different tool types', async () => {
  // Browser + Read + Write + Bash operations in parallel
  // Verify all complete without interference
});
```

#### Test 2.4: High Concurrency Stress Test
```typescript
it('should maintain system stability under high concurrency', async () => {
  const operations = [];
  for (let i = 0; i < 20; i++) {
    operations.push(
      env.toolSystem.executor.executeWithPermissionCheck(
        i % 2 === 0 ? 'Browser' : 'Read',
        'concurrent-op',
        { operation: 'test', params: { id: i } }
      )
    );
  }

  const results = await Promise.allSettled(operations);

  // All operations should resolve (success or failure, but not hang)
  expect(results.every(r => r.status === 'fulfilled' || r.status === 'rejected')).toBe(true);

  // System should remain stable
  assertTriSystemReady(env);
});
```

#### Test 2.5: Permission Grant During Concurrent Operations
```typescript
it('should handle permission grants during concurrent operations', async () => {
  // Start operations that will initially be denied
  // Mid-flight, grant permission
  // Verify subsequent operations pick up new permission
});
```

### 3. Event Ordering Validation

#### Test 3.1: Deterministic Event Sequencing
```typescript
it('should maintain deterministic event ordering across runs', async () => {
  // Execute same operation multiple times
  // Verify event sequence is consistent
  const eventSequences = [];

  for (let run = 0; run < 3; run++) {
    env.systemEvents.cleanup();
    await performStandardOperation();
    eventSequences.push(
      env.systemEvents.getAllEvents().map(e => e.type)
    );
  }

  // All sequences should match
  expect(eventSequences[0]).toEqual(eventSequences[1]);
  expect(eventSequences[1]).toEqual(eventSequences[2]);
});
```

#### Test 3.2: Causal Event Dependencies
```typescript
it('should maintain causal ordering for dependent events', async () => {
  const events = env.systemEvents.getAllEvents();

  // Permission request must precede permission grant/deny
  const requestIdx = events.findIndex(e => e.type === 'permission:requested');
  const grantIdx = events.findIndex(e => e.type === 'permission:granted');

  if (requestIdx !== -1 && grantIdx !== -1) {
    expect(grantIdx).toBeGreaterThan(requestIdx);
  }

  // Tool start must precede tool complete
  const startIdx = events.findIndex(e => e.type === 'tool:execution:start');
  const completeIdx = events.findIndex(e => e.type === 'tool:execution:complete');

  if (startIdx !== -1 && completeIdx !== -1) {
    expect(completeIdx).toBeGreaterThan(startIdx);
  }
});
```

#### Test 3.3: Timestamp Monotonicity
```typescript
it('should maintain monotonic timestamp ordering', async () => {
  await performMultipleOperations();

  const events = env.systemEvents.getAllEvents();
  const timestamps = events.map(e => e.timestamp.getTime());

  // Verify timestamps are non-decreasing
  for (let i = 1; i < timestamps.length; i++) {
    expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
  }
});
```

#### Test 3.4: Cross-System Ordering Constraints
```typescript
it('should maintain logical ordering across system boundaries', async () => {
  // Permission events should precede tool execution events
  // Browser events should be within tool execution span
  const events = env.systemEvents.getAllEvents();

  const permissionGrantTime = events
    .find(e => e.type === 'permission:granted')?.timestamp;
  const toolStartTime = events
    .find(e => e.type === 'tool:execution:start')?.timestamp;

  if (permissionGrantTime && toolStartTime) {
    expect(toolStartTime.getTime()).toBeGreaterThanOrEqual(
      permissionGrantTime.getTime()
    );
  }
});
```

#### Test 3.5: Concurrent Event Interleaving Validation
```typescript
it('should handle event interleaving from concurrent operations correctly', async () => {
  // Execute concurrent operations
  // Verify events from different operations don't corrupt each other
  // Check correlation IDs separate concurrent operation events
});
```

### 4. System State Consistency

#### Test 4.1: Permission State After Concurrent Operations
```typescript
it('should maintain permission state consistency after concurrent operations', async () => {
  // Grant specific permissions
  await env.permissionSystem.manager.grantPermission('Browser', 'allow-always', 'https://test.com');

  // Execute concurrent operations
  const operations = Array.from({ length: 10 }, () =>
    env.toolSystem.executor.executeWithPermissionCheck(
      'Browser', 'navigate',
      { operation: 'navigate', params: { url: 'https://test.com' } }
    )
  );

  await Promise.all(operations);

  // Permission should still be intact
  const permCheck = await env.permissionSystem.manager.checkToolPermission('Browser', {
    scope: 'https://test.com'
  });
  expect(permCheck.allowed).toBe(true);
  expect(permCheck.level).toBe('allow-always');
});
```

#### Test 4.2: Event Count Consistency
```typescript
it('should not lose events during concurrent execution', async () => {
  const operationCount = 10;

  const operations = Array.from({ length: operationCount }, (_, i) =>
    env.toolSystem.executor.execute('Read', { filePath: `/test-${i}.txt` })
  );

  await Promise.all(operations);
  await new Promise(resolve => setTimeout(resolve, 100)); // settling time

  // Should have at least start and complete events for each operation
  const toolEvents = env.systemEvents.getEventsBySystem('tool');
  expect(toolEvents.length).toBeGreaterThanOrEqual(operationCount * 2);
});
```

#### Test 4.3: Correlation Group Integrity
```typescript
it('should maintain complete correlation groups after concurrent operations', async () => {
  await executeConcurrentMixedOperations();

  const correlatedGroups = env.systemEvents.correlatedEvents;

  // Each group should have matching start/complete events
  correlatedGroups.forEach(group => {
    const startEvents = group.events.filter(e => e.type.includes(':start'));
    const completeEvents = group.events.filter(e =>
      e.type.includes(':complete') || e.type.includes(':error')
    );

    // Every start should have a corresponding end
    expect(completeEvents.length).toBeGreaterThanOrEqual(startEvents.length);
  });
});
```

#### Test 4.4: Recovery After Concurrent Failures
```typescript
it('should maintain state consistency after concurrent operation failures', async () => {
  // Set up some operations to fail
  env.toolSystem.mocks.browser.mockImplementation(async (params, idx) => {
    if (idx % 3 === 0) throw new Error('Simulated failure');
    return { success: true, data: {} };
  });

  // Execute concurrent operations (some will fail)
  const operations = Array.from({ length: 10 }, (_, i) =>
    env.toolSystem.executor.execute('Browser', { id: i })
  );

  await Promise.allSettled(operations);

  // System should remain consistent
  assertTriSystemReady(env);

  // Event count should reflect both successes and failures
  const errorEvents = env.systemEvents.getAllEvents()
    .filter(e => e.type.includes(':error'));
  expect(errorEvents.length).toBeGreaterThan(0);
});
```

#### Test 4.5: System Isolation During Concurrent Operations
```typescript
it('should maintain system isolation during concurrent operations', async () => {
  // Browser system failure should not affect tool system
  env.browserSystem.mockPage.goto.mockRejectedValue(new Error('Browser crashed'));

  // Execute mixed operations concurrently
  const browserOp = env.browserSystem.tool.execute({
    operation: 'navigate', params: { url: 'https://fail.com' }
  });

  const readOp = env.toolSystem.executor.execute('Read', { filePath: '/test.txt' });

  const [browserResult, readResult] = await Promise.allSettled([browserOp, readOp]);

  // Browser should fail
  expect((browserResult as PromiseFulfilledResult<any>).value.success).toBe(false);

  // Read should succeed (isolated)
  expect((readResult as PromiseFulfilledResult<any>).value.success).toBe(true);
});
```

## Helper Functions

### New Helper: assertEventOrdering
```typescript
function assertEventOrdering(
  events: SystemEvent[],
  constraints: Array<{ before: string; after: string }>
): void {
  constraints.forEach(({ before, after }) => {
    const beforeIdx = events.findIndex(e => e.type === before);
    const afterIdx = events.findIndex(e => e.type === after);

    if (beforeIdx !== -1 && afterIdx !== -1) {
      expect(afterIdx).toBeGreaterThan(beforeIdx);
    }
  });
}
```

### New Helper: executeConcurrentOperations
```typescript
async function executeConcurrentOperations(
  env: TriSystemTestEnvironment,
  count: number,
  mixTypes: boolean = true
): Promise<Array<{ result: any; type: string }>> {
  const tools: AgentTool[] = mixTypes
    ? ['Browser', 'Read', 'Write', 'Grep']
    : ['Browser'];

  const operations = Array.from({ length: count }, (_, i) => ({
    tool: tools[i % tools.length],
    params: { id: i, operation: 'concurrent-test' }
  }));

  const promises = operations.map(op =>
    env.toolSystem.executor.execute(op.tool, op.params)
      .then(result => ({ result, type: op.tool }))
  );

  return Promise.all(promises);
}
```

### New Helper: captureSystemState
```typescript
interface SystemState {
  toolEventCount: number;
  permissionEventCount: number;
  browserEventCount: number;
  correlationGroupCount: number;
  activePermissions: Set<string>;
}

function captureSystemState(env: TriSystemTestEnvironment): SystemState {
  return {
    toolEventCount: env.systemEvents.toolEvents.length,
    permissionEventCount: env.systemEvents.permissionEvents.length,
    browserEventCount: env.systemEvents.browserEvents.length,
    correlationGroupCount: env.systemEvents.correlatedEvents.length,
    activePermissions: new Set() // Capture current permission state
  };
}
```

## Test Configuration

```typescript
// Standard beforeEach for all tests
beforeEach(async () => {
  env = await createTriSystemTestEnvironment({
    toolConfig: {
      enabledTools: ['Browser', 'Read', 'Write', 'Edit', 'Grep', 'Glob'],
      mockAll: true
    },
    permissionConfig: {
      preset: 'selective',
      defaultLevel: 'allow-always'
    },
    browserConfig: {
      backend: 'mock',
      headless: true
    },
    eventConfig: {
      captureAll: true,
      enableCorrelation: true,
      maxEvents: 1000
    }
  });

  env.systemEvents.start();
});

// Standard afterEach for cleanup
afterEach(async () => {
  if (env) {
    await env.cleanup();
    env = null;
  }
  vi.clearAllMocks();
});
```

## Acceptance Criteria Mapping

| Acceptance Criteria | Test Coverage |
|---------------------|---------------|
| Event propagation across all three systems | Tests 1.1-1.5 |
| Concurrent operations with permission checks | Tests 2.1-2.5 |
| Event ordering validation | Tests 3.1-3.5 |
| System state consistency | Tests 4.1-4.5 |

## Implementation Priority

1. **Phase 1**: Core event propagation tests (1.1, 1.4, 1.3)
2. **Phase 2**: Concurrent operation tests (2.1, 2.3, 2.4)
3. **Phase 3**: Event ordering tests (3.1, 3.2, 3.4)
4. **Phase 4**: State consistency tests (4.1, 4.2, 4.5)
5. **Phase 5**: Edge cases and remaining tests

## Notes for Implementation Stage

1. Use `vi.useFakeTimers()` carefully - may need real timers for concurrent tests
2. Add settling time (50-100ms) after concurrent operations before checking events
3. Use `Promise.allSettled()` for operations that may fail
4. Reset mocks in `afterEach` to prevent test pollution
5. Consider test isolation - each test should be independent
