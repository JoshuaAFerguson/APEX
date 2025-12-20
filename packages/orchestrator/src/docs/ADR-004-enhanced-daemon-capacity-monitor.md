# ADR-004: Wire CapacityMonitor into EnhancedDaemon and Add Events

## Status

**Proposed**

## Context

The **CapacityMonitor** (`packages/orchestrator/src/capacity-monitor.ts`) is a component that proactively monitors capacity and detects when usage drops below thresholds or when capacity is restored due to mode switches or daily resets. It already emits a `capacity:restored` event.

The **DaemonRunner** (`packages/orchestrator/src/runner.ts`) already initializes and uses CapacityMonitor for auto-resume functionality. It:
1. Creates a `CapacityMonitorUsageAdapter` to bridge `UsageManager` with `CapacityMonitor`
2. Subscribes to `capacity:restored` events
3. Handles capacity restoration by resuming paused tasks
4. Emits `tasks:auto-resumed` events through the orchestrator

However, **EnhancedDaemon** (`packages/orchestrator/src/enhanced-daemon.ts`) does NOT currently initialize CapacityMonitor, even though it manages many of the same components (UsageManager, DaemonRunner, etc.). The capacity events are not exposed through the `EnhancedDaemonEvents` interface, limiting CLI/API consumption of these important events.

## Decision

### 1. Add Capacity Events to EnhancedDaemonEvents Interface

Extend the `EnhancedDaemonEvents` interface to include capacity-related events:

```typescript
// File: packages/orchestrator/src/enhanced-daemon.ts

import { CapacityRestoredEvent } from './capacity-monitor';

/**
 * Event payload for tasks:auto-resumed event
 */
export interface TasksAutoResumedEvent {
  reason: string;           // Capacity restoration reason (mode_switch, budget_reset, capacity_dropped)
  totalTasks: number;       // Total paused tasks found
  resumedCount: number;     // Successfully resumed count
  errors: Array<{           // Failed resume attempts
    taskId: string;
    error: string;
  }>;
  timestamp: Date;
}

export interface EnhancedDaemonEvents {
  // Existing events...
  'daemon:started': () => void;
  'daemon:stopped': () => void;
  'daemon:error': (error: Error) => void;
  'service:installed': () => void;
  'service:uninstalled': () => void;
  'usage:mode-changed': (mode: string) => void;
  'session:recovered': (taskId: string) => void;
  'workspace:created': (taskId: string, workspacePath: string) => void;
  'workspace:cleaned': (taskId: string) => void;
  'idle:suggestion': (suggestion: any) => void;
  'thought:captured': (thought: any) => void;
  'interaction:received': (interaction: any) => void;

  // NEW: Capacity events forwarded from CapacityMonitor
  'capacity:restored': (event: CapacityRestoredEvent) => void;

  // NEW: Auto-resume event (forwarded from orchestrator/DaemonRunner)
  'tasks:auto-resumed': (event: TasksAutoResumedEvent) => void;
}
```

### 2. Add CapacityMonitor to EnhancedDaemon

EnhancedDaemon should initialize and manage its own CapacityMonitor instance:

```typescript
// File: packages/orchestrator/src/enhanced-daemon.ts

import { CapacityMonitor, CapacityRestoredEvent } from './capacity-monitor';
import { CapacityMonitorUsageAdapter } from './capacity-monitor-usage-adapter';

export class EnhancedDaemon extends EventEmitter<EnhancedDaemonEvents> {
  // Existing members...
  private daemonRunner: DaemonRunner;
  private serviceManager: ServiceManager;
  private usageManager: UsageManager;
  // ...other managers

  // NEW: CapacityMonitor for proactive capacity monitoring
  private capacityMonitor: CapacityMonitor;

  constructor(projectPath: string, config?: ApexConfig) {
    super();
    // ...existing initialization
    this.initializeComponents();
    this.setupEventHandlers();
  }

  private initializeComponents(): void {
    // ...existing component initialization

    // Initialize usage manager (already exists)
    this.usageManager = new UsageManager(daemonConfig, limitsConfig);

    // NEW: Initialize CapacityMonitor with UsageManager adapter
    const capacityUsageProvider = new CapacityMonitorUsageAdapter(
      this.usageManager,
      daemonConfig,
      limitsConfig
    );

    this.capacityMonitor = new CapacityMonitor(
      daemonConfig,
      limitsConfig,
      capacityUsageProvider
    );
  }
}
```

### 3. Forward Capacity Events in setupEventHandlers

Add event forwarding for capacity events:

