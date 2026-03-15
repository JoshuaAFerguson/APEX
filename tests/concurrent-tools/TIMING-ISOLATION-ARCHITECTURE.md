# Technical Design: Timing Event Isolation Between Tools

## Architecture Decision Record (ADR)

**ADR-2024-TIMING-ISOLATION**

**Status**: Approved
**Date**: 2024
**Deciders**: Architect Agent

---

## Context

When multiple different tools (e.g., ReadTool, GrepTool, BashTool) execute concurrently, their timing events must remain isolated and not interfere with each other. This is critical for:

1. **Accurate performance measurement** - Each tool's duration must be independently tracked
2. **Debugging concurrent issues** - Events must be attributable to specific tool executions
3. **Event ordering validation** - Interleaved events from multiple tools must maintain per-tool consistency

---

## Decision

We will create a comprehensive test suite for timing event isolation using the existing concurrent tools infrastructure, extending it with specialized utilities for timing isolation validation.

### Architecture Overview

```
tests/concurrent-tools/
├── shared/
│   ├── concurrent-event-collector.ts    # ✅ EXISTS - Captures concurrent events
│   ├── ordering-validator.ts            # ✅ EXISTS - Validates event ordering
│   ├── concurrent-test-scenarios.ts     # ✅ EXISTS - Predefined scenarios
│   └── timing-isolation-validator.ts    # 🆕 NEW - Timing isolation specific validation
├── timing-isolation/
│   └── timing-events-isolated-between-tools.test.ts  # 🆕 NEW - Main test file
└── TIMING-ISOLATION-ARCHITECTURE.md     # 🆕 NEW - This document
```

---

## Technical Design

### 1. Timing Isolation Validator (`timing-isolation-validator.ts`)

A new utility module that extends the existing infrastructure with timing isolation-specific validation:

```typescript
/**
 * Timing Isolation Validator
 *
 * Validates that timing events from concurrent tool executions remain properly
 * isolated and do not interfere with each other.
 */

export interface TimingIsolationViolation {
  type: 'timestamp_collision' | 'duration_interference' | 'timing_overlap_error' |
        'cross_contamination' | 'timing_boundary_violation';
  callIds: string[];
  toolNames: string[];
  description: string;
  severity: 'error' | 'warning';
  evidence: {
    expected: unknown;
    actual: unknown;
  };
}

export interface TimingIsolationResult {
  isIsolated: boolean;
  violations: TimingIsolationViolation[];
  stats: {
    toolExecutions: number;
    uniqueTools: number;
    maxConcurrency: number;
    avgDuration: number;
    timingCollisions: number;
  };
}

export interface ToolTimingRecord {
  callId: string;
  toolName: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  captureSequence: number;
}

export class TimingIsolationValidator {
  private timings: Map<string, ToolTimingRecord>;

  /**
   * Validates timing boundaries don't overlap incorrectly
   */
  validateTimingBoundaries(): TimingIsolationViolation[];

  /**
   * Validates each tool's duration is calculated independently
   */
  validateDurationIndependence(): TimingIsolationViolation[];

  /**
   * Validates timestamps are not shared or confused between tools
   */
  validateTimestampUniqueness(): TimingIsolationViolation[];

  /**
   * Validates event sequences don't cross-contaminate timing data
   */
  validateNoTimingCrossContamination(): TimingIsolationViolation[];

  /**
   * Comprehensive isolation validation
   */
  validate(): TimingIsolationResult;
}
```

### 2. Test Categories

The test suite will cover the following scenarios:

#### 2.1 Basic Timing Isolation
- Different tools executing concurrently have independent timing
- Each tool's startTime, endTime, and duration are isolated
- Timing data doesn't leak between concurrent executions

#### 2.2 Multi-Tool Concurrent Execution
- Mix of all 12 supported tools running concurrently
- Each tool type maintains correct timing isolation
- No timing interference regardless of tool combination

#### 2.3 Same Tool Type Concurrent Execution
- Multiple instances of the same tool running concurrently
- Each instance has its own independent timing
- Call IDs properly separate timing data

#### 2.4 Interleaved Start/Complete Patterns
- Tool A starts, Tool B starts, Tool A completes, Tool B completes
- Tool A starts, Tool B starts, Tool B completes, Tool A completes
- Random ordering maintains timing isolation

