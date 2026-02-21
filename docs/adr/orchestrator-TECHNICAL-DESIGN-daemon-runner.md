# Technical Design: DaemonRunner Implementation

## Overview

This document provides detailed technical specifications for implementing the `DaemonRunner` class, including TypeScript interfaces, method signatures, and implementation guidelines.

## File Locations

| File | Purpose |
|------|---------|
| `packages/orchestrator/src/runner.ts` | DaemonRunner class implementation |
| `packages/orchestrator/src/daemon-entry.ts` | Entry point for forked daemon process |
| `packages/orchestrator/src/daemon.ts` | Update DaemonManager to use new entry point |
| `packages/orchestrator/src/index.ts` | Re-export DaemonRunner |

## Interface Specifications

### DaemonRunnerOptions

```typescript
// packages/orchestrator/src/runner.ts

export interface DaemonRunnerOptions {
  /**
   * Path to the project directory containing .apex/
   * Required for loading config and accessing TaskStore
   */
  projectPath: string;

  /**
   * Interval in milliseconds between polling for new tasks
   * Default: 5000 (5 seconds)
   * Min: 1000, Max: 60000
   */
  pollIntervalMs?: number;

  /**
   * Maximum number of tasks to run concurrently
   * If not provided, uses config.limits.maxConcurrentTasks
   */
  maxConcurrentTasks?: number;

  /**
   * Path to log file
   * Default: <projectPath>/.apex/daemon.log
   */
  logFile?: string;

  /**
   * Whether to also log to stdout (for debugging)
   * Default: false
   */
  logToStdout?: boolean;
}
```

### DaemonMetrics

```typescript
export interface DaemonMetrics {
  /** When the daemon was started */
  startedAt: Date;

  /** Uptime in milliseconds */
  uptime: number;

  /** Total tasks processed (started) */
  tasksProcessed: number;

  /** Tasks that completed successfully */
  tasksSucceeded: number;

  /** Tasks that failed */
  tasksFailed: number;

  /** Currently executing tasks */
  activeTaskCount: number;

  /** Active task IDs for debugging */
  activeTaskIds: string[];

  /** When the last poll occurred */
  lastPollAt?: Date;

  /** Number of poll cycles completed */
  pollCount: number;

  /** Whether the runner is accepting new tasks */
  isRunning: boolean;
}
```

### DaemonLogEntry

```typescript
export interface DaemonLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}
```

## Class Implementation

### DaemonRunner Class

