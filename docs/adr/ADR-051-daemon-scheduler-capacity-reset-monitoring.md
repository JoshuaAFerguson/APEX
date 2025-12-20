# ADR-051: DaemonScheduler Capacity Reset Monitoring

## Status
**Accepted** - Feature fully implemented

## Context

The APEX daemon scheduler manages task execution based on time windows (day/night modes) and capacity thresholds (budget utilization). When capacity thresholds are exceeded, task execution pauses until capacity is restored. The system needed:

1. Methods to query time until capacity restoration events
2. Callback registration for reactive capacity restoration handling
3. Robust handling of edge cases (midnight wraparound, DST, same-day transitions)

## Decision

We implemented capacity reset monitoring directly in the `DaemonScheduler` class with three core capabilities:

### 1. Time Query Methods

```typescript
// Calculate milliseconds until next day/night mode switch
getTimeUntilModeSwitch(now?: Date): number

// Calculate milliseconds until midnight budget reset
getTimeUntilBudgetReset(now?: Date): number
```

**Design Rationale:**
- Return milliseconds for precise timer scheduling
- Accept optional `now` parameter for testability and deterministic behavior
- Leverage existing `getCurrentTimeWindow()` and `getNextMidnight()` private methods

### 2. Callback Registration System

```typescript
type CapacityRestoredReason = 'mode_switch' | 'budget_reset' | 'usage_decreased';

interface CapacityRestoredEvent {
  reason: CapacityRestoredReason;
  previousCapacity: CapacityInfo;
  newCapacity: CapacityInfo;
  timeWindow: TimeWindow;
  timestamp: Date;
}

onCapacityRestored(callback: CapacityRestoredCallback): () => void
```

**Design Rationale:**
- Event-driven pattern allows decoupled consumers
- Returns unsubscribe function for proper cleanup (RAII pattern)
- Three restoration reasons cover all capacity restoration scenarios:
  - `mode_switch`: Day-to-night transition enables higher thresholds
  - `budget_reset`: Midnight resets daily budget
  - `usage_decreased`: External usage tracking update

### 3. Internal Monitoring System

```typescript
private capacityCallbacks: Set<CapacityRestoredCallback>
private monitoringTimer?: ReturnType<typeof setTimeout>
private lastCapacityState?: { shouldPause: boolean; capacity: CapacityInfo; timeWindow: TimeWindow }
```

**Monitoring Strategy:**
- Lazy activation: Timer only runs when callbacks are registered
- Smart scheduling: Next check aligned to earliest of:
  - Time until mode switch
  - Time until budget reset
  - 60-second fallback for usage changes
- State comparison: Detects blocked→unblocked transitions
- Error isolation: Individual callback errors don't break other callbacks

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         DaemonScheduler                              │
├──────────────────────────────────────────────────────────────────────┤
│ Public API                                                           │
│ ├── getTimeUntilModeSwitch(now?)  → number (ms)                     │
│ ├── getTimeUntilBudgetReset(now?) → number (ms)                     │
│ ├── onCapacityRestored(callback)  → unsubscribe function            │
│ └── destroy()                     → cleanup resources               │
├──────────────────────────────────────────────────────────────────────┤
│ Internal Monitoring                                                  │
│ ├── capacityCallbacks: Set<Callback>                                │
│ ├── monitoringTimer?: setTimeout                                    │
│ ├── lastCapacityState?: snapshot                                    │
│ ├── ensureMonitoring()           → start if needed                  │
│ ├── stopMonitoring()             → clear timer                      │
│ ├── scheduleNextCheck()          → smart timer scheduling           │
│ └── checkCapacityRestored()      → state comparison + dispatch      │
├──────────────────────────────────────────────────────────────────────┤
│ Existing Infrastructure (reused)                                     │
│ ├── getCurrentTimeWindow(now)    → TimeWindow                       │
│ ├── getCapacityInfo(window, now) → CapacityInfo                     │
│ ├── getNextModeTransition(now)   → Date                             │
│ └── getNextMidnight(now)         → Date                             │
└──────────────────────────────────────────────────────────────────────┘
```

## Edge Cases Handled

### Time Calculations
| Scenario | Handling |
|----------|----------|
| Midnight wraparound | `getNextMidnight()` uses `setDate(+1)` and `setHours(0,0,0,0)` |
| Year boundary | JavaScript Date handles Dec 31 → Jan 1 automatically |
| Leap year | JavaScript Date handles Feb 28/29 correctly |
| DST transitions | Local time calculations via Date methods |
| Same-day transition | Mode transition finder checks current hour correctly |
| Disabled time-based usage | Falls back to midnight as next "transition" |

### Callback System
| Scenario | Handling |
|----------|----------|
| Callback throws | Try-catch isolates; logs error; continues other callbacks |
| Rapid capacity changes | State captured per check cycle; may miss intermediate states |
| All callbacks removed | Timer automatically stopped |
| Multiple registration | Set prevents duplicates; multiple unsubscribes safe |
| Post-destroy calls | No-op; callbacks cleared |

## Interfaces

### Types (in daemon-scheduler.ts)

```typescript
// Reason for capacity restoration
export type CapacityRestoredReason =
  | 'mode_switch'      // Day/night transition
  | 'budget_reset'     // Midnight budget reset
  | 'usage_decreased'; // External usage update dropped below threshold

