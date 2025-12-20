# ADR: DaemonRunner Implementation

## Status
Proposed

## Date
2025-01-XX

## Context

The APEX orchestrator package currently has a `DaemonManager` class in `daemon.ts` that handles the lifecycle of daemon processes (start, stop, status). However, the actual daemon runner logic—the code that runs inside the forked process to poll and execute tasks—is not yet implemented.

### Current Architecture

```
DaemonManager (daemon.ts)
├── startDaemon()     → Forks child process, writes PID file
├── stopDaemon()      → Sends SIGTERM/SIGKILL, cleans up
├── getStatus()       → Returns running state, uptime, PID
└── killDaemon()      → Force kill with SIGKILL

TaskStore (store.ts)
├── getNextQueuedTask()    → Returns next ready task (respects dependencies)
├── getReadyTasks()        → Returns all tasks ready to execute
└── listTasks()            → Lists tasks by status/priority

ApexOrchestrator (index.ts)
├── startTaskRunner()      → Internal polling mechanism (in-process)
├── stopTaskRunner()       → Stops internal runner
├── executeTask()          → Executes a single task
└── processTaskQueue()     → Picks up pending tasks
```

### Requirements

The DaemonRunner class must:
1. Initialize ApexOrchestrator
2. Poll TaskStore.getNextQueuedTask() at configurable interval
3. Execute pending tasks automatically
4. Handle graceful shutdown on SIGTERM/SIGINT
5. Track uptime and active task count
6. Log activity to .apex/daemon.log

## Decision

### Architecture Overview

We will implement `DaemonRunner` as a standalone class in `packages/orchestrator/src/runner.ts` that:

1. **Is the entry point for the daemon process** - The forked child process will instantiate and run this class
2. **Composes ApexOrchestrator** - Uses orchestrator's existing task execution capabilities
3. **Implements its own polling loop** - Independent from the orchestrator's internal runner
4. **Handles process signals** - Clean shutdown on SIGTERM/SIGINT
5. **Manages structured logging** - Appends to .apex/daemon.log with timestamps

### Class Design