```typescript
private setupEventHandlers(): void {
  // ...existing event handlers

  // NEW: CapacityMonitor events
  this.capacityMonitor.on('capacity:restored', (event: CapacityRestoredEvent) => {
    this.emit('capacity:restored', event);
  });

  // Forward tasks:auto-resumed from orchestrator to EnhancedDaemon
  this.orchestrator.on('tasks:auto-resumed', (event: TasksAutoResumedEvent) => {
    this.emit('tasks:auto-resumed', event);
  });
}
```

### 4. Lifecycle Management

Start and stop CapacityMonitor with daemon lifecycle:

```typescript
async start(): Promise<void> {
  try {
    // ...existing initialization

    // NEW: Start capacity monitoring
    this.capacityMonitor.start();

    this.isRunning = true;
    this.emit('daemon:started');
    // ...
  } catch (error) {
    this.emit('daemon:error', error as Error);
    throw error;
  }
}

async stop(): Promise<void> {
  try {
    this.isRunning = false;

    // NEW: Stop capacity monitoring
    this.capacityMonitor.stop();

    // ...existing cleanup
    this.emit('daemon:stopped');
  } catch (error) {
    this.emit('daemon:error', error as Error);
    throw error;
  }
}
```

### 5. Expose CapacityMonitor Status in getStatus()

Update the status response to include capacity monitoring info:

```typescript
async getStatus(): Promise<{
  daemon: any;
  service: any;
  usage: any;
  workspaces: any;
  thoughts: any;
  health: any;
  capacity: any;  // NEW
}> {
  const [
    daemonMetrics,
    serviceStatus,
    usageStats,
    workspaceStats,
    thoughtStats,
    healthStatus,
  ] = await Promise.all([
    this.daemonRunner.getMetrics(),
    this.serviceManager.getServiceStatus(),
    this.usageManager.getUsageStats(),
    this.workspaceManager.getWorkspaceStats(),
    this.thoughtCapture.getThoughtStats(),
    this.serviceManager.performHealthCheck(),
  ]);

  return {
    daemon: daemonMetrics,
    service: serviceStatus,
    usage: usageStats,
    workspaces: workspaceStats,
    thoughts: thoughtStats,
    health: healthStatus,
    capacity: this.capacityMonitor.getStatus(),  // NEW
  };
}
```

### 6. Add Public Accessor for CLI Integration

```typescript
/**
 * Get capacity monitor for CLI commands
 */
getCapacityMonitor(): CapacityMonitor {
  return this.capacityMonitor;
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          EnhancedDaemon                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌───────────────────┐                          │
│  │ UsageManager │───▶│ CapacityMonitor-  │                          │
│  │              │    │ UsageAdapter      │                          │
│  └──────────────┘    └─────────┬─────────┘                          │
│                                │                                     │
│                                ▼                                     │
│                      ┌─────────────────────┐                        │
│                      │  CapacityMonitor    │                        │
│                      │                     │                        │
│                      │ Events:             │                        │
│                      │ - capacity:restored │                        │
│                      └──────────┬──────────┘                        │
│                                 │                                    │
│          ┌──────────────────────┼──────────────────────┐            │
│          ▼                      ▼                      ▼            │
│  ┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐   │
│  │ EnhancedDaemon│    │   Orchestrator  │    │  DaemonRunner   │   │
│  │ Events:       │    │   Events:       │    │                 │   │
│  │ capacity:     │    │ tasks:auto-     │    │ (has own        │   │
│  │  restored     │    │  resumed        │    │  CapacityMonitor│   │
│  │ tasks:auto-   │    │                 │    │  instance)      │   │
│  │  resumed      │    │                 │    │                 │   │
│  └───────┬───────┘    └────────┬────────┘    └─────────────────┘   │
│          │                     │                                    │
└──────────┼─────────────────────┼────────────────────────────────────┘
           │                     │
           ▼                     ▼
    ┌─────────────────────────────────────┐
    │           CLI / API                  │
    │                                      │
    │  Consumes:                           │
    │  - capacity:restored                 │
    │  - tasks:auto-resumed                │
    └─────────────────────────────────────┘
```

## Event Flow

1. **Capacity Restored Flow**:
   - CapacityMonitor detects capacity restoration (mode switch, budget reset, or usage drop)
   - Emits `capacity:restored` event with `CapacityRestoredEvent` payload
   - EnhancedDaemon forwards event to its listeners
   - CLI/API can display real-time capacity status updates

