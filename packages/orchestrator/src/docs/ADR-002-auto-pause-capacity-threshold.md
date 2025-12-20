# ADR-002: Auto-Pause Logic for Capacity Threshold Integration

## Status
**Proposed**

## Context

The APEX daemon needs to automatically pause task processing when the daily budget capacity threshold is reached. The thresholds are:
- **Day mode**: 90% of daily budget (configurable via `dayModeCapacityThreshold`)
- **Night mode**: 96% of daily budget (configurable via `nightModeCapacityThreshold`)

Currently:
1. **DaemonScheduler** (`daemon-scheduler.ts`) implements the core threshold logic via `shouldPauseTasks()` method
2. **DaemonRunner** (`runner.ts`) polls for tasks and executes them but only checks concurrent task slots
3. **EnhancedDaemon** (`enhanced-daemon.ts`) coordinates all daemon components but doesn't integrate DaemonScheduler
4. **ApexOrchestrator** has pause/resume infrastructure (`pauseTask()`, `resumePausedTask()`)

The gap: DaemonScheduler's capacity-based pause decisions are not connected to DaemonRunner's polling loop.

## Decision

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EnhancedDaemon                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │  UsageManager   │  │  DaemonScheduler │  │       DaemonRunner          │ │
│  │                 │──│                  │──│                             │ │
│  │ trackTaskStart()│  │shouldPauseTasks()│  │ poll() [INTEGRATION POINT]  │ │
│  │ getUsageStats() │  │  getUsageStats() │  │ - Check scheduler decision  │ │
│  └─────────────────┘  └──────────────────┘  │ - Emit events on state      │ │
│           │                    │            │   change                     │ │
│           └────────────────────┼────────────│ - Log capacity info          │ │
│                                │            └─────────────────────────────┘ │
│                                │                        │                    │
│                       UsageManagerProvider              │                    │
│                       (adapter)                         ▼                    │
│                                              ┌─────────────────────────────┐ │
│                                              │   Event Bus                 │ │
│                                              │ 'daemon:capacity-paused'    │ │
│                                              │ 'daemon:capacity-resumed'   │ │
│                                              └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. DaemonRunner Modifications

**File**: `packages/orchestrator/src/runner.ts`

Add DaemonScheduler as a dependency:

```typescript
interface DaemonRunnerOptions {
  // ... existing options
  scheduler?: DaemonScheduler;  // Optional for backward compatibility
}
```

Modify `poll()` method to check capacity before fetching tasks:

```typescript
private async poll(): Promise<void> {
  // ... existing shutdown check

  // NEW: Check capacity threshold before processing
  if (this.scheduler) {
    const decision = this.scheduler.shouldPauseTasks();

    if (decision.shouldPause) {
      // State transition: running -> paused
      if (!this.isPausedByCapacity) {
        this.isPausedByCapacity = true;
        this.log('warn', `Capacity threshold reached: ${decision.reason}`);
        this.emit('daemon:capacity-paused', decision);
      }
      return; // Skip task fetching
    } else if (this.isPausedByCapacity) {
      // State transition: paused -> running
      this.isPausedByCapacity = false;
      this.log('info', 'Capacity restored, resuming task processing');
      this.emit('daemon:capacity-resumed', decision);
    }
  }

  // ... existing concurrent slot check and task fetching
}
```

#### 2. EnhancedDaemon Modifications

**File**: `packages/orchestrator/src/enhanced-daemon.ts`

Initialize DaemonScheduler and inject into DaemonRunner:

```typescript
private initializeComponents(): void {
  // ... existing initialization

  // NEW: Initialize DaemonScheduler with UsageManager adapter
  const usageProvider = new UsageManagerProvider(this.usageManager);
  this.scheduler = new DaemonScheduler(daemonConfig, limitsConfig, usageProvider);

  // Pass scheduler to DaemonRunner
  this.daemonRunner = new DaemonRunner({
    projectPath: this.projectPath,
    config: this.config,
    scheduler: this.scheduler,  // NEW
  });
}
```

Add event handlers for capacity state changes:

```typescript
private setupEventHandlers(): void {
  // ... existing handlers

  // NEW: Capacity threshold events
  this.daemonRunner.on('daemon:capacity-paused', (decision) => {
    this.emit('daemon:capacity-paused', decision);
    this.log('warn', `Task processing paused: ${decision.reason}`);
  });

  this.daemonRunner.on('daemon:capacity-resumed', (decision) => {
    this.emit('daemon:capacity-resumed', decision);
    this.log('info', 'Task processing resumed');
  });
}
```

#### 3. New Events

Add to `EnhancedDaemonEvents` interface:

```typescript
export interface EnhancedDaemonEvents {
  // ... existing events
  'daemon:capacity-paused': (decision: SchedulingDecision) => void;
  'daemon:capacity-resumed': (decision: SchedulingDecision) => void;
}
```

