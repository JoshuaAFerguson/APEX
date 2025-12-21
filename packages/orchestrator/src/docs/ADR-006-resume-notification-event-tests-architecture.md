# ADR-006: Resume Notification Event Tests Architecture

## Status
**Approved** - Architecture verification completed

## Context

This ADR documents the technical design and architecture for unit tests verifying resume notification events. The task is to ensure comprehensive test coverage for:

1. `tasks:auto-resumed` event includes `resumeReason` and `contextSummary` fields
2. `task:session-resumed` is emitted for each resumed task
3. Session limit recovery triggers appropriate resume events
4. Events are correctly forwarded through EnhancedDaemon

## Analysis Summary

After comprehensive codebase analysis, **extensive test coverage already exists** for all acceptance criteria. This ADR serves as architectural documentation of the existing test infrastructure and identifies any gaps.

## Existing Test Architecture

### 1. Event Interface Definitions

**Location**: `packages/orchestrator/src/index.ts` (Lines 51-114)

Two primary event types are defined:

```typescript
// TasksAutoResumedEvent (Lines 90-102)
interface TasksAutoResumedEvent {
  reason: string;              // Capacity restoration reason
  totalTasks: number;          // Total paused tasks found
  resumedCount: number;        // Successfully resumed count
  errors: Array<{taskId: string; error: string}>;
  timestamp: Date;
  resumeReason?: string;       // v0.4.0 enhancement
  contextSummary?: string;     // v0.4.0 enhancement
}

// TaskSessionResumedEvent (Lines 107-114)
interface TaskSessionResumedEvent {
  taskId: string;
  resumeReason: string;        // 'checkpoint_restore' | 'manual_resume' | 'auto_resume' | etc.
  contextSummary: string;
  previousStatus: TaskStatus;
  sessionData: TaskSessionData;
  timestamp: Date;
}
```

### 2. Event Emission Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Data Flow                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CapacityMonitor ──┬──> 'capacity:restored'                     │
│                    │                                             │
│                    v                                             │
│  DaemonRunner.handleCapacityRestored()                          │
│       │                                                          │
│       ├── For each task:                                        │
│       │       └── orchestrator.emit('task:session-resumed')     │
│       │                                                          │
│       └── Final aggregate:                                       │
│               └── orchestrator.emit('tasks:auto-resumed')       │
│                        │                                         │
│                        v                                         │
│  ApexOrchestrator (EventEmitter<OrchestratorEvents>)            │
│       │                                                          │
│       v (via setupEventHandlers in enhanced-daemon.ts)          │
│  EnhancedDaemon (EventEmitter<EnhancedDaemonEvents>)            │
│       │                                                          │
│       └── External consumers                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Existing Test Coverage Matrix

| AC# | Acceptance Criteria | Test File(s) | Status |
|-----|---------------------|--------------|--------|
| 1 | `tasks:auto-resumed` includes `resumeReason` and `contextSummary` | `tasks-auto-resumed-event.test.ts` (429 lines), `tasks-auto-resumed-event.integration.test.ts` | ✅ Complete |
| 2 | `task:session-resumed` is emitted for each resumed task | `task-session-resumed-event.test.ts` (757 lines), `task-session-resumed-event.integration.test.ts`, `task-session-resumed-event-coverage.test.ts` | ✅ Complete |
| 3 | Session limit recovery triggers appropriate resume events | `runner.enhanced-resume-events.test.ts`, `runner.enhanced-resume-events.edge-cases.test.ts`, `runner.auto-resume.test.ts`, `daemon-auto-resume.integration.test.ts` | ✅ Complete |
| 4 | Events correctly forwarded through EnhancedDaemon | `enhanced-daemon-task-session-resumed-forwarding.test.ts` (620 lines), `enhanced-daemon-events-integration.test.ts` | ✅ Complete |

## Test File Architecture

### Unit Tests Structure

