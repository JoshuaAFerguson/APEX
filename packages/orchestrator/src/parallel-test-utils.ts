/**
 * @fileoverview Parallel Test Execution Support Utilities
 *
 * Provides utilities for preventing test interference during parallel execution:
 * - Worker-aware unique database paths
 * - Isolated event emitter instances
 * - Shared state guards
 * - Mutex/locking helpers for shared resources
 *
 * @see ADR-008-parallel-test-execution-utilities.md
 *
 * @example
 * ```typescript
 * import { createParallelTestContext } from './parallel-test-utils';
 *
 * describe('MyFeature', () => {
 *   let ctx: ParallelTestContext;
 *
 *   beforeEach(async () => {
 *     ctx = await createParallelTestContext();
 *   });
 *
 *   afterEach(async () => {
 *     await ctx.cleanup();
 *   });
 *
 *   it('should work in parallel', async () => {
 *     // Each worker gets unique ctx.dbPath, ctx.tempDir, ctx.eventEmitter
 *     const store = new TaskStore(ctx.tempDir);
 *     // ...
 *   });
 * });
 * ```
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Worker ID Detection
// ============================================================================

/**
 * Gets the current Vitest worker ID for parallel test isolation.
 *
 * Detection strategy (in order):
 * 1. VITEST_WORKER_ID environment variable
 * 2. VITEST_POOL_ID environment variable
 * 3. __vitest_worker__ global context
 * 4. Fallback to process.pid with random suffix
 *
 * @returns A unique identifier for the current test worker
 *
 * @example
 * ```typescript
 * const workerId = getTestWorkerId();
 * // Returns 'w1', 'p2', 'v3', or 'pid12345_abc123'
 * ```
 */
