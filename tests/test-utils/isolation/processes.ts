/**
 * Process Isolation Utilities
 *
 * Provides isolated child process management for tests.
 * Tracks spawned processes for automatic cleanup/termination.
 *
 * @module tests/test-utils/isolation/processes
 * @see ADR-052 for architecture decisions
 *
 * @example
 * ```typescript
 * const processes = new ProcessIsolationImpl();
 *
 * // Track a spawned process
 * const child = spawn('node', ['server.js']);
 * processes.track(child, 'test-server');
 *
 * // Kill all processes during cleanup
 * processes.killAll();
 * ```
 */

import type { ProcessIsolation } from './types';

/**
 * Tracked process entry with metadata.
 */
interface TrackedProcess {
  process: { kill: (signal?: string) => boolean };
  description: string;
  pid?: number;
}

/**
 * Implementation of ProcessIsolation.
 *
 * Manages child processes with:
 * - Automatic tracking of spawned processes
 * - Safe termination that handles already-exited processes
 * - Optional signal specification for graceful shutdown
 */
export class ProcessIsolationImpl implements ProcessIsolation {
  /** List of tracked processes for cleanup */
  private trackedProcesses: TrackedProcess[] = [];

  /** Whether cleanup has been performed */
  private isKilled = false;

  /**
   * Track a child process for cleanup.
   *
   * The process will be killed during cleanup if still running.
   *
   * @param process - Process with a kill method
   * @param description - Optional description for debugging
   *
   * @example
   * ```typescript
   * import { spawn } from 'child_process';
   *
   * const child = spawn('node', ['server.js']);
   * processes.track(child, 'background-server');
   *
   * // Process will be killed during cleanup
   * ```
   */
  track(
    process: { kill: (signal?: string) => boolean; pid?: number },
    description = 'unknown'
  ): void {
    this.ensureNotKilled();
    this.trackedProcesses.push({
      process,
      description,
      pid: process.pid,
    });
  }

  /**
   * Get count of tracked processes.
   *
   * @returns Number of tracked processes
   *
   * @example
   * ```typescript
   * console.log(`Tracking ${processes.getActiveCount()} processes`);
   * ```
   */
  getActiveCount(): number {
    return this.trackedProcesses.length;
  }

  /**
   * Kill all tracked processes.
   *
   * Sends the specified signal to each tracked process.
   * Errors during termination are logged but don't prevent other terminations.
   *
   * @param signal - Signal to send (default: 'SIGTERM')
   *
   * @example
   * ```typescript
   * // Graceful shutdown
   * processes.killAll('SIGTERM');
   *
   * // Forceful termination
   * processes.killAll('SIGKILL');
   * ```
   */
  killAll(signal = 'SIGTERM'): void {
    if (this.isKilled) {
      return;
    }

    for (const { process, description, pid } of this.trackedProcesses) {
      try {
        const result = process.kill(signal);
        if (!result) {
          // Process may have already exited
          console.debug(`ProcessIsolation: Process ${description} (${pid}) already exited`);
        }
      } catch (error) {
        // Process may have already been killed or doesn't exist
        console.warn(
          `ProcessIsolation: Failed to kill process ${description} (${pid}):`,
          error
        );
      }
    }

    this.trackedProcesses = [];
    this.isKilled = true;
  }

  /**
   * Check if any tracked processes are still running.
   * Note: This is a best-effort check as process state can change.
   *
   * @returns True if there might be running processes
   */
  hasActiveProcesses(): boolean {
    return this.trackedProcesses.length > 0 && !this.isKilled;
  }

  /**
   * Ensure kill hasn't been performed.
   * @throws Error if processes have already been killed
   */
  private ensureNotKilled(): void {
    if (this.isKilled) {
      throw new Error('ProcessIsolation has already killed all processes');
    }
  }
}

/**
 * Create a new process isolation instance.
 *
 * @returns New ProcessIsolation instance
 *
 * @example
 * ```typescript
 * const processes = createProcessIsolation();
 * processes.track(childProcess, 'worker');
 * // ...
 * processes.killAll();
 * ```
 */
export function createProcessIsolation(): ProcessIsolation {
  return new ProcessIsolationImpl();
}
