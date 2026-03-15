# ADR: Event Timing Consistency Testing

## Status
Accepted

## Context

The APEX system emits events across multiple categories (tool events, task events, approval events) that all contain timing information. Timing data is critical for:
- Observability and debugging
- Performance monitoring
- Workflow audit trails
- Retry logic validation

Currently, timing tests exist in isolation for specific scenarios (e.g., `failed-tool-timing.test.ts`, `tool-execution-timing.test.ts`). We need a comprehensive test suite that verifies **timing consistency across different event types** to ensure:
1. Timestamps are properly ordered within event sequences
2. Duration calculations are accurate and consistent
3. Timing data survives serialization
4. Cross-event timing relationships are valid

## Decision

Implement a dedicated **Event Timing Consistency Test Suite** that validates timing invariants across all event types (tool, task, approval) with a focus on:

1. **Intra-event timing consistency**: startTime <= endTime, duration = endTime - startTime
2. **Inter-event timing consistency**: Event sequences follow logical time ordering
3. **Cross-type timing consistency**: Related events (e.g., tool events within a task) have coherent timing
4. **Timing data integrity**: Timestamps survive serialization/deserialization

### Architecture

```
tests/event-data-integrity/
├── shared/
│   ├── event-test-utils.ts           # Existing utilities
│   ├── mock-event-generators.ts      # Existing mock factories
│   └── timing-consistency-utils.ts   # NEW: Timing-specific utilities
├── timing-consistency.test.ts         # NEW: Cross-event timing tests
└── ...existing event tests
```

### Technical Design

#### 1. Timing Consistency Utilities

```typescript
// tests/event-data-integrity/shared/timing-consistency-utils.ts

/**
 * Timing tolerance for assertions (accounts for CI variability)
 */
export const TIMING_TOLERANCE_MS = 50;

/**
 * Validates that an event's timing data is internally consistent
 */
export interface TimingData {
  startTime: Date;
  endTime: Date;
  duration: number;
}

export function assertTimingConsistency(timing: TimingData): void;

/**
 * Validates that events follow logical time ordering
 * (event1 happened before event2)
 */
export function assertEventOrdering(
  earlier: { timestamp: Date },
  later: { timestamp: Date }
): void;

/**
 * Validates that nested events have proper timing relationships
 * (child events are within parent event's time bounds)
 */
export function assertNestedTiming(
  parent: { startTime: Date; endTime: Date },
  child: { startTime: Date; endTime: Date }
): void;

/**
 * Cross-event timing validator for related event sequences
 */
export class EventTimingValidator {
  addEvent(eventType: string, timestamp: Date, metadata?: Record<string, unknown>): void;
  validateOrdering(): ValidationResult;
  validateNoGaps(maxGapMs: number): ValidationResult;
  validateNoOverlaps(): ValidationResult;
}
```

#### 2. Test Scenarios

##### 2.1 Tool Event Timing Consistency
```typescript
describe('Tool Event Timing Consistency', () => {
  it('tool:start timestamp < tool:complete timestamp');
  it('tool:complete timing.duration = timing.endTime - timing.startTime');
  it('tool:progress events occur between tool:start and tool:complete');
  it('concurrent tool executions have independent timing');
  it('failed tools have same timing integrity as successful tools');
});
```

##### 2.2 Task Event Timing Consistency
```typescript
describe('Task Event Timing Consistency', () => {
  it('task:created timestamp < task:started timestamp');
  it('task:started timestamp < task:completed timestamp');
  it('task:stage-changed events have progressive timestamps');
  it('task:paused pausedAt timestamp is valid');
  it('nested tool events are within task time bounds');
});
```

##### 2.3 Approval Event Timing Consistency
```typescript
describe('Approval Event Timing Consistency', () => {
  it('approval-required requestedAt < approval-resolved resolvedAt');
  it('timeout resolutions occur after requestedAt + timeoutMinutes');
  it('approval events are within parent task time bounds');
});
```

##### 2.4 Cross-Event Type Timing
```typescript
describe('Cross-Event Timing Consistency', () => {
  it('tool events within a task are bounded by task timestamps');
  it('approval events pause task timing appropriately');
  it('stage transitions have matching tool event timings');
});
```

