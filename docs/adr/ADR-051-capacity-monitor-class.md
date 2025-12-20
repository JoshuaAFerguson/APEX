# ADR-051: CapacityMonitor Class for Proactive Reset Detection

## Status
Proposed

## Context

The APEX daemon system needs proactive capacity monitoring to detect when budget resets occur (at midnight or mode switches) and resume paused tasks automatically. Currently, the `DaemonScheduler` class contains capacity monitoring functionality mixed with scheduling logic via callback-based `onCapacityRestored()` method.

The acceptance criteria require a **separate `CapacityMonitor` class** that:
1. Uses timers to wake up at mode switches and midnight
2. Detects when capacity drops below threshold
3. Emits `capacity:restored` events with reason (mode_switch, budget_reset, capacity_dropped)

## Decision

We will create a new `CapacityMonitor` class that:

1. **Extracts and extends** the capacity monitoring logic from `DaemonScheduler`
2. **Uses the EventEmitter pattern** (consistent with `EnhancedDaemon`, `ApexOrchestrator`)
3. **Provides typed events** for capacity state changes
4. **Supports multiple listeners** via standard EventEmitter interface
5. **Implements proactive timer-based monitoring** with intelligent scheduling

### Key Design Decisions

#### 1. Event-Based Architecture (vs Callback-Based)

The existing `DaemonScheduler.onCapacityRestored()` uses a callback pattern. The new `CapacityMonitor` will use `eventemitter3` for consistency with the rest of the codebase (`EnhancedDaemon`, `ApexOrchestrator`, etc.).

**Rationale:**
- Consistent with existing codebase patterns
- Supports multiple listeners naturally
- Better TypeScript type inference for event payloads
- Easier testing and mocking

#### 2. Composition Over Inheritance

`CapacityMonitor` will accept a `UsageStatsProvider` interface (already defined in `DaemonScheduler`) and `DaemonConfig`, making it composable and testable.

**Rationale:**
- Maintains loose coupling
- Allows use of existing `UsageManagerProvider` adapter
- Enables easy mocking in tests

#### 3. Timer Scheduling Strategy

The monitor will use intelligent timer scheduling:
- Schedule wake-up at the **minimum** of:
  - Time until next mode switch
  - Time until midnight (budget reset)
  - Configurable periodic interval (default 60s for usage changes)
- Use `setTimeout` (not `setInterval`) to allow dynamic rescheduling

**Rationale:**
- Minimizes CPU/memory usage during quiet periods
- Ensures prompt detection of capacity restoration events
- Handles edge cases (DST, leap seconds) by recalculating on each wake-up

#### 4. Event Types

```typescript
type CapacityEventType =
  | 'capacity:restored'   // Capacity became available
  | 'capacity:exhausted'  // Capacity became unavailable
  | 'capacity:warning';   // Approaching threshold (optional)
```

The primary event is `capacity:restored` with reason:
- `mode_switch`: Day/night transition changed threshold
- `budget_reset`: Midnight budget reset
- `capacity_dropped`: Usage decreased (external update)

#### 5. Separation of Concerns

| Class | Responsibility |
|-------|----------------|
| `DaemonScheduler` | Scheduling decisions, time windows, thresholds |
| `CapacityMonitor` | Proactive monitoring, event emission, timer management |
| `UsageManager` | Usage tracking, stats collection |

`CapacityMonitor` will **depend on** `DaemonScheduler` for capacity calculations but **own** the monitoring lifecycle.

## Consequences

### Positive
- Clear separation of monitoring concerns
- Event-driven architecture enables reactive patterns
- Easy to add new capacity events in the future
- Testable with fake timers and mock providers

### Negative
- Additional class to maintain
- Slight overlap with `DaemonScheduler.onCapacityRestored()` (migration path needed)

### Migration Path
The existing `DaemonScheduler.onCapacityRestored()` callback system will remain for backward compatibility. New consumers should use `CapacityMonitor` events. A future version may deprecate the callback approach.

## Technical Design

### File Location
`packages/orchestrator/src/capacity-monitor.ts`

### Interface Definitions

