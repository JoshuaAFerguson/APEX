# ADR-0005: Auto-Resume Integration Test Architecture

## Status
Accepted

## Context

The auto-resume feature allows paused tasks to automatically resume when capacity is restored. The acceptance criteria require integration tests for four specific scenarios:

1. Resume on day->night mode switch
2. Resume on night->day mode switch
3. Resume at midnight budget reset
4. Resume when capacity naturally drops below threshold

Current test coverage includes:
- `runner.auto-resume.test.ts` - Unit tests with mocked dependencies
- `daemon-auto-resume.integration.test.ts` - Integration tests using manual event emission
- `capacity-monitor.integration.test.ts` - Tests with UsageManager integration

The gap is that existing tests either mock the capacity events or don't fully simulate time-based transitions with actual timer advancement.

## Decision

### Test File Location and Structure

Create a new integration test file:
```
packages/orchestrator/src/auto-resume-scenarios.integration.test.ts
```

This file will contain comprehensive integration tests that:
1. Use Vitest fake timers for time manipulation
2. Create real component instances (TaskStore, DaemonRunner, CapacityMonitor)
3. Simulate time-based events through timer advancement
4. Verify end-to-end auto-resume behavior

### Test Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Test Fixture Setup                                │
├─────────────────────────────────────────────────────────────────────┤
│  - vi.useFakeTimers()                                               │
│  - vi.setSystemTime() - Set initial time context                    │
│  - Create test directory with .apex config                          │
│  - Initialize TaskStore (real SQLite)                               │
│  - Initialize DaemonRunner with CapacityMonitor                     │
│  - Mock only orchestrator.resumePausedTask() to avoid execution     │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Scenario Execution                                │
├─────────────────────────────────────────────────────────────────────┤
│  1. Create paused task(s) with resumable pause reason               │
│  2. Configure time-based usage settings                             │
│  3. Advance time using vi.advanceTimersByTimeAsync()                │
│  4. CapacityMonitor timer fires, checks usage provider              │
│  5. Emits capacity:restored event                                   │
│  6. DaemonRunner.handleCapacityRestored() triggers                  │
│  7. Calls store.getPausedTasksForResume()                          │
│  8. Calls orchestrator.resumePausedTask() for each task            │
│  9. Emits tasks:auto-resumed event                                  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Verification                                      │
├─────────────────────────────────────────────────────────────────────┤
│  - Verify resumePausedTask called with correct taskIds             │
│  - Verify tasks:auto-resumed event emitted                         │
│  - Verify event contains correct reason (mode_switch/budget_reset) │
│  - Verify correct number of tasks resumed                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Integration

```
┌──────────────────┐      ┌───────────────────────┐
│  DaemonRunner    │◄────►│  CapacityMonitor      │
│                  │      │                       │
│  - start()       │      │  - scheduleModeSwitch │
│  - stop()        │      │  - scheduleMidnight   │
│  - handleCapacity│      │  - handleModeSwitch   │
│    Restored()    │      │  - handleMidnight     │
└────────┬─────────┘      └───────────┬───────────┘
         │                            │
         │  capacity:restored         │
         │◄───────────────────────────┘
         │
         ▼
┌──────────────────┐      ┌───────────────────────┐
│  TaskStore       │      │  ApexOrchestrator     │
│                  │      │                       │
│  getPausedTasks  │      │  resumePausedTask()   │
│  ForResume()     │      │  (mocked)             │
└──────────────────┘      └───────────────────────┘
```

### Time Mocking Strategy

For each scenario, set specific times that trigger the expected behavior:

#### Scenario 1: Day -> Night Mode Switch
```typescript
// Initial: 5 PM (17:00) - Day mode
vi.setSystemTime(new Date('2024-01-01T17:00:00Z'));

// Night mode starts at 6 PM (18:00)
// Advance 1 hour + buffer to trigger mode switch
vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1000);
```

#### Scenario 2: Night -> Day Mode Switch
```typescript
// Initial: 5 AM (05:00) - Night mode
vi.setSystemTime(new Date('2024-01-01T05:00:00Z'));

// Day mode starts at 9 AM
// Advance 4 hours + buffer
vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000 + 1000);
```

#### Scenario 3: Midnight Budget Reset
```typescript
// Initial: 11:55 PM (23:55)
vi.setSystemTime(new Date('2024-01-01T23:55:00Z'));

// Advance past midnight
vi.advanceTimersByTimeAsync(6 * 60 * 1000 + 1000);
```

#### Scenario 4: Capacity Drop
```typescript
// Use checkCapacity() method directly
// Simulate usage drop by modifying the usage provider state
capacityMonitor.checkCapacity();
```

### Mock Configuration

