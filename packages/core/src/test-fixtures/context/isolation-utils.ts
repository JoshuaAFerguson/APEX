/**
 * @fileoverview Advanced Test Isolation Utilities
 *
 * This module provides additional utilities for test isolation beyond the basic
 * TestContext factory. It includes patterns for:
 * - Concurrent test execution with resource isolation
 * - State reset helpers for complex objects
 * - Mock registry for tracking and cleanup
 * - Snapshot-based state comparison
 *
 * These utilities complement the TestContext factory and are designed for
 * advanced scenarios where more control over test isolation is needed.
 *
 * @example Basic Concurrent Isolation
 * ```typescript
 * import {
 *   createIsolatedExecution,
 *   withCleanState
 * } from '@apex/core/test-fixtures';
 *
 * describe.concurrent('ParallelTests', () => {
 *   it('test A', async () => {
 *     await createIsolatedExecution(async (isolationContext) => {
 *       // All resources created here are automatically cleaned up
 *       const id = isolationContext.uniqueId('resource');
 *       // ... test logic
 *     });
 *   });
 * });
 * ```
 *
 * @example Mock Registry Pattern
 * ```typescript
 * import { createMockRegistry } from '@apex/core/test-fixtures';
 *
 * describe('MockedFeature', () => {
 *   const mockRegistry = createMockRegistry();
 *
 *   beforeEach(() => mockRegistry.reset());
 *   afterEach(() => mockRegistry.verifyAllCalled());
 *
 *   it('should call all registered mocks', () => {
 *     const mockFn = mockRegistry.register('apiCall', vi.fn());
 *     // ... test that uses mockFn
 *   });
 * });
 * ```
 */

import { vi } from 'vitest';
import { createTestContext } from './test-context.js';
import type { TestContext, TestContextOptions } from './types.js';

// ============================================================================
// Isolated Execution
// ============================================================================

/**
 * Creates an isolated execution context that automatically cleans up after use.
 * Useful for concurrent tests that need guaranteed isolation.
 *
 * @param executor - The function to execute with isolation
 * @param options - TestContext options
 * @returns The result of the executor function
 *
 * @example
 * ```typescript
 * it('should run in isolation', async () => {
 *   const result = await createIsolatedExecution(async (ctx) => {
 *     const taskId = ctx.uniqueTaskId();
 *     // All state is isolated and cleaned up automatically
 *     return taskId;
 *   });
 *
 *   expect(result).toMatch(/^task_/);
 * });
 * ```
 */
export async function createIsolatedExecution<T>(
  executor: (ctx: TestContext) => Promise<T> | T,
  options?: TestContextOptions
): Promise<T> {
  const ctx = createTestContext(options);

  try {
    const result = await executor(ctx);
    return result;
  } finally {
    await ctx.cleanup();
  }
}

/**
 * Synchronous version of createIsolatedExecution for simple cases.
 *
 * @param executor - The function to execute with isolation
 * @param options - TestContext options
 * @returns The result of the executor function
 */
export function withIsolatedContext<T>(
  executor: (ctx: TestContext) => T,
  options?: TestContextOptions
): T {
  const ctx = createTestContext(options);

  try {
    return executor(ctx);
  } finally {
    // Schedule cleanup for next tick to allow any pending operations
    queueMicrotask(() => {
      ctx.cleanup().catch(() => {
        // Ignore cleanup errors in sync context
      });
    });
  }
}

// ============================================================================
// State Reset Helpers
// ============================================================================

/**
 * State snapshot for comparison testing
 */
export interface StateSnapshot<T> {
  /** The captured state */
  data: T;
  /** Timestamp when snapshot was taken */
  timestamp: Date;
  /** Human-readable label */
  label?: string;
}

/**
 * Creates a state snapshot helper for tracking changes during tests.
 *
 * @example
 * ```typescript
 * const stateTracker = createStateTracker();
 *
 * stateTracker.snapshot('before', { count: 0 });
 * // ... perform operations
 * stateTracker.snapshot('after', { count: 5 });
 *
 * expect(stateTracker.hasChanged('before', 'after')).toBe(true);
 * ```
 */