```typescript
// packages/orchestrator/src/runner.ts

export interface DaemonRunnerOptions {
  projectPath: string;
  pollIntervalMs?: number;      // Default: 5000ms
  maxConcurrentTasks?: number;  // Override config, default: from config
  logFile?: string;             // Default: .apex/daemon.log
}

export interface DaemonMetrics {
  startedAt: Date;
  uptime: number;              // milliseconds
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  activeTaskCount: number;
  lastPollAt?: Date;
}

export class DaemonRunner {
  private orchestrator: ApexOrchestrator;
  private store: TaskStore;
  private options: Required<DaemonRunnerOptions>;
  private metrics: DaemonMetrics;
  private isRunning: boolean;
  private pollInterval: NodeJS.Timeout | null;
  private runningTasks: Map<string, Promise<void>>;
  private logStream: WriteStream;

  constructor(options: DaemonRunnerOptions);

  // Lifecycle
  async start(): Promise<void>;
  async stop(): Promise<void>;

  // Metrics
  getMetrics(): DaemonMetrics;

  // Internal
  private async poll(): Promise<void>;
  private async executeTask(taskId: string): Promise<void>;
  private setupSignalHandlers(): void;
  private log(level: string, message: string): void;
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Forked Daemon Process                        │
│                                                                  │
│  ┌──────────────┐     ┌──────────────────────────────────────┐ │
│  │   Signals    │────▶│           DaemonRunner               │ │
│  │ SIGTERM/INT  │     │                                      │ │
│  └──────────────┘     │  ┌────────────────────────────────┐  │ │
│                       │  │     Polling Loop (5s)          │  │ │
│                       │  │  ┌──────────────────────────┐  │  │ │
│                       │  │  │  TaskStore.getNextTask() │  │  │ │
│                       │  │  └────────────┬─────────────┘  │  │ │
│                       │  └───────────────│────────────────┘  │ │
│                       │                  ▼                    │ │
│                       │  ┌────────────────────────────────┐  │ │
│                       │  │   ApexOrchestrator.execute()   │  │ │
│                       │  │   (with concurrency limits)    │  │ │
│                       │  └────────────────────────────────┘  │ │
│                       │                  │                    │ │
│                       │                  ▼                    │ │
│                       │  ┌────────────────────────────────┐  │ │
│                       │  │   Metrics & Logging            │  │ │
│                       │  │   → .apex/daemon.log           │  │ │
│                       │  └────────────────────────────────┘  │ │
│                       └──────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points

1. **DaemonManager → DaemonRunner**
   - DaemonManager's `startDaemon()` will be updated to fork a script that instantiates DaemonRunner
   - Environment variables pass configuration:
     - `APEX_DAEMON_MODE=1`
     - `APEX_PROJECT_PATH=/path/to/project`
     - `APEX_POLL_INTERVAL=5000`

2. **DaemonRunner → ApexOrchestrator**
   - DaemonRunner creates and initializes its own ApexOrchestrator instance
   - Uses orchestrator's `executeTask()` method for task execution
   - Subscribes to orchestrator events for logging

3. **DaemonRunner → TaskStore**
   - Direct access for `getNextQueuedTask()` polling
   - Respects task dependencies via store's built-in logic

### Signal Handling

```typescript
private setupSignalHandlers(): void {
  const shutdown = async (signal: string) => {
    this.log('info', `Received ${signal}, initiating graceful shutdown...`);
    this.isRunning = false;

    // Stop accepting new tasks
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Wait for running tasks to complete (with timeout)
    if (this.runningTasks.size > 0) {
      this.log('info', `Waiting for ${this.runningTasks.size} task(s) to complete...`);

      const timeout = new Promise<void>(resolve =>
        setTimeout(() => {
          this.log('warn', 'Timeout waiting for tasks, forcing shutdown');
          resolve();
        }, 30000) // 30 second grace period
      );

      await Promise.race([
        Promise.all(this.runningTasks.values()),
        timeout
      ]);
    }

    // Close log stream
    this.logStream.end();

    this.log('info', 'Daemon stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```

### Logging Format

```
[2025-01-15T10:30:00.000Z] [INFO] Daemon started (poll: 5000ms, max concurrent: 3)
[2025-01-15T10:30:05.123Z] [INFO] Polling for tasks...
[2025-01-15T10:30:05.456Z] [INFO] Starting task abc12345
[2025-01-15T10:30:45.789Z] [INFO] Task abc12345 completed (40.3s)
[2025-01-15T10:31:00.000Z] [WARN] Rate limit hit for task def67890, pausing
[2025-01-15T10:32:00.000Z] [INFO] Received SIGTERM, initiating graceful shutdown...
[2025-01-15T10:32:05.000Z] [INFO] Waiting for 1 task(s) to complete...
[2025-01-15T10:32:30.000Z] [INFO] Daemon stopped
```

### File Structure

```
packages/orchestrator/src/
├── index.ts          # ApexOrchestrator (existing)
├── store.ts          # TaskStore (existing)
├── daemon.ts         # DaemonManager (existing, updated)
├── runner.ts         # DaemonRunner (NEW)
├── daemon-entry.ts   # Entry point for forked process (NEW)
└── hooks.ts          # Existing hooks
```

### Entry Point Script

```typescript
// packages/orchestrator/src/daemon-entry.ts
import { DaemonRunner } from './runner';

const projectPath = process.env.APEX_PROJECT_PATH || process.cwd();
const pollInterval = parseInt(process.env.APEX_POLL_INTERVAL || '5000', 10);

const runner = new DaemonRunner({
  projectPath,
  pollIntervalMs: pollInterval,
});

runner.start().catch((error) => {
  console.error('Failed to start daemon:', error);
  process.exit(1);
});
```

### Configuration Integration

The DaemonRunner will respect configuration from `.apex/config.yaml`:

```yaml
# .apex/config.yaml
limits:
  maxConcurrentTasks: 3    # Used by DaemonRunner
  maxTokensPerTask: 500000
  maxCostPerTask: 10.0

# Future: daemon-specific config (optional)
daemon:
  pollIntervalMs: 5000
  gracefulShutdownTimeoutMs: 30000
```

## Consequences

### Positive
- **Clean separation**: DaemonRunner handles daemon-specific concerns (signals, logging, polling)
- **Reuses existing infrastructure**: Leverages ApexOrchestrator for task execution
- **Testable**: DaemonRunner can be unit tested independently
- **Observable**: Structured logging and metrics for debugging
- **Graceful degradation**: Proper shutdown handling prevents data loss

### Negative
- **Dual polling mechanisms**: Both ApexOrchestrator and DaemonRunner have polling, but serve different purposes
- **Additional complexity**: New files and entry point to maintain
- **Process coordination**: Need to ensure PID file management is robust

### Neutral
- **Memory footprint**: Forked process has separate memory space (standard Node.js behavior)
- **Log rotation**: Not implemented initially, can be added later

## Alternatives Considered

### 1. Extend ApexOrchestrator Directly
Add daemon mode to ApexOrchestrator instead of creating DaemonRunner.

**Rejected because**:
- Violates single responsibility principle
- ApexOrchestrator already handles task execution, adding process management bloats it
- Harder to test signal handling within the orchestrator

### 2. Use PM2 or systemd Directly
Let external process managers handle daemonization.

**Rejected because**:
- Adds external dependency
- Less portable across platforms
- Harder to integrate with CLI commands like `apex daemon start/stop`

### 3. In-Process Background Runner Only
Rely solely on `startTaskRunner()` without true daemonization.

**Rejected because**:
- Process dies when terminal closes
- No graceful restart capability
- No true background execution

## Implementation Plan

1. **Phase 1: Core DaemonRunner** (developer stage)
   - Create `runner.ts` with DaemonRunner class
   - Implement polling loop and metrics
   - Add signal handling

2. **Phase 2: Entry Point** (developer stage)
   - Create `daemon-entry.ts`
   - Update `DaemonManager.startDaemon()` to fork the entry point

3. **Phase 3: Integration** (tester stage)
   - Update package exports
   - Add unit tests for DaemonRunner
   - Integration tests for daemon lifecycle

4. **Phase 4: CLI Integration** (future)
   - Add `apex daemon logs` command
   - Add `apex daemon metrics` command

## References

- Existing `DaemonManager` implementation: `packages/orchestrator/src/daemon.ts`
- ApexOrchestrator task runner: `packages/orchestrator/src/index.ts` (lines 1869-1939)
- TaskStore queue methods: `packages/orchestrator/src/store.ts` (lines 426-446)