```typescript
// packages/orchestrator/src/runner.ts

import { createWriteStream, WriteStream } from 'fs';
import { join } from 'path';
import { ApexOrchestrator, OrchestratorOptions } from './index';
import { TaskStore } from './store';
import { loadConfig, getEffectiveConfig, ApexConfig } from '@apexcli/core';

export class DaemonRunner {
  // Dependencies
  private orchestrator: ApexOrchestrator | null = null;
  private store: TaskStore | null = null;
  private config: ApexConfig | null = null;

  // Configuration
  private readonly options: Required<DaemonRunnerOptions>;

  // State
  private isRunning = false;
  private isShuttingDown = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private runningTasks: Map<string, Promise<void>> = new Map();

  // Metrics
  private startedAt: Date | null = null;
  private tasksProcessed = 0;
  private tasksSucceeded = 0;
  private tasksFailed = 0;
  private pollCount = 0;
  private lastPollAt: Date | null = null;

  // Logging
  private logStream: WriteStream | null = null;

  constructor(options: DaemonRunnerOptions) {
    // Validate and apply defaults
    this.options = {
      projectPath: options.projectPath,
      pollIntervalMs: Math.max(1000, Math.min(60000, options.pollIntervalMs ?? 5000)),
      maxConcurrentTasks: options.maxConcurrentTasks ?? 0, // 0 = use config
      logFile: options.logFile ?? join(options.projectPath, '.apex', 'daemon.log'),
      logToStdout: options.logToStdout ?? false,
    };
  }

  /**
   * Start the daemon runner
   * Initializes orchestrator, opens log file, starts polling
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('DaemonRunner is already running');
    }

    // Open log file (append mode)
    this.logStream = createWriteStream(this.options.logFile, { flags: 'a' });

    try {
      // Load configuration
      this.config = await loadConfig(this.options.projectPath);
      const effectiveConfig = getEffectiveConfig(this.config);

      // Determine max concurrent tasks
      if (this.options.maxConcurrentTasks === 0) {
        this.options.maxConcurrentTasks = effectiveConfig.limits.maxConcurrentTasks;
      }

      // Initialize TaskStore
      this.store = new TaskStore(this.options.projectPath);
      await this.store.initialize();

      // Initialize Orchestrator
      this.orchestrator = new ApexOrchestrator({
        projectPath: this.options.projectPath,
      });
      await this.orchestrator.initialize();

      // Subscribe to orchestrator events for logging
      this.setupOrchestratorEvents();

      // Setup signal handlers
      this.setupSignalHandlers();

      // Start
      this.isRunning = true;
      this.startedAt = new Date();

      this.log('info', `Daemon started (poll: ${this.options.pollIntervalMs}ms, max concurrent: ${this.options.maxConcurrentTasks})`);

      // Initial poll
      await this.poll();

      // Start polling interval
      this.pollInterval = setInterval(() => {
        if (this.isRunning && !this.isShuttingDown) {
          this.poll().catch(err => {
            this.log('error', `Poll error: ${err.message}`);
          });
        }
      }, this.options.pollIntervalMs);

    } catch (error) {
      this.log('error', `Failed to start: ${(error as Error).message}`);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the daemon gracefully
   * Waits for running tasks to complete (with timeout)
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isShuttingDown = true;
    this.log('info', 'Initiating graceful shutdown...');

    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Wait for running tasks
    if (this.runningTasks.size > 0) {
      this.log('info', `Waiting for ${this.runningTasks.size} task(s) to complete...`);

      const gracePeriod = 30000; // 30 seconds
      const timeout = new Promise<'timeout'>(resolve =>
        setTimeout(() => resolve('timeout'), gracePeriod)
      );

      const result = await Promise.race([
        Promise.allSettled(this.runningTasks.values()).then(() => 'completed' as const),
        timeout,
      ]);

      if (result === 'timeout') {
        this.log('warn', `Timeout after ${gracePeriod}ms, ${this.runningTasks.size} task(s) still running`);
      } else {
        this.log('info', 'All tasks completed');
      }
    }

    await this.cleanup();
    this.log('info', 'Daemon stopped');
    this.isRunning = false;
  }

  /**
   * Get current daemon metrics
   */
  getMetrics(): DaemonMetrics {
    return {
      startedAt: this.startedAt ?? new Date(),
      uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      tasksProcessed: this.tasksProcessed,
      tasksSucceeded: this.tasksSucceeded,
      tasksFailed: this.tasksFailed,
      activeTaskCount: this.runningTasks.size,
      activeTaskIds: Array.from(this.runningTasks.keys()),
      lastPollAt: this.lastPollAt ?? undefined,
      pollCount: this.pollCount,
      isRunning: this.isRunning,
    };
  }

  /**
   * Poll for new tasks and execute them
   */
  private async poll(): Promise<void> {
    if (this.isShuttingDown || !this.store) {
      return;
    }

    this.pollCount++;
    this.lastPollAt = new Date();

    // Check capacity
    const availableSlots = this.options.maxConcurrentTasks - this.runningTasks.size;
    if (availableSlots <= 0) {
      this.log('debug', `At capacity (${this.runningTasks.size}/${this.options.maxConcurrentTasks})`);
      return;
    }

    // Get next tasks
    try {
      for (let i = 0; i < availableSlots; i++) {
        const task = await this.store.getNextQueuedTask();
        if (!task) {
          break; // No more tasks
        }

        // Skip if already running
        if (this.runningTasks.has(task.id)) {
          continue;
        }

        // Start task
        this.startTask(task.id);
      }
    } catch (error) {
      this.log('error', `Failed to get tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Start executing a task in the background
   */
  private startTask(taskId: string): void {
    if (!this.orchestrator) {
      return;
    }

    this.log('info', `Starting task ${taskId}`, { taskId });
    this.tasksProcessed++;

    const startTime = Date.now();

    const taskPromise = this.orchestrator.executeTask(taskId)
      .then(() => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log('info', `Task ${taskId} completed (${duration}s)`, { taskId });
        this.tasksSucceeded++;
      })
      .catch((error: Error) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log('error', `Task ${taskId} failed (${duration}s): ${error.message}`, { taskId });
        this.tasksFailed++;
      })
      .finally(() => {
        this.runningTasks.delete(taskId);
      });

    this.runningTasks.set(taskId, taskPromise);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const handler = async (signal: string) => {
      this.log('info', `Received ${signal}`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => handler('SIGTERM'));
    process.on('SIGINT', () => handler('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.log('error', `Uncaught exception: ${error.message}`);
      this.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      this.log('error', `Unhandled rejection: ${reason}`);
    });
  }

  /**
   * Subscribe to orchestrator events for logging
   */
  private setupOrchestratorEvents(): void {
    if (!this.orchestrator) return;

    this.orchestrator.on('task:paused', (task, reason) => {
      this.log('warn', `Task ${task.id} paused: ${reason}`, { taskId: task.id });
    });

    this.orchestrator.on('task:stage-changed', (task, stage) => {
      this.log('debug', `Task ${task.id} stage: ${stage}`, { taskId: task.id });
    });

    this.orchestrator.on('pr:created', (taskId, prUrl) => {
      this.log('info', `Task ${taskId} created PR: ${prUrl}`, { taskId });
    });
  }

  /**
   * Log a message to the log file
   */
  private log(
    level: DaemonLogEntry['level'],
    message: string,
    metadata?: { taskId?: string }
  ): void {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase().padEnd(5);
    const taskPrefix = metadata?.taskId ? `[${metadata.taskId.substring(0, 8)}] ` : '';
    const logLine = `[${timestamp}] [${levelUpper}] ${taskPrefix}${message}\n`;

    // Write to log file
    if (this.logStream && !this.logStream.destroyed) {
      this.logStream.write(logLine);
    }

    // Optionally log to stdout
    if (this.options.logToStdout) {
      process.stdout.write(logLine);
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Close log stream
    if (this.logStream && !this.logStream.destroyed) {
      await new Promise<void>((resolve) => {
        this.logStream!.end(resolve);
      });
    }

    // Close store
    if (this.store) {
      this.store.close();
    }
  }
}
```

### Daemon Entry Point

```typescript
// packages/orchestrator/src/daemon-entry.ts

