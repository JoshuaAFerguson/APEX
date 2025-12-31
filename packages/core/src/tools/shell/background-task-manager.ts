/**
 * @fileoverview Background Task Manager for shell command execution
 *
 * This module provides a singleton manager for tracking and managing
 * background shell processes spawned by the BashTool.
 *
 * ## Features
 * - Register and track background processes
 * - Buffer stdout/stderr with configurable limits
 * - Automatic cleanup of completed tasks
 * - Event emission for real-time monitoring
 * - Graceful shutdown support
 *
 * @module @apex/core/tools/shell/background-task-manager
 */

import { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  BackgroundTaskId,
  BackgroundTaskStatus,
  BackgroundTaskInfo,
  BackgroundTaskOutput,
  BackgroundTaskManagerConfig,
  BackgroundTaskRegisterOptions,
  BackgroundTaskKillResult,
  BackgroundTaskManagerEvents,
} from './background-task-types.js';
import { BACKGROUND_TASK_DEFAULTS } from './background-task-types.js';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal representation of a background task with process handle
 */
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
  truncated: boolean;
  process: ChildProcess;
  workingDirectory?: string;
  description?: string;
}

// ============================================================================
// BackgroundTaskManager Class
// ============================================================================

/**
 * Singleton manager for background shell tasks.
 *
 * Provides functionality to:
 * - Register spawned background processes
 * - Track status and collect output
 * - Kill running processes
 * - Clean up completed tasks
 * - Emit events for monitoring
 *
 * @example
 * ```typescript
 * const manager = BackgroundTaskManager.getInstance();
 *
 * // Register a process
 * const taskId = manager.register(childProcess, 'npm run dev', {
 *   description: 'Start development server'
 * });
 *
 * // Check status
 * const status = manager.getStatus(taskId);
 * console.log(status?.status); // 'running'
 *
 * // Get output
 * const output = manager.getOutput(taskId);
 * console.log(output?.stdout);
 *
 * // Kill when done
 * manager.kill(taskId);
 * ```
 */
export class BackgroundTaskManager extends EventEmitter {
  private static instance: BackgroundTaskManager | null = null;

  private tasks: Map<BackgroundTaskId, BackgroundTask> = new Map();
  private config: Required<BackgroundTaskManagerConfig>;
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Private constructor - use getInstance() to get the singleton
   */
  private constructor(config?: BackgroundTaskManagerConfig) {
    super();
    this.config = { ...BACKGROUND_TASK_DEFAULTS, ...config };
    this.setupCleanupInterval();
    this.setupProcessExitHandler();
  }

