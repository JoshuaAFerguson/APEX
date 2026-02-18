/**
 * Mock Isolation Utilities
 *
 * Provides isolated mock and spy management for tests.
 * All mocks and spies are tracked and automatically restored during cleanup.
 *
 * @module tests/test-utils/isolation/mocks
 * @see ADR-052 for architecture decisions
 *
 * @example
 * ```typescript
 * const mocks = new MockIsolationImpl();
 *
 * // Create spies - automatically tracked
 * const logSpy = mocks.spyOn(console, 'log');
 *
 * // Create mock functions
 * const mockFn = mocks.fn(() => 'mocked');
 *
 * // Restore all mocks
 * mocks.restoreAll();
 * ```
 */

import { vi, type SpyInstance } from 'vitest';
import type { MockIsolation } from './types';

/**
 * Tracked spy entry with metadata.
 */
interface TrackedSpy {
  spy: SpyInstance;
  description: string;
}

/**
 * Implementation of MockIsolation.
 *
 * Manages vitest mocks and spies with:
 * - Automatic tracking of all created spies
 * - Safe restoration that handles errors
 * - Count tracking for debugging
 */
export class MockIsolationImpl implements MockIsolation {
  /** List of tracked spies for restoration */
  private trackedSpies: TrackedSpy[] = [];

  /** Whether restoration has been performed */
  private isRestored = false;

  /**
   * Create a spy on an object method.
   *
   * The spy is automatically tracked for restoration during cleanup.
   *
   * @param obj - Object containing the method
   * @param method - Method name to spy on
   * @returns Vitest spy instance
   *
   * @example
   * ```typescript
   * const consoleSpy = mocks.spyOn(console, 'log');
   * console.log('test');
   * expect(consoleSpy).toHaveBeenCalledWith('test');
   * ```
   */
  spyOn<T extends object, K extends keyof T>(obj: T, method: K): SpyInstance {
    this.ensureNotRestored();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(obj as any, method as any);
    const description = `${obj.constructor?.name || 'Object'}.${String(method)}`;

    this.trackedSpies.push({ spy, description });

    return spy;
  }

  /**
   * Create a mock function.
   *
   * Note: Mock functions created with vi.fn() don't need explicit cleanup
   * as they don't modify external state. However, they are included here
   * for API consistency.
   *
   * @param impl - Optional implementation function
   * @returns Vitest mock function
   *
   * @example
   * ```typescript
   * const mockCallback = mocks.fn((x: number) => x * 2);
   * expect(mockCallback(5)).toBe(10);
   * expect(mockCallback).toHaveBeenCalledWith(5);
   * ```
   */
  fn<T extends (...args: unknown[]) => unknown>(impl?: T): ReturnType<typeof vi.fn> {
    this.ensureNotRestored();
    return vi.fn(impl);
  }

  /**
   * Get count of active mocks/spies.
   *
   * @returns Number of tracked spies
   *
   * @example
   * ```typescript
   * mocks.spyOn(console, 'log');
   * mocks.spyOn(console, 'error');
   * console.log(mocks.getActiveCount()); // 2
   * ```
   */
  getActiveCount(): number {
    return this.trackedSpies.length;
  }

  /**
   * Restore all mocks and spies.
   *
   * Calls mockRestore() on each tracked spy and clears all vitest mocks.
   * Errors during restoration are logged but don't prevent other restorations.
   *
   * @example
   * ```typescript
   * mocks.spyOn(console, 'log').mockImplementation(() => {});
   * console.log('silenced');
   *
   * mocks.restoreAll();
   * console.log('visible again');
   * ```
   */
  restoreAll(): void {
    if (this.isRestored) {
      return;
    }

    for (const { spy, description } of this.trackedSpies) {
      try {
        spy.mockRestore();
      } catch (error) {
        console.warn(`MockIsolation: Failed to restore ${description}:`, error);
      }
    }

    // Clear all mocks to reset call history
    vi.clearAllMocks();

    this.trackedSpies = [];
    this.isRestored = true;
  }

  /**
   * Ensure restoration hasn't been performed.
   * @throws Error if restoration has already been performed
   */
  private ensureNotRestored(): void {
    if (this.isRestored) {
      throw new Error('MockIsolation has already been restored');
    }
  }
}

/**
 * Create a new mock isolation instance.
 *
 * @returns New MockIsolation instance
 *
 * @example
 * ```typescript
 * const mocks = createMockIsolation();
 * const spy = mocks.spyOn(console, 'log');
 * // ...
 * mocks.restoreAll();
 * ```
 */
export function createMockIsolation(): MockIsolation {
  return new MockIsolationImpl();
}
