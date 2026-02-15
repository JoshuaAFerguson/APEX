# Implementation Guide: event-coordination.e2e.test.ts

## Quick Reference

This guide provides the complete specification for implementing the `event-coordination.e2e.test.ts` file.

## File Path
```
tests/e2e/tri-system-integration/event-coordination.e2e.test.ts
```

## Dependencies
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTriSystemTestEnvironment,
  createFullAutonomyScenario,
  createSupervisedModeScenario,
  createPermissionDeniedScenario,
  assertTriSystemEventSequence,
  assertCrossSystemEventPropagation,
  assertTriSystemReady,
  assertPermissionEnforced,
  assertBrowserPermissionRespected,
  type TriSystemTestEnvironment,
  type SystemEvent,
  type SystemType,
  type CorrelatedEventGroup,
  type ToolExecutionResult
} from './test-utils';

import type { AgentTool } from '@apexcli/core';
```

## Test Structure (20 tests total)

### 1. Event Propagation Across All Three Systems (5 tests)
1. `should propagate events through complete tool-permission-browser lifecycle`
2. `should handle bidirectional event propagation between systems`
3. `should maintain event correlation across system boundaries`
4. `should propagate permission denial events correctly`
5. `should handle chained events across multiple operations`

### 2. Concurrent Operations with Permission Checks (5 tests)
1. `should handle concurrent permission requests without conflicts`
2. `should handle permission races for the same resource`
3. `should handle concurrent operations across different tool types`
4. `should maintain system stability under high concurrency`
5. `should handle permission grants during concurrent operations`

### 3. Event Ordering Validation (5 tests)
1. `should maintain deterministic event ordering across runs`
2. `should maintain causal ordering for dependent events`
3. `should maintain monotonic timestamp ordering`
4. `should maintain logical ordering across system boundaries`
5. `should handle event interleaving from concurrent operations correctly`

### 4. System State Consistency (5 tests)
1. `should maintain permission state consistency after concurrent operations`
2. `should not lose events during concurrent execution`
3. `should maintain complete correlation groups after concurrent operations`
4. `should maintain state consistency after concurrent operation failures`
5. `should maintain system isolation during concurrent operations`

## Test Environment Configuration

```typescript
// Standard setup for all tests
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

afterEach(async () => {
  if (env) {
    await env.cleanup();
    env = null;
  }
  vi.clearAllMocks();
});
```

## Key Test Patterns

### Pattern 1: Event Sequence Verification
```typescript
const events = env.systemEvents.getAllEvents();
assertTriSystemEventSequence(events, [
  { type: 'permission:requested', system: 'permission' },
  { type: 'permission:granted', system: 'permission' },
  { type: 'tool:execution:start', system: 'tool' },
  { type: 'tool:execution:complete', system: 'tool' }
]);
```

### Pattern 2: Concurrent Operation Execution
```typescript
const operations = Array.from({ length: 10 }, (_, i) =>
  env.toolSystem.executor.executeWithPermissionCheck(
    'Browser',
    'concurrent-op',
    { operation: 'navigate', params: { url: `https://test-${i}.com` } }
  )
);
const results = await Promise.all(operations);
```

### Pattern 3: Event Ordering Assertion
```typescript
const events = env.systemEvents.getAllEvents();
const requestIdx = events.findIndex(e => e.type === 'permission:requested');
const grantIdx = events.findIndex(e => e.type === 'permission:granted');
expect(grantIdx).toBeGreaterThan(requestIdx);
```

### Pattern 4: State Consistency Check
```typescript
// Capture state before
const permBefore = await env.permissionSystem.manager.checkToolPermission('Browser', {
  scope: 'https://test.com'
});

// Execute concurrent operations
await Promise.all(operations);

// Verify state after
const permAfter = await env.permissionSystem.manager.checkToolPermission('Browser', {
  scope: 'https://test.com'
});
expect(permAfter.level).toBe(permBefore.level);
```

## Helper Functions to Implement

### 1. assertEventOrdering
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

### 2. executeConcurrentOperations
```typescript
async function executeConcurrentOperations(
  env: TriSystemTestEnvironment,
  count: number
): Promise<ToolExecutionResult[]> {
  const tools: AgentTool[] = ['Browser', 'Read', 'Write', 'Grep'];
  const promises = Array.from({ length: count }, (_, i) =>
    env.toolSystem.executor.execute(
      tools[i % tools.length],
      { operation: 'concurrent-test', params: { id: i } }
    )
  );
  return Promise.all(promises);
}
```

## Event Types Reference

### Tool System Events
- `tool:execution:start`
- `tool:execution:complete`
- `tool:execution:error`

### Permission System Events
- `permission:requested`
- `permission:granted`
- `permission:denied`

### Browser System Events
- `browser:operation:start`
- `browser:operation:complete`
- `browser:operation:error`
- `browser:session:created`
- `browser:session:closed`

## Acceptance Criteria Checklist

- [ ] Event propagation across all three systems - 5 tests
- [ ] Concurrent operations with permission checks - 5 tests
- [ ] Event ordering validation - 5 tests
- [ ] System state consistency - 5 tests
- [ ] All tests pass (`npm run test:e2e`)
- [ ] Build passes (`npm run build`)

## Notes for Developer Stage

1. **Async Handling**: Always use `await` for operations and add settling time (~100ms) after concurrent operations
2. **Event Capture**: Start capture before operations with `env.systemEvents.start()`
3. **Cleanup**: Always clean up in `afterEach` to prevent test pollution
4. **Error Handling**: Use `Promise.allSettled()` when operations may fail
5. **Correlation**: Access correlated events via `env.systemEvents.correlatedEvents`
