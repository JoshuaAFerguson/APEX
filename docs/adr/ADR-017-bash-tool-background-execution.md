# ADR-017: BashTool Background Execution Support

## Status
Proposed

## Context

The BashTool currently has a `run_in_background` parameter in its interface, but it's not implemented. The existing code at lines 271-274 contains only a placeholder comment:

```typescript
if (params.run_in_background) {
  // Note: Real background execution would require additional infrastructure
  // For now, we'll execute normally but could extend this later
}
```

APEX agents need the ability to run long-running shell commands in the background while continuing with other tasks. This is essential for:
- Running development servers (e.g., `npm run dev`)
- Running continuous test watchers
- Building large projects
- Running database migrations or long data processing

The existing daemon infrastructure (see ADR-051) provides patterns for process management that can inform this design.

## Decision

### 1. Architecture Overview

Implement background execution using a **BackgroundTaskManager** singleton that tracks spawned processes and provides status/output retrieval mechanisms.

```
┌─────────────────────────────────────────────────────────────────┐
│                         BashTool                                 │
│                                                                  │
│  ┌──────────────────────┐    ┌────────────────────────────────┐ │
│  │  Foreground Mode     │    │  Background Mode                │ │
│  │  (run_in_background  │    │  (run_in_background = true)    │ │
│  │   = false/undefined) │    │                                │ │
│  │                      │    │  1. Spawn detached process     │ │
│  │  Wait for completion │    │  2. Register with TaskManager  │ │
│  │  Return full output  │    │  3. Return immediately w/ ID   │ │
│  └──────────────────────┘    └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BackgroundTaskManager                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Active Tasks Map                                            ││
│  │  task_id → { pid, command, startedAt, stdout, stderr, ... } ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Methods:                                                        │
│  - register(pid, command, options) → taskId                      │
│  - getStatus(taskId) → BackgroundTaskStatus                     │
│  - getOutput(taskId) → { stdout, stderr, exitCode }             │
│  - kill(taskId, signal?) → boolean                              │
│  - listAll() → BackgroundTaskInfo[]                              │
│  - cleanup() → void                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Type Definitions

```typescript
// New types for background execution support

/**
 * Unique identifier for a background task
 */
export type BackgroundTaskId = string;

/**
 * Status of a background task
 */
export type BackgroundTaskStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'killed'
  | 'unknown';

/**
 * Information about a background task
 */
export interface BackgroundTaskInfo {
  /** Unique task identifier */
  taskId: BackgroundTaskId;
  /** Process ID */
  pid: number;
  /** Original command */
  command: string;
  /** When the task was started */
  startedAt: Date;
  /** Current status */
  status: BackgroundTaskStatus;
  /** Exit code if completed/failed */
  exitCode?: number;
  /** Working directory */
  workingDirectory?: string;
  /** Description from the original command */
  description?: string;
}

/**
 * Output from a background task
 */
export interface BackgroundTaskOutput {
  /** Buffered stdout (may be truncated) */
  stdout: string;
  /** Buffered stderr (may be truncated) */
  stderr: string;
  /** Exit code if process has exited */
  exitCode?: number;
  /** Whether process is still running */
  isRunning: boolean;
  /** Whether output was truncated */
  truncated: boolean;
}

/**
 * Extended BashToolOutput for background mode
 */
export interface BashToolBackgroundOutput {
  /** Background task ID for later reference */
  taskId: BackgroundTaskId;
  /** Process ID */
  pid: number;
  /** The command that was started */
  command: string;
  /** Indicates this is a background task */
  background: true;
  /** Initial status */
  status: BackgroundTaskStatus;
  /** When started */
  startedAt: Date;
}
```

### 3. Updated BashToolOutput Union Type

The `BashToolOutput` will become a discriminated union:

```typescript
/**
 * Output from the Bash tool - either synchronous or background
 */
export type BashToolOutput = BashToolSyncOutput | BashToolBackgroundOutput;

/**
 * Synchronous (foreground) execution output
 */
export interface BashToolSyncOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  duration: number;
  timedOut: boolean;
  pid?: number;
  background?: false;  // Discriminator
}

/**
 * Background execution output
 */
export interface BashToolBackgroundOutput {
  taskId: BackgroundTaskId;
  pid: number;
  command: string;
  background: true;  // Discriminator
  status: BackgroundTaskStatus;
  startedAt: Date;
}
```

### 4. BackgroundTaskManager Implementation

Location: `packages/core/src/tools/shell/background-task-manager.ts`

```typescript
import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

export class BackgroundTaskManager extends EventEmitter {
  private static instance: BackgroundTaskManager | null = null;

  private tasks: Map<BackgroundTaskId, BackgroundTask> = new Map();

  /** Maximum stdout/stderr buffer per task (default: 1MB) */
  private maxBufferSize: number = 1024 * 1024;

  /** Auto-cleanup completed tasks after this duration (default: 1 hour) */
  private cleanupAfterMs: number = 60 * 60 * 1000;

  private constructor() {
    super();
    this.setupCleanupInterval();
  }

