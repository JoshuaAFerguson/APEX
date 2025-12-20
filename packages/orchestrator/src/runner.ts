import { createWriteStream, WriteStream, promises as fs } from 'fs';
import { join } from 'path';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import { loadConfig, getEffectiveConfig, ApexConfig, Task, DaemonConfig } from '@apexcli/core';
import { UsageManager } from './usage-manager';
import { DaemonScheduler, UsageManagerProvider } from './daemon-scheduler';
import { CapacityMonitor, CapacityRestoredEvent } from './capacity-monitor';
import { CapacityMonitorUsageAdapter } from './capacity-monitor-usage-adapter';

// ============================================================================
// Interface Definitions
// ============================================================================

export interface DaemonRunnerOptions {
  /**
   * Path to the project directory containing .apex/
   * Required for loading config and accessing TaskStore
   */
  projectPath: string;

  /**
   * Interval in milliseconds between polling for new tasks
   * Default: 5000 (5 seconds) or from config.daemon.pollInterval
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

  /**
   * Log level for daemon logging
   * Default: 'info' or from config.daemon.logLevel
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Optional pre-loaded config to avoid re-loading
   * If not provided, config will be loaded from projectPath
   */
  config?: ApexConfig;
}

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

  /** Whether task processing is paused due to capacity limits */
  isPaused: boolean;

  /** Reason for pausing if applicable */
  pauseReason?: string;
}

export interface DaemonLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// DaemonRunner Implementation
// ============================================================================

export class DaemonRunner {
  // Dependencies
  private orchestrator: ApexOrchestrator | null = null;
  private store: TaskStore | null = null;
  private config: ApexConfig | null = null;
  private usageManager: UsageManager | null = null;
  private daemonScheduler: DaemonScheduler | null = null;
  private capacityMonitor: CapacityMonitor | null = null;

  // Configuration
  private readonly options: Required<DaemonRunnerOptions>;

  // State
  private isRunning = false;
  private isShuttingDown = false;
  private isPaused = false;
  private pauseReason: string | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private runningTasks: Map<string, Promise<void>> = new Map();
  private stateUpdateInterval: NodeJS.Timeout | null = null;

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
    // Store the raw options - we'll resolve defaults in start() after loading config
    this.options = {
      projectPath: options.projectPath,
      pollIntervalMs: options.pollIntervalMs, // Will be resolved in start()
      maxConcurrentTasks: options.maxConcurrentTasks ?? 0, // 0 = use config
      logFile: options.logFile ?? join(options.projectPath, '.apex', 'daemon.log'),
      logToStdout: options.logToStdout ?? false,
      logLevel: options.logLevel, // Will be resolved in start()
      config: options.config, // Optional pre-loaded config
    } as Required<DaemonRunnerOptions>;
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
      // Load configuration (use pre-loaded if available)
      this.config = this.options.config ?? await loadConfig(this.options.projectPath);
      const effectiveConfig = getEffectiveConfig(this.config);

      // Resolve defaults from config
      const daemonConfig = effectiveConfig.daemon ?? {};

      // Apply config defaults if options were not explicitly provided
      if (this.options.pollIntervalMs === undefined) {
        this.options.pollIntervalMs = daemonConfig.pollInterval ?? 5000;
      }
      if (this.options.logLevel === undefined) {
        this.options.logLevel = daemonConfig.logLevel ?? 'info';
      }

      // Validate and constrain pollIntervalMs
      this.options.pollIntervalMs = Math.max(1000, Math.min(60000, this.options.pollIntervalMs));

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

      // Initialize UsageManager and DaemonScheduler for capacity monitoring
      this.usageManager = new UsageManager(effectiveConfig.daemon || {}, effectiveConfig.limits);
      const usageProvider = new UsageManagerProvider(this.usageManager);
      this.daemonScheduler = new DaemonScheduler(
        effectiveConfig.daemon || {},
        effectiveConfig.limits,
        usageProvider
      );

      // Initialize CapacityMonitor for auto-resume functionality
      const capacityUsageProvider = new CapacityMonitorUsageAdapter(
        this.usageManager,
        effectiveConfig.daemon || {},
        effectiveConfig.limits
      );
      this.capacityMonitor = new CapacityMonitor(
        effectiveConfig.daemon || {},
        effectiveConfig.limits,
        capacityUsageProvider
      );

      // Subscribe to orchestrator events for logging
      this.setupOrchestratorEvents();

      // Setup capacity monitor events for auto-resume
      this.setupCapacityMonitorEvents();