#### 2.5 High-Frequency Rapid Execution
- Many tools starting in rapid succession
- Near-simultaneous starts don't cause timing conflicts
- Sub-millisecond precision maintained

#### 2.6 Mixed Duration Scenarios
- Short-running tools alongside long-running tools
- Instant (0ms) tools with slow tools
- Variable duration doesn't affect isolation

#### 2.7 Error Conditions
- Failed tools maintain correct timing isolation
- Mixed success/failure doesn't affect timing isolation
- Error timing is isolated from success timing

---

## Implementation Details

### Test Structure

```typescript
// timing-events-isolated-between-tools.test.ts

describe('Timing Events Isolated Between Tools', () => {
  describe('Basic Timing Isolation', () => {
    it('should isolate timing between two different tools executing concurrently');
    it('should maintain independent duration calculations per tool');
    it('should not share timestamps between concurrent tools');
    it('should isolate timing.startTime, timing.endTime, and timing.duration');
  });

  describe('Multi-Tool Concurrent Execution', () => {
    it('should isolate timing when all 12 tools execute concurrently');
    it('should maintain isolation with random subset of tools');
    it('should handle category-mixed tools (file, search, web, execution, ui)');
  });

  describe('Same Tool Type Concurrent Execution', () => {
    it('should isolate timing for 5 concurrent Read tools');
    it('should isolate timing for concurrent Bash commands');
    it('should maintain isolation by callId, not toolName');
  });

  describe('Interleaved Start/Complete Patterns', () => {
    it('should isolate timing with ABAB pattern (start A, start B, complete A, complete B)');
    it('should isolate timing with ABBA pattern (start A, start B, complete B, complete A)');
    it('should isolate timing with random interleaved patterns');
  });

  describe('High-Frequency Rapid Execution', () => {
    it('should isolate timing for 20 rapid concurrent tool starts');
    it('should maintain sub-millisecond timing precision per tool');
    it('should not have timing collisions with 1ms stagger');
  });

  describe('Mixed Duration Scenarios', () => {
    it('should isolate instant tools from slow tools');
    it('should isolate timing when durations vary by 100x');
    it('should handle 0ms duration alongside 5000ms duration');
  });

  describe('Error Condition Timing Isolation', () => {
    it('should isolate failed tool timing from successful tools');
    it('should isolate timing for concurrent failures');
    it('should maintain timing isolation during error recovery workflows');
  });

  describe('Stress Testing', () => {
    it('should maintain isolation with 50 concurrent executions');
    it('should handle rapid fire execution (100 tools, 1ms intervals)');
    it('should maintain isolation under high concurrency load');
  });
});
```

### Key Validation Functions

```typescript
/**
 * Assert that two tool executions have completely isolated timing
 */
function assertTimingIsolation(
  executionA: ToolTimingRecord,
  executionB: ToolTimingRecord
): void {
  // Timing objects should be different instances
  expect(executionA.startTime).not.toBe(executionB.startTime);
  expect(executionA.endTime).not.toBe(executionB.endTime);

  // Durations should be independently calculated
  const durationA = executionA.endTime.getTime() - executionA.startTime.getTime();
  const durationB = executionB.endTime.getTime() - executionB.startTime.getTime();
  expect(executionA.duration).toBe(durationA);
  expect(executionB.duration).toBe(durationB);

  // Call IDs must be unique
  expect(executionA.callId).not.toBe(executionB.callId);
}

/**
 * Assert timing isolation for a set of concurrent executions
 */
function assertBatchTimingIsolation(
  executions: ToolTimingRecord[]
): void {
  // All call IDs unique
  const callIds = new Set(executions.map(e => e.callId));
  expect(callIds.size).toBe(executions.length);

  // Each execution's timing is self-consistent
  executions.forEach(execution => {
    const calculatedDuration =
      execution.endTime.getTime() - execution.startTime.getTime();
    expect(execution.duration).toBe(calculatedDuration);
    expect(execution.endTime.getTime()).toBeGreaterThanOrEqual(
      execution.startTime.getTime()
    );
  });

  // No timing cross-contamination
  for (let i = 0; i < executions.length; i++) {
    for (let j = i + 1; j < executions.length; j++) {
      assertTimingIsolation(executions[i], executions[j]);
    }
  }
}
```

