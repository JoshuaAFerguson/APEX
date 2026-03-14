# ADR-075: Test Event Ordering with Concurrent Tools

## Status

Proposed

## Context

When multiple tools execute concurrently in APEX, the orchestrator emits `tool:start` and `tool:complete` events. Ensuring correct event ordering is critical for:

1. **UI Consistency**: The CLI and WebSocket clients must display tool execution states correctly
2. **Debugging**: Developers need to trace tool execution flows in logs
3. **Timing Data Integrity**: Duration calculations depend on proper start/end pairing
4. **Concurrent Isolation**: Each tool's events must be independently trackable without cross-contamination

This ADR defines the technical architecture for testing event ordering behavior when multiple tools run concurrently.

## Decision

### 1. Test Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Concurrent Event Ordering Tests                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Test Event Capture Layer                      │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │    │
│  │  │ SequenceTracker │  │ OrderValidator │  │ TimingVerifier │    │    │
│  │  │ - records order │  │ - validates    │  │ - checks timing│    │    │
│  │  │ - tracks callId │  │   per-tool seq │  │ - isolation    │    │    │
│  │  └────────────────┘  └────────────────┘  └────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                      │
│  ┌─────────────────────────────────▼───────────────────────────────┐    │
│  │                   Mock Orchestrator Layer                        │    │
│  │  - Simulates concurrent tool executions                          │    │
│  │  - Emits tool:start, tool:progress, tool:complete events        │    │
│  │  - Configurable timing and failure scenarios                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Core Test Interfaces

```typescript
/**
 * Represents a captured event with sequence tracking
 */
interface ConcurrentEventRecord {
  /** Event type (tool:start, tool:complete, etc.) */
  type: 'tool:start' | 'tool:progress' | 'tool:complete';
  /** Unique call identifier for this tool invocation */
  callId: string;
  /** Tool name being executed */
  toolName: string;
  /** Task ID context */
  taskId: string;
  /** High-resolution timestamp for ordering */
  hrTimestamp: [number, number];
  /** Global sequence number across all events */
  globalSequence: number;
  /** Per-tool sequence number */
  toolSequence: number;
  /** Timing data (for complete events) */
  timing?: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
}

/**
 * Configuration for concurrent tool execution simulation
 */
interface ConcurrentExecutionConfig {
  /** Number of concurrent tools to simulate */
  concurrentCount: number;
  /** Execution time range [min, max] in ms */
  executionTimeRange: [number, number];
  /** Probability of tool failure (0-1) */
  failureProbability?: number;
  /** Whether to emit progress events */
  emitProgress?: boolean;
  /** Stagger start times (ms between starts) */
  staggerDelay?: number;
}

/**
 * Result of concurrent execution analysis
 */
interface ConcurrentExecutionResult {
  /** Total events captured */
  totalEvents: number;
  /** Events grouped by callId */
  eventsByTool: Map<string, ConcurrentEventRecord[]>;
  /** Ordering violations found */
  violations: OrderingViolation[];
  /** Timing anomalies detected */
  timingAnomalies: TimingAnomaly[];
  /** Overall validation status */
  valid: boolean;
}

/**
 * Describes an ordering violation
 */
interface OrderingViolation {
  callId: string;
  expectedOrder: string[];
  actualOrder: string[];
  description: string;
}

/**
 * Describes a timing anomaly
 */
interface TimingAnomaly {
  callId: string;
  type: 'negative_duration' | 'impossible_overlap' | 'timing_mismatch';
  details: string;
}
```

### 3. Test Categories

#### 3.1 Basic Event Sequence Tests
- Verify `tool:start` always precedes `tool:complete` for same callId
- Verify event data integrity (callId, toolName, taskId consistency)
- Verify timing fields are properly populated

#### 3.2 Concurrent Isolation Tests
- Multiple tools start simultaneously
- Tools complete in different order than started
- No event cross-contamination between concurrent tools
- Each tool's events are independently trackable

#### 3.3 Race Condition Tests
- Very rapid tool completions (< 5ms execution)
- Simultaneous starts/completions
- High concurrency stress (10+ concurrent tools)

#### 3.4 Error Handling Tests
- Failed tools still emit proper event sequence
- Mixed success/failure concurrent executions
- Error events include timing data

#### 3.5 Progress Event Tests
- Progress events occur between start and complete
- Progress events have consistent callId
- Progress percentages are properly ordered (0-100)

### 4. Test Implementation Strategy

