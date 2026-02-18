# ADR: Event Coordination E2E Tests Architecture

## Status
Proposed

## Context

The APEX tri-system integration (Tool System, Permission System, Browser System) requires comprehensive E2E testing for event coordination and concurrent operations. This ADR documents the architectural design for the new `event-coordination.e2e.test.ts` test file.

### Existing Infrastructure Analysis

Based on analysis of the existing test infrastructure:

1. **test-utils.ts** provides:
   - `createTriSystemTestEnvironment()` - Factory for integrated test environments
   - `TriSystemEventCapture` - Cross-system event capture with correlation
   - Assertion helpers: `assertTriSystemEventSequence()`, `assertPermissionEnforced()`, `assertCrossSystemEventPropagation()`
   - Event types: `SystemEvent`, `CorrelatedEventGroup`, `EventExpectation`
   - Scenario factories for common test setups

2. **Existing E2E tests cover**:
   - Basic browser-permission integration (`browser-permission-basic.e2e.test.ts`)
   - Complex permission scenarios (`complex-permission-scenarios.e2e.test.ts`)
   - Error recovery (`error-recovery.e2e.test.ts`)
   - Basic tri-system integration (`tri-system-integration.test.ts`)

3. **Gap Analysis** - The following aspects need dedicated testing:
   - Event propagation timing and ordering across all three systems
   - Concurrent operations with permission checks racing
   - Event ordering validation under stress
   - System state consistency after concurrent operations

## Decision

Create `tests/e2e/tri-system-integration/event-coordination.e2e.test.ts` with the following architectural design:

### Test Suite Structure

```typescript
describe('Event Coordination E2E Tests', () => {
  describe('Event Propagation Across All Three Systems', () => {
    // Tests for cross-system event flow
  });

  describe('Concurrent Operations with Permission Checks', () => {
    // Tests for parallel operation handling
  });

  describe('Event Ordering Validation', () => {
    // Tests for deterministic event sequencing
  });

  describe('System State Consistency', () => {
    // Tests for state coherence after concurrent operations
  });
});
```

### Key Design Patterns

#### 1. Event Propagation Testing Pattern
```typescript
// Emit events in sequence and verify cross-system propagation
await performTriSystemOperation();
await env.systemEvents.expectEventSequence([
  { type: 'permission:requested', system: 'permission' },
  { type: 'tool:execution:start', system: 'tool' },
  { type: 'browser:operation:start', system: 'browser' },
  { type: 'browser:operation:complete', system: 'browser' },
  { type: 'tool:execution:complete', system: 'tool' }
]);
assertCrossSystemEventPropagation(env, 'tool', 'browser', 'tool:execution:complete');
```

#### 2. Concurrent Operations Pattern
```typescript
// Execute multiple operations simultaneously
const operations = [
  env.toolSystem.executor.executeWithPermissionCheck('Browser', 'navigate', params1),
  env.toolSystem.executor.executeWithPermissionCheck('Browser', 'click', params2),
  env.toolSystem.executor.executeWithPermissionCheck('Read', 'file', params3),
];

const results = await Promise.all(operations);

// Verify no race conditions affected permissions
results.forEach(result => {
  expect(result.metadata?.permissionLevel).toBeDefined();
});
```

#### 3. Event Ordering Validation Pattern
```typescript
// Verify deterministic event ordering
const allEvents = env.systemEvents.getAllEvents();
const sortedByTime = [...allEvents].sort((a, b) =>
  a.timestamp.getTime() - b.timestamp.getTime()
);

// Verify logical ordering constraints
const requestIndex = sortedByTime.findIndex(e => e.type === 'permission:requested');
const grantIndex = sortedByTime.findIndex(e => e.type === 'permission:granted');
const execIndex = sortedByTime.findIndex(e => e.type === 'tool:execution:start');

expect(grantIndex).toBeGreaterThan(requestIndex);
expect(execIndex).toBeGreaterThan(grantIndex);
```

#### 4. State Consistency Pattern
```typescript
// Verify system state consistency after concurrent operations
const initialState = captureSystemState(env);

await executeConcurrentOperations(env, 10);

const finalState = captureSystemState(env);

// Verify state invariants
expect(finalState.permissionCount).toBeGreaterThanOrEqual(initialState.permissionCount);
expect(finalState.eventOrder).toBeConsistent();
assertTriSystemReady(env);
```

### Test Categories

#### Category 1: Event Propagation Tests
- **Cross-system event flow**: Verify events flow correctly between tool → permission → browser systems
- **Event correlation**: Verify correlated events maintain proper grouping
- **Bidirectional propagation**: Test events propagating in both directions (browser → tool, tool → browser)
- **Permission cascade events**: Test permission decisions propagating to dependent operations

#### Category 2: Concurrent Operations Tests
- **Parallel tool execution**: Multiple tools executing simultaneously with permission checks
- **Permission race conditions**: Concurrent permission requests for same resource
- **Mixed operation concurrency**: Browser operations + file operations + permission changes
- **High-concurrency stress**: 10+ concurrent operations with tracking

#### Category 3: Event Ordering Tests
- **Deterministic sequencing**: Verify event order is consistent across runs
- **Causal ordering**: Events with causal dependencies maintain order
- **System boundary ordering**: Events across system boundaries maintain logical order
- **Timestamp accuracy**: Event timestamps reflect actual execution order

#### Category 4: State Consistency Tests
- **Permission state preservation**: Permissions remain consistent after concurrent ops
- **Event count consistency**: No events lost during concurrent execution
- **Correlation group integrity**: Event groups remain complete
- **Recovery state validation**: State remains valid after errors during concurrency

### Integration with Existing Infrastructure

The tests will leverage existing utilities:

```typescript
import {
  createTriSystemTestEnvironment,
  assertTriSystemEventSequence,
  assertCrossSystemEventPropagation,
  assertTriSystemReady,
  type TriSystemTestEnvironment,
  type SystemEvent,
  type CorrelatedEventGroup
} from './test-utils';
```

### New Helper Functions to Add

The following helper functions may be added to support these tests:

1. `assertEventOrdering(events, constraints)` - Verify event ordering constraints
2. `executeConcurrentOperations(env, count)` - Execute N operations in parallel
3. `captureSystemState(env)` - Snapshot current system state
4. `assertStateConsistency(before, after)` - Verify state invariants

## Consequences

### Positive
- Comprehensive coverage of event coordination scenarios
- Detection of race conditions and ordering issues
- Validation of system stability under concurrent load
- Reusable patterns for future tri-system tests

### Negative
- Additional test maintenance overhead
- Potential flakiness in timing-sensitive tests (mitigated by proper async handling)
- Increased test execution time for concurrent scenarios

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Timing-dependent test flakiness | Use `expectEventSequence()` with proper timeouts |
| Resource contention | Proper cleanup in `afterEach` hooks |
| False positives in ordering tests | Multiple validation approaches |

## Implementation Notes

1. All tests should use `async/await` properly to avoid race conditions
2. Event capture should start before operations and include settling time
3. Concurrent tests should use `Promise.allSettled()` for resilient handling
4. State consistency checks should include both positive and negative cases

## File Structure

```
tests/e2e/tri-system-integration/
├── test-utils.ts                        # Existing utilities
├── event-coordination.e2e.test.ts       # NEW: Event coordination tests
├── browser-permission-basic.e2e.test.ts # Existing
├── complex-permission-scenarios.e2e.test.ts # Existing
├── error-recovery.e2e.test.ts           # Existing
└── tri-system-integration.test.ts       # Existing
```
