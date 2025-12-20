# Auto-Pause Capacity Threshold - Technical Design

## Overview

This document details the technical implementation for integrating DaemonScheduler's capacity threshold logic into DaemonRunner and EnhancedDaemon to automatically pause task processing when budget capacity thresholds are reached.

## Interface Definitions

### 1. DaemonRunnerEvents (New)

```typescript
// File: packages/orchestrator/src/runner.ts

import { SchedulingDecision } from './daemon-scheduler';

export interface DaemonRunnerEvents {
  /**
   * Emitted when task processing is paused due to capacity threshold
   * @param decision - The scheduling decision that caused the pause
   */
  'daemon:capacity-paused': (decision: SchedulingDecision) => void;

  /**
   * Emitted when task processing resumes after capacity restored
   * @param decision - The scheduling decision indicating capacity restored
   */
  'daemon:capacity-resumed': (decision: SchedulingDecision) => void;
}
```

### 2. Updated DaemonRunnerOptions

```typescript
// File: packages/orchestrator/src/runner.ts

import { DaemonScheduler } from './daemon-scheduler';

export interface DaemonRunnerOptions {
  projectPath: string;
  pollIntervalMs?: number;
  maxConcurrentTasks?: number;
  logFile?: string;
  logToStdout?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  config?: ApexConfig;

  /**
   * Optional DaemonScheduler for capacity-based pausing
   * If provided, poll() will check capacity before starting new tasks
   */
  scheduler?: DaemonScheduler;
}
```

### 3. Updated DaemonMetrics

```typescript
// File: packages/orchestrator/src/runner.ts

export interface DaemonMetrics {
  startedAt: Date;
  uptime: number;
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  activeTaskCount: number;
  activeTaskIds: string[];
  lastPollAt?: Date;
  pollCount: number;
  isRunning: boolean;

  /**
   * NEW: Whether task processing is paused due to capacity threshold
   */
  isPausedByCapacity: boolean;

  /**
   * NEW: Current capacity percentage (0-1)
   */
  capacityPercentage: number;

  /**
   * NEW: Current capacity threshold for the active time window (0-1)
   */
  capacityThreshold: number;

  /**
   * NEW: When the last capacity check occurred
   */
  lastCapacityCheck?: Date;

  /**
   * NEW: Current time window mode
   */
  timeWindowMode?: 'day' | 'night' | 'off-hours';
}
```

### 4. Updated EnhancedDaemonEvents

```typescript
// File: packages/orchestrator/src/enhanced-daemon.ts

import { SchedulingDecision } from './daemon-scheduler';

export interface EnhancedDaemonEvents {
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

  /**
   * NEW: Emitted when task processing is paused due to capacity threshold
   */
  'daemon:capacity-paused': (decision: SchedulingDecision) => void;

  /**
   * NEW: Emitted when task processing resumes after capacity restored
   */
  'daemon:capacity-resumed': (decision: SchedulingDecision) => void;
}
```

## Implementation Details

### 1. DaemonRunner Modifications