import { DaemonRunner } from './runner';

async function main(): Promise<void> {
  // Get configuration from environment
  const projectPath = process.env.APEX_PROJECT_PATH;
  if (!projectPath) {
    console.error('APEX_PROJECT_PATH environment variable is required');
    process.exit(1);
  }

  const pollInterval = parseInt(process.env.APEX_POLL_INTERVAL || '5000', 10);
  const logToStdout = process.env.APEX_DAEMON_DEBUG === '1';

  const runner = new DaemonRunner({
    projectPath,
    pollIntervalMs: pollInterval,
    logToStdout,
  });

  try {
    await runner.start();
  } catch (error) {
    console.error('Failed to start daemon:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  main();
}
```

### DaemonManager Updates

```typescript
// packages/orchestrator/src/daemon.ts
// Updates to startDaemon() method

async startDaemon(): Promise<number> {
  // ... existing checks ...

  try {
    // Fork the daemon entry point script
    const entryPoint = join(__dirname, 'daemon-entry.js'); // Compiled output

    const child = fork(entryPoint, [], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        APEX_DAEMON_MODE: '1',
        APEX_PROJECT_PATH: this.projectPath,
        APEX_POLL_INTERVAL: String(this.options.pollIntervalMs ?? 5000),
      },
    });

    // ... rest of existing implementation ...
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// packages/orchestrator/src/__tests__/runner.test.ts

describe('DaemonRunner', () => {
  describe('constructor', () => {
    it('should apply default options');
    it('should clamp pollIntervalMs to valid range');
  });

  describe('start', () => {
    it('should initialize orchestrator and store');
    it('should open log file in append mode');
    it('should start polling immediately');
    it('should throw if already running');
  });

  describe('stop', () => {
    it('should stop polling');
    it('should wait for running tasks');
    it('should timeout after grace period');
    it('should close log stream');
  });

  describe('poll', () => {
    it('should respect max concurrent tasks');
    it('should skip if shutting down');
    it('should handle store errors gracefully');
  });

  describe('getMetrics', () => {
    it('should return current metrics');
    it('should track task success/failure counts');
  });

  describe('signal handling', () => {
    it('should handle SIGTERM gracefully');
    it('should handle SIGINT gracefully');
  });
});
```

### Integration Tests

```typescript
describe('DaemonRunner Integration', () => {
  it('should execute pending tasks');
  it('should respect task dependencies');
  it('should log to daemon.log');
  it('should survive orchestrator errors');
});
```

## Error Handling

| Error Scenario | Handling |
|---------------|----------|
| Store initialization fails | Log error, exit with code 1 |
| Orchestrator initialization fails | Log error, cleanup, exit with code 1 |
| Task execution fails | Log error, increment tasksFailed, continue |
| Log file write fails | Ignore (prevent cascading failures) |
| Poll timeout | Log warning, continue |
| SIGTERM during task | Wait up to 30s, then force exit |

## Metrics Endpoint (Future)

For future CLI integration (`apex daemon metrics`):

```typescript
// DaemonRunner method
toJSON(): string {
  return JSON.stringify(this.getMetrics(), null, 2);
}

// CLI would read from a metrics file or IPC
```

## Dependencies

- No new external dependencies required
- Uses existing:
  - `fs` (createWriteStream)
  - `path` (join)
  - `child_process` (fork) - only in DaemonManager
  - `@apexcli/core` (loadConfig, getEffectiveConfig)

## Export Updates

```typescript
// packages/orchestrator/src/index.ts

// Add to existing exports
export { DaemonRunner, DaemonRunnerOptions, DaemonMetrics } from './runner';
```

## Checklist for Implementation

- [ ] Create `runner.ts` with DaemonRunner class
- [ ] Create `daemon-entry.ts` entry point
- [ ] Update `daemon.ts` DaemonManager.startDaemon()
- [ ] Update `index.ts` exports
- [ ] Add unit tests for DaemonRunner
- [ ] Add integration tests
- [ ] Update package.json if needed (add daemon-entry to build)
- [ ] Test manual daemon lifecycle (start/stop/status)
- [ ] Verify log file rotation works with external tools