  static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  /**
   * Register a new background process
   */
  register(
    process: ChildProcess,
    command: string,
    options?: {
      workingDirectory?: string;
      description?: string;
    }
  ): BackgroundTaskId {
    const taskId = `bg_${randomUUID().slice(0, 8)}`;

    const task: BackgroundTask = {
      taskId,
      pid: process.pid!,
      command,
      startedAt: new Date(),
      status: 'running',
      stdout: '',
      stderr: '',
      process,
      workingDirectory: options?.workingDirectory,
      description: options?.description,
    };

    // Collect output
    process.stdout?.on('data', (data: Buffer) => {
      task.stdout += data.toString();
      if (task.stdout.length > this.maxBufferSize) {
        task.stdout = task.stdout.slice(-this.maxBufferSize);
        task.truncated = true;
      }
      this.emit('stdout', taskId, data.toString());
    });

    process.stderr?.on('data', (data: Buffer) => {
      task.stderr += data.toString();
      if (task.stderr.length > this.maxBufferSize) {
        task.stderr = task.stderr.slice(-this.maxBufferSize);
        task.truncated = true;
      }
      this.emit('stderr', taskId, data.toString());
    });

    process.on('exit', (code, signal) => {
      task.exitCode = code ?? -1;
      task.status = code === 0 ? 'completed' : 'failed';
      task.completedAt = new Date();
      if (signal) {
        task.status = 'killed';
        task.signal = signal;
      }
      this.emit('exit', taskId, code, signal);
    });

    process.on('error', (error) => {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = new Date();
      this.emit('error', taskId, error);
    });

    this.tasks.set(taskId, task);
    return taskId;
  }

  /**
   * Get status of a background task
   */
  getStatus(taskId: BackgroundTaskId): BackgroundTaskInfo | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return {
      taskId: task.taskId,
      pid: task.pid,
      command: task.command,
      startedAt: task.startedAt,
      status: task.status,
      exitCode: task.exitCode,
      workingDirectory: task.workingDirectory,
      description: task.description,
    };
  }

  /**
   * Get output from a background task
   */
  getOutput(taskId: BackgroundTaskId): BackgroundTaskOutput | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return {
      stdout: task.stdout,
      stderr: task.stderr,
      exitCode: task.exitCode,
      isRunning: task.status === 'running',
      truncated: task.truncated ?? false,
    };
  }

  /**
   * Kill a background task
   */
  kill(taskId: BackgroundTaskId, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return false;

    try {
      task.process.kill(signal);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all background tasks
   */
  listAll(): BackgroundTaskInfo[] {
    return Array.from(this.tasks.values()).map(task => ({
      taskId: task.taskId,
      pid: task.pid,
      command: task.command,
      startedAt: task.startedAt,
      status: task.status,
      exitCode: task.exitCode,
      workingDirectory: task.workingDirectory,
      description: task.description,
    }));
  }

  /**
   * Clean up completed tasks older than cleanupAfterMs
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [taskId, task] of this.tasks) {
      if (task.status !== 'running' && task.completedAt) {
        if (now - task.completedAt.getTime() > this.cleanupAfterMs) {
          this.tasks.delete(taskId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Force cleanup all tasks (for shutdown)
   */
  async shutdownAll(timeoutMs: number = 5000): Promise<void> {
    const runningTasks = Array.from(this.tasks.values())
      .filter(t => t.status === 'running');

    // Send SIGTERM to all
    for (const task of runningTasks) {
      try {
        task.process.kill('SIGTERM');
      } catch { /* ignore */ }
    }

    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, timeoutMs));

    // Force kill remaining
    for (const task of runningTasks) {
      if (task.status === 'running') {
        try {
          task.process.kill('SIGKILL');
        } catch { /* ignore */ }
      }
    }

    this.tasks.clear();
  }

  private setupCleanupInterval(): void {
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
  }
}

interface BackgroundTask {
  taskId: BackgroundTaskId;
  pid: number;
  command: string;
  startedAt: Date;
  completedAt?: Date;
  status: BackgroundTaskStatus;
  stdout: string;
  stderr: string;
  exitCode?: number;
  signal?: string;
  error?: string;
  truncated?: boolean;
  process: ChildProcess;
  workingDirectory?: string;
  description?: string;
}
```

### 5. Updated BashTool executeImpl

```typescript
protected async executeImpl(
  params: BashToolInput,
  context?: ToolExecutionContext
): Promise<BashToolOutput> {
  const command = params.command.trim();
  const timeout = params.timeout || BashTool.DEFAULT_TIMEOUT;
  const startTime = Date.now();

  // Handle background execution
  if (params.run_in_background) {
    return this.executeBackground(command, params.description, context);
  }

  // Existing synchronous execution...
  return this.executeForeground(command, timeout, context);
}