##### 2.5 Timing Data Serialization
```typescript
describe('Timing Data Serialization', () => {
  it('Date objects survive JSON round-trip');
  it('duration values are preserved exactly');
  it('ISO 8601 timestamps parse correctly');
});
```

#### 3. Implementation Details

##### Event Timing Data Structures

| Event Type | Timing Fields |
|------------|---------------|
| `tool:start` | `timestamp` |
| `tool:progress` | `timestamp` |
| `tool:complete` | `timing: { startTime, endTime, duration }`, `timestamp` |
| `task:created` | `timestamp` |
| `task:started` | `timestamp` |
| `task:stage-changed` | `timestamp` |
| `task:completed` | `duration`, `timestamp` |
| `task:paused` | `pausedAt` |
| `approval-required` | `requestedAt` |
| `approval-resolved` | `resolvedAt` |

##### Timing Invariants

1. **Duration Invariant**: `duration === endTime.getTime() - startTime.getTime()`
2. **Ordering Invariant**: `startTime <= endTime` for any event with both
3. **Sequence Invariant**: Events in a sequence have non-decreasing timestamps
4. **Nesting Invariant**: Child events timestamps are bounded by parent event timestamps
5. **Causality Invariant**: Effect events follow cause events (e.g., `approval-resolved` follows `approval-required`)

##### Mock Event Sequence Generator

```typescript
/**
 * Creates a realistic event sequence with proper timing
 */
export function createEventSequence(options: {
  taskDuration: number;
  toolCount: number;
  includeApproval?: boolean;
  includeFailures?: boolean;
}): EventSequence;
```

## Consequences

### Positive

1. **Comprehensive timing validation** across all event types
2. **Early detection** of timing-related bugs and regressions
3. **Documentation** of timing invariants through tests
4. **Reusable utilities** for timing validation in other tests
5. **Improved confidence** in event data integrity

### Negative

1. Additional test maintenance burden
2. Timing tests can be flaky in CI due to clock variations
3. Mock complexity increases with more event types

### Mitigation

- Use generous tolerances for timing assertions (50ms+)
- Run timing-sensitive tests with retries in CI
- Document timing test requirements clearly

## Test File Structure

```
tests/event-data-integrity/
├── shared/
│   ├── event-test-utils.ts           # Existing
│   ├── mock-event-generators.ts      # Existing
│   └── timing-consistency-utils.ts   # NEW
├── timing-consistency.test.ts         # NEW: Primary timing tests
├── tool-events.test.ts               # Existing (enhanced)
├── task-events.test.ts               # Existing (enhanced)
├── approval-events.test.ts           # Existing (enhanced)
└── README.md                         # Existing (updated)
```

## Integration Points

- **Existing Test Infrastructure**: Uses shared utilities from `tests/event-data-integrity/shared/`
- **Failed Tool Timing Tests**: Complements `packages/orchestrator/src/failed-tool-timing.test.ts`
- **Tool Execution Timing Tests**: Complements `packages/orchestrator/src/tool-execution-timing.test.ts`
- **Event Data Integrity Tests**: Extends existing patterns in `tests/event-data-integrity/`

## Acceptance Criteria

| Criteria | Verification |
|----------|--------------|
| Tool events have consistent timing | Unit tests pass |
| Task events have consistent timing | Unit tests pass |
| Approval events have consistent timing | Unit tests pass |
| Cross-event timing is validated | Integration tests pass |
| Timing survives serialization | Serialization tests pass |
| All tests pass in CI | CI pipeline green |
| No flaky timing tests | <1% flake rate after 100 runs |

## Implementation Priority

1. **Phase 1**: Create timing utilities and tool event tests
2. **Phase 2**: Add task event timing tests
3. **Phase 3**: Add approval event timing tests
4. **Phase 4**: Add cross-event timing tests
5. **Phase 5**: Documentation and cleanup

## Related Documents

- [Event Data Integrity Testing Architecture](./tests/event-data-integrity/README.md)
- [Failed Tool Timing Test Design](./failed-tool-timing-test-design.md)
- [packages/orchestrator/src/failed-tool-timing.test.ts](../packages/orchestrator/src/failed-tool-timing.test.ts)
- [packages/orchestrator/src/tool-execution-timing.test.ts](../packages/orchestrator/src/tool-execution-timing.test.ts)