```typescript
import { EventEmitter } from 'eventemitter3';
import { DaemonConfig, LimitsConfig } from '@apex/core';

// Re-use existing interfaces from daemon-scheduler.ts
import {
  UsageStatsProvider,
  TimeWindow,
  CapacityInfo,
  CapacityRestoredReason,
} from './daemon-scheduler';

/**
 * Capacity restoration event payload
 */
export interface CapacityRestoredEvent {
  reason: CapacityRestoredReason;
  previousCapacity: CapacityInfo;
  newCapacity: CapacityInfo;
  timeWindow: TimeWindow;
  timestamp: Date;
}

/**
 * Events emitted by CapacityMonitor
 */
export interface CapacityMonitorEvents {
  'capacity:restored': (event: CapacityRestoredEvent) => void;
  'capacity:exhausted': (capacity: CapacityInfo, timeWindow: TimeWindow) => void;
  'capacity:warning': (percentage: number, threshold: number) => void;
}

/**
 * Configuration options for CapacityMonitor
 */
export interface CapacityMonitorOptions {
  /** Minimum check interval in milliseconds (default: 60000) */
  minCheckInterval?: number;
  /** Warning threshold as percentage of capacity threshold (default: 0.9) */
  warningThreshold?: number;
  /** Whether to emit warning events (default: false) */
  emitWarnings?: boolean;
}
```

### Class Structure

```typescript
export class CapacityMonitor extends EventEmitter<CapacityMonitorEvents> {
  private config: DaemonConfig;
  private baseLimits: LimitsConfig;
  private usageProvider: UsageStatsProvider;
  private options: Required<CapacityMonitorOptions>;

  // Monitoring state
  private monitoringTimer?: ReturnType<typeof setTimeout>;
  private isMonitoring: boolean = false;
  private lastCapacityState?: {
    shouldPause: boolean;
    capacity: CapacityInfo;
    timeWindow: TimeWindow;
    timestamp: Date;
  };

  constructor(
    config: DaemonConfig,
    baseLimits: LimitsConfig,
    usageProvider: UsageStatsProvider,
    options?: CapacityMonitorOptions
  );

  // Lifecycle
  start(): void;
  stop(): void;
  destroy(): void;

  // State queries
  isActive(): boolean;
  getCurrentCapacity(): CapacityInfo;
  getCurrentTimeWindow(): TimeWindow;

  // Internal methods
  private scheduleNextCheck(): void;
  private checkCapacity(): void;
  private determineRestorationReason(
    previousState: typeof this.lastCapacityState,
    currentTimeWindow: TimeWindow,
    currentTimestamp: Date
  ): CapacityRestoredReason;
  private getTimeUntilModeSwitch(now: Date): number;
  private getTimeUntilBudgetReset(now: Date): number;
}
```

### Integration Points

```typescript
// In enhanced-daemon.ts
import { CapacityMonitor } from './capacity-monitor';

class EnhancedDaemon {
  private capacityMonitor: CapacityMonitor;

  constructor() {
    // Create capacity monitor
    this.capacityMonitor = new CapacityMonitor(
      daemonConfig,
      limitsConfig,
      new UsageManagerProvider(this.usageManager)
    );

    // Forward capacity events
    this.capacityMonitor.on('capacity:restored', (event) => {
      this.emit('capacity:restored', event);
      this.resumePausedTasks(event.reason);
    });
  }

  async start() {
    this.capacityMonitor.start();
  }

  async stop() {
    this.capacityMonitor.stop();
  }
}
```

### Test Strategy

1. **Unit Tests** (`capacity-monitor.test.ts`)
   - Timer scheduling logic
   - Event emission on state changes
   - Reason determination (mode_switch, budget_reset, capacity_dropped)
   - Edge cases (DST, leap year, midnight exactly)

2. **Integration Tests** (`capacity-monitor.integration.test.ts`)
   - Integration with mock UsageStatsProvider
   - Event ordering and timing
   - Multiple listener support

3. **Test Utilities**
   - Use `vi.useFakeTimers()` for timer control
   - Create `MockUsageStatsProvider` (similar to existing `MonitoringMockProvider`)

## Implementation Notes

1. **Reuse from DaemonScheduler**: The capacity calculation logic (`getCapacityInfo`, `getCurrentTimeWindow`) should be reused. Consider extracting to shared utilities or having `CapacityMonitor` delegate to `DaemonScheduler`.

2. **Timer Edge Cases**: Always use `Math.max(100, calculatedDelay)` to prevent tight loops.

3. **Thread Safety**: Node.js is single-threaded, but ensure state updates are atomic within `checkCapacity()`.

4. **Memory Management**: Clear timers on `stop()`/`destroy()` to prevent leaks.

## Related ADRs
- ADR-003: Daemon Event Architecture
- ADR-005: Time-Based Usage Management
