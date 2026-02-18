/**
 * Timer Isolation Utilities
 *
 * Provides isolated timer management for tests.
 * Tracks setTimeout and setInterval calls for automatic cleanup.
 *
 * @module tests/test-utils/isolation/timers
 * @see ADR-052 for architecture decisions
 *
 * @example
 * ```typescript
 * const timers = new TimerIsolationImpl();
 *
 * // Create tracked timers
 * const timeoutId = timers.setTimeout(() => {
 *   console.log('This might not run');
 * }, 5000);
 *
 * const intervalId = timers.setInterval(() => {
 *   console.log('Periodic');
 * }, 1000);
 *
 * // Clear all timers during cleanup
 * timers.clearAll();
 * ```
 */

import type { TimerIsolation } from './types';

/**
 * Tracked timer entry with metadata.
 */
interface TrackedTimer {
  id: NodeJS.Timeout;
  type: 'timeout' | 'interval';
  description?: string;
}

/**
 * Implementation of TimerIsolation.
 *
 * Manages timers with:
 * - Automatic tracking of created timers
 * - Support for both setTimeout and setInterval
 * - Safe cleanup that handles already-cleared timers
 */
export class TimerIsolationImpl implements TimerIsolation {
  /** List of tracked timers for cleanup */
  private trackedTimers: TrackedTimer[] = [];

  /** Whether cleanup has been performed */
  private isCleared = false;

  /**
   * Create a tracked setTimeout.
   *
   * The timer is automatically tracked for cleanup.
   *
   * @param callback - Timer callback function
   * @param ms - Delay in milliseconds
   * @returns Timer ID
   *
   * @example
   * ```typescript
   * timers.setTimeout(() => {
   *   console.log('Delayed execution');
   * }, 1000);
   * ```
   */
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout {
    this.ensureNotCleared();

    const id = global.setTimeout(() => {
      // Remove from tracking when executed
      this.removeFromTracking(id);
      callback();
    }, ms);

    this.trackedTimers.push({ id, type: 'timeout' });

    return id;
  }

  /**
   * Create a tracked setInterval.
   *
   * The interval is automatically tracked for cleanup.
   *
   * @param callback - Timer callback function
   * @param ms - Interval in milliseconds
   * @returns Timer ID
   *
   * @example
   * ```typescript
   * let count = 0;
   * timers.setInterval(() => {
   *   count++;
   *   console.log(`Tick ${count}`);
   * }, 100);
   * ```
   */
  setInterval(callback: () => void, ms: number): NodeJS.Timeout {
    this.ensureNotCleared();

    const id = global.setInterval(callback, ms);
    this.trackedTimers.push({ id, type: 'interval' });

    return id;
  }

  /**
   * Track an existing timer for cleanup.
   *
   * Use this to track timers created outside of this utility.
   *
   * @param id - Timer ID
   * @param type - Timer type ('timeout' or 'interval')
   *
   * @example
   * ```typescript
   * // Track a timer created elsewhere
   * const id = global.setTimeout(() => {}, 1000);
   * timers.track(id, 'timeout');
   * ```
   */
  track(id: NodeJS.Timeout, type: 'timeout' | 'interval'): void {
    this.ensureNotCleared();
    this.trackedTimers.push({ id, type });
  }

  /**
   * Get count of active timers.
   *
   * @returns Number of tracked timers
   *
   * @example
   * ```typescript
   * timers.setTimeout(() => {}, 1000);
   * timers.setInterval(() => {}, 500);
   * console.log(timers.getActiveCount()); // 2
   * ```
   */
  getActiveCount(): number {
    return this.trackedTimers.length;
  }

  /**
   * Clear all tracked timers.
   *
   * Calls clearTimeout/clearInterval on each tracked timer.
   * Safe to call multiple times.
   *
   * @example
   * ```typescript
   * timers.setTimeout(() => console.log('never runs'), 10000);
   * timers.clearAll();
   * // Timer is cleared, callback won't execute
   * ```
   */
  clearAll(): void {
    if (this.isCleared) {
      return;
    }

    for (const { id, type } of this.trackedTimers) {
      try {
        if (type === 'timeout') {
          global.clearTimeout(id);
        } else {
          global.clearInterval(id);
        }
      } catch {
        // Timer may have already been cleared or executed
      }
    }

    this.trackedTimers = [];
    this.isCleared = true;
  }

  /**
   * Remove a specific timer from tracking.
   * Used when a timer executes normally.
   */
  private removeFromTracking(id: NodeJS.Timeout): void {
    const index = this.trackedTimers.findIndex(t => t.id === id);
    if (index !== -1) {
      this.trackedTimers.splice(index, 1);
    }
  }

  /**
   * Ensure cleanup hasn't been performed.
   * @throws Error if cleanup has already been performed
   */
  private ensureNotCleared(): void {
    if (this.isCleared) {
      throw new Error('TimerIsolation has already been cleared');
    }
  }
}

/**
 * Create a new timer isolation instance.
 *
 * @returns New TimerIsolation instance
 *
 * @example
 * ```typescript
 * const timers = createTimerIsolation();
 * timers.setTimeout(() => {}, 1000);
 * // ...
 * timers.clearAll();
 * ```
 */
export function createTimerIsolation(): TimerIsolation {
  return new TimerIsolationImpl();
}