export function createStateTracker<T>() {
  const snapshots: Map<string, StateSnapshot<T>> = new Map();

  return {
    /**
     * Take a snapshot of the current state
     */
    snapshot(label: string, state: T): StateSnapshot<T> {
      const snapshot: StateSnapshot<T> = {
        data: structuredClone(state),
        timestamp: new Date(),
        label,
      };
      snapshots.set(label, snapshot);
      return snapshot;
    },

    /**
     * Get a previously taken snapshot
     */
    getSnapshot(label: string): StateSnapshot<T> | undefined {
      return snapshots.get(label);
    },

    /**
     * Check if state changed between two snapshots
     */
    hasChanged(beforeLabel: string, afterLabel: string): boolean {
      const before = snapshots.get(beforeLabel);
      const after = snapshots.get(afterLabel);

      if (!before || !after) {
        throw new Error(`Snapshot not found: ${!before ? beforeLabel : afterLabel}`);
      }

      return JSON.stringify(before.data) !== JSON.stringify(after.data);
    },

    /**
     * Get the diff between two snapshots (simple keys that changed)
     */
    getChangedKeys(beforeLabel: string, afterLabel: string): string[] {
      const before = snapshots.get(beforeLabel);
      const after = snapshots.get(afterLabel);

      if (!before || !after) {
        throw new Error(`Snapshot not found: ${!before ? beforeLabel : afterLabel}`);
      }

      const changedKeys: string[] = [];
      const allKeys = new Set([
        ...Object.keys(before.data as object),
        ...Object.keys(after.data as object),
      ]);

      for (const key of allKeys) {
        const beforeVal = (before.data as Record<string, unknown>)[key];
        const afterVal = (after.data as Record<string, unknown>)[key];
        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
          changedKeys.push(key);
        }
      }

      return changedKeys;
    },

    /**
     * Clear all snapshots
     */
    clear(): void {
      snapshots.clear();
    },

    /**
     * Get all snapshot labels
     */
    getLabels(): string[] {
      return Array.from(snapshots.keys());
    },
  };
}

// ============================================================================
// Mock Registry
// ============================================================================

/**
 * Registry entry for a mock function
 */
export interface MockRegistryEntry<T extends (...args: unknown[]) => unknown> {
  /** The mock function */
  mock: ReturnType<typeof vi.fn<T>>;
  /** Description of what this mock represents */
  description?: string;
  /** Whether this mock is expected to be called */
  expectedCalls?: number;
  /** Actual call count for verification */
  actualCalls: number;
}

/**
 * Creates a mock registry for tracking and verifying mock usage.
 * Helps ensure all registered mocks are called and cleaned up properly.
 *
 * @example
 * ```typescript
 * const registry = createMockRegistry();
 *
 * beforeEach(() => {
 *   registry.reset();
 * });
 *
 * it('should call API', () => {
 *   const fetchMock = registry.register('fetch', vi.fn(), {
 *     expectedCalls: 1,
 *     description: 'API fetch call'
 *   });
 *
 *   // ... test code
 *
 *   registry.verifyExpectations(); // Throws if expectations not met
 * });
 * ```
 */