  /**
   * Get the singleton instance of BackgroundTaskManager.
   *
   * @param config - Optional configuration (only used on first call)
   * @returns The singleton BackgroundTaskManager instance
   */
  static getInstance(config?: BackgroundTaskManagerConfig): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager(config);
    }
    return BackgroundTaskManager.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  static resetInstance(): void {
    if (BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance.dispose();
      BackgroundTaskManager.instance = null;
    }
  }

  /**
   * Register a new background process with the manager.
   *
   * @param process - The spawned child process
   * @param command - The command that was executed
   * @param options - Additional options (workingDirectory, description)
   * @returns The unique task ID for this background task
   * @throws Error if maximum concurrent tasks limit is reached
   */
  register(
    process: ChildProcess,
    command: string,
    options?: BackgroundTaskRegisterOptions
  ): BackgroundTaskId {
    // Check concurrent task limit
    const runningCount = Array.from(this.tasks.values())
      .filter(t => t.status === 'running').length;

    if (runningCount >= this.config.maxConcurrentTasks) {
      throw new Error(
        `Maximum concurrent background tasks (${this.config.maxConcurrentTasks}) reached. ` +
        `Kill some running tasks before starting new ones.`
      );
    }

    const taskId: BackgroundTaskId = `bg_${randomUUID().slice(0, 8)}`;

    const task: BackgroundTask = {
      taskId,
      pid: process.pid ?? -1,
      command,
      startedAt: new Date(),
      status: 'running',
      stdout: '',
      stderr: '',
      truncated: false,
      process,
      workingDirectory: options?.workingDirectory,
      description: options?.description,
    };

    // Collect stdout
    process.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      task.stdout += chunk;

      // Truncate if buffer exceeds limit (keep most recent data)
      if (task.stdout.length > this.config.maxBufferSize) {
        task.stdout = task.stdout.slice(-this.config.maxBufferSize);
        task.truncated = true;
      }

      this.emit('stdout', taskId, chunk);
    });

    // Collect stderr
    process.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      task.stderr += chunk;

      // Truncate if buffer exceeds limit (keep most recent data)
      if (task.stderr.length > this.config.maxBufferSize) {
        task.stderr = task.stderr.slice(-this.config.maxBufferSize);
        task.truncated = true;
      }

      this.emit('stderr', taskId, chunk);
    });

    // Handle process exit
    process.on('exit', (code, signal) => {
      task.exitCode = code ?? -1;
      task.completedAt = new Date();

      if (signal) {
        task.status = 'killed';
        task.signal = signal;
      } else if (code === 0) {
        task.status = 'completed';
      } else {
        task.status = 'failed';
      }

      this.emit('exit', taskId, code, signal);
    });

    // Handle spawn/process errors
    process.on('error', (error: Error) => {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = new Date();

      this.emit('error', taskId, error);
    });

    this.tasks.set(taskId, task);

    // Emit registered event
    this.emit('registered', taskId, this.toTaskInfo(task));

    return taskId;
  }

  /**
   * Get status information for a background task.
   *
   * @param taskId - The task ID to look up
   * @returns Task info or null if not found
   */
  getStatus(taskId: BackgroundTaskId): BackgroundTaskInfo | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return this.toTaskInfo(task);
  }

  /**
   * Get the buffered output from a background task.
   *
   * @param taskId - The task ID to look up
   * @returns Task output or null if not found
   */
  getOutput(taskId: BackgroundTaskId): BackgroundTaskOutput | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return {
      stdout: task.stdout,
      stderr: task.stderr,
      exitCode: task.exitCode,
      isRunning: task.status === 'running',
      truncated: task.truncated,
    };
  }

  /**
   * Kill a running background task.
   *
   * @param taskId - The task ID to kill
   * @param signal - The signal to send (default: SIGTERM)
   * @returns Result indicating success or failure
   */
  kill(
    taskId: BackgroundTaskId,
    signal: NodeJS.Signals = 'SIGTERM'
  ): BackgroundTaskKillResult {
    const task = this.tasks.get(taskId);

    if (!task) {
      return {
        success: false,
        message: `Task ${taskId} not found`,
        taskId,
      };
    }

    if (task.status !== 'running') {
      return {
        success: false,
        message: `Task ${taskId} is not running (status: ${task.status})`,
        taskId,
      };
    }

    try {
      task.process.kill(signal);
      return {
        success: true,
        message: `Sent ${signal} to task ${taskId} (PID: ${task.pid})`,
        taskId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to kill task ${taskId}: ${message}`,
        taskId,
      };
    }
  }

  /**
   * List all background tasks.
   *
   * @param filter - Optional filter by status
   * @returns Array of task info objects
   */
  listAll(filter?: BackgroundTaskStatus): BackgroundTaskInfo[] {
    const tasks = Array.from(this.tasks.values());

    const filtered = filter
      ? tasks.filter(t => t.status === filter)
      : tasks;

    return filtered.map(t => this.toTaskInfo(t));
  }

  /**
   * Get count of tasks by status.
   *
   * @returns Object with counts per status
   */
  getCounts(): Record<BackgroundTaskStatus, number> {
    const counts: Record<BackgroundTaskStatus, number> = {
      running: 0,
      completed: 0,
      failed: 0,
      killed: 0,
      unknown: 0,
    };

    for (const task of this.tasks.values()) {
      counts[task.status]++;
    }

    return counts;
  }

  /**
   * Clean up completed tasks older than cleanupAfterMs.
   *
   * @returns Number of tasks cleaned up
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [taskId, task] of this.tasks) {
      if (task.status !== 'running' && task.completedAt) {
        if (now - task.completedAt.getTime() > this.config.cleanupAfterMs) {
          this.tasks.delete(taskId);
          this.emit('cleaned', taskId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Force cleanup a specific task (regardless of age).
   *
   * @param taskId - The task ID to remove
   * @returns true if task was removed, false if not found or still running
   */
  remove(taskId: BackgroundTaskId): boolean {
    const task = this.tasks.get(taskId);

    if (!task) return false;

    if (task.status === 'running') {
      return false; // Don't remove running tasks
    }

    this.tasks.delete(taskId);
    this.emit('cleaned', taskId);
    return true;
  }

  /**
   * Gracefully shut down all running tasks.
   *
   * Sends SIGTERM, waits for timeout, then sends SIGKILL to remaining.
   *
   * @param timeoutMs - Time to wait for graceful shutdown (default: 5000)
   */
  async shutdownAll(timeoutMs: number = 5000): Promise<void> {
    const runningTasks = Array.from(this.tasks.values())
      .filter(t => t.status === 'running');

    if (runningTasks.length === 0) {
      return;
    }

    // Send SIGTERM to all running tasks
    for (const task of runningTasks) {
      try {
        task.process.kill('SIGTERM');
      } catch {
        // Ignore errors - process might have already exited
      }
    }

    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, timeoutMs));

    // Force kill remaining running tasks
    for (const task of runningTasks) {
      if (task.status === 'running') {
        try {
          task.process.kill('SIGKILL');
        } catch {
          // Ignore errors
        }
      }
    }
  }

  /**
   * Dispose of the manager, cleaning up intervals and tasks.
   */
  dispose(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // Kill all running tasks synchronously
    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        try {
          task.process.kill('SIGKILL');
        } catch {
          // Ignore errors
        }
      }
    }

    this.tasks.clear();
    this.removeAllListeners();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Convert internal BackgroundTask to public BackgroundTaskInfo
   */
  private toTaskInfo(task: BackgroundTask): BackgroundTaskInfo {
    return {
      taskId: task.taskId,
      pid: task.pid,
      command: task.command,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      status: task.status,
      exitCode: task.exitCode,
      signal: task.signal,
      workingDirectory: task.workingDirectory,
      description: task.description,
    };
  }

  /**
   * Set up periodic cleanup of completed tasks
   */
  private setupCleanupInterval(): void {
    this.cleanupIntervalId = setInterval(
      () => this.cleanup(),
      this.config.cleanupIntervalMs
    );

    // Don't keep the process alive just for cleanup
    if (this.cleanupIntervalId.unref) {
      this.cleanupIntervalId.unref();
    }
  }

  /**
   * Set up handler for process exit to clean up tasks
   */
  private setupProcessExitHandler(): void {
    const cleanup = () => {
      this.dispose();
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

// ============================================================================
// Type Augmentation for EventEmitter
// ============================================================================

// Augment the EventEmitter interface for type-safe events
declare module 'node:events' {
  interface EventEmitter {
    on<K extends keyof BackgroundTaskManagerEvents>(
      event: K,
      listener: BackgroundTaskManagerEvents[K]
    ): this;
    emit<K extends keyof BackgroundTaskManagerEvents>(
      event: K,
      ...args: Parameters<BackgroundTaskManagerEvents[K]>
    ): boolean;
  }
}