```typescript
// File: packages/orchestrator/src/runner.ts

import { EventEmitter } from 'eventemitter3';
import { DaemonScheduler, SchedulingDecision } from './daemon-scheduler';

export class DaemonRunner extends EventEmitter<DaemonRunnerEvents> {
  // NEW: Scheduler for capacity-based decisions
  private scheduler: DaemonScheduler | null = null;

  // NEW: Track capacity pause state
  private isPausedByCapacity = false;

  // NEW: Cache last scheduling decision for metrics
  private lastSchedulingDecision: SchedulingDecision | null = null;

  constructor(options: DaemonRunnerOptions) {
    super();
    // ... existing initialization

    // NEW: Store scheduler if provided
    if (options.scheduler) {
      this.scheduler = options.scheduler;
    }
  }

  /**
   * Poll for new tasks and execute them
   * Modified to check capacity threshold before starting new tasks
   */
  private async poll(): Promise<void> {
    if (this.isShuttingDown || !this.store) {
      return;
    }

    this.pollCount++;
    this.lastPollAt = new Date();

    // NEW: Check capacity threshold before processing
    if (this.scheduler) {
      const decision = this.scheduler.shouldPauseTasks();
      this.lastSchedulingDecision = decision;

      if (decision.shouldPause) {
        // State transition: running -> paused
        if (!this.isPausedByCapacity) {
          this.isPausedByCapacity = true;
          this.log('warn', `Capacity threshold reached: ${decision.reason}`, {
            metadata: {
              capacity: decision.capacity.currentPercentage,
              threshold: decision.capacity.threshold,
              timeWindow: decision.timeWindow.mode,
            }
          });
          this.emit('daemon:capacity-paused', decision);
        } else {
          // Already paused, log at debug level
          this.log('debug', `Still paused by capacity (${(decision.capacity.currentPercentage * 100).toFixed(1)}%)`);
        }
        return; // Skip task fetching
      }

      // Capacity OK - check if we need to resume
      if (this.isPausedByCapacity) {
        // State transition: paused -> running
        this.isPausedByCapacity = false;
        this.log('info', `Capacity restored (${(decision.capacity.currentPercentage * 100).toFixed(1)}% < ${(decision.capacity.threshold * 100).toFixed(1)}%), resuming task processing`);
        this.emit('daemon:capacity-resumed', decision);
      }
    }

    // ... existing concurrent slot check and task fetching (unchanged)
    const availableSlots = this.options.maxConcurrentTasks - this.runningTasks.size;
    if (availableSlots <= 0) {
      this.log('debug', `At capacity (${this.runningTasks.size}/${this.options.maxConcurrentTasks})`);
      return;
    }

    try {
      for (let i = 0; i < availableSlots; i++) {
        const task = await this.store.getNextQueuedTask();
        if (!task) {
          break;
        }
        if (this.runningTasks.has(task.id)) {
          continue;
        }
        this.startTask(task.id);
      }
    } catch (error) {
      this.log('error', `Failed to get tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Get current daemon metrics
   * Modified to include capacity information
   */
  getMetrics(): DaemonMetrics {
    const baseMetrics = {
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

    // NEW: Add capacity metrics
    if (this.lastSchedulingDecision) {
      return {
        ...baseMetrics,
        isPausedByCapacity: this.isPausedByCapacity,
        capacityPercentage: this.lastSchedulingDecision.capacity.currentPercentage,
        capacityThreshold: this.lastSchedulingDecision.capacity.threshold,
        lastCapacityCheck: this.lastPollAt ?? undefined,
        timeWindowMode: this.lastSchedulingDecision.timeWindow.mode,
      };
    }

    // No scheduler configured - return defaults
    return {
      ...baseMetrics,
      isPausedByCapacity: false,
      capacityPercentage: 0,
      capacityThreshold: 1,
      lastCapacityCheck: undefined,
      timeWindowMode: undefined,
    };
  }
}
```

### 2. EnhancedDaemon Modifications

```typescript
// File: packages/orchestrator/src/enhanced-daemon.ts

import { DaemonScheduler, UsageManagerProvider, SchedulingDecision } from './daemon-scheduler';

export class EnhancedDaemon extends EventEmitter<EnhancedDaemonEvents> {
  // NEW: DaemonScheduler instance
  private scheduler: DaemonScheduler;

  private initializeComponents(): void {
    const daemonConfig = this.config.daemon || {};
    const limitsConfig = this.config.limits || {};

    // Initialize usage manager first (unchanged)
    this.usageManager = new UsageManager(daemonConfig, limitsConfig);

    // NEW: Initialize DaemonScheduler with UsageManager adapter
    const usageProvider = new UsageManagerProvider(this.usageManager);
    this.scheduler = new DaemonScheduler(daemonConfig, limitsConfig, usageProvider);

    // Initialize daemon runner WITH scheduler
    this.daemonRunner = new DaemonRunner({
      projectPath: this.projectPath,
      config: this.config,
      scheduler: this.scheduler,  // NEW: Inject scheduler
    });

    // ... rest of initialization (unchanged)
  }

  private setupEventHandlers(): void {
    // ... existing handlers (unchanged)

    // NEW: Forward capacity threshold events from DaemonRunner
    this.daemonRunner.on('daemon:capacity-paused', (decision: SchedulingDecision) => {
      this.emit('daemon:capacity-paused', decision);
      console.log(`\u26A0\uFE0F Task processing paused: ${decision.reason}`);
      if (decision.recommendations?.length) {
        console.log(`   Recommendations: ${decision.recommendations.join(', ')}`);
      }
    });

    this.daemonRunner.on('daemon:capacity-resumed', (decision: SchedulingDecision) => {
      this.emit('daemon:capacity-resumed', decision);
      console.log(`\u2705 Task processing resumed (capacity: ${(decision.capacity.currentPercentage * 100).toFixed(1)}%)`);
    });
  }

  /**
   * NEW: Get current scheduling status
   */
  getSchedulingStatus(): SchedulingDecision {
    return this.scheduler.shouldPauseTasks();
  }