export function createMockRegistry() {
  const mocks: Map<string, MockRegistryEntry<(...args: unknown[]) => unknown>> = new Map();

  return {
    /**
     * Register a mock function with the registry
     */
    register<T extends (...args: unknown[]) => unknown>(
      name: string,
      mockFn: ReturnType<typeof vi.fn<T>>,
      options?: {
        expectedCalls?: number;
        description?: string;
      }
    ): ReturnType<typeof vi.fn<T>> {
      const entry: MockRegistryEntry<T> = {
        mock: mockFn,
        description: options?.description,
        expectedCalls: options?.expectedCalls,
        actualCalls: 0,
      };

      // Wrap the mock to track calls
      const wrappedMock = vi.fn((...args: Parameters<T>) => {
        entry.actualCalls++;
        return mockFn(...args);
      }) as ReturnType<typeof vi.fn<T>>;

      mocks.set(name, entry as MockRegistryEntry<(...args: unknown[]) => unknown>);

      return wrappedMock;
    },

    /**
     * Get a registered mock by name
     */
    get<T extends (...args: unknown[]) => unknown>(name: string): ReturnType<typeof vi.fn<T>> | undefined {
      return mocks.get(name)?.mock as ReturnType<typeof vi.fn<T>> | undefined;
    },

    /**
     * Reset all registered mocks
     */
    reset(): void {
      for (const entry of mocks.values()) {
        entry.mock.mockReset();
        entry.actualCalls = 0;
      }
    },

    /**
     * Clear all mocks from the registry
     */
    clear(): void {
      mocks.clear();
    },

    /**
     * Verify that all mocks with expectedCalls were called correctly
     */
    verifyExpectations(): void {
      const failures: string[] = [];

      for (const [name, entry] of mocks) {
        if (entry.expectedCalls !== undefined) {
          if (entry.actualCalls !== entry.expectedCalls) {
            failures.push(
              `Mock "${name}": expected ${entry.expectedCalls} calls, got ${entry.actualCalls}` +
                (entry.description ? ` (${entry.description})` : '')
            );
          }
        }
      }

      if (failures.length > 0) {
        throw new Error(`Mock verification failed:\n${failures.join('\n')}`);
      }
    },

    /**
     * Check if any mock was called
     */
    anyCalled(): boolean {
      for (const entry of mocks.values()) {
        if (entry.actualCalls > 0) {
          return true;
        }
      }
      return false;
    },

    /**
     * Get summary of all mock calls
     */
    getSummary(): Array<{ name: string; calls: number; expected?: number }> {
      return Array.from(mocks.entries()).map(([name, entry]) => ({
        name,
        calls: entry.actualCalls,
        expected: entry.expectedCalls,
      }));
    },
  };
}

// ============================================================================
// Parallel Test Helpers
// ============================================================================

/**
 * Resource lock for coordinating access in parallel tests.
 * Use this when multiple tests need exclusive access to a shared resource.
 */
export interface ResourceLock {
  /** Acquire the lock (waits if already held) */
  acquire(): Promise<void>;
  /** Release the lock */
  release(): void;
  /** Check if lock is currently held */
  isLocked(): boolean;
}

/**
 * Creates a resource lock for coordinating parallel test access.
 *
 * @example
 * ```typescript
 * const dbLock = createResourceLock('database');
 *
 * it.concurrent('test A', async () => {
 *   await dbLock.acquire();
 *   try {
 *     // Exclusive access to database
 *   } finally {
 *     dbLock.release();
 *   }
 * });
 * ```
 */
export function createResourceLock(name: string): ResourceLock {
  let locked = false;
  const waiters: Array<() => void> = [];

  return {
    async acquire(): Promise<void> {
      if (!locked) {
        locked = true;
        return;
      }

      // Wait for lock to be released
      return new Promise((resolve) => {
        waiters.push(resolve);
      });
    },

    release(): void {
      if (!locked) {
        console.warn(`ResourceLock "${name}": Attempting to release unlocked lock`);
        return;
      }

      // Give lock to next waiter, or release it
      const nextWaiter = waiters.shift();
      if (nextWaiter) {
        nextWaiter();
      } else {
        locked = false;
      }
    },

    isLocked(): boolean {
      return locked;
    },
  };
}

/**
 * Executes a function with exclusive access to a resource lock.
 *
 * @example
 * ```typescript
 * const lock = createResourceLock('api');
 *
 * await withLock(lock, async () => {
 *   // Exclusive access here
 *   await callApi();
 * });
 * ```
 */
export async function withLock<T>(
  lock: ResourceLock,
  fn: () => Promise<T> | T
): Promise<T> {
  await lock.acquire();
  try {
    return await fn();
  } finally {
    lock.release();
  }
}

// ============================================================================
// Environment Isolation
// ============================================================================

/**
 * Creates an isolated environment variable scope for testing.
 * All changes are automatically reverted after the scope ends.
 *
 * @example
 * ```typescript
 * await withEnvironment({ NODE_ENV: 'test', API_KEY: 'test-key' }, async () => {
 *   expect(process.env.NODE_ENV).toBe('test');
 *   expect(process.env.API_KEY).toBe('test-key');
 * });
 * // Original values are restored
 * ```
 */
export async function withEnvironment<T>(
  envOverrides: Record<string, string | undefined>,
  fn: () => Promise<T> | T
): Promise<T> {
  const originalEnv: Record<string, string | undefined> = {};

  // Save original values
  for (const key of Object.keys(envOverrides)) {
    originalEnv[key] = process.env[key];
    if (envOverrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = envOverrides[key];
    }
  }

  try {
    return await fn();
  } finally {
    // Restore original values
    for (const key of Object.keys(originalEnv)) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  }
}