```typescript
// File: tests/concurrent-tools-event-ordering.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Mock orchestrator for concurrent tool execution testing
 */
class ConcurrentToolTestOrchestrator extends EventEmitter {
  private activeTools = new Map<string, ActiveToolState>();
  private globalSequence = 0;

  async executeToolsConcurrently(
    taskId: string,
    tools: ConcurrentToolConfig[]
  ): Promise<ConcurrentExecutionResult> {
    const events: ConcurrentEventRecord[] = [];
    const toolSequences = new Map<string, number>();

    // Setup event capture
    this.setupEventCapture(events, toolSequences);

    // Start all tools concurrently
    const executions = tools.map(tool =>
      this.simulateToolExecution(taskId, tool)
    );

    await Promise.all(executions);

    // Analyze and return results
    return this.analyzeExecution(events);
  }

  private analyzeExecution(events: ConcurrentEventRecord[]): ConcurrentExecutionResult {
    const eventsByTool = this.groupEventsByTool(events);
    const violations = this.detectOrderingViolations(eventsByTool);
    const timingAnomalies = this.detectTimingAnomalies(eventsByTool);

    return {
      totalEvents: events.length,
      eventsByTool,
      violations,
      timingAnomalies,
      valid: violations.length === 0 && timingAnomalies.length === 0
    };
  }
}

describe('Concurrent Tools Event Ordering', () => {
  describe('Basic Sequence Validation', () => {
    it('should emit start before complete for each concurrent tool', async () => {
      // Test implementation
    });

    it('should maintain correct sequence with varying execution times', async () => {
      // Test implementation
    });
  });

  describe('Concurrent Isolation', () => {
    it('should track events independently for each concurrent tool', async () => {
      // Test implementation
    });

    it('should handle completion order different from start order', async () => {
      // Test implementation
    });
  });

  describe('Race Conditions', () => {
    it('should handle very rapid sequential completions', async () => {
      // Test implementation
    });

    it('should handle simultaneous start events', async () => {
      // Test implementation
    });
  });

  describe('Error Scenarios', () => {
    it('should maintain event ordering when tools fail', async () => {
      // Test implementation
    });

    it('should include timing data in error completion events', async () => {
      // Test implementation
    });
  });
});
```

### 5. Acceptance Criteria

| # | Criterion | Validation Method |
|---|-----------|-------------------|
| AC-1 | Each tool's `tool:start` event must precede its `tool:complete` event | Sequence analysis per callId |
| AC-2 | Concurrent tools have isolated event streams (no cross-contamination) | Event grouping by callId verification |
| AC-3 | All events include consistent callId, toolName, taskId | Data integrity assertions |
| AC-4 | Timing data is accurate within ±50ms tolerance | Duration validation |
| AC-5 | Event ordering is deterministic for same-callId events | Repeated execution consistency |
| AC-6 | Failed tools still emit complete events with error data | Error scenario testing |
| AC-7 | High concurrency (10+ tools) maintains ordering guarantees | Stress testing |

### 6. Test File Structure

```
tests/
├── concurrent-tools-event-ordering.test.ts    # Main test file
└── utils/
    └── concurrent-event-validator.ts          # Validation utilities

packages/orchestrator/tests/utils/
├── concurrent-tool-orchestrator.ts            # Mock orchestrator
└── event-sequence-tracker.ts                  # Sequence tracking
```

### 7. Integration with Existing Test Infrastructure

The tests will leverage:
- **EventCapture** utility from `packages/orchestrator/tests/utils/event-capture.ts`
- **ParallelTestContext** from `packages/orchestrator/src/parallel-test-utils.ts`
- Existing timing test patterns from `tests/timing-consistency-focused.test.ts`
- Event type definitions from `packages/core/src/types.ts`

### 8. Performance Considerations

- Use high-resolution timestamps (`process.hrtime()`) for precise ordering
- Limit stress tests to reasonable concurrency (10-20 tools)
- Use `vi.useFakeTimers()` where appropriate for deterministic testing
- Avoid I/O operations in event capture hot paths

## Consequences

### Positive
- Comprehensive coverage of concurrent event ordering scenarios
- Catches race conditions in event emission
- Validates timing data accuracy
- Ensures UI consistency for concurrent tool displays
- Reusable test infrastructure for future event testing

### Negative
- Additional test execution time for stress scenarios
- Mock orchestrator maintenance overhead
- Potential flakiness in high-concurrency timing tests

### Mitigation
- Use appropriate tolerances for timing assertions
- Implement retry logic for timing-sensitive tests
- Run stress tests in dedicated test suite with extended timeouts

## References

- ADR-060: Tool Call Event Emission from ApexOrchestrator
- ADR-007: Tool Timing Events Streaming
- Existing test: `tests/tool-timing-events-comprehensive.test.ts`
- Existing test: `tests/timing-consistency-focused.test.ts`
- Event types: `packages/core/src/types.ts` (ApexEventType)