export function getTestWorkerId(): string {
  // Try Vitest worker ID first (available in threads/forks pools)
  if (process.env.VITEST_WORKER_ID) {
    return `w${process.env.VITEST_WORKER_ID}`;
  }

  // Try Vitest pool ID
  if (process.env.VITEST_POOL_ID) {
    return `p${process.env.VITEST_POOL_ID}`;
  }

  // Check for worker context (undocumented but available)
  if ('__vitest_worker__' in globalThis) {
    const worker = (globalThis as Record<string, unknown>).__vitest_worker__ as {
      id?: string | number;
    };
    if (worker?.id !== undefined) {
      return `v${worker.id}`;
    }
  }

  // Fallback to process ID + random suffix for uniqueness
  return `pid${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Checks if the current execution context is running in parallel test mode.
 *
 * @returns true if running in a parallel test worker
 */
export function isParallelTestExecution(): boolean {
  return !!(
    process.env.VITEST_WORKER_ID ||
    process.env.VITEST_POOL_ID ||
    '__vitest_worker__' in globalThis
  );
}

// ============================================================================
// Worker-Unique Database Paths
// ============================================================================

/**
 * Generates a unique database path incorporating the worker ID.
 * Ensures no database collisions during parallel execution.
 *
 * @param prefix - Optional prefix for the database directory name
 * @returns Absolute path to a unique database file
 *
 * @example
 * ```typescript
 * const dbPath = getWorkerUniqueDbPath('test');
 * // Returns '/tmp/test-w1-1707654321000-abc123/.apex/apex.db'
 * ```
 */
export function getWorkerUniqueDbPath(prefix: string = 'apex'): string {
  const workerId = getTestWorkerId();
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  return path.join(
    os.tmpdir(),
    `${prefix}-${workerId}-${timestamp}-${random}`,
    '.apex',
    'apex.db'
  );
}

/**
 * Generates a unique temporary directory path for the current worker.
 *
 * @param prefix - Optional prefix for the directory name
 * @returns Absolute path to a unique temporary directory
 */
export function getWorkerUniqueTempDir(prefix: string = 'apex-test'): string {
  const workerId = getTestWorkerId();
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  return path.join(os.tmpdir(), `${prefix}-${workerId}-${timestamp}-${random}`);
}

/**
 * Creates a unique temporary directory for the current worker.
 *
 * @param prefix - Optional prefix for the directory name
 * @returns Promise resolving to the created directory path
 */
export async function createWorkerUniqueTempDir(
  prefix: string = 'apex-test'
): Promise<string> {
  const dirPath = getWorkerUniqueTempDir(prefix);
  await fs.mkdir(dirPath, { recursive: true });
  await fs.mkdir(path.join(dirPath, '.apex'), { recursive: true });
  return dirPath;
}

// ============================================================================
// Isolated Event Emitter
// ============================================================================

/**
 * Event map type for type-safe event emitters.
 */
export type EventMap = Record<string, (...args: any[]) => void>;

/**
 * Recorded event entry for history tracking.
 */
export interface EventHistoryEntry {
  /** Event name */
  event: string;
  /** Event arguments */
  args: any[];
  /** Timestamp when event was emitted */
  timestamp: number;
}

/**
 * Context for managing an isolated event emitter in tests.
 *
 * @typeParam T - Event map defining the emitter's event signatures
 */
export interface IsolatedEventEmitterContext<T extends EventMap> {
  /** The isolated event emitter instance */
  emitter: EventEmitter<T>;
  /** Cleanup function to remove all listeners and clear history */
  cleanup: () => void;
  /** Get a copy of the event history */
  getEventHistory: () => EventHistoryEntry[];
  /** Clear the event history without removing listeners */
  clearHistory: () => void;
  /** Wait for a specific event to be emitted */
  waitForEvent: <K extends keyof T>(
    event: K,
    timeout?: number
  ) => Promise<Parameters<T[K]>>;
  /** Get count of times an event was emitted */
  getEventCount: (event: keyof T) => number;
}

/**
 * Creates an isolated EventEmitter instance for testing.
 * Each test gets its own emitter that doesn't interfere with others.
 *
 * Features:
 * - Complete isolation from other tests
 * - Event history tracking for assertions
 * - Automatic cleanup support
 * - Type-safe event handling
 *
 * @typeParam T - Event map defining the emitter's event signatures
 * @returns Isolated event emitter context with utilities
 *
 * @example
 * ```typescript
 * const { emitter, getEventHistory, cleanup } = createIsolatedEventEmitter<{
 *   'task:started': (taskId: string) => void;
 *   'task:completed': (taskId: string, result: unknown) => void;
 * }>();
 *
 * emitter.emit('task:started', 'task-1');
 *
 * const history = getEventHistory();
 * expect(history).toHaveLength(1);
 * expect(history[0].event).toBe('task:started');
 *
 * cleanup();
 * ```
 */
export function createIsolatedEventEmitter<
  T extends EventMap = Record<string, (...args: any[]) => void>
>(): IsolatedEventEmitterContext<T> {
  const emitter = new EventEmitter<T>();
  const eventHistory: EventHistoryEntry[] = [];

  // Wrap emit to capture history
  const originalEmit = emitter.emit.bind(emitter);
  (emitter as EventEmitter<T>).emit = function <K extends keyof T>(
    event: K,
    ...args: Parameters<T[K]>
  ): boolean {
    eventHistory.push({
      event: String(event),
      args: [...args],
      timestamp: Date.now(),
    });
    return originalEmit(event, ...args);
  } as EventEmitter<T>['emit'];

  return {
    emitter,

    cleanup: () => {
      emitter.removeAllListeners();
      eventHistory.length = 0;
    },

    getEventHistory: () => eventHistory.map((e) => ({ ...e, args: [...e.args] })),

    clearHistory: () => {
      eventHistory.length = 0;
    },

    waitForEvent: <K extends keyof T>(
      event: K,
      timeout: number = 5000
    ): Promise<Parameters<T[K]>> => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          emitter.off(event, handler);
          reject(new Error(`Timeout waiting for event: ${String(event)}`));
        }, timeout);

        const handler = (...args: Parameters<T[K]>) => {
          clearTimeout(timer);
          resolve(args);
        };

        emitter.once(event, handler as T[K]);
      });
    },

    getEventCount: (event: keyof T): number => {
      return eventHistory.filter((e) => e.event === String(event)).length;
    },
  };
}

// ============================================================================
// Shared State Guards
// ============================================================================

/**
 * Verifies that a test doesn't mutate shared state.
 * Captures state before test execution and verifies it's restored after.
 *
 * @param getState - Function that returns the state to monitor
 * @param testFn - The test function to execute
 * @throws Error if state was mutated and not restored
 *
 * @example
 * ```typescript
 * await assertNoSharedMutation(
 *   () => process.env.NODE_ENV,
 *   async () => {
 *     process.env.NODE_ENV = 'test';
 *     // Forgetting to restore will throw
 *   }
 * );
 * ```
 */
export async function assertNoSharedMutation<T>(
  getState: () => T,
  testFn: () => Promise<void>
): Promise<void> {
  const stateBefore = deepClone(getState());

  try {
    await testFn();
  } finally {
    const stateAfter = deepClone(getState());

    if (!deepEqual(stateBefore, stateAfter)) {
      throw new Error(
        'Shared state was mutated during test execution.\n' +
          `Before: ${JSON.stringify(stateBefore, null, 2)}\n` +
          `After: ${JSON.stringify(stateAfter, null, 2)}`
      );
    }
  }
}

/**
 * Creates a deep-frozen copy of state that throws on modification attempts.
 *
 * @param state - The state to make immutable
 * @returns A deeply frozen copy of the state
 *
 * @example
 * ```typescript
 * const snapshot = createImmutableSnapshot({ count: 0, nested: { value: 1 } });
 * snapshot.count = 1; // Throws in strict mode
 * ```
 */
export function createImmutableSnapshot<T>(state: T): Readonly<T> {
  const clone = deepClone(state);
  return deepFreeze(clone);
}

/**
 * Deep clones an object for state comparison.
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  if (obj instanceof Map) {
    const clonedMap = new Map();
    obj.forEach((value, key) => {
      clonedMap.set(deepClone(key), deepClone(value));
    });
    return clonedMap as unknown as T;
  }

  if (obj instanceof Set) {
    const clonedSet = new Set();
    obj.forEach((value) => {
      clonedSet.add(deepClone(value));
    });
    return clonedSet as unknown as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Deep freezes an object to prevent modifications.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  Object.freeze(obj);

  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }

  return obj;
}

/**
 * Deep equality check for state comparison.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
    }
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) =>
    deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key]
    )
  );
}

// ============================================================================
// Mutex / Locking Helpers
// ============================================================================

/**
 * A release function returned when acquiring a lock.
 */
export type ReleaseLock = () => void;

/**
 * Simple async mutex for coordinating access to shared resources.
 * Use sparingly - prefer isolation over locking.
 *
 * @example
 * ```typescript
 * const mutex = new AsyncMutex();
 *
 * // Option 1: Manual acquire/release
 * const release = await mutex.acquire();
 * try {
 *   // Critical section
 * } finally {
 *   release();
 * }
 *
 * // Option 2: withLock helper
 * const result = await mutex.withLock(async () => {
 *   // Critical section
 *   return someValue;
 * });
 * ```
 */
export class AsyncMutex {
  private locked = false;
  private waitQueue: Array<() => void> = [];

  /**
   * Acquires the mutex lock.
   *
   * @returns Promise resolving to a release function
   */
  async acquire(): Promise<ReleaseLock> {
    while (this.locked) {
      await new Promise<void>((resolve) => {
        this.waitQueue.push(resolve);
      });
    }

    this.locked = true;

    return () => {
      this.locked = false;
      const next = this.waitQueue.shift();
      if (next) {
        next();
      }
    };
  }

  /**
   * Executes a function with exclusive access.
   *
   * @param fn - The function to execute while holding the lock
   * @returns The result of the function
   */
  async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Checks if the mutex is currently locked.
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Gets the number of waiters in the queue.
   */
  getQueueLength(): number {
    return this.waitQueue.length;
  }
}

/**
 * Resource lock handle.
 */
export interface ResourceLock {
  /** The locked resource ID */
  resourceId: string;
  /** The worker/test that holds the lock */
  holder: string;
  /** When the lock was acquired */
  acquiredAt: number;
  /** Release the lock */
  release: () => void;
}

/**
 * Named resource lock manager for test coordination.
 * Prevents concurrent access to the same resource across workers.
 *
 * @example
 * ```typescript
 * const lockManager = new ResourceLockManager();
 *
 * // Acquire a lock on a specific resource
 * const lock = await lockManager.acquireLock('shared-port-3000', 5000);
 * try {
 *   // Use the resource
 * } finally {
 *   lockManager.releaseLock(lock);
 * }
 * ```
 */
export class ResourceLockManager {
  private locks = new Map<string, ResourceLock>();
  private waiters = new Map<string, Array<(lock: ResourceLock) => void>>();

  /**
   * Acquires a lock on a named resource.
   *
   * @param resourceId - The resource identifier to lock
   * @param timeout - Optional timeout in milliseconds (default: 30000)
   * @returns Promise resolving to the resource lock
   * @throws Error if timeout is reached
   */
  async acquireLock(
    resourceId: string,
    timeout: number = 30000
  ): Promise<ResourceLock> {
    const holder = getTestWorkerId();
    const startTime = Date.now();

    while (this.locks.has(resourceId)) {
      if (Date.now() - startTime > timeout) {
        const currentHolder = this.locks.get(resourceId)?.holder;
        throw new Error(
          `Timeout acquiring lock for resource '${resourceId}' (held by ${currentHolder})`
        );
      }

      await new Promise<void>((resolve) => {
        const waiters = this.waiters.get(resourceId) || [];
        waiters.push(() => resolve());
        this.waiters.set(resourceId, waiters);
      });
    }

    const lock: ResourceLock = {
      resourceId,
      holder,
      acquiredAt: Date.now(),
      release: () => this.releaseLock(lock),
    };

    this.locks.set(resourceId, lock);
    return lock;
  }

  /**
   * Releases a resource lock.
   *
   * @param lock - The lock to release
   */
  releaseLock(lock: ResourceLock): void {
    const currentLock = this.locks.get(lock.resourceId);
    if (currentLock && currentLock.holder === lock.holder) {
      this.locks.delete(lock.resourceId);

      // Wake up first waiter
      const waiters = this.waiters.get(lock.resourceId);
      if (waiters && waiters.length > 0) {
        const waiter = waiters.shift()!;
        if (waiters.length === 0) {
          this.waiters.delete(lock.resourceId);
        }
        waiter(lock);
      }
    }
  }

  /**
   * Checks if a resource is currently locked.
   *
   * @param resourceId - The resource to check
   * @returns true if the resource is locked
   */
  isLocked(resourceId: string): boolean {
    return this.locks.has(resourceId);
  }

  /**
   * Gets the current holder of a resource lock.
   *
   * @param resourceId - The resource to check
   * @returns The holder ID or undefined if not locked
   */
  getLockHolder(resourceId: string): string | undefined {
    return this.locks.get(resourceId)?.holder;
  }

  /**
   * Clears all locks (use with caution, primarily for cleanup).
   */
  clearAllLocks(): void {
    this.locks.clear();
    this.waiters.clear();
  }
}

// Global resource lock manager instance for cross-test coordination
export const globalResourceLocks = new ResourceLockManager();

// ============================================================================
// Parallel Test Context
// ============================================================================

/**
 * Options for creating a parallel test context.
 */
export interface ParallelTestContextOptions {
  /** Prefix for temporary directories and database files */
  prefix?: string;
  /** Whether to create the database directory structure */
  createDbStructure?: boolean;
  /** Custom event map type for the event emitter */
  eventMap?: EventMap;
}

/**
 * Complete parallel-safe test context combining all utilities.
 */
export interface ParallelTestContext {
  /** Unique worker identifier */
  workerId: string;
  /** Isolated temporary directory for this test */
  tempDir: string;
  /** Path to isolated database file */
  dbPath: string;
  /** Isolated event emitter with history tracking */
  eventEmitter: IsolatedEventEmitterContext<Record<string, (...args: any[]) => void>>;
  /** Cleanup function to release all resources */
  cleanup: () => Promise<void>;
}

/**
 * Creates a complete parallel-safe test context with all isolated resources.
 *
 * Includes:
 * - Worker-unique temporary directory
 * - Worker-unique database path (with .apex structure)
 * - Isolated event emitter with history tracking
 * - Automatic cleanup
 *
 * @param options - Configuration options
 * @returns Promise resolving to the test context
 *
 * @example
 * ```typescript
 * describe('MyFeature', () => {
 *   let ctx: ParallelTestContext;
 *
 *   beforeEach(async () => {
 *     ctx = await createParallelTestContext();
 *   });
 *
 *   afterEach(async () => {
 *     await ctx.cleanup();
 *   });
 *
 *   it('should work in parallel', async () => {
 *     const store = new TaskStore(ctx.tempDir);
 *     await store.initialize();
 *
 *     ctx.eventEmitter.emitter.emit('test:event', 'data');
 *     expect(ctx.eventEmitter.getEventHistory()).toHaveLength(1);
 *   });
 * });
 * ```
 */
export async function createParallelTestContext(
  options: ParallelTestContextOptions = {}
): Promise<ParallelTestContext> {
  const { prefix = 'apex-test', createDbStructure = true } = options;

  const workerId = getTestWorkerId();
  const tempDir = await createWorkerUniqueTempDir(prefix);
  const dbPath = path.join(tempDir, '.apex', 'apex.db');

  if (createDbStructure) {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
  }

  const eventEmitter = createIsolatedEventEmitter();

  return {
    workerId,
    tempDir,
    dbPath,
    eventEmitter,
    cleanup: async () => {
      eventEmitter.cleanup();

      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

// ============================================================================
// Test Utilities Integration
// ============================================================================

/**
 * Creates an isolated TaskStore for parallel test execution.
 * Integrates with the existing TaskStore but ensures worker isolation.
 *
 * @param options - Configuration options
 * @returns Promise resolving to context with store and cleanup
 */
export async function createParallelSafeTaskStore(options?: {
  prefix?: string;
}): Promise<{
  store: import('./store.js').TaskStore;
  db: import('better-sqlite3').Database;
  tempPath: string;
  workerId: string;
  cleanup: () => Promise<void>;
}> {
  // Dynamic import to avoid circular dependencies
  const { TaskStore } = await import('./store.js');

  const ctx = await createParallelTestContext(options);
  const store = new TaskStore(ctx.tempDir);
  await store.initialize();

  return {
    store,
    db: store.getDatabase(),
    tempPath: ctx.tempDir,
    workerId: ctx.workerId,
    cleanup: async () => {
      try {
        store.close();
      } catch {
        // Already closed
      }
      await ctx.cleanup();
    },
  };
}

// ============================================================================
// Environment Isolation
// ============================================================================

/**
 * Context for environment variable isolation.
 */
export interface EnvironmentIsolationContext {
  /** Set an environment variable */
  set: (key: string, value: string) => void;
  /** Delete an environment variable */
  delete: (key: string) => void;
  /** Get an environment variable */
  get: (key: string) => string | undefined;
  /** Restore all original values */
  restore: () => void;
}

/**
 * Creates an isolated environment context for testing.
 * All changes are tracked and can be restored.
 *
 * @returns Environment isolation context
 *
 * @example
 * ```typescript
 * const env = createEnvironmentIsolation();
 *
 * env.set('NODE_ENV', 'test');
 * env.set('DEBUG', 'true');
 *
 * // In cleanup:
 * env.restore();
 * ```
 */
export function createEnvironmentIsolation(): EnvironmentIsolationContext {
  const originalValues = new Map<string, string | undefined>();

  return {
    set(key: string, value: string): void {
      if (!originalValues.has(key)) {
        originalValues.set(key, process.env[key]);
      }
      process.env[key] = value;
    },

    delete(key: string): void {
      if (!originalValues.has(key)) {
        originalValues.set(key, process.env[key]);
      }
      delete process.env[key];
    },

    get(key: string): string | undefined {
      return process.env[key];
    },

    restore(): void {
      for (const [key, value] of originalValues) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
      originalValues.clear();
    },
  };
}
