import { createWriteStream, WriteStream, promises as fs } from 'fs';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { ApexOrchestrator, TaskSessionResumedEvent } from './index';
import { TaskStore } from './store';
import { loadConfig, getEffectiveConfig, ApexConfig, Task, TaskStatus, DaemonConfig, TaskSessionData } from '@apexcli/core';
import { UsageManager } from './usage-manager';
import { DaemonScheduler, UsageManagerProvider } from './daemon-scheduler';
import { CapacityMonitor, CapacityRestoredEvent } from './capacity-monitor';
import { CapacityMonitorUsageAdapter } from './capacity-monitor-usage-adapter';
import { createContextSummary } from './context';
import { HealthMonitor } from './health-monitor';

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

  /**
   * Optional HealthMonitor instance for tracking health metrics
   * If not provided, no health metrics will be tracked
   */
  healthMonitor?: HealthMonitor;
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
  private healthMonitor: HealthMonitor | null = null;

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
  private orphanCheckInterval: NodeJS.Timeout | null = null;
  private pausedTaskCheckInterval: NodeJS.Timeout | null = null;

  // Metrics
  private startedAt: Date | null = null;
  private tasksProcessed = 0;
  private tasksSucceeded = 0;
  private tasksFailed = 0;
  private pollCount = 0;
  private lastPollAt: Date | null = null;

  // Logging
  private logStream: WriteStream | null = null;

  // Integrated services (API and Web UI)
  private apiProcess: ChildProcess | null = null;
  private webuiProcess: ChildProcess | null = null;
  private apiRestartCount = 0;
  private webuiRestartCount = 0;
  private static readonly MAX_SERVICE_RESTARTS = 3;

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
      healthMonitor: options.healthMonitor, // Optional health monitor
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

      // Store healthMonitor if provided
      this.healthMonitor = this.options.healthMonitor || null;

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

      // Start integrated services if configured
      await this.startIntegratedServices(daemonConfig);

      // Reset any in-progress tasks immediately on startup
      // A fresh daemon can't have any legitimately running tasks
      await this.resetInterruptedTasksOnStartup();

      // Detect and handle orphaned tasks from previous daemon instances (staleness-based)
      await this.detectAndHandleOrphanedTasks();

      // Setup periodic orphan detection if enabled
      this.setupPeriodicOrphanDetection();

      // Setup periodic check for paused tasks that can be resumed
      this.setupPeriodicPausedTaskCheck();

      // Setup periodic stuck task auto-triage
      this.setupPeriodicStuckTaskCheck();

      // Initial check for paused tasks on startup
      await this.checkAndResumePausedTasks();

      // Initial auto-triage check on startup
      await this.checkAndRepairStuckTasks();

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

    if (this.orphanCheckInterval) {
      clearInterval(this.orphanCheckInterval);
      this.orphanCheckInterval = null;
    }

    if (this.pausedTaskCheckInterval) {
      clearInterval(this.pausedTaskCheckInterval);
      this.pausedTaskCheckInterval = null;
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
   * Generate an aggregated context summary for all resumed tasks.
   * This provides a high-level overview of what tasks were resumed and their context.
   *
   * @param resumedTasks - Array of successfully resumed tasks with their session data
   * @param failedTasks - Array of tasks that failed to resume with error details
   * @param reason - The capacity restoration reason
   * @returns A formatted context summary string
   */
  private generateAggregatedContextSummary(
    resumedTasks: Array<{
      task: Task;
      sessionData?: TaskSessionData;
    }>,
    failedTasks: Array<{ taskId: string; error: string }>,
    reason: string
  ): string {
    const summaryParts: string[] = [];

    // Header with capacity restoration reason
    summaryParts.push(`Auto-resume triggered by: ${reason}`);

    if (resumedTasks.length > 0) {
      summaryParts.push(`\nSuccessfully resumed ${resumedTasks.length} task(s):`);

      for (const { task, sessionData } of resumedTasks) {
        const taskSummary = [
          `• ${task.id} (${task.priority})`,
          task.description.length > 60 ? `${task.description.substring(0, 57)}...` : task.description
        ];

        // Add context from session data if available
        if (sessionData?.contextSummary) {
          const trimmedContext = sessionData.contextSummary.length > 100
            ? `${sessionData.contextSummary.substring(0, 97)}...`
            : sessionData.contextSummary;
          taskSummary.push(`Context: ${trimmedContext}`);
        }

        if (task.currentStage) {
          taskSummary.push(`Stage: ${task.currentStage}`);
        }

        summaryParts.push(`  ${taskSummary.join(', ')}`);
      }
    }

    if (failedTasks.length > 0) {
      summaryParts.push(`\nFailed to resume ${failedTasks.length} task(s):`);
      for (const { taskId, error } of failedTasks) {
        const errorSummary = error.length > 80 ? `${error.substring(0, 77)}...` : error;
        summaryParts.push(`  • ${taskId}: ${errorSummary}`);
      }
    }

    return summaryParts.join('\n');
  }

  /**
   * Generate a detailed resume reason based on the capacity restoration event
   * @param eventReason - The original capacity restoration reason
   * @returns A human-readable detailed description
   */
  private generateDetailedResumeReason(eventReason: string): string {
    const reasonMap: Record<string, string> = {
      'mode_switch': 'Time-based mode switched from day to night mode, increasing capacity thresholds',
      'budget_reset': 'Daily budget was reset, allowing new tasks to be processed',
      'capacity_dropped': 'System usage dropped below capacity thresholds, freeing up resources',
      'manual_override': 'Capacity limits were manually adjusted or disabled',
      'usage_expired': 'Previous high-usage period expired, restoring normal capacity'
    };

    return reasonMap[eventReason] || `Capacity restored: ${eventReason}`;
  }

  /**
   * Emit a task:session-resumed event for an individual task.
   * This provides detailed context about the specific task that was resumed.
   *
   * @param task - The task that was resumed
   * @param resumeReason - Detailed reason for the resume
   * @param sessionData - Session recovery data if available
   */
  private emitTaskSessionResumed(
    task: Task,
    resumeReason: string,
    sessionData?: TaskSessionData
  ): void {
    if (!this.orchestrator) {
      return;
    }

    // Generate context summary for this specific task
    let contextSummary = 'No previous session context available';

    if (sessionData?.contextSummary) {
      contextSummary = sessionData.contextSummary;
    } else if (sessionData?.conversationHistory) {
      // Generate summary from conversation history if available
      try {
        contextSummary = createContextSummary(sessionData.conversationHistory);
      } catch (error) {
        this.log('debug', `Failed to create context summary for task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        contextSummary = `Task was in stage: ${task.currentStage || 'unknown'}, previous session data partially available`;
      }
    } else if (task.currentStage) {
      contextSummary = `Task was paused in stage: ${task.currentStage}, resuming from checkpoint`;
    }

    const event: TaskSessionResumedEvent = {
      taskId: task.id,
      resumeReason,
      contextSummary,
      previousStatus: 'paused', // We know it was paused since we're resuming it
      sessionData: sessionData || {
        lastCheckpoint: new Date(),
        contextSummary,
      },
      timestamp: new Date(),
    };

    this.orchestrator.emit('task:session-resumed', event);

    this.log('debug', `Emitted task:session-resumed for ${task.id}`, {
      taskId: task.id,
      metadata: {
        resumeReason,
        contextSummaryLength: contextSummary.length,
        hasSessionData: !!sessionData,
      },
    });
  }

  /**
   * Handle capacity restored events for auto-resume functionality
   *
   * Resume order:
   * 1. Parent tasks (tasks with subtasks) by priority
   * 2. Their subtasks (if paused with resumable reasons)
   * 3. Remaining non-parent paused tasks by priority
   */
  private async handleCapacityRestored(event: CapacityRestoredEvent): Promise<void> {
    if (this.isShuttingDown || !this.store || !this.orchestrator) {
      return;
    }

    try {
      this.log('info', `Capacity restored: ${event.reason}`, {
        taskId: undefined,
      });

      let totalResumedCount = 0;
      const errors: Array<{taskId: string; error: string}> = [];
      const resumedTasks: Array<{task: Task; sessionData?: TaskSessionData}> = [];

      // Generate detailed resume reason for events
      const detailedResumeReason = this.generateDetailedResumeReason(event.reason);

      // Phase 1: Resume highest priority parent tasks first
      const pausedParentTasks = await this.store.findHighestPriorityParentTask();

      if (pausedParentTasks.length > 0) {
        this.log('info', `Found ${pausedParentTasks.length} paused parent task(s) for resume`);

        for (const parentTask of pausedParentTasks) {
          try {
            // Get task session data before resuming
            const sessionData = parentTask.sessionData;

            const resumed = await this.orchestrator.resumePausedTask(parentTask.id);
            if (resumed) {
              totalResumedCount++;
              this.log('info', `Auto-resumed parent task ${parentTask.id}`, { taskId: parentTask.id });

              // Track resumed task with session data
              resumedTasks.push({ task: parentTask, sessionData });

              // Emit task:session-resumed event for this individual task
              this.emitTaskSessionResumed(parentTask, detailedResumeReason, sessionData);

              // Parent resumed - also check and resume its subtasks if needed
              await this.resumeParentSubtasksIfNeeded(parentTask.id);
            } else {
              this.log('warn', `Failed to resume parent task ${parentTask.id}: Task not in resumable state`, { taskId: parentTask.id });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ taskId: parentTask.id, error: errorMessage });
            this.log('error', `Error resuming parent task ${parentTask.id}: ${errorMessage}`, { taskId: parentTask.id });
          }
        }
      }

      // Phase 2: Resume remaining paused tasks (non-parent) by priority
      const allPausedTasks = await this.store.getPausedTasksForResume();
      const resumedParentIds = new Set(pausedParentTasks.map(p => p.id));

      // Filter out already-resumed parent tasks
      const remainingTasks = allPausedTasks.filter(task => !resumedParentIds.has(task.id));

      if (remainingTasks.length > 0) {
        this.log('info', `Found ${remainingTasks.length} remaining paused task(s) for resume`);

        for (const task of remainingTasks) {
          try {
            // Get task session data before resuming
            const sessionData = task.sessionData;

            const resumed = await this.orchestrator.resumePausedTask(task.id);
            if (resumed) {
              totalResumedCount++;
              this.log('info', `Auto-resumed task ${task.id}`, { taskId: task.id });

              // Track resumed task with session data
              resumedTasks.push({ task, sessionData });

              // Emit task:session-resumed event for this individual task
              this.emitTaskSessionResumed(task, detailedResumeReason, sessionData);
            } else {
              this.log('warn', `Failed to resume task ${task.id}: Task not in resumable state`, { taskId: task.id });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ taskId: task.id, error: errorMessage });
            this.log('error', `Error resuming task ${task.id}: ${errorMessage}`, { taskId: task.id });
          }
        }
      }

      // Generate aggregated context summary from all resumed tasks
      const contextSummary = this.generateAggregatedContextSummary(
        resumedTasks,
        errors,
        event.reason
      );

      // Emit enhanced auto-resumed event with populated contextSummary
      if (this.orchestrator) {
        this.orchestrator.emit('tasks:auto-resumed', {
          reason: event.reason,
          totalTasks: allPausedTasks.length,
          resumedCount: totalResumedCount,
          errors,
          timestamp: new Date(),
          // v0.4.0 enhanced fields
          resumeReason: detailedResumeReason,
          contextSummary,
        });
      }

      this.log('info', `Auto-resume completed: ${totalResumedCount}/${allPausedTasks.length} tasks resumed`);

      if (errors.length > 0) {
        this.log('warn', `${errors.length} tasks failed to resume during auto-resume`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', `Auto-resume process failed: ${errorMessage}`);
    }
  }

  /**
   * Resume paused subtasks of a parent task when the parent is resumed.
   * Only resumes subtasks that were paused due to resumable reasons.
   */
  private async resumeParentSubtasksIfNeeded(parentTaskId: string): Promise<void> {
    if (!this.store || !this.orchestrator) {
      return;
    }

    try {
      const parentTask = await this.store.getTask(parentTaskId);
      if (!parentTask?.subtaskIds?.length) {
        this.log('debug', `Parent task ${parentTaskId} has no subtasks to resume`);
        return;
      }

      this.log('info', `Checking ${parentTask.subtaskIds.length} subtask(s) for auto-resume after parent task ${parentTaskId} resumed`);

      let subtasksResumedCount = 0;
      const subtaskResumeReason = `Parent task ${parentTaskId} was resumed, allowing dependent subtasks to continue`;

      for (const subtaskId of parentTask.subtaskIds) {
        try {
          const subtask = await this.store.getTask(subtaskId);

          if (subtask?.status === 'paused' &&
              ['usage_limit', 'budget', 'capacity', 'container_failure'].includes(subtask.pauseReason || '')) {

            // Check if subtask can be resumed (resumeAfter date check)
            if (subtask.resumeAfter && subtask.resumeAfter > new Date()) {
              this.log('debug', `Subtask ${subtaskId} has future resumeAfter date, skipping auto-resume`);
              continue;
            }

            // Get subtask session data before resuming
            const sessionData = subtask.sessionData;

            const resumed = await this.orchestrator.resumePausedTask(subtaskId);
            if (resumed) {
              subtasksResumedCount++;
              this.log('info', `Auto-resumed subtask ${subtaskId} after parent resume`, { taskId: subtaskId });

              // Emit task:session-resumed event for this subtask
              this.emitTaskSessionResumed(subtask, subtaskResumeReason, sessionData);
            } else {
              this.log('warn', `Failed to resume subtask ${subtaskId}: Task not in resumable state`, { taskId: subtaskId });
            }
          } else {
            this.log('debug', `Subtask ${subtaskId} is not paused with resumable reason (status: ${subtask?.status}, reason: ${subtask?.pauseReason})`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.log('error', `Error resuming subtask ${subtaskId}: ${errorMessage}`, { taskId: subtaskId });
        }
      }

      if (subtasksResumedCount > 0) {
        this.log('info', `Resumed ${subtasksResumedCount} subtask(s) for parent task ${parentTaskId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', `Error in resumeParentSubtasksIfNeeded for parent ${parentTaskId}: ${errorMessage}`);
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
      // Check if we should only restart parent tasks (default: true)
      const restartParentOnly = this.config?.daemon?.taskRestart?.restartParentOnly ?? true;

      for (let i = 0; i < availableSlots; i++) {
        const task = await this.store.getNextQueuedTask();
        if (!task) {
          break; // No more tasks
        }

        // Skip if already running
        if (this.runningTasks.has(task.id)) {
          continue;
        }

        // Skip child tasks if restartParentOnly is enabled
        // The orchestrator will manage child tasks when parent is executed
        if (restartParentOnly && task.parentTaskId) {
          this.log('debug', `Skipping child task ${task.id} (parent: ${task.parentTaskId}) - orchestrator will manage`, { taskId: task.id });
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
          totalCostCents: 0,
          executionTimeMs: Date.now() - startTime,
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
          totalCostCents: 0,
          executionTimeMs: Date.now() - startTime,
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

      // Get health information if daemon is running and healthMonitor is available
      let healthInfo: any = undefined;
      if (running && this.healthMonitor) {
        try {
          const healthReport = this.healthMonitor.getHealthReport(this);
          healthInfo = {
            uptime: healthReport.uptime,
            memoryUsage: healthReport.memoryUsage,
            taskCounts: healthReport.taskCounts,
            lastHealthCheck: healthReport.lastHealthCheck.toISOString(),
            healthChecksPassed: healthReport.healthChecksPassed,
            healthChecksFailed: healthReport.healthChecksFailed,
            restartHistory: healthReport.restartHistory.map(record => ({
              timestamp: record.timestamp.toISOString(),
              reason: record.reason,
              exitCode: record.exitCode,
              triggeredByWatchdog: record.triggeredByWatchdog,
            })),
          };
        } catch (error) {
          this.log('warn', `Failed to get health report for state file: ${(error as Error).message}`);
        }
      }

      // Get services information
      const servicesInfo = running ? {
        api: {
          running: this.apiProcess !== null,
          port: this.config?.daemon?.services?.api?.port ?? 4000,
          host: this.config?.daemon?.services?.api?.host ?? 'localhost',
        },
        webui: {
          running: this.webuiProcess !== null,
          port: this.config?.daemon?.services?.webui?.port ?? 3000,
          host: this.config?.daemon?.services?.webui?.host ?? 'localhost',
        },
      } : undefined;

      const stateData = {
        timestamp: new Date().toISOString(),
        pid: process.pid,
        startedAt: this.startedAt.toISOString(),
        running,
        capacity: capacityInfo,
        health: healthInfo,
        services: servicesInfo,
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
    metadata?: { taskId?: string; [key: string]: unknown }
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

    // Optionally log to stdout (may fail with EPIPE if stdout is disconnected)
    if (this.options.logToStdout) {
      try {
        process.stdout.write(logLine);
      } catch {
        // Ignore EPIPE errors - stdout may be disconnected
      }
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
   * Start integrated services (API and Web UI) based on daemon config
   */
  private async startIntegratedServices(daemonConfig: DaemonConfig): Promise<void> {
    const servicesConfig = daemonConfig.services;
    if (!servicesConfig) {
      return;
    }

    // Start API server if enabled (skip if already running)
    if (servicesConfig.api?.enabled && !this.apiProcess) {
      const apiPort = servicesConfig.api.port ?? 4000;
      const apiHost = servicesConfig.api.host ?? 'localhost';

      try {
        // Resolve API path relative to orchestrator package (../api/dist/index.js from packages/orchestrator/dist/)
        // At runtime in CommonJS, __dirname is packages/orchestrator/dist
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - __dirname is available at runtime in CommonJS
        const apiPath = join(__dirname, '..', '..', 'api', 'dist', 'index.js');

        this.apiProcess = spawn('node', [apiPath], {
          cwd: this.options.projectPath,
          env: {
            ...process.env,
            PORT: String(apiPort),
            HOST: apiHost,
            APEX_PROJECT_PATH: this.options.projectPath,
          },
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.apiProcess.stdout?.on('data', (data) => {
          this.log('debug', `[API] ${data.toString().trim()}`);
        });

        this.apiProcess.stderr?.on('data', (data) => {
          this.log('warn', `[API] ${data.toString().trim()}`);
        });

        this.apiProcess.on('exit', (code) => {
          this.log('info', `API server exited with code ${code}`);
          this.apiProcess = null;
          if (this.isRunning && !this.isShuttingDown && code !== 0) {
            this.apiRestartCount++;
            if (this.apiRestartCount <= DaemonRunner.MAX_SERVICE_RESTARTS) {
              this.log('warn', `API server crashed (code ${code}), restarting in 5s... (attempt ${this.apiRestartCount}/${DaemonRunner.MAX_SERVICE_RESTARTS})`);
              setTimeout(() => {
                if (this.isRunning && !this.isShuttingDown) {
                  this.startIntegratedServices(daemonConfig).catch(err => {
                    this.log('error', `Failed to restart API server: ${(err as Error).message}`);
                  });
                }
              }, 5000);
            } else {
              this.log('error', `API server exceeded max restarts (${DaemonRunner.MAX_SERVICE_RESTARTS}), giving up`);
            }
          }
        });

        this.log('info', `API server started on ${apiHost}:${apiPort}`);
      } catch (error) {
        this.log('error', `Failed to start API server: ${(error as Error).message}`);
      }
    }

    // Start Web UI if enabled (skip if already running)
    if (servicesConfig.webui?.enabled && !this.webuiProcess) {
      const webuiPort = servicesConfig.webui.port ?? 3000;
      const webuiHost = servicesConfig.webui.host ?? 'localhost';

      try {
        // Resolve Web UI path relative to orchestrator package (../web-ui from packages/orchestrator/dist/)
        // At runtime in CommonJS, __dirname is packages/orchestrator/dist
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - __dirname is available at runtime in CommonJS
        const webuiPath = join(__dirname, '..', '..', 'web-ui');

        // Use npm exec with -- separator for command arguments
        this.webuiProcess = spawn('npm', ['exec', '--', 'next', 'start', '-p', String(webuiPort), '-H', webuiHost], {
          cwd: webuiPath,
          env: {
            ...process.env,
            PORT: String(webuiPort),
            NEXT_PUBLIC_API_URL: `http://${servicesConfig.api?.host ?? 'localhost'}:${servicesConfig.api?.port ?? 4000}`,
          },
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.webuiProcess.stdout?.on('data', (data) => {
          this.log('debug', `[WebUI] ${data.toString().trim()}`);
        });

        this.webuiProcess.stderr?.on('data', (data) => {
          this.log('warn', `[WebUI] ${data.toString().trim()}`);
        });

        this.webuiProcess.on('exit', (code) => {
          this.log('info', `Web UI exited with code ${code}`);
          this.webuiProcess = null;
          if (this.isRunning && !this.isShuttingDown && code !== 0) {
            this.webuiRestartCount++;
            if (this.webuiRestartCount <= DaemonRunner.MAX_SERVICE_RESTARTS) {
              this.log('warn', `Web UI crashed (code ${code}), restarting in 5s... (attempt ${this.webuiRestartCount}/${DaemonRunner.MAX_SERVICE_RESTARTS})`);
              setTimeout(() => {
                if (this.isRunning && !this.isShuttingDown) {
                  this.startIntegratedServices(daemonConfig).catch(err => {
                    this.log('error', `Failed to restart Web UI: ${(err as Error).message}`);
                  });
                }
              }, 5000);
            } else {
              this.log('error', `Web UI exceeded max restarts (${DaemonRunner.MAX_SERVICE_RESTARTS}), giving up`);
            }
          }
        });

        this.log('info', `Web UI started on ${webuiHost}:${webuiPort}`);
      } catch (error) {
        this.log('error', `Failed to start Web UI: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Stop integrated services
   */
  private async stopIntegratedServices(): Promise<void> {
    if (this.apiProcess) {
      this.log('info', 'Stopping API server...');
      this.apiProcess.kill('SIGTERM');
      this.apiProcess = null;
    }

    if (this.webuiProcess) {
      this.log('info', 'Stopping Web UI...');
      this.webuiProcess.kill('SIGTERM');
      this.webuiProcess = null;
    }
  }

  /**
   * Check if daemon has services running
   */
  public hasServicesRunning(): { api: boolean; webui: boolean } {
    return {
      api: this.apiProcess !== null,
      webui: this.webuiProcess !== null,
    };
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Stop integrated services
    await this.stopIntegratedServices();

    // Stop capacity monitor
    if (this.capacityMonitor) {
      this.capacityMonitor.stop();
      this.log('info', 'Capacity monitor stopped');
    }

    // Shutdown orchestrator (disconnects MCP servers, etc.)
    if (this.orchestrator) {
      try {
        await this.orchestrator.shutdown();
        this.log('info', 'Orchestrator shutdown complete');
      } catch (error) {
        this.log('warn', `Orchestrator shutdown error: ${(error as Error).message}`);
      }
    }

    // Close log stream
    if (this.logStream && !this.logStream.destroyed) {
      await new Promise<void>((resolve) => {
        this.logStream!.end(resolve);
      });
    }

    // Close store (already closed by orchestrator.shutdown, but be safe)
    if (this.store) {
      this.store.close();
    }
  }

  /**
   * Reset all in-progress tasks to pending on daemon startup.
   * A fresh daemon can't have any legitimately running tasks, so any in-progress
   * tasks must be from a previous daemon instance that was interrupted.
   */
  private async resetInterruptedTasksOnStartup(): Promise<void> {
    if (!this.store) {
      return;
    }

    try {
      // Get all in-progress tasks (lightweight — we only need IDs for reset)
      const inProgressTasks = await this.store.listTasks({ status: 'in-progress', lightweight: true });

      if (inProgressTasks.length === 0) {
        this.log('debug', 'No interrupted tasks to reset on startup');
        return;
      }

      this.log('info', `Resetting ${inProgressTasks.length} interrupted task(s) to pending`);

      // Reset each task to pending
      for (const task of inProgressTasks) {
        await this.store.updateTask(task.id, {
          status: 'pending',
          updatedAt: new Date(),
        });

        await this.store.addLog(task.id, {
          level: 'info',
          message: 'Task reset to pending: daemon restarted while task was in-progress',
        });

        this.log('info', `Reset interrupted task ${task.id} to pending`);
      }
    } catch (error) {
      this.log('error', `Failed to reset interrupted tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Detect and handle orphaned tasks on daemon startup.
   * Orphaned tasks are those stuck in 'in-progress' status from previous daemon instances.
   */
  private async detectAndHandleOrphanedTasks(): Promise<void> {
    if (!this.store || !this.orchestrator || !this.config) {
      return;
    }

    const orphanConfig = this.config.daemon?.orphanDetection;
    if (orphanConfig?.enabled === false) {
      this.log('debug', 'Orphan detection disabled in config');
      return;
    }

    const stalenessThreshold = orphanConfig?.stalenessThreshold ?? 3600000; // 1 hour
    const recoveryPolicy = orphanConfig?.recoveryPolicy ?? 'pending';

    try {
      const orphanedTasks = await this.store.getOrphanedTasks(stalenessThreshold);

      // Filter out tasks that are actively running in this daemon instance
      const trulyOrphaned = orphanedTasks.filter(task =>
        !this.runningTasks.has(task.id)
      );

      if (trulyOrphaned.length === 0) {
        this.log('debug', 'No orphaned tasks detected');
        return;
      }

      this.log('warn', `Detected ${trulyOrphaned.length} orphaned task(s)`);

      // Emit detection event
      this.orchestrator.emit('orphan:detected', {
        tasks: trulyOrphaned,
        detectedAt: new Date(),
        reason: 'startup_check',
        stalenessThreshold,
      });

      // Handle each orphaned task based on policy
      for (const task of trulyOrphaned) {
        await this.recoverOrphanedTask(task, recoveryPolicy);
      }
    } catch (error) {
      this.log('error', `Orphan detection failed: ${(error as Error).message}`);
    }
  }

  /**
   * Recover a single orphaned task based on the configured policy.
   */
  private async recoverOrphanedTask(
    task: Task,
    policy: 'pending' | 'fail' | 'retry'
  ): Promise<void> {
    if (!this.store || !this.orchestrator) {
      return;
    }

    const previousStatus = task.status;
    let newStatus: TaskStatus;
    let action: 'marked_failed' | 'reset_pending' | 'retry';
    let message: string;

    try {
      switch (policy) {
        case 'fail':
          newStatus = 'failed';
          action = 'marked_failed';
          message = `Task marked as failed: orphaned in '${previousStatus}' status since ${task.updatedAt.toISOString()}`;
          await this.store.updateTaskStatus(task.id, 'failed', undefined, message);
          break;

        case 'pending':
          newStatus = 'pending';
          action = 'reset_pending';
          message = `Task reset to pending: was orphaned in '${previousStatus}' status`;
          await this.store.updateTaskStatus(task.id, 'pending');
          break;

        case 'retry':
          newStatus = 'pending';
          action = 'retry';
          message = `Task queued for retry: was orphaned in '${previousStatus}' status`;
          await this.store.updateTask(task.id, {
            status: 'pending',
            retryCount: (task.retryCount || 0) + 1,
            updatedAt: new Date(),
          });
          break;
      }

      // Add log entry to task
      await this.store.addLog(task.id, {
        level: 'warn',
        message: `Orphan recovery: ${message}`,
        metadata: {
          policy,
          previousStatus,
          newStatus,
          staleSeconds: Math.floor((Date.now() - task.updatedAt.getTime()) / 1000),
        },
      });

      // Emit recovery event
      this.orchestrator.emit('orphan:recovered', {
        taskId: task.id,
        previousStatus,
        newStatus,
        action,
        message,
        timestamp: new Date(),
      });

      this.log('info', `Recovered orphaned task ${task.id}: ${action}`);
    } catch (error) {
      this.log('error', `Failed to recover orphaned task ${task.id}: ${(error as Error).message}`);
    }
  }

  /**
   * Setup periodic orphan detection if enabled in config.
   */
  private setupPeriodicOrphanDetection(): void {
    if (!this.config) {
      return;
    }

    const orphanConfig = this.config.daemon?.orphanDetection;

    if (!orphanConfig?.periodicCheck) {
      return;
    }

    const interval = orphanConfig.periodicCheckInterval ?? 300000; // 5 minutes

    this.orphanCheckInterval = setInterval(async () => {
      if (!this.isRunning || this.isShuttingDown) {
        return;
      }

      try {
        await this.detectAndHandleOrphanedTasks();
      } catch (error) {
        this.log('error', `Periodic orphan check failed: ${(error as Error).message}`);
      }
    }, interval);

    this.log('info', `Periodic orphan detection enabled (interval: ${interval}ms)`);
  }

  /**
   * Check for paused tasks that can be resumed and resume them.
   *
   * IMPORTANT: Only resumes the HIGHEST parent tasks (root of paused hierarchies).
   * The orchestrator will handle resuming subtasks through normal execution flow.
   * This prevents overwhelming the system by starting many tasks in parallel.
   */
  private async checkAndResumePausedTasks(): Promise<void> {
    if (!this.store || !this.orchestrator) {
      return;
    }

    try {
      // Get only paused tasks (lightweight to avoid OOM with large task counts)
      const pausedTasks = await this.store.listTasks({ status: 'paused', lightweight: true });

      if (pausedTasks.length === 0) {
        return;
      }

      const pausedTaskIds = new Set(pausedTasks.map(t => t.id));
      const rateLimitResetMs = 3600000; // 1 hour
      const now = Date.now();

      // Find root paused tasks - tasks whose parent is NOT paused (or have no parent)
      // These are the tasks we should resume; orchestrator will handle their subtasks
      const rootPausedTasks = pausedTasks.filter(task => {
        // If task has no parent, it's a root
        if (!task.parentTaskId) {
          return true;
        }
        // If task's parent is not in the paused set, this task is a root of its paused hierarchy
        return !pausedTaskIds.has(task.parentTaskId);
      });

      if (rootPausedTasks.length === 0) {
        this.log('debug', `Found ${pausedTasks.length} paused task(s), but no root paused tasks to resume`);
        return;
      }

      this.log('debug', `Found ${rootPausedTasks.length} root paused task(s) out of ${pausedTasks.length} total`);

      let resumedCount = 0;

      // Only resume root paused tasks that meet the criteria
      for (const task of rootPausedTasks) {
        // Check if this task can be resumed based on pause reason
        let shouldResume = false;
        let resumeReason = '';

        if (task.pausedAt) {
          const pausedDuration = now - new Date(task.pausedAt).getTime();
          if (pausedDuration >= rateLimitResetMs) {
            shouldResume = true;
            const reason = task.pauseReason ?? 'unknown';
            resumeReason = `${reason} expired (${Math.round(pausedDuration / 60000)} minutes)`;
          }
        }

        if (shouldResume) {
          this.log('info', `Attempting to resume root task ${task.id}: ${resumeReason}`, { taskId: task.id });

          try {
            const resumed = await this.orchestrator.resumePausedTask(task.id);
            if (resumed) {
              resumedCount++;
              this.log('info', `Auto-resumed root task ${task.id}`, { taskId: task.id });
              // Stop if we've hit the max concurrent task limit
              const currentRunning = this.runningTasks.size + resumedCount;
              if (currentRunning >= (this.options.maxConcurrentTasks || 3)) {
                break;
              }
            }
          } catch (error) {
            const errMsg = (error as Error).message ?? String(error);
            this.log('warn', `Failed to resume task ${task.id}: ${errMsg}`, { taskId: task.id });
            // If this is a usage limit error, stop trying other tasks —
            // the limit is global so all subsequent attempts will also fail
            if (errMsg.includes('usage limit') || errMsg.includes('Usage limit') || errMsg.includes("hit your limit")) {
              this.log('info', `Usage limit active, skipping remaining ${rootPausedTasks.length - rootPausedTasks.indexOf(task) - 1} paused task(s) this cycle`);
              break;
            }
          }
        }
      }

      if (resumedCount > 0) {
        this.log('info', `Auto-resumed ${resumedCount} root paused task(s)`);
      }
    } catch (error) {
      this.log('error', `Failed to check paused tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Setup periodic check for paused tasks that can be resumed
   */
  private setupPeriodicPausedTaskCheck(): void {
    // Check every 60 seconds
    const interval = 60000;

    this.pausedTaskCheckInterval = setInterval(async () => {
      if (!this.isRunning || this.isShuttingDown) {
        return;
      }

      try {
        await this.checkAndResumePausedTasks();
      } catch (error) {
        this.log('error', `Periodic paused task check failed: ${(error as Error).message}`);
      }
    }, interval);

    this.log('info', `Periodic paused task check enabled (interval: ${interval}ms)`);
  }

  /**
   * Auto-triage and repair stuck tasks.
   *
   * Detects and repairs tasks that are stuck due to:
   * 1. Parent tasks waiting for pending subtasks but not progressing
   * 2. Tasks stuck in checkpoint resume loops (resume_attempts >= max)
   * 3. Tasks with workflow stages that failed due to recoverable errors
   * 4. In-progress tasks that haven't been updated in a long time
   */
  private async checkAndRepairStuckTasks(): Promise<void> {
    if (!this.store || !this.orchestrator) {
      return;
    }

    try {
      // Only load in-progress tasks (lightweight to avoid OOM with large task counts)
      const inProgressTasks = await this.store.listTasks({ status: 'in-progress', lightweight: true });
      const now = Date.now();
      const stuckThresholdMs = 5 * 60 * 1000; // 5 minutes without update = potentially stuck
      let repairedCount = 0;

      for (const task of inProgressTasks) {

        const updatedAt = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
        const timeSinceUpdate = now - updatedAt;
        let needsRepair = false;
        let repairReason = '';

        // Check 1: Parent task with pending subtasks that's stuck
        if (task.subtaskIds && task.subtaskIds.length > 0 && timeSinceUpdate > stuckThresholdMs) {
          if (!this.runningTasks.has(task.id)) {
            // Query subtask statuses directly instead of loading all tasks
            const subtaskStatuses = this.store.getSubtaskStatuses(task.subtaskIds);
            const pendingCount = subtaskStatuses.filter(s => s.status === 'pending').length;
            const inProgressCount = subtaskStatuses.filter(s => s.status === 'in-progress').length;
            const failedCount = subtaskStatuses.filter(s => s.status === 'failed').length;

            if (pendingCount > 0 && inProgressCount === 0) {
              needsRepair = true;
              repairReason = `Parent task stuck with ${pendingCount} pending subtasks (${failedCount} failed)`;
            }
          }
        }

        // Check 2: Task stuck in checkpoint resume loop — mark as failed to break the cycle
        if (!needsRepair && task.resumeAttempts && task.resumeAttempts >= 3) {
          if (timeSinceUpdate > stuckThresholdMs && !this.runningTasks.has(task.id)) {
            this.log('warn', `[AutoTriage] Task ${task.id} hit max resume attempts (${task.resumeAttempts}), marking as failed`);
            await this.store.updateTask(task.id, {
              status: 'failed',
              error: `AutoTriage: Task stuck after ${task.resumeAttempts} resume/repair attempts. Last error: ${(task.error ?? 'none').substring(0, 200)}`,
              updatedAt: new Date(),
            });
            repairedCount++;
            continue;
          }
        }

        // Check 3: Task with error in error field that looks like a checkpoint reference (not a real error)
        // Only repair if the task hasn't been updated recently (same guard as other checks)
        // and hasn't already been repaired too many times (resumeAttempts tracks this)
        if (!needsRepair && task.error && task.error.startsWith('Resuming from checkpoint:')) {
          if (timeSinceUpdate > stuckThresholdMs && !this.runningTasks.has(task.id)) {
            if ((task.resumeAttempts ?? 0) >= 3) {
              // Task has been repaired multiple times but keeps ending up with checkpoint error.
              // Mark it as failed to break the infinite loop.
              this.log('warn', `[AutoTriage] Task ${task.id} stuck in checkpoint repair loop (${task.resumeAttempts} attempts), marking as failed`);
              await this.store.updateTask(task.id, {
                status: 'failed',
                error: `AutoTriage: Task stuck in checkpoint resume loop after ${task.resumeAttempts} repair attempts. Original: ${task.error.substring(0, 200)}`,
                updatedAt: new Date(),
              });
              repairedCount++;
              continue;
            }
            needsRepair = true;
            repairReason = 'Task has checkpoint reference in error field';
          }
        }

        // Check 4: Task stuck in planning/subtask-execution with workflow error
        if (!needsRepair && task.error && timeSinceUpdate > stuckThresholdMs) {
          const recoverableErrors = [
            'Tests or build did not pass',
            'Workflow stuck:',
            'dependencies not met',
          ];

          if (recoverableErrors.some(e => task.error!.includes(e)) && !this.runningTasks.has(task.id)) {
            needsRepair = true;
            repairReason = `Task has recoverable workflow error: ${task.error.substring(0, 50)}...`;
          }
        }

        // Apply repair if needed
        if (needsRepair) {
          this.log('info', `[AutoTriage] Repairing stuck task ${task.id}: ${repairReason}`);

          // Determine the appropriate current_stage based on subtask status
          let newStage = task.currentStage;
          if (task.subtaskIds && task.subtaskIds.length > 0) {
            const subtaskStatuses = this.store.getSubtaskStatuses(task.subtaskIds);
            if (subtaskStatuses.some(s => s.status === 'pending')) {
              newStage = 'subtask-execution';
            }
          }

          // Reset the task (increment resumeAttempts to track repair cycles)
          await this.store.updateTask(task.id, {
            error: undefined,
            resumeAttempts: (task.resumeAttempts ?? 0) + 1,
            currentStage: newStage,
            updatedAt: new Date(),
          });

          this.log('info', `[AutoTriage] Repaired task ${task.id}, set stage to '${newStage}'`);
          repairedCount++;
        }
      }

      if (repairedCount > 0) {
        this.log('info', `[AutoTriage] Repaired ${repairedCount} stuck task(s)`);
      }
    } catch (error) {
      this.log('error', `[AutoTriage] Failed to check stuck tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Setup periodic stuck task detection and repair
   */
  private setupPeriodicStuckTaskCheck(): void {
    // Check every 2 minutes
    const interval = 120000;

    setInterval(async () => {
      if (!this.isRunning || this.isShuttingDown) {
        return;
      }

      try {
        await this.checkAndRepairStuckTasks();
      } catch (error) {
        this.log('error', `Periodic stuck task check failed: ${(error as Error).message}`);
      }
    }, interval);

    this.log('info', `Periodic stuck task auto-triage enabled (interval: ${interval}ms)`);
  }
}