// Capacity restoration event details
export interface CapacityRestoredEvent {
  reason: CapacityRestoredReason;
  previousCapacity: CapacityInfo;
  newCapacity: CapacityInfo;
  timeWindow: TimeWindow;
  timestamp: Date;
}

// Callback function signature
export type CapacityRestoredCallback = (event: CapacityRestoredEvent) => void;
```

## Usage Examples

### Querying Time Until Reset

```typescript
const scheduler = new DaemonScheduler(daemonConfig, limitsConfig, usageProvider);

// Get time until next mode switch (for UI display)
const msUntilModeSwitch = scheduler.getTimeUntilModeSwitch();
console.log(`Mode switch in ${Math.floor(msUntilModeSwitch / 60000)} minutes`);

// Get time until budget reset (for scheduling)
const msUntilBudgetReset = scheduler.getTimeUntilBudgetReset();
setTimeout(() => {
  console.log('Budget has reset!');
}, msUntilBudgetReset);
```

### Reactive Capacity Monitoring

```typescript
// Register for capacity restoration events
const unsubscribe = scheduler.onCapacityRestored((event) => {
  console.log(`Capacity restored due to: ${event.reason}`);
  console.log(`Previous: ${event.previousCapacity.currentPercentage * 100}%`);
  console.log(`Current: ${event.newCapacity.currentPercentage * 100}%`);

  // Resume task processing
  taskQueue.resume();
});

// Cleanup when done
process.on('SIGTERM', () => {
  unsubscribe();
  scheduler.destroy();
});
```

## Test Coverage

Comprehensive test coverage in `daemon-scheduler.test.ts`:

### getTimeUntilModeSwitch()
- Day mode to night mode transition
- Midnight wraparound (11:30 PM → 9 AM next day)
- Same-day transition (8 AM → 9 AM)
- Disabled time-based usage (falls back to midnight)
- Default parameter usage

### getTimeUntilBudgetReset()
- Standard midnight calculation
- Year boundary (Dec 31 → Jan 1)
- Leap year handling
- Always positive value assertion

### onCapacityRestored()
- Callback registration and invocation
- Unsubscribe function behavior
- Multiple callback handling
- Mode switch detection
- Usage decrease detection
- Callback error isolation
- Timer cleanup on last unsubscribe

### destroy()
- Resource cleanup
- Safe multiple calls

## Consequences

### Positive
- **Proactive scheduling**: Consumers can schedule work for optimal times
- **Reactive updates**: Callbacks enable immediate response to capacity changes
- **Resource efficiency**: Lazy monitoring only when needed
- **Testability**: All methods accept optional `now` parameter
- **Robustness**: Comprehensive edge case handling

### Negative
- **Polling overhead**: 60-second fallback timer for usage changes
- **State lag**: Monitoring may miss very rapid capacity fluctuations
- **Memory**: Stores last capacity state for comparison

### Neutral
- **Coupling**: Callbacks tightly coupled to DaemonScheduler lifecycle
- **Complexity**: Internal timer management adds code complexity

## Alternatives Considered

### 1. EventEmitter Pattern
**Rejected**: Would require consumers to manually manage event subscriptions; unsubscribe function pattern is more explicit.

### 2. Observable/RxJS Stream
**Rejected**: Adds external dependency; overkill for simple capacity monitoring use case.

### 3. Push-based from UsageProvider
**Rejected**: Would require UsageStatsProvider interface change; current pull-based design is simpler.

## Related ADRs

- ADR-XXX: Time-based Usage Management (v0.4.0 daemon features)
- ADR-XXX: Usage Tracking and Budget Management

## Implementation Files

- `packages/orchestrator/src/daemon-scheduler.ts` - Core implementation
- `packages/orchestrator/src/daemon-scheduler.test.ts` - Comprehensive tests
- `packages/core/src/types.ts` - DaemonConfig schema with timeBasedUsage