2. **Auto-Resume Flow**:
   - DaemonRunner's CapacityMonitor detects capacity restoration
   - DaemonRunner handles restoration by resuming paused tasks
   - DaemonRunner emits `tasks:auto-resumed` through orchestrator
   - EnhancedDaemon forwards `tasks:auto-resumed` to its listeners
   - CLI/API can display task resumption notifications

## TypeScript Interface Summary

```typescript
// From capacity-monitor.ts (existing)
export interface CapacityRestoredEvent {
  reason: CapacityRestoredReason;  // 'mode_switch' | 'budget_reset' | 'capacity_dropped'
  timestamp: Date;
  previousUsage: CapacityUsage;
  currentUsage: CapacityUsage;
  modeInfo: ModeInfo;
}

// New in enhanced-daemon.ts
export interface TasksAutoResumedEvent {
  reason: string;
  totalTasks: number;
  resumedCount: number;
  errors: Array<{ taskId: string; error: string }>;
  timestamp: Date;
}

// Updated EnhancedDaemonEvents
export interface EnhancedDaemonEvents {
  // ... existing events ...
  'capacity:restored': (event: CapacityRestoredEvent) => void;
  'tasks:auto-resumed': (event: TasksAutoResumedEvent) => void;
}
```

## Consequences

### Positive
- CLI/API can subscribe to capacity events for real-time UI updates
- Consistent event architecture with other EnhancedDaemon features
- Enables capacity status display in daemon status commands
- Allows proactive notifications when capacity is restored

### Negative
- EnhancedDaemon and DaemonRunner will each have their own CapacityMonitor instance
- Slight increase in memory/timer overhead (minimal - two timer instances)

### Mitigation
The duplicate CapacityMonitor instances are acceptable because:
1. DaemonRunner's instance handles the actual auto-resume logic
2. EnhancedDaemon's instance is for event forwarding to CLI/API consumers
3. Both read from the same UsageManager, so state is consistent
4. Timer overhead is minimal (two setTimeout calls for mode/midnight)

## Implementation Checklist

### Phase 1: Type Definitions (index.ts)
1. [ ] Define `TasksAutoResumedEvent` interface in `index.ts`
2. [ ] Add `tasks:auto-resumed` event to `OrchestratorEvents` interface (fix existing type issue)
3. [ ] Export `TasksAutoResumedEvent` for CLI/API consumption

### Phase 2: EnhancedDaemon Updates (enhanced-daemon.ts)
4. [ ] Import `CapacityMonitor`, `CapacityRestoredEvent`, `CapacityMonitorUsageAdapter`
5. [ ] Import `TasksAutoResumedEvent` from `index.ts`
6. [ ] Add `capacity:restored` and `tasks:auto-resumed` to `EnhancedDaemonEvents`
7. [ ] Add `capacityMonitor` private member
8. [ ] Initialize `CapacityMonitor` in `initializeComponents()`
9. [ ] Add event forwarding in `setupEventHandlers()`
10. [ ] Start `CapacityMonitor` in `start()`
11. [ ] Stop `CapacityMonitor` in `stop()`
12. [ ] Add `capacity` to `getStatus()` return type and implementation
13. [ ] Add `getCapacityMonitor()` public accessor

### Phase 3: Testing
14. [ ] Add unit tests for event forwarding
15. [ ] Add integration tests for capacity lifecycle

## Files to Modify

1. **packages/orchestrator/src/enhanced-daemon.ts** - Main implementation
2. **packages/orchestrator/src/index.ts** - Export new types AND fix missing `tasks:auto-resumed` event in `OrchestratorEvents`

### Note: Existing Type Issue in OrchestratorEvents

The `runner.ts` emits `tasks:auto-resumed` on the orchestrator (line 391), but this event is NOT declared in `OrchestratorEvents` interface. This should be fixed as part of this implementation:

```typescript
// File: packages/orchestrator/src/index.ts

export interface OrchestratorEvents {
  // ... existing events ...

  // NEW: Add missing tasks:auto-resumed event declaration
  'tasks:auto-resumed': (event: TasksAutoResumedEvent) => void;
}
```

The `TasksAutoResumedEvent` interface should be defined in `index.ts` (or imported from a shared location) and exported for both orchestrator and enhanced-daemon consumers.

## Notes for Next Stages

- Developer stage should implement changes in the order listed in the implementation checklist
- Tester stage should verify:
  - CapacityMonitor starts/stops correctly with daemon lifecycle
  - Events are properly forwarded (use mock emitters in tests)
  - getStatus() includes capacity information
  - No memory leaks from timer management