```
packages/orchestrator/src/
├── tasks-auto-resumed-event.test.ts
│   ├── Interface Type Validation
│   │   ├── Basic event without optional fields
│   │   ├── Event with resumeReason only
│   │   ├── Event with contextSummary only
│   │   ├── Event with both optional fields
│   │   └── Backwards compatibility
│   ├── Real-world Event Scenarios
│   │   ├── Capacity restoration scenarios
│   │   ├── Budget reset scenarios
│   │   └── Mode switch scenarios
│   └── Edge Cases
│       ├── Long content strings
│       ├── Null-like values
│       └── Complex error arrays
│
├── task-session-resumed-event.test.ts
│   ├── Interface Validation
│   │   ├── Required fields presence
│   │   ├── Valid resume reasons
│   │   └── Previous status values
│   ├── Session Data Testing
│   │   ├── Conversation history
│   │   ├── Stage state preservation
│   │   └── Resume point metadata
│   ├── Event Emission Scenarios
│   │   ├── Paused task resumption
│   │   ├── contextSummary accuracy
│   │   └── Session data inclusion
│   └── Edge Cases
│       ├── Large session data
│       ├── Malformed data handling
│       └── Type validation
│
├── enhanced-daemon-task-session-resumed-forwarding.test.ts
│   ├── Event Forwarding Integration
│   │   ├── Single task resume forwarding
│   │   ├── Multiple task resume forwarding
│   │   └── Event integrity verification
│   ├── Multiple Listener Support
│   │   ├── Handler registration
│   │   ├── Handler removal
│   │   └── Event isolation
│   ├── Error Handling
│   │   ├── Throwing handlers
│   │   └── Minimal session data
│   └── Timing and Order
│       ├── Rapid successive resumes
│       ├── Event timestamp accuracy
│       └── Order verification
│
└── runner.enhanced-resume-events.test.ts
    ├── handleCapacityRestored Method
    │   ├── Resume reason generation
    │   ├── Context summary aggregation
    │   └── Individual event emission
    ├── emitTaskSessionResumed Helper
    │   ├── With session data
    │   ├── Without session data
    │   └── Fallback context generation
    └── Integration with CapacityMonitor
        ├── Event subscription
        └── Event propagation
```

### Integration Tests Structure

```
packages/orchestrator/src/
├── tasks-auto-resumed-event.integration.test.ts
│   └── Real orchestrator and daemon runner testing
│
├── task-session-resumed-event.integration.test.ts
│   └── Real orchestrator event emission testing
│
├── daemon-auto-resume.integration.test.ts
│   └── Full auto-resume flow testing
│
├── daemon-auto-resume-scenarios.integration.test.ts
│   └── Real-world scenario testing
│
└── enhanced-daemon-events-integration.test.ts
    └── EnhancedDaemon event interface testing
```

## Test Patterns