private executeBackground(
  command: string,
  description?: string,
  context?: ToolExecutionContext
): BashToolBackgroundOutput {
  const child = spawn('/bin/sh', ['-c', command], {
    detached: true,  // Run independently of parent
    cwd: context?.workingDirectory,
    env: {
      ...process.env,
      ...(context?.environment || {})
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Don't wait for the child process
  child.unref();

  const manager = BackgroundTaskManager.getInstance();
  const taskId = manager.register(child, command, {
    workingDirectory: context?.workingDirectory,
    description,
  });

  return {
    taskId,
    pid: child.pid!,
    command,
    background: true,
    status: 'running',
    startedAt: new Date(),
  };
}
```

### 6. Helper Tools for Background Task Management

Create additional tools for managing background tasks:

#### BackgroundStatusTool
```typescript
// packages/core/src/tools/shell/background-status-tool.ts
export class BackgroundStatusTool extends BaseTool<
  { taskId: string },
  BackgroundTaskInfo | null
> {
  // Returns status of a specific background task
}
```

#### BackgroundOutputTool
```typescript
// packages/core/src/tools/shell/background-output-tool.ts
export class BackgroundOutputTool extends BaseTool<
  { taskId: string },
  BackgroundTaskOutput | null
> {
  // Returns stdout/stderr from a background task
}
```

#### BackgroundKillTool
```typescript
// packages/core/src/tools/shell/background-kill-tool.ts
export class BackgroundKillTool extends BaseTool<
  { taskId: string; signal?: string },
  { success: boolean; message: string }
> {
  // Kills a background task
}
```

#### BackgroundListTool
```typescript
// packages/core/src/tools/shell/background-list-tool.ts
export class BackgroundListTool extends BaseTool<
  {},
  BackgroundTaskInfo[]
> {
  // Lists all background tasks
}
```

### 7. File Structure

```
packages/core/src/tools/shell/
├── bash-tool.ts                    # Updated with background support
├── background-task-manager.ts      # New - task manager singleton
├── background-status-tool.ts       # New - get task status
├── background-output-tool.ts       # New - get task output
├── background-kill-tool.ts         # New - kill background task
├── background-list-tool.ts         # New - list all tasks
├── index.ts                        # Updated exports
├── command-sandbox.ts              # Existing
├── blocklist.ts                    # Existing
├── path-validator.ts               # Existing
└── __tests__/
    ├── bash-tool.test.ts           # Existing
    ├── bash-tool.background.test.ts # New - background tests
    ├── background-task-manager.test.ts # New
    └── ...
```

### 8. Security Considerations

1. **Process Limit**: Maximum concurrent background tasks (default: 10)
2. **Buffer Limit**: Maximum stdout/stderr per task (default: 1MB)
3. **Automatic Cleanup**: Remove completed task data after 1 hour
4. **Graceful Shutdown**: Kill all background tasks on process exit
5. **Sandbox Integration**: Background tasks still go through CommandSandbox validation

### 9. Error Handling

| Scenario | Handling |
|----------|----------|
| Too many background tasks | Return error, don't start process |
| Process spawn failure | Return error with details |
| Task not found | Return null from getStatus/getOutput |
| Kill failure | Return { success: false, message: "..." } |
| Output buffer exceeded | Truncate oldest data, set truncated flag |

### 10. Events

The BackgroundTaskManager emits events for integration:

```typescript
manager.on('stdout', (taskId, data) => { /* stream output */ });
manager.on('stderr', (taskId, data) => { /* stream output */ });
manager.on('exit', (taskId, code, signal) => { /* process ended */ });
manager.on('error', (taskId, error) => { /* process error */ });
```

## Consequences

### Positive
- Enables running long-lived processes (dev servers, test watchers)
- Returns immediately with task ID for async workflow
- Provides mechanisms to monitor and control background tasks
- Follows established patterns from DaemonManager
- Buffer management prevents memory issues
- Automatic cleanup of old task data

### Negative
- Increases complexity of BashTool
- Requires additional helper tools for full functionality
- Background processes may outlive the APEX session
- Platform differences in signal handling (Windows vs Unix)

### Risks & Mitigations
- **Risk**: Orphaned processes
  - **Mitigation**: Graceful shutdown handler, process limit, auto-cleanup
- **Risk**: Memory exhaustion from output buffering
  - **Mitigation**: Buffer limits, truncation strategy
- **Risk**: Race conditions in status checks
  - **Mitigation**: Singleton manager, synchronous Map operations

## Implementation Plan

### Phase 1: Core Infrastructure (This Task)
1. Create `BackgroundTaskManager` class
2. Define new types in `bash-tool.ts`
3. Update `BashToolOutput` to union type
4. Implement background execution path in `BashTool.executeImpl()`
5. Update exports in `index.ts`
6. Write unit tests

### Phase 2: Helper Tools (Future Task)
1. Implement `BackgroundStatusTool`
2. Implement `BackgroundOutputTool`
3. Implement `BackgroundKillTool`
4. Implement `BackgroundListTool`
5. Register tools in shell module
6. Integration tests

### Phase 3: Integration (Future Task)
1. Add process cleanup to APEX shutdown hooks
2. Add background task listing to CLI status command
3. Document usage patterns for agents
4. End-to-end integration tests

## References

- ADR-016: BashTool Implementation (existing design)
- ADR-051: Daemon Process Manager (process management patterns)
- [Node.js child_process](https://nodejs.org/api/child_process.html)
- [Node.js process signals](https://nodejs.org/api/process.html#signal-events)