Add to `DaemonRunnerEvents` (new interface):

```typescript
export interface DaemonRunnerEvents {
  'daemon:capacity-paused': (decision: SchedulingDecision) => void;
  'daemon:capacity-resumed': (decision: SchedulingDecision) => void;
}
```

### State Machine

```
                    ┌────────────────┐
                    │     IDLE       │
                    │  (no tasks)    │
                    └───────┬────────┘
                            │ Task queued
                            ▼
        ┌───────────────────────────────────────┐
        │              RUNNING                  │
        │  (actively polling and executing)     │
        └───────────┬───────────────┬───────────┘
                    │               │
    Capacity ≥      │               │ Capacity <
    threshold       │               │ threshold
                    ▼               │
        ┌───────────────────────┐   │
        │   PAUSED_CAPACITY     │   │
        │  (threshold exceeded) │───┘
        │  - Existing tasks     │ Resume when:
        │    continue running   │ - Budget resets
        │  - No new tasks       │ - Time window changes
        │    started            │ - Manual budget increase
        └───────────────────────┘
```

### Key Design Decisions

1. **Existing Tasks Continue**: When capacity threshold is reached, tasks already in progress continue to completion. Only new task starts are blocked.

2. **Scheduler as Optional Dependency**: DaemonRunner accepts scheduler optionally to maintain backward compatibility with existing code that doesn't need capacity checking.

3. **Event-Driven State Changes**: State transitions emit events that can be consumed by CLI/API for user notification.

4. **UsageManagerProvider Adapter**: Bridges UsageManager (which tracks actual usage) with DaemonScheduler (which makes decisions).

5. **Logging Integration**: All capacity-related decisions are logged with appropriate severity levels.

### Metrics Exposure

Add to `DaemonMetrics` interface:

```typescript
interface DaemonMetrics {
  // ... existing metrics
  isPausedByCapacity: boolean;
  capacityPercentage: number;
  capacityThreshold: number;
  lastCapacityCheck?: Date;
}
```

### Configuration

Uses existing configuration from `config.yaml`:

```yaml
daemon:
  timeBasedUsage:
    enabled: true
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17]
    nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6]
    dayModeCapacityThreshold: 0.90   # 90%
    nightModeCapacityThreshold: 0.96 # 96%

limits:
  dailyBudget: 100.0
```

## Alternatives Considered

### 1. Integration in ApexOrchestrator

**Rejected**: Would require orchestrator to be aware of daemon-specific scheduling concerns, violating separation of concerns.

### 2. Polling-Based Capacity Check in EnhancedDaemon

**Rejected**: Would duplicate the polling logic that already exists in DaemonRunner. Better to integrate at the existing poll point.

### 3. Pre-Task Capacity Check Only (Not in Polling Loop)

**Rejected**: Would allow tasks to start during threshold exceeded state if they were queued before the threshold was hit.

## Consequences

### Positive
- Clean separation of concerns: DaemonScheduler makes decisions, DaemonRunner acts on them
- Event-driven architecture enables easy monitoring and alerting
- Backward compatible: existing code without scheduler continues to work
- Testable: Each component can be tested in isolation

### Negative
- Adds coupling between DaemonRunner and DaemonScheduler (mitigated by optional dependency)
- Slight latency in capacity enforcement (up to one poll interval)

### Risks
- If UsageManager stats are stale, capacity decisions may be incorrect
- Mitigation: Ensure UsageManager is updated before scheduler check

## Implementation Plan

### Phase 1: Core Integration (This PR)
1. Add `DaemonRunnerEvents` interface with capacity events
2. Add `scheduler` option to `DaemonRunnerOptions`
3. Modify `poll()` to check scheduler decision
4. Add capacity state tracking (`isPausedByCapacity`)
5. Update `getMetrics()` to include capacity info

### Phase 2: EnhancedDaemon Wiring
1. Initialize DaemonScheduler in `initializeComponents()`
2. Create UsageManagerProvider with UsageManager
3. Pass scheduler to DaemonRunner
4. Add event forwarding for capacity events

### Phase 3: Testing
1. Unit tests for capacity check in poll()
2. Integration tests for full flow
3. Edge case tests (threshold boundaries, time window transitions)

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `runner.ts` | Modify | Add scheduler integration, capacity events |
| `enhanced-daemon.ts` | Modify | Initialize scheduler, wire events |
| `runner.test.ts` | Add/Modify | Unit tests for capacity checking |
| `enhanced-daemon.integration.test.ts` | Modify | Integration tests |

## References

- DaemonScheduler implementation: `packages/orchestrator/src/daemon-scheduler.ts`
- DaemonScheduler documentation: `packages/orchestrator/src/daemon-scheduler.md`
- UsageManager: `packages/orchestrator/src/usage-manager.ts`
- Configuration types: `packages/core/src/types.ts` (lines 158-175)