```typescript
const mockConfig = {
  version: '1.0',
  agents: {
    'test-agent': {
      description: 'Test agent',
      capabilities: ['test']
    }
  },
  workflows: {
    'test-workflow': {
      name: 'Test workflow',
      stages: ['test']
    }
  },
  daemon: {
    enabled: true,
    pollInterval: 1000,
    logLevel: 'debug'
  },
  limits: {
    maxConcurrentTasks: 2,
    maxTokensPerTask: 10000,
    maxCostPerTask: 1.0,
    dailyBudget: 10.0
  },
  timeBasedUsage: {
    enabled: true,
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    nightModeHours: [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8],
    dayModeThresholds: {
      maxTokensPerTask: 5000,
      maxCostPerTask: 0.5,
      maxConcurrentTasks: 1
    },
    nightModeThresholds: {
      maxTokensPerTask: 20000,
      maxCostPerTask: 2.0,
      maxConcurrentTasks: 3
    }
  }
};
```

### CapacityUsageProvider Implementation

Create a test-specific usage provider that can be dynamically updated:

```typescript
class TestUsageProvider implements CapacityUsageProvider {
  private currentMode: 'day' | 'night' = 'day';
  private activeTasks: number = 0;
  private tokensUsed: number = 0;
  private costSpent: number = 0;

  constructor(private config: DaemonConfig, private limits: LimitsConfig) {}

  setMode(mode: 'day' | 'night'): void {
    this.currentMode = mode;
  }

  setUsage(tokens: number, cost: number, tasks: number): void {
    this.tokensUsed = tokens;
    this.costSpent = cost;
    this.activeTasks = tasks;
  }

  getCurrentUsage(): CapacityUsage {
    const thresholds = this.currentMode === 'day'
      ? this.config.timeBasedUsage.dayModeThresholds
      : this.config.timeBasedUsage.nightModeThresholds;

    return {
      currentTokens: this.tokensUsed,
      currentCost: this.costSpent,
      activeTasks: this.activeTasks,
      maxTokensPerTask: thresholds.maxTokensPerTask,
      maxCostPerTask: thresholds.maxCostPerTask,
      maxConcurrentTasks: thresholds.maxConcurrentTasks,
      dailyBudget: this.limits.dailyBudget,
      dailySpent: this.costSpent
    };
  }

  getModeInfo(): ModeInfo {
    // Calculate next mode switch based on current time and config
    // ... implementation
  }

  getThresholds(): CapacityThresholds {
    // Return thresholds for monitoring
    // ... implementation
  }
}
```

### Test Cases

```typescript
describe('Auto-Resume Scenario Integration Tests', () => {
  describe('Mode Switch Auto-Resume', () => {
    it('should auto-resume paused tasks when switching from day to night mode');
    it('should auto-resume paused tasks when switching from night to day mode');
    it('should handle mode switch with no paused tasks');
    it('should resume multiple tasks in priority order on mode switch');
  });

  describe('Budget Reset Auto-Resume', () => {
    it('should auto-resume paused tasks at midnight budget reset');
    it('should handle budget reset with no paused tasks');
    it('should correctly set dailySpent to 0 after reset');
  });

  describe('Capacity Drop Auto-Resume', () => {
    it('should auto-resume when active tasks drop');
    it('should auto-resume when token usage drops below threshold');
    it('should auto-resume when cost drops below threshold');
    it('should not emit event when drop is insignificant');
  });

  describe('Edge Cases', () => {
    it('should handle concurrent capacity restored events');
    it('should respect resumeAfter dates during auto-resume');
    it('should not resume tasks with non-resumable pause reasons');
    it('should handle partial failures gracefully');
  });
});
```

### Key Implementation Details

1. **Timer Buffer**: CapacityMonitor adds a 1-second buffer (`TIMER_BUFFER_MS`) to scheduled timers. Tests must account for this.

2. **Async Timer Advancement**: Use `vi.advanceTimersByTimeAsync()` instead of `vi.advanceTimersByTime()` to properly handle async event handlers.

3. **Event Listener Setup**: Register event listeners before starting the daemon to capture all events.

4. **Mock Isolation**: Only mock `orchestrator.resumePausedTask()` to prevent actual task execution while testing the flow.

5. **Cleanup**: Ensure proper cleanup in afterEach:
   - Stop DaemonRunner
   - Close TaskStore
   - Restore real timers
   - Remove test directories

## Consequences

### Positive
- Comprehensive coverage of all auto-resume trigger scenarios
- Time-based testing validates timer scheduling logic
- Real component integration catches issues mocks would miss
- Clear separation between unit tests (mocked) and integration tests (real components)

### Negative
- Integration tests are slower than unit tests
- Fake timers can be tricky to debug
- Additional test maintenance as components evolve

### Neutral
- Follows existing test patterns in the codebase
- Uses same tooling (Vitest) and conventions

## References

- Existing tests: `daemon-auto-resume.integration.test.ts`, `capacity-monitor.integration.test.ts`
- CapacityMonitor implementation: `packages/orchestrator/src/capacity-monitor.ts`
- DaemonRunner implementation: `packages/orchestrator/src/runner.ts`
- Vitest Fake Timers: https://vitest.dev/guide/mocking.html#timers