### Standard Test Pattern (Vitest)

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('FeatureName', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
    await initializeApex(testDir, { /* config */ });
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Event Emission', () => {
    it('should emit event with correct payload', async () => {
      const eventHandler = vi.fn();
      orchestrator.on('task:session-resumed', eventHandler);

      // Trigger event...

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: expect.any(String),
          resumeReason: expect.any(String),
          contextSummary: expect.any(String),
        })
      );
    });
  });
});
```

### Event Forwarding Test Pattern

```typescript
describe('Event Forwarding', () => {
  it('should forward events from orchestrator to daemon', async () => {
    const eventHandler = vi.fn();
    enhancedDaemon.on('task:session-resumed', eventHandler);

    // Emit from orchestrator
    orchestrator.emit('task:session-resumed', mockEvent);

    // Verify forwarding
    expect(eventHandler).toHaveBeenCalledWith(mockEvent);
  });
});
```

## Architectural Decisions

### Decision 1: Layered Event Architecture

**Decision**: Use a layered event system where:
- `ApexOrchestrator` is the source of truth for task-related events
- `EnhancedDaemon` forwards events to external consumers
- `DaemonRunner` orchestrates the auto-resume logic and event emission

**Rationale**: Clean separation of concerns allows for:
- Independent testing of each layer
- Flexible event consumption patterns
- Easy extension for new event types

### Decision 2: Rich Event Payloads

**Decision**: Include comprehensive data in event payloads (`resumeReason`, `contextSummary`, `sessionData`)

**Rationale**:
- Enables rich UI/CLI feedback without additional API calls
- Supports debugging and monitoring
- Backwards compatible via optional fields

### Decision 3: Test File Organization

**Decision**: Separate test files by:
- Event type (e.g., `task-session-resumed-event.test.ts`)
- Component (e.g., `enhanced-daemon-task-session-resumed-forwarding.test.ts`)
- Scenario type (unit vs integration)

**Rationale**:
- Clear test ownership
- Easier maintenance
- Focused test execution

### Decision 4: Session Limit Recovery Event Flow

**Decision**: When session limits are recovered:
1. `capacity:restored` event triggers `handleCapacityRestored`
2. Each resumed task emits `task:session-resumed`
3. Aggregate `tasks:auto-resumed` is emitted after all tasks are processed

**Rationale**:
- Fine-grained events for per-task tracking
- Aggregate event for summary reporting
- Consistent event flow regardless of resume trigger

## Test Coverage Verification

### AC1: `tasks:auto-resumed` includes `resumeReason` and `contextSummary`

**Verified by**:
- `tasks-auto-resumed-event.test.ts` lines 26-78 (optional field tests)
- `tasks-auto-resumed-event.integration.test.ts` (real event emission)

### AC2: `task:session-resumed` is emitted for each resumed task

**Verified by**:
- `task-session-resumed-event.test.ts` lines 62-114 (interface tests)
- `runner.enhanced-resume-events.test.ts` (emission tests)
- `task-session-resumed-event.integration.test.ts` (real emission tests)

### AC3: Session limit recovery triggers appropriate resume events

**Verified by**:
- `runner.auto-resume.test.ts` (handleCapacityRestored tests)
- `daemon-auto-resume.integration.test.ts` (full flow tests)
- `runner.enhanced-resume-events.edge-cases.test.ts` (edge cases)

### AC4: Events correctly forwarded through EnhancedDaemon

**Verified by**:
- `enhanced-daemon-task-session-resumed-forwarding.test.ts` (620 lines of forwarding tests)
- `enhanced-daemon-events-integration.test.ts` (interface tests)
- `enhanced-daemon.ts` lines 366-374 (implementation verified)

## Implementation Notes

### Event Forwarding Setup (enhanced-daemon.ts)

```typescript
// Lines 366-374
this.orchestrator.on('tasks:auto-resumed', (event: TasksAutoResumedEvent) => {
  this.emit('tasks:auto-resumed', event);
});

this.orchestrator.on('task:session-resumed', (event: TaskSessionResumedEvent) => {
  this.emit('task:session-resumed', event);
});
```

### Resume Event Emission (runner.ts)

The `handleCapacityRestored` method (as designed in ADR-005):
1. Collects resumed tasks with session data
2. Emits `task:session-resumed` for each individual task
3. Aggregates context and emits `tasks:auto-resumed`

## Conclusion

All acceptance criteria have comprehensive test coverage through:

- **429+ lines** of unit tests for `TasksAutoResumedEvent`
- **757+ lines** of unit tests for `TaskSessionResumedEvent`
- **620+ lines** of tests for EnhancedDaemon event forwarding
- Multiple integration tests covering real-world scenarios

No additional test architecture changes are required. The existing test infrastructure provides complete coverage of resume notification events.

## Files Referenced

| File | Purpose | Lines |
|------|---------|-------|
| `index.ts` | Event interface definitions | 51-114 |
| `enhanced-daemon.ts` | Event forwarding setup | 297-375 |
| `tasks-auto-resumed-event.test.ts` | Unit tests for aggregate event | 429 |
| `task-session-resumed-event.test.ts` | Unit tests for individual event | 757 |
| `enhanced-daemon-task-session-resumed-forwarding.test.ts` | Forwarding tests | 620 |
| `runner.enhanced-resume-events.test.ts` | DaemonRunner event tests | 150+ |
| `daemon-auto-resume.integration.test.ts` | Integration tests | 100+ |

## Next Steps for Implementation Stage

If any gaps are identified during implementation, the developer stage should:

1. Add specific test cases to existing test files
2. Follow the established test patterns documented above
3. Ensure all new tests follow the Vitest framework conventions
4. Maintain test isolation with proper setup/teardown hooks