---

## Integration with Existing Infrastructure

### Using ConcurrentEventCollector

```typescript
import { createConcurrentEventCollector } from '../shared/concurrent-event-collector';
import { createOrderingValidator } from '../shared/ordering-validator';
import { ConcurrentScenarios } from '../shared/concurrent-test-scenarios';

describe('Timing Isolation Tests', () => {
  let orchestrator: MockOrchestrator;
  let collector: ConcurrentEventCollector;
  let isolationValidator: TimingIsolationValidator;

  beforeEach(() => {
    orchestrator = createTestOrchestrator();
    collector = createConcurrentEventCollector(orchestrator);
    isolationValidator = new TimingIsolationValidator();
    collector.startCapturing();
  });

  afterEach(() => {
    collector.dispose();
    orchestrator.reset();
  });

  it('validates timing isolation for burst start scenario', async () => {
    // Use existing scenario
    const result = await ConcurrentScenarios.burstStart(
      orchestrator,
      'isolation-test-task'
    );

    // Build timing records from captured events
    const events = collector.getEvents();
    const timingRecords = buildTimingRecords(events);

    // Validate timing isolation
    const isolationResult = isolationValidator.validate(timingRecords);
    expect(isolationResult.isIsolated).toBe(true);
    expect(isolationResult.violations).toHaveLength(0);
  });
});
```

---

## Acceptance Criteria

The test suite must verify:

1. **✓ No Timing Leakage**: Tool A's timing data never appears in Tool B's events
2. **✓ Independent Duration Calculation**: Each tool's duration = its endTime - its startTime
3. **✓ Unique Timestamps**: Each tool execution has its own start/end timestamps
4. **✓ Call ID Isolation**: Timing data is keyed by call ID, not tool name
5. **✓ Concurrent Execution Safety**: Any number of concurrent tools maintain isolation
6. **✓ Order Independence**: Event emission order doesn't affect timing accuracy
7. **✓ Error Isolation**: Failed tools don't corrupt successful tool timing
8. **✓ High-Frequency Safety**: Rapid execution doesn't cause timing conflicts

---

## File Outputs

### New Files to Create

1. **`tests/concurrent-tools/shared/timing-isolation-validator.ts`**
   - TimingIsolationValidator class
   - TimingIsolationViolation interface
   - TimingIsolationResult interface
   - Helper assertion functions

2. **`tests/concurrent-tools/timing-isolation/timing-events-isolated-between-tools.test.ts`**
   - Complete test suite with all categories
   - ~400-500 lines of comprehensive tests
   - Integration with existing infrastructure

---

## Dependencies

### Existing (No Changes Required)
- `tests/concurrent-tools/shared/concurrent-event-collector.ts`
- `tests/concurrent-tools/shared/ordering-validator.ts`
- `tests/concurrent-tools/shared/concurrent-test-scenarios.ts`
- `tests/tool-complete-events/shared/orchestrator-test-harness.ts`
- `tests/tool-complete-events/shared/tool-test-fixtures.ts`
- `tests/event-data-integrity/shared/timing-consistency-utils.ts`

### New (To Be Created)
- `tests/concurrent-tools/shared/timing-isolation-validator.ts`

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Test flakiness due to timing sensitivity | Use tolerances from existing `TIMING_TOLERANCE_MS` constant |
| High test execution time | Use mock orchestrator, not real tool execution |
| False positives in collision detection | Only flag actual value collisions, not temporal proximity |

---

## Implementation Order

1. Create `timing-isolation-validator.ts` utility module
2. Create test file with basic isolation tests
3. Add multi-tool concurrent execution tests
4. Add same-tool concurrent execution tests
5. Add interleaved pattern tests
6. Add high-frequency and stress tests
7. Add error condition tests
8. Verify all tests pass with `npm test`
9. Verify build passes with `npm run build`

---

## Estimated Complexity

- **New utility module**: ~150 lines
- **Test file**: ~450 lines
- **Total new code**: ~600 lines
- **Estimated implementation time**: 1-2 hours
