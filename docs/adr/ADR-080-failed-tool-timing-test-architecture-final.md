# ADR-080: Failed Tool Timing Test Architecture - Final Design

## Status
**Accepted**

## Context

The APEX project requires comprehensive testing of timing data capture for failed tool executions. This includes verifying that `startTime`, `endTime`, and `duration` fields are correctly captured and emitted for tools that fail during execution, regardless of failure mode (timeout, validation, permission denied, network errors, etc.).

This ADR consolidates the architectural decisions made across multiple previous ADRs (ADR-010, ADR-016, ADR-079) and documents the final production-ready test architecture.

## Decision

### Three-Tier Testing Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   Tier 1: Unit Tests (Foundation)                        │
│  Location: tests/failed-tool-timing-events.test.ts                       │
│            tests/failed-tool-timing-edge-cases.test.ts                   │
│  Purpose: Test timing event structure and emission patterns              │
│  Approach: Standalone ToolExecutionSimulator, no external dependencies   │
│  Tests: 26 tests covering basic timing, error types, concurrency, edges  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               Tier 2: Integration Scenario Tests                         │
│  Location: tests/failed-tool-timing-integration-scenarios.test.ts       │
│  Purpose: Test end-to-end timing flow through mock components            │
│  Approach: MockTaskManager + MockEventBroadcaster composition            │
│  Tests: 7 tests covering workflow stages, multi-client, load             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Tier 3: Stress and Edge Case Tests                      │
│  Location: tests/failed-tool-timing-stress-tests.test.ts                │
│  Purpose: Verify timing accuracy under extreme conditions                │
│  Approach: StressToolExecutionSimulator with concurrent operations       │
│  Tests: 10 tests covering high volume, precision, abortion, memory       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│            Package-Level Integration Tests                               │
│  Location: packages/orchestrator/src/__tests__/                          │
│            packages/api/src/__tests__/                                   │
│  Purpose: Test timing in real orchestrator and API WebSocket contexts   │
│  Approach: vi.hoisted() mocks for ESM compatibility                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Timing Data Structure

All timing tests validate against this canonical structure from `@apexcli/orchestrator`:

```typescript
export interface ToolCallCompleteEvent {
  taskId: string;
  toolName: string;
  callId: string;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number; // milliseconds, integer
  };
  timestamp: Date;
}
```

### Test Helper Library

Location: `tests/test-utils/failed-tool-timing-helpers.ts`

Key components:
- `assertFailedToolTiming()` - Validates single event timing
- `assertConcurrentFailedToolTiming()` - Validates multiple concurrent events
- `assertTimingAccuracy()` - Validates duration within tolerance
- `waitForEvents()` - Waits for expected number of events with timeout
- `createFailingToolQueryMock()` - Factory for mock query implementations
- `ErrorTypes` - Constants for consistent error categorization

### Timing Tolerance Strategy

| Environment | Default Tolerance | Extended Tolerance |
|------------|------------------|-------------------|
| Local Dev  | 50ms            | 100ms             |
| CI/CD      | 100ms           | 200ms             |
| Stress     | 100ms           | 300ms             |

Rationale: CI environments have more variability in timing due to shared resources, container overhead, and event loop scheduling.

### Concurrency Testing

The architecture handles concurrent tool failures by:

1. **Independent Timing**: Each tool execution maintains isolated `startTime`/`endTime` tracking
2. **Call ID Correlation**: Use Map-based lookup instead of array index assumptions
3. **Duration Calculation**: `duration = endTime.getTime() - startTime.getTime()`
4. **No Order Guarantees**: Tests do not assume event arrival order matches start order

### Mock Architecture for Package Tests

Using `vi.hoisted()` for ESM-compatible mocking:

```typescript
const { orchestratorInstanceHolder } = vi.hoisted(() => ({
  orchestratorInstanceHolder: { current: null as any },
}));

vi.mock('@apexcli/orchestrator', () => {
  class MockOrchestrator {
    constructor() {
      orchestratorInstanceHolder.current = this;
    }
    simulateFailedToolComplete(...) { ... }
    // ... other methods
  }

  class MockDaemonManager { ... }
  class MockHealthMonitor { ... }

  return {
    ApexOrchestrator: MockOrchestrator,
    DaemonManager: MockDaemonManager,
    HealthMonitor: MockHealthMonitor,
  };
});
```

### Test Timeout Guidelines

| Test Category | Recommended Timeout |
|--------------|-------------------|
| Simple unit tests | Default (5000ms) |
| Tests with delays < 100ms | 10000ms |
| Tests with delays 100-500ms | 15000ms |
| Concurrent operations (20+) | 20000ms |
| Long-running tool tests (1-5s) | Test duration + 5000ms |

## Consequences

### Positive
1. **43 comprehensive tests** covering all timing scenarios
2. **100% passing** on local and CI environments
3. **Reusable test utilities** for future timing tests
4. **Clear separation** between unit and integration layers
5. **No production code changes required**

### Negative
1. Some test setup complexity with ESM mocking
2. Extended test execution time for stress tests (~12s total)

### Risks
1. Mock drift if orchestrator internals change significantly
2. Timing tests may mask performance regressions if tolerances are too generous

## Test Coverage Summary

| Test File | Tests | Focus Areas |
|-----------|-------|-------------|
| `failed-tool-timing-events.test.ts` | 13 | Basic timing, error types, concurrent failures, data consistency |
| `failed-tool-timing-edge-cases.test.ts` | 13 | Clock adjustments, crashes, high load, resource management, ordering |
| `failed-tool-timing-integration-scenarios.test.ts` | 7 | End-to-end flow, retries, multi-client, workflow stages, load |
| `failed-tool-timing-stress-tests.test.ts` | 10 | High volume, precision timing, concurrent stress, abortion, memory |
| **Total** | **43** | |

## Related Documents

- `ADR-010`: Initial failed tool timing test architecture
- `ADR-016`: Mock architecture improvements
- `ADR-079`: Event ordering and duration bound fixes
- `tests/test-utils/failed-tool-timing-helpers.ts`: Helper library
- `packages/orchestrator/src/index.ts`: `ToolCallCompleteEvent` type

## Author
Architecture Agent - APEX Workflow System

## Date
2024