  /**
   * NEW: Get scheduler for external access (e.g., CLI status display)
   */
  getScheduler(): DaemonScheduler {
    return this.scheduler;
  }
}
```

### 3. Required Imports Update

```typescript
// File: packages/orchestrator/src/index.ts (exports)

export { DaemonRunner, DaemonRunnerOptions, DaemonMetrics, DaemonRunnerEvents } from './runner';
export {
  DaemonScheduler,
  UsageManagerProvider,
  SchedulingDecision,
  TimeWindow,
  CapacityInfo,
  UsageStatsProvider
} from './daemon-scheduler';
export { EnhancedDaemon, EnhancedDaemonEvents } from './enhanced-daemon';
```

## Test Cases

### Unit Tests for DaemonRunner

```typescript
// File: packages/orchestrator/src/runner.capacity.test.ts

describe('DaemonRunner capacity threshold integration', () => {
  describe('poll() with scheduler', () => {
    it('should skip task fetching when capacity threshold exceeded', async () => {
      const mockScheduler = createMockScheduler({
        shouldPause: true,
        reason: 'Capacity threshold exceeded (92.0% >= 90.0%)',
        capacity: { currentPercentage: 0.92, threshold: 0.90, shouldPause: true }
      });

      const runner = new DaemonRunner({
        projectPath: '/test',
        scheduler: mockScheduler
      });

      await runner.poll();

      expect(mockStore.getNextQueuedTask).not.toHaveBeenCalled();
    });

    it('should emit daemon:capacity-paused on state transition', async () => {
      const pausedSpy = vi.fn();
      runner.on('daemon:capacity-paused', pausedSpy);

      // First poll - transitions to paused
      mockScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'Threshold exceeded'
      });
      await runner.poll();

      expect(pausedSpy).toHaveBeenCalledTimes(1);

      // Second poll - already paused, no event
      await runner.poll();
      expect(pausedSpy).toHaveBeenCalledTimes(1);
    });

    it('should emit daemon:capacity-resumed when threshold cleared', async () => {
      const resumedSpy = vi.fn();
      runner.on('daemon:capacity-resumed', resumedSpy);

      // Transition to paused
      mockScheduler.shouldPauseTasks.mockReturnValue({ shouldPause: true });
      await runner.poll();

      // Transition back to running
      mockScheduler.shouldPauseTasks.mockReturnValue({ shouldPause: false });
      await runner.poll();

      expect(resumedSpy).toHaveBeenCalledTimes(1);
    });

    it('should include capacity info in metrics', () => {
      mockScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        capacity: { currentPercentage: 0.75, threshold: 0.90 },
        timeWindow: { mode: 'day' }
      });

      runner.poll();
      const metrics = runner.getMetrics();

      expect(metrics.isPausedByCapacity).toBe(false);
      expect(metrics.capacityPercentage).toBe(0.75);
      expect(metrics.capacityThreshold).toBe(0.90);
      expect(metrics.timeWindowMode).toBe('day');
    });
  });

  describe('backward compatibility', () => {
    it('should work without scheduler (existing behavior)', async () => {
      const runner = new DaemonRunner({
        projectPath: '/test',
        // No scheduler provided
      });

      await runner.poll();

      // Should proceed with normal task fetching
      expect(mockStore.getNextQueuedTask).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```typescript
// File: packages/orchestrator/src/enhanced-daemon.capacity.integration.test.ts

describe('EnhancedDaemon capacity threshold integration', () => {
  it('should pause task processing when day mode threshold exceeded', async () => {
    const daemon = new EnhancedDaemon('/test', {
      ...baseConfig,
      daemon: {
        timeBasedUsage: {
          enabled: true,
          dayModeCapacityThreshold: 0.90
        }
      },
      limits: { dailyBudget: 100 }
    });

    const pausedSpy = vi.fn();
    daemon.on('daemon:capacity-paused', pausedSpy);

    // Simulate usage at 92%
    daemon.getUsageManager().trackTaskCompletion('task1', { totalCost: 92 }, true);

    await daemon.start();
    // Wait for poll
    await vi.advanceTimersByTimeAsync(5000);

    expect(pausedSpy).toHaveBeenCalled();
    expect(pausedSpy.mock.calls[0][0].reason).toContain('Capacity threshold exceeded');
  });

  it('should use 96% threshold during night mode', async () => {
    vi.setSystemTime(new Date('2024-01-15T23:00:00')); // 11 PM

    const daemon = new EnhancedDaemon('/test', {
      daemon: {
        timeBasedUsage: {
          enabled: true,
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          nightModeCapacityThreshold: 0.96
        }
      }
    });

    // At 94%, should NOT pause (below 96% threshold)
    daemon.getUsageManager().trackTaskCompletion('task1', { totalCost: 94 }, true);

    const pausedSpy = vi.fn();
    daemon.on('daemon:capacity-paused', pausedSpy);

    await daemon.start();
    await vi.advanceTimersByTimeAsync(5000);

    expect(pausedSpy).not.toHaveBeenCalled();
  });

  it('should resume when capacity drops below threshold', async () => {
    // Setup at 92% (paused)
    const daemon = createDaemonAt92Percent();

    const resumedSpy = vi.fn();
    daemon.on('daemon:capacity-resumed', resumedSpy);

    await daemon.start();

    // Simulate daily reset (new day)
    vi.setSystemTime(new Date('2024-01-16T00:00:00'));
    daemon.getUsageManager().resetDailyUsage();

    await vi.advanceTimersByTimeAsync(5000);

    expect(resumedSpy).toHaveBeenCalled();
  });
});
```

## Sequence Diagram

```
┌────────┐     ┌─────────────┐     ┌───────────────┐     ┌─────────────┐     ┌──────────────┐
│  CLI   │     │EnhancedDaemon│     │ DaemonRunner  │     │DaemonScheduler│   │ UsageManager │
└───┬────┘     └──────┬──────┘     └───────┬───────┘     └──────┬───────┘     └──────┬───────┘
    │                 │                    │                    │                    │
    │  start()        │                    │                    │                    │
    ├────────────────►│                    │                    │                    │
    │                 │                    │                    │                    │
    │                 │  start()           │                    │                    │
    │                 ├───────────────────►│                    │                    │
    │                 │                    │                    │                    │
    │                 │                    │ [poll interval]    │                    │
    │                 │                    │ ─ ─ ─ ─ ┐          │                    │
    │                 │                    │         │          │                    │
    │                 │                    │◄─ ─ ─ ─ ┘          │                    │
    │                 │                    │                    │                    │
    │                 │                    │ shouldPauseTasks() │                    │
    │                 │                    ├───────────────────►│                    │
    │                 │                    │                    │                    │
    │                 │                    │                    │ getCurrentDailyUsage()
    │                 │                    │                    ├───────────────────►│
    │                 │                    │                    │                    │
    │                 │                    │                    │◄─ {totalCost: 92}  │
    │                 │                    │                    │                    │
    │                 │                    │◄───────────────────┤                    │
    │                 │                    │ {shouldPause: true,│                    │
    │                 │                    │  reason: "92% >= 90%"}                  │
    │                 │                    │                    │                    │
    │                 │'daemon:capacity-   │                    │                    │
    │                 │ paused' event      │                    │                    │
    │                 │◄───────────────────┤                    │                    │
    │                 │                    │                    │                    │
    │◄────────────────┤ [Log: "Paused"]    │                    │                    │
    │                 │                    │                    │                    │
    │                 │                    │ [Skip task fetch]  │                    │
    │                 │                    │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ►│                    │
    │                 │                    │                    │                    │
```

## Error Handling

### UsageManager Not Available

```typescript
private async poll(): Promise<void> {
  if (this.scheduler) {
    try {
      const decision = this.scheduler.shouldPauseTasks();
      // ... handle decision
    } catch (error) {
      // Log error but don't block task processing
      this.log('error', `Scheduler error: ${error.message}, continuing without capacity check`);
      // Fall through to normal task processing
    }
  }
  // ... continue with normal poll logic
}
```

### Invalid Configuration

The DaemonScheduler already handles missing/invalid configuration gracefully by using defaults:
- Day threshold: 0.90 (if not configured)
- Night threshold: 0.96 (if not configured)
- Disabled timeBasedUsage: Uses 1.0 (100%) threshold

## Performance Considerations

1. **Minimal Overhead**: `shouldPauseTasks()` is a fast, synchronous operation
2. **Caching**: The scheduling decision is cached for metrics without re-computation
3. **No Database Calls**: Capacity checking uses in-memory UsageManager stats
4. **Single Check Per Poll**: One scheduler call per poll cycle

## Migration Guide

### Existing DaemonRunner Users

No changes required. The scheduler is optional and existing code without a scheduler continues to work unchanged.

### EnhancedDaemon Users

No code changes required. The integration is automatic when using EnhancedDaemon.

### CLI Users

New commands available (optional enhancement):
- `apex daemon status` - Now shows capacity percentage and threshold
- `apex daemon status --watch` - Live capacity monitoring