/**
 * Synchronous version of withEnvironment
 */
export function withEnvironmentSync<T>(
  envOverrides: Record<string, string | undefined>,
  fn: () => T
): T {
  const originalEnv: Record<string, string | undefined> = {};

  for (const key of Object.keys(envOverrides)) {
    originalEnv[key] = process.env[key];
    if (envOverrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = envOverrides[key];
    }
  }

  try {
    return fn();
  } finally {
    for (const key of Object.keys(originalEnv)) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  }
}

// ============================================================================
// Test Data Isolation
// ============================================================================

/**
 * Creates a test data factory that generates isolated data per test.
 *
 * @example
 * ```typescript
 * const userFactory = createTestDataFactory('user', (id: number) => ({
 *   id,
 *   name: `User ${id}`,
 *   email: `user${id}@test.com`
 * }));
 *
 * const user1 = userFactory.create(); // { id: 1, name: 'User 1', ... }
 * const user2 = userFactory.create(); // { id: 2, name: 'User 2', ... }
 * userFactory.reset(); // Resets sequence
 * ```
 */
export function createTestDataFactory<T>(
  name: string,
  generator: (sequence: number, ctx: { factoryName: string }) => T
) {
  let sequence = 0;

  return {
    /**
     * Create a new instance with auto-incrementing sequence
     */
    create(overrides?: Partial<T>): T {
      sequence++;
      const generated = generator(sequence, { factoryName: name });
      return overrides ? { ...generated, ...overrides } : generated;
    },

    /**
     * Create multiple instances
     */
    createMany(count: number, overrides?: Partial<T>): T[] {
      return Array.from({ length: count }, () => this.create(overrides));
    },

    /**
     * Reset the sequence counter
     */
    reset(): void {
      sequence = 0;
    },

    /**
     * Get current sequence value
     */
    getSequence(): number {
      return sequence;
    },
  };
}

// ============================================================================
// Cleanup Orchestration
// ============================================================================

/**
 * Orchestrates cleanup across multiple test contexts.
 * Useful when tests create resources in multiple systems.
 *
 * @example
 * ```typescript
 * const cleanupOrchestrator = createCleanupOrchestrator();
 *
 * beforeEach(() => cleanupOrchestrator.reset());
 * afterEach(() => cleanupOrchestrator.runAll());
 *
 * it('should cleanup multiple resources', () => {
 *   cleanupOrchestrator.add('database', async () => db.clear());
 *   cleanupOrchestrator.add('cache', () => cache.flush());
 *   cleanupOrchestrator.add('files', async () => fs.rm(tempDir));
 * });
 * ```
 */
export function createCleanupOrchestrator() {
  const tasks: Map<string, () => Promise<void> | void> = new Map();
  const errors: Array<{ name: string; error: Error }> = [];

  return {
    /**
     * Add a named cleanup task
     */
    add(name: string, cleanup: () => Promise<void> | void): void {
      if (tasks.has(name)) {
        console.warn(`CleanupOrchestrator: Overwriting existing task "${name}"`);
      }
      tasks.set(name, cleanup);
    },

    /**
     * Remove a cleanup task by name
     */
    remove(name: string): boolean {
      return tasks.delete(name);
    },

    /**
     * Run all cleanup tasks (in reverse order of registration)
     */
    async runAll(): Promise<void> {
      const taskList = Array.from(tasks.entries()).reverse();

      for (const [name, cleanup] of taskList) {
        try {
          await cleanup();
        } catch (error) {
          errors.push({
            name,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }

      // Clear tasks after running
      tasks.clear();
    },

    /**
     * Reset the orchestrator (clears tasks without running them)
     */
    reset(): void {
      tasks.clear();
      errors.length = 0;
    },

    /**
     * Get any errors that occurred during cleanup
     */
    getErrors(): Array<{ name: string; error: Error }> {
      return [...errors];
    },

    /**
     * Check if there are pending cleanup tasks
     */
    hasPendingTasks(): boolean {
      return tasks.size > 0;
    },

    /**
     * Get list of pending task names
     */
    getPendingTaskNames(): string[] {
      return Array.from(tasks.keys());
    },
  };
}
