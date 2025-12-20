# ADR-057: DaemonScheduler Capacity Reset Monitoring

## Status
Proposed

## Date
2025-01-20

## Context

The DaemonScheduler currently provides basic time window and capacity threshold management but lacks the ability to:
1. Calculate precise time until the next mode switch (day/night transition)
2. Calculate time until budget reset (midnight)
3. Register callbacks that fire when capacity is restored (either via mode switch or budget reset)

These capabilities are essential for the daemon to proactively notify waiting tasks or UI components when they can resume execution, rather than requiring constant polling.

## Decision

### 1. New Public Methods

Extend `DaemonScheduler` with three new capabilities:

```typescript
/**
 * Calculate milliseconds until the next day/night mode switch
 * Handles edge cases: midnight wraparound, same-day transitions
 */
getTimeUntilModeSwitch(now?: Date): number;

/**
 * Calculate milliseconds until budget resets at midnight
 * Always returns time until next local midnight
 */
getTimeUntilBudgetReset(now?: Date): number;

/**
 * Register a callback to be invoked when capacity is restored
 * Capacity restoration events:
 *   - Mode switch from day to night (higher thresholds)
 *   - Budget reset at midnight
 *   - Capacity drops below threshold (external usage tracking update)
 * Returns an unsubscribe function
 */
onCapacityRestored(callback: CapacityRestoredCallback): () => void;
```

### 2. New Types

```typescript
export type CapacityRestoredReason =
  | 'mode_switch'      // Day/night transition
  | 'budget_reset'     // Midnight budget reset
  | 'usage_decreased'; // External usage update dropped below threshold

export interface CapacityRestoredEvent {
  reason: CapacityRestoredReason;
  previousCapacity: CapacityInfo;
  newCapacity: CapacityInfo;
  timeWindow: TimeWindow;
  timestamp: Date;
}

export type CapacityRestoredCallback = (event: CapacityRestoredEvent) => void;
```

### 3. Implementation Architecture

#### Time Calculation Methods

The time calculation methods are pure functions that don't require state:

```typescript
getTimeUntilModeSwitch(now: Date = new Date()): number {
  const timeWindow = this.getCurrentTimeWindow(now);
  return timeWindow.nextTransition.getTime() - now.getTime();
}

getTimeUntilBudgetReset(now: Date = new Date()): number {
  const nextMidnight = this.getNextMidnight(now);
  return nextMidnight.getTime() - now.getTime();
}
```

#### Callback Registration Pattern

The callback system uses an internal timer-based approach:

```typescript
class DaemonScheduler {
  private capacityCallbacks: Set<CapacityRestoredCallback> = new Set();
  private monitoringTimer?: ReturnType<typeof setTimeout>;
  private lastCapacityState?: { shouldPause: boolean; capacity: CapacityInfo };

  onCapacityRestored(callback: CapacityRestoredCallback): () => void {
    this.capacityCallbacks.add(callback);
    this.ensureMonitoring();

    // Return unsubscribe function
    return () => {
      this.capacityCallbacks.delete(callback);
      if (this.capacityCallbacks.size === 0) {
        this.stopMonitoring();
      }
    };
  }

  private ensureMonitoring(): void {
    if (this.monitoringTimer) return;
    this.scheduleNextCheck();
  }

  private scheduleNextCheck(): void {
    const now = new Date();
    const timeToModeSwitch = this.getTimeUntilModeSwitch(now);
    const timeToBudgetReset = this.getTimeUntilBudgetReset(now);

    // Check at the earlier of: mode switch, budget reset, or periodic (60s)
    const checkIn = Math.min(
      timeToModeSwitch,
      timeToBudgetReset,
      60000 // Fallback check every 60 seconds for usage changes
    );

    this.monitoringTimer = setTimeout(() => {
      this.checkCapacityRestored();
      this.scheduleNextCheck();
    }, Math.max(100, checkIn)); // Minimum 100ms to prevent tight loops
  }
}
```

### 4. Edge Case Handling

#### Midnight Wraparound
When calculating time until mode switch for night hours that span midnight (e.g., [22, 23, 0, 1, 2]):
- Current hour 23, next transition is at hour 9 tomorrow
- Must add 24 hours when the next hour is less than current

```typescript
private getNextModeTransition(now: Date): Date {
  // ... existing logic ...

  // Handle night hours spanning midnight
  if (nightHours.includes(0) && currentHour >= nightHours[nightHours.length - 1]) {
    // We're in night mode near midnight, next transition is day mode start
    const dayStart = Math.min(...dayHours);
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(dayStart, 0, 0, 0);
    return nextDay;
  }
}
```

