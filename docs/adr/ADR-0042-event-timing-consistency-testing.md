# ADR-0042: Event Timing Consistency Testing Architecture

## Status

Accepted

## Context

The APEX system emits events during tool execution lifecycle (start, progress, complete). Ensuring timing consistency between these events is critical for:

1. **Data Integrity**: Ensuring timing values (startTime, endTime, duration) are mathematically consistent
2. **Event Ordering**: Validating chronological order of events across concurrent executions
3. **Isolation**: Confirming timing data doesn't leak between concurrent tool executions
4. **Cross-Event Consistency**: Verifying relationships between paired events (start/complete)

The existing codebase has extensive event testing infrastructure that we will leverage.

## Decision

### Technical Design for Timing Consistency Testing

We will create a focused test file `tests/event-data-integrity/event-timing-consistency.test.ts` that specifically validates timing consistency between events using the existing testing infrastructure.

### Architecture Overview

```
tests/
├── event-data-integrity/
│   ├── shared/
│   │   ├── timing-consistency-utils.ts    # Existing - timing validation utilities
│   │   ├── event-test-utils.ts            # Existing - event validation helpers
│   │   └── mock-event-generators.ts       # Existing - mock event factories
│   ├── cross-event-consistency.test.ts    # Existing - cross-event validation
│   ├── event-field-validation.test.ts     # Existing - field validation
│   └── event-timing-consistency.test.ts   # NEW - focused timing consistency tests
│
├── concurrent-tools/
│   ├── shared/
│   │   ├── timing-isolation-validator.ts  # Existing - isolation validation
│   │   ├── concurrent-event-collector.ts  # Existing - event collection
│   │   └── concurrent-test-scenarios.ts   # Existing - test scenario builder
│   └── timing-isolation/
│       └── timing-events-isolated-between-tools.test.ts  # Existing - isolation tests
│
└── tool-complete-events/
    └── shared/
        ├── orchestrator-test-harness.ts   # Existing - MockOrchestrator
        └── tool-test-fixtures.ts          # Existing - tool configurations
```

### Test Suite Structure

The new `event-timing-consistency.test.ts` will cover:

#### 1. Start/Complete Event Timing Consistency
- Timestamp alignment between start event and complete event's timing.startTime
- Complete event timestamp matches timing.endTime
- Duration calculation consistency (endTime - startTime = duration)

#### 2. Progress Event Timing Consistency
- Progress events fall within [startTime, endTime] window
- Progress events maintain chronological ordering
- Progress timestamps align with start/complete event boundaries

#### 3. Duration Calculation Consistency
- Reported duration matches calculated duration (within tolerance)
- Zero duration handling for instant operations
- Negative duration detection and rejection

#### 4. Chronological Ordering Validation
- Events across tool executions maintain logical ordering
- No temporal paradoxes (complete before start)
- Proper handling of concurrent execution timing

#### 5. Cross-Event Timing Relationships
- Multi-tool workflows maintain timing coherence
- Overlapping execution timing remains isolated
- Sequential execution timing is properly gapped

### Key Interfaces (Existing)

```typescript
// From timing-consistency-utils.ts
interface TimingEvent {
  id: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface TimingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

class EventTimingValidator {
  addEvent(id: string, timestamp: Date, metadata?: Record<string, unknown>): void;
  validateOrdering(): TimingValidationResult;
  getTotalDuration(): number;
}
```

```typescript
// From timing-isolation-validator.ts
interface ToolTimingRecord {
  callId: string;
  toolName: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  captureSequence: number;
  success?: boolean;
}

class TimingIsolationValidator {
  validateTimingBoundaries(): TimingIsolationViolation[];
  validateDurationIndependence(): TimingIsolationViolation[];
  validateTimestampUniqueness(): TimingIsolationViolation[];
  validateNoTimingCrossContamination(): TimingIsolationViolation[];
}
```

### Constants

```typescript
// From timing-consistency-utils.ts
const TIMING_TOLERANCE_MS = 50;           // Standard timing tolerance
const INTEGRATION_TIMING_TOLERANCE_MS = 500;  // Extended for integration tests
const MAX_REASONABLE_DURATION_MS = 5 * 60 * 1000;  // 5 minutes max
const MIN_REASONABLE_DURATION_MS = 1;      // 1ms minimum
```

### Test Implementation Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockOrchestrator,
  createTestOrchestrator,
} from '../tool-complete-events/shared/orchestrator-test-harness';
import {
  EventTimingValidator,
  TIMING_TOLERANCE_MS,
  createEventSequence,
  assertEventOrdering,
} from './shared/timing-consistency-utils';
import {
  createToolEventPair,
  createToolEventSequence,
} from './shared/mock-event-generators';
import { eventAssert } from './shared/event-test-utils';

describe('Event Timing Consistency', () => {
  // Test implementation follows existing patterns
});
```

## Consequences

### Positive

1. **Leverages Existing Infrastructure**: Uses battle-tested utilities (`EventTimingValidator`, `TimingIsolationValidator`, etc.)
2. **Comprehensive Coverage**: Tests all timing-related consistency aspects
3. **Maintainable**: Follows established patterns in the codebase
4. **Well-Documented**: Clear test organization and naming conventions
5. **Isolated**: New test file doesn't modify existing tests

### Negative

1. **Some Overlap**: Minor overlap with existing `cross-event-consistency.test.ts` tests
2. **Dependency Chain**: Relies on shared utilities remaining stable

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Tests become flaky due to timing | Use TIMING_TOLERANCE_MS for fuzzy comparisons |
| Shared utilities change | Tests use stable, well-documented APIs |
| CI environment timing differs | Use relative timing, not absolute |

## Implementation Notes

### File Location
`tests/event-data-integrity/event-timing-consistency.test.ts`

### Dependencies
- `vitest` - Test framework
- Existing shared utilities in `tests/event-data-integrity/shared/`
- Existing shared utilities in `tests/concurrent-tools/shared/`
- Existing shared utilities in `tests/tool-complete-events/shared/`

### Test Categories

1. **Unit Tests**: Pure timing calculation validation
2. **Integration Tests**: Event flow with MockOrchestrator
3. **Edge Case Tests**: Zero duration, cross-day, sub-millisecond precision

## References

- Existing test: `tests/concurrent-tools/timing-isolation/timing-events-isolated-between-tools.test.ts`
- Existing test: `tests/event-data-integrity/cross-event-consistency.test.ts`
- Timing utilities: `tests/event-data-integrity/shared/timing-consistency-utils.ts`
