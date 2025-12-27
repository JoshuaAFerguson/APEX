# ADR-0004: HealthMonitor Design

## Status
Accepted

## Context
APEX daemon requires a centralized health monitoring component to:
1. Collect and track process memory usage (`process.memoryUsage()`)
2. Maintain health check history (passed/failed counts)
3. Record restart events for debugging and monitoring
4. Provide a unified `getHealthReport()` method returning `HealthMetrics`
5. Integrate with existing `DaemonRunner` metrics

The types for health metrics already exist in `@apexcli/core` (`HealthMetrics`, `DaemonMemoryUsage`, `DaemonTaskCounts`, `RestartRecord`), but no implementation collects or manages this data.

## Decision

### Class Design

Create `HealthMonitor` class in `packages/orchestrator/src/health-monitor.ts` following the established EventEmitter-based pattern used by `CapacityMonitor`, `UsageManager`, and other orchestrator components.

```typescript
export interface HealthMonitorEvents {
  'health:check:passed': (metrics: HealthMetrics) => void;
  'health:check:failed': (error: Error, metrics: HealthMetrics) => void;
  'health:memory:warning': (usage: DaemonMemoryUsage, thresholdPercent: number) => void;
  'health:restart:recorded': (record: RestartRecord) => void;
}

export interface HealthMonitorOptions {
  /** Optional check interval in ms (default: from DaemonConfig.healthCheck.interval or 30000ms) */
  checkIntervalMs?: number;
  /** Memory warning threshold as percentage of heap (default: 85) */
  memoryWarningThreshold?: number;
  /** Maximum restart records to keep (default: 100) */
  maxRestartHistory?: number;
}

export class HealthMonitor extends EventEmitter<HealthMonitorEvents> {
  constructor(options?: HealthMonitorOptions);

  // Lifecycle
  start(): void;
  stop(): void;

  // Core API
  getHealthReport(): HealthMetrics;
  performHealthCheck(): boolean;

  // Metric Collection
  collectMemoryUsage(): DaemonMemoryUsage;

  // Restart Tracking
  recordRestart(reason: string, exitCode?: number, triggeredByWatchdog?: boolean): void;
  getRestartHistory(): RestartRecord[];
  clearRestartHistory(): void;

  // Integration with DaemonRunner
  updateTaskCounts(counts: Partial<DaemonTaskCounts>): void;
  setStartTime(startedAt: Date): void;
}
```

### Architecture Decisions

#### 1. Standalone Design (No Direct Dependencies)
The `HealthMonitor` is designed as a standalone component that can be used independently or integrated with `DaemonRunner`. This follows the Single Responsibility Principle and makes the class testable in isolation.

```
┌─────────────────────────────────────────────────────────────────┐
│                        DaemonRunner                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     HealthMonitor                            ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐││
│  │  │MemoryTracker │ │HealthChecker│ │ RestartHistoryTracker │││
│  │  └──────────────┘ └──────────────┘ └───────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### 2. EventEmitter Pattern
Following the established pattern in the codebase (CapacityMonitor, UsageManager), HealthMonitor extends EventEmitter to broadcast health-related events. This allows:
- DaemonRunner to react to health warnings
- API/CLI to stream real-time health status
- Logging systems to capture health events

#### 3. Memory Collection Strategy
Use Node.js `process.memoryUsage()` directly, mapping to `DaemonMemoryUsage`:
- `heapUsed` → V8 heap in use
- `heapTotal` → Total V8 heap allocated
- `rss` → Resident Set Size (total process memory)

No external dependencies required.

#### 4. Health Check Implementation
A health check passes if:
1. Process is responsive (can execute code)
2. Memory usage is below critical threshold (optional)
3. No unrecoverable errors detected

Failed checks are tracked with reason for debugging.

#### 5. Restart History Management
- Store restart records in memory (not persisted to SQLite)
- Limit to `maxRestartHistory` entries (default: 100)
- Most recent entries first (LIFO)
- Restart records are provided by caller (DaemonManager/watchdog)

#### 6. Integration Points

**With DaemonRunner:**
```typescript
// In DaemonRunner.start()
this.healthMonitor = new HealthMonitor({
  checkIntervalMs: daemonConfig.healthCheck?.interval,
  memoryWarningThreshold: daemonConfig.healthCheck?.memoryThreshold,
});
this.healthMonitor.setStartTime(this.startedAt);
this.healthMonitor.start();

// After task completion
this.healthMonitor.updateTaskCounts({
  processed: this.tasksProcessed,
  succeeded: this.tasksSucceeded,
  failed: this.tasksFailed,
  active: this.runningTasks.size,
});
```

**With DaemonManager (for restarts):**
```typescript
// When daemon restarts
healthMonitor.recordRestart('crash', exitCode, false);
healthMonitor.recordRestart('oom', undefined, true); // watchdog triggered
```

**With API:**
```typescript
// GET /daemon/health endpoint
app.get('/daemon/health', () => {
  return healthMonitor.getHealthReport();
});
```

### File Structure

```
packages/orchestrator/src/
├── health-monitor.ts     # New file - HealthMonitor implementation
├── runner.ts             # Updated - integrate HealthMonitor
└── index.ts              # Updated - export HealthMonitor
```

### Type Reuse

Reuse existing types from `@apexcli/core`:
- `HealthMetrics` - Main return type for `getHealthReport()`
- `DaemonMemoryUsage` - Memory statistics structure
- `DaemonTaskCounts` - Task processing statistics
- `RestartRecord` - Restart event record

No new types need to be added to core.

## Implementation Details

### getHealthReport() Return Structure

```typescript
{
  uptime: number,              // ms since start
  memoryUsage: {
    heapUsed: number,          // bytes
    heapTotal: number,         // bytes
    rss: number                // bytes
  },
  taskCounts: {
    processed: number,
    succeeded: number,
    failed: number,
    active: number
  },
  lastHealthCheck: Date,
  healthChecksPassed: number,
  healthChecksFailed: number,
  restartHistory: RestartRecord[]
}
```

### Periodic Health Checks

When `start()` is called:
1. Initial health check is performed immediately
2. `setInterval` schedules periodic checks
3. Each check:
   - Collects memory usage
   - Increments passed/failed counter
   - Emits appropriate event
   - Checks memory threshold, emits warning if exceeded

### Thread Safety

JavaScript is single-threaded, so no mutex/lock needed. Timer callbacks are serialized by the event loop.

## Consequences

### Positive
- Centralized health monitoring with consistent API
- Reuses existing type definitions
- Follows established EventEmitter patterns
- Easily testable in isolation
- Minimal integration effort with DaemonRunner

### Negative
- Restart history is in-memory only (lost on process restart)
- Task counts require manual updates from DaemonRunner

### Neutral
- Health check interval configurable but defaults to 30 seconds
- Memory threshold configurable per deployment needs

## Alternatives Considered

### 1. Extend DaemonRunner directly
Rejected because:
- Violates Single Responsibility Principle
- Makes DaemonRunner harder to test
- Mixes concerns (task execution vs health monitoring)

### 2. Store restart history in SQLite
Deferred for future work:
- Current implementation keeps history in memory
- SQLite persistence could be added later without API changes
- Keeps initial implementation simple

### 3. Use external health check library
Rejected because:
- Simple requirements don't justify dependency
- Node.js provides all needed APIs
- Maintains consistency with rest of codebase

## References
- `packages/core/src/types.ts` lines 307-372 (existing HealthMetrics types)
- `packages/orchestrator/src/capacity-monitor.ts` (EventEmitter pattern reference)
- `packages/orchestrator/src/runner.ts` (DaemonMetrics integration point)