#### Same-Day Transitions
When day and night modes are on the same calendar day:
- Day: 9-17, Night: 22-06 (next day)
- At 18:00 (off-hours), next mode is night at 22:00

#### Timer Precision
- Use `Math.max(100, timeToEvent)` to prevent scheduling timers < 100ms
- Use `Math.min(timeToEvent, 60000)` to ensure at least one check per minute

### 5. Integration Points

The capacity monitoring integrates with existing components:

```
┌─────────────────────────────────────────────────────────────────┐
│                       EnhancedDaemon                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    DaemonScheduler                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │ │
│  │  │ Time Window  │  │  Capacity    │  │ Callback Registry  │ │ │
│  │  │ Calculator   │  │  Monitor     │  │                    │ │ │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘ │ │
│  │         │                 │                    │             │ │
│  │         v                 v                    v             │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │         Timer-based Event Scheduler                  │   │ │
│  │  │  - Schedule at mode transitions                      │   │ │
│  │  │  - Schedule at midnight                              │   │ │
│  │  │  - Periodic fallback (60s)                          │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              v                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Subscribers (CLI, API, DaemonRunner, IdleProcessor, etc.) │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Resource Management

- **Timer cleanup**: Timers are cleared when last callback unsubscribes or scheduler is destroyed
- **Memory**: Callback Set is bounded by number of subscribers (typically < 10)
- **CPU**: Timers are event-based, not polling (minimal CPU overhead)

### 7. Updated Interface Exports

```typescript
// daemon-scheduler.ts exports
export {
  DaemonScheduler,
  UsageStatsProvider,
  UsageManagerProvider,
  TimeWindow,
  CapacityInfo,
  SchedulingDecision,
  // New exports
  CapacityRestoredReason,
  CapacityRestoredEvent,
  CapacityRestoredCallback,
} from './daemon-scheduler';
```

## Consequences

### Positive
- Enables reactive UI updates when capacity is restored
- Eliminates need for constant polling from consumers
- Time calculations are pure functions, easy to test
- Callback pattern is idiomatic JavaScript/TypeScript

### Negative
- Adds timer management complexity
- Requires careful cleanup to avoid memory leaks
- Callback notifications may have slight delay (up to 100ms)

### Risks
- **Timer drift**: Over long periods, setTimeout can drift; mitigated by re-calculating on each check
- **Callback errors**: One failing callback shouldn't break others; wrap in try-catch
- **Race conditions**: Multiple rapid capacity changes could fire multiple callbacks

## Implementation Notes

### Files to Modify
1. `packages/orchestrator/src/daemon-scheduler.ts` - Add new methods and types
2. `packages/orchestrator/src/daemon-scheduler.test.ts` - Add comprehensive tests
3. `packages/orchestrator/src/index.ts` - Export new types

### Test Cases Required
1. `getTimeUntilModeSwitch` with various times throughout day
2. `getTimeUntilModeSwitch` at midnight boundary
3. `getTimeUntilBudgetReset` at various times
4. Callback registration and unsubscription
5. Callback invocation on mode switch
6. Callback invocation on budget reset
7. Multiple callbacks
8. Cleanup when scheduler destroyed
9. Edge case: disabled time-based usage
10. Edge case: custom hour configurations

### Sample Usage

```typescript
const scheduler = new DaemonScheduler(config, limits, provider);

// Query time until events
const msUntilSwitch = scheduler.getTimeUntilModeSwitch();
const msUntilReset = scheduler.getTimeUntilBudgetReset();

console.log(`Mode switch in ${Math.round(msUntilSwitch / 60000)} minutes`);
console.log(`Budget resets in ${Math.round(msUntilReset / 3600000)} hours`);

// Register for capacity restoration notifications
const unsubscribe = scheduler.onCapacityRestored((event) => {
  console.log(`Capacity restored due to: ${event.reason}`);
  console.log(`New capacity: ${(event.newCapacity.currentPercentage * 100).toFixed(1)}%`);

  // Resume paused tasks
  if (!event.newCapacity.shouldPause) {
    resumePausedTasks();
  }
});

// Later, when done listening
unsubscribe();
```

## References
- Existing `DaemonScheduler` implementation: `packages/orchestrator/src/daemon-scheduler.ts`
- Time-based usage configuration: `packages/core/src/types.ts` (DaemonConfigSchema)
- ADR-053: v0.4.0 Sleepless Mode Architecture