      // Setup signal handlers
      this.setupSignalHandlers();

      // Start
      this.isRunning = true;
      this.startedAt = new Date();

      this.log('info', `Daemon started (poll: ${this.options.pollIntervalMs}ms, max concurrent: ${this.options.maxConcurrentTasks})`);

      // Start capacity monitoring for auto-resume
      if (this.capacityMonitor) {
        this.capacityMonitor.start();
        this.log('info', 'Capacity monitoring started for auto-resume');
      }

      // Write initial state file
      await this.writeStateFile();

      // Start periodic state file updates (every 30 seconds)
      this.stateUpdateInterval = setInterval(() => {
        if (this.isRunning && !this.isShuttingDown) {
          this.writeStateFile().catch(err => {
            this.log('error', `State file update error: ${err.message}`);
          });
        }
      }, 30000);

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

    // Stop polling and state updates
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.stateUpdateInterval) {
      clearInterval(this.stateUpdateInterval);
      this.stateUpdateInterval = null;
    }

    // Write final state file with running: false
    try {
      await this.writeStateFile(false);
    } catch (error) {
      this.log('error', `Failed to write final state file: ${(error as Error).message}`);
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
      isPaused: this.isPaused,
      pauseReason: this.pauseReason ?? undefined,
    };
  }

  /**
   * Set the paused state and emit appropriate events
   */
  private setPaused(paused: boolean, reason?: string): void {
    const wasUnpaused = !this.isPaused;
    this.isPaused = paused;
    this.pauseReason = reason ?? null;

    if (paused && wasUnpaused) {
      this.log('warn', `Daemon auto-paused: ${reason || 'Capacity threshold exceeded'}`);
      // Emit pause event through orchestrator if available
      if (this.orchestrator) {
        this.orchestrator.emit('daemon:paused', reason || 'Capacity threshold exceeded');
      }
      // Update state file immediately on pause
      this.writeStateFile().catch(err => {
        this.log('error', `Failed to update state file on pause: ${err.message}`);
      });
    } else if (!paused && !wasUnpaused) {
      this.log('info', 'Daemon auto-resumed: Capacity threshold no longer exceeded');
      // Emit resume event through orchestrator if available
      if (this.orchestrator) {
        this.orchestrator.emit('daemon:resumed');
      }
      // Update state file immediately on resume
      this.writeStateFile().catch(err => {
        this.log('error', `Failed to update state file on resume: ${err.message}`);
      });
    }
  }

  /**
   * Handle capacity restored events for auto-resume functionality
   */
  private async handleCapacityRestored(event: CapacityRestoredEvent): Promise<void> {
    if (this.isShuttingDown || !this.store || !this.orchestrator) {
      return;
    }

    try {
      this.log('info', `Capacity restored: ${event.reason}`, {
        taskId: undefined,
      });

      // Fetch paused tasks that can be resumed
      const pausedTasks = await this.store.getPausedTasksForResume();

      if (pausedTasks.length === 0) {
        this.log('debug', 'No resumable paused tasks found');
        return;
      }

      let resumedCount = 0;
      const errors: Array<{taskId: string; error: string}> = [];

      // Attempt to resume each paused task
      for (const task of pausedTasks) {
        try {
          const resumed = await this.orchestrator.resumePausedTask(task.id);
          if (resumed) {
            resumedCount++;
            this.log('info', `Auto-resumed task ${task.id}`, { taskId: task.id });
          } else {
            this.log('warn', `Failed to resume task ${task.id}: Task not in resumable state`, { taskId: task.id });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ taskId: task.id, error: errorMessage });
          this.log('error', `Error resuming task ${task.id}: ${errorMessage}`, { taskId: task.id });
        }
      }

      // Emit auto-resumed event with summary
      if (this.orchestrator) {
        this.orchestrator.emit('tasks:auto-resumed', {
          reason: event.reason,
          totalTasks: pausedTasks.length,
          resumedCount,
          errors,
          timestamp: new Date(),
        });
      }

      this.log('info', `Auto-resume completed: ${resumedCount}/${pausedTasks.length} tasks resumed`);

      if (errors.length > 0) {
        this.log('warn', `${errors.length} tasks failed to resume during auto-resume`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', `Auto-resume process failed: ${errorMessage}`);
    }
  }

  /**
   * Poll for new tasks and execute them
   */
  private async poll(): Promise<void> {
    if (this.isShuttingDown || !this.store || !this.daemonScheduler) {
      return;
    }

    this.pollCount++;
    this.lastPollAt = new Date();

    // Check capacity threshold using DaemonScheduler
    const schedulingDecision = this.daemonScheduler.shouldPauseTasks();

    if (schedulingDecision.shouldPause) {
      if (!this.isPaused) {
        // Just became paused
        this.setPaused(true, schedulingDecision.reason || 'Capacity threshold exceeded');
      }
      return;
    } else if (this.isPaused) {
      // Resume from pause
      this.setPaused(false);
    }

    // Check available concurrent task slots
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
    if (!this.orchestrator || !this.usageManager) {
      return;
    }

    this.log('info', `Starting task ${taskId}`, { taskId });
    this.tasksProcessed++;

    // Track task start with UsageManager
    this.usageManager.trackTaskStart(taskId);

    const startTime = Date.now();

    const taskPromise = this.orchestrator.executeTask(taskId)
      .then(() => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log('info', `Task ${taskId} completed (${duration}s)`, { taskId });
        this.tasksSucceeded++;

        // Track task completion with estimated usage (we can improve this later with actual usage)
        const estimatedUsage = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        };
        this.usageManager!.trackTaskCompletion(taskId, estimatedUsage, true);
      })
      .catch((error: Error) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log('error', `Task ${taskId} failed (${duration}s): ${error.message}`, { taskId });
        this.tasksFailed++;

        // Track task completion as failed
        const estimatedUsage = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        };
        this.usageManager!.trackTaskCompletion(taskId, estimatedUsage, false);
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

    this.orchestrator.on('task:failed', (task, error) => {
      this.log('error', `Task ${task.id} orchestrator failure: ${error.message}`, { taskId: task.id });
    });

    this.orchestrator.on('task:completed', (task) => {
      this.log('info', `Task ${task.id} orchestrator completion`, { taskId: task.id });
    });
  }

  /**
   * Setup capacity monitor events for auto-resume functionality
   */
  private setupCapacityMonitorEvents(): void {
    if (!this.capacityMonitor) return;

    this.capacityMonitor.on('capacity:restored', (event) => {
      // Handle capacity restoration for auto-resume
      this.handleCapacityRestored(event).catch((error) => {
        this.log('error', `Failed to handle capacity restoration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    });
  }

  /**
   * Write current daemon state to the state file for status queries
   */
  private async writeStateFile(running: boolean = true): Promise<void> {
    if (!this.startedAt) {
      return;
    }

    const stateFilePath = join(this.options.projectPath, '.apex', 'daemon-state.json');

    try {
      let capacityInfo: any = undefined;

      // Get capacity information if daemon is running and scheduler is available
      if (running && this.daemonScheduler) {
        const usageStats = this.daemonScheduler.getUsageStats();

        capacityInfo = {
          mode: usageStats.timeWindow.mode,
          capacityThreshold: usageStats.capacity.threshold,
          currentUsagePercent: usageStats.capacity.currentPercentage,
          isAutoPaused: this.isPaused,
          pauseReason: this.pauseReason,
          nextModeSwitch: usageStats.timeWindow.nextTransition.toISOString(),
          timeBasedUsageEnabled: usageStats.timeWindow.isActive || usageStats.timeWindow.mode !== 'off-hours',
        };
      }

      const stateData = {
        timestamp: new Date().toISOString(),
        pid: process.pid,
        startedAt: this.startedAt.toISOString(),
        running,
        capacity: capacityInfo,
      };

      await fs.writeFile(stateFilePath, JSON.stringify(stateData, null, 2));

      this.log('debug', 'State file updated');
    } catch (error) {
      this.log('error', `Failed to write state file: ${(error as Error).message}`);
    }
  }

  /**
   * Log a message to the log file
   */
  private log(
    level: DaemonLogEntry['level'],
    message: string,
    metadata?: { taskId?: string }
  ): void {
    // Check if this log level should be written based on configured log level
    if (!this.shouldLog(level)) {
      return;
    }

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
   * Check if a log level should be written based on configured log level
   */
  private shouldLog(level: DaemonLogEntry['level']): boolean {
    const configuredLevel = this.options.logLevel ?? 'info';
    const levels = ['debug', 'info', 'warn', 'error'];
    const configuredIndex = levels.indexOf(configuredLevel);
    const messageIndex = levels.indexOf(level);

    // Log if message level is at or above configured level
    return messageIndex >= configuredIndex;
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Stop capacity monitor
    if (this.capacityMonitor) {
      this.capacityMonitor.stop();
      this.log('info', 'Capacity monitor stopped');
    }

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