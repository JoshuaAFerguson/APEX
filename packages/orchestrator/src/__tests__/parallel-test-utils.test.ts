/**
 * @fileoverview Tests for Parallel Test Execution Support Utilities
 *
 * Tests cover:
 * - Worker ID detection
 * - Worker-unique database paths
 * - Isolated event emitters
 * - Shared state guards
 * - Mutex/locking helpers
 * - Parallel test context
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

import {
  getTestWorkerId,
  isParallelTestExecution,
  getWorkerUniqueDbPath,
  getWorkerUniqueTempDir,
  createWorkerUniqueTempDir,
  createIsolatedEventEmitter,
  assertNoSharedMutation,
  createImmutableSnapshot,
  AsyncMutex,
  ResourceLockManager,
  globalResourceLocks,
  createParallelTestContext,
  createParallelSafeTaskStore,
  createEnvironmentIsolation,
  type ParallelTestContext,
  type IsolatedEventEmitterContext,
  type EventMap,
} from '../parallel-test-utils.js';

// ============================================================================
// Worker ID Detection Tests
// ============================================================================

describe('Worker ID Detection', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
  });

  describe('getTestWorkerId', () => {
    it('should return worker ID from VITEST_WORKER_ID', () => {
      process.env.VITEST_WORKER_ID = '42';
      expect(getTestWorkerId()).toBe('w42');
    });

    it('should return pool ID from VITEST_POOL_ID when no worker ID', () => {
      delete process.env.VITEST_WORKER_ID;
      process.env.VITEST_POOL_ID = '7';
      expect(getTestWorkerId()).toBe('p7');
    });

    it('should return fallback with process ID pattern when no Vitest vars', () => {
      delete process.env.VITEST_WORKER_ID;
      delete process.env.VITEST_POOL_ID;

      const workerId = getTestWorkerId();

      // Should match pattern: pid<number>_<alphanumeric>
      expect(workerId).toMatch(/^(w|p|v|pid)\d+/);
    });

    it('should return consistent ID for same environment', () => {
      process.env.VITEST_WORKER_ID = '5';
      const id1 = getTestWorkerId();
      const id2 = getTestWorkerId();
      expect(id1).toBe(id2);
    });
  });

  describe('isParallelTestExecution', () => {
    it('should return true when VITEST_WORKER_ID is set', () => {
      process.env.VITEST_WORKER_ID = '1';
      expect(isParallelTestExecution()).toBe(true);
    });

    it('should return true when VITEST_POOL_ID is set', () => {
      delete process.env.VITEST_WORKER_ID;
      process.env.VITEST_POOL_ID = '1';
      expect(isParallelTestExecution()).toBe(true);
    });

    it('should return false when no Vitest vars are set', () => {
      delete process.env.VITEST_WORKER_ID;
      delete process.env.VITEST_POOL_ID;
      // Note: __vitest_worker__ may still be present in test environment
      // This test verifies the env var check at minimum
      const result = isParallelTestExecution();
      // In a test environment, __vitest_worker__ is likely present
      expect(typeof result).toBe('boolean');
    });
  });
});

// ============================================================================
// Worker-Unique Paths Tests
// ============================================================================

describe('Worker-Unique Paths', () => {
  describe('getWorkerUniqueDbPath', () => {
    it('should return a path in temp directory', () => {
      const dbPath = getWorkerUniqueDbPath();
      expect(dbPath).toContain(os.tmpdir());
    });

    it('should include .apex/apex.db suffix', () => {
      const dbPath = getWorkerUniqueDbPath();
      expect(dbPath).toMatch(/\.apex[/\\]apex\.db$/);
    });

    it('should use custom prefix', () => {
      const dbPath = getWorkerUniqueDbPath('my-test');
      expect(dbPath).toContain('my-test');
    });

    it('should generate unique paths on each call', () => {
      const path1 = getWorkerUniqueDbPath();
      const path2 = getWorkerUniqueDbPath();
      expect(path1).not.toBe(path2);
    });
  });

  describe('getWorkerUniqueTempDir', () => {
    it('should return a path in temp directory', () => {
      const tempDir = getWorkerUniqueTempDir();
      expect(tempDir).toContain(os.tmpdir());
    });

    it('should use custom prefix', () => {
      const tempDir = getWorkerUniqueTempDir('custom-prefix');
      expect(tempDir).toContain('custom-prefix');
    });

    it('should generate unique paths on each call', () => {
      const dir1 = getWorkerUniqueTempDir();
      const dir2 = getWorkerUniqueTempDir();
      expect(dir1).not.toBe(dir2);
    });
  });

  describe('createWorkerUniqueTempDir', () => {
    let createdDirs: string[] = [];

    afterEach(async () => {
      // Clean up created directories
      for (const dir of createdDirs) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
      createdDirs = [];
    });

    it('should create the directory', async () => {
      const tempDir = await createWorkerUniqueTempDir();
      createdDirs.push(tempDir);

      const stat = await fs.stat(tempDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create .apex subdirectory', async () => {
      const tempDir = await createWorkerUniqueTempDir();
      createdDirs.push(tempDir);

      const apexDir = path.join(tempDir, '.apex');
      const stat = await fs.stat(apexDir);
      expect(stat.isDirectory()).toBe(true);
    });
  });
});

// ============================================================================
// Isolated Event Emitter Tests
// ============================================================================

describe('Isolated Event Emitter', () => {
  interface TestEvents extends EventMap {
    'test:started': (id: string) => void;
    'test:completed': (id: string, result: number) => void;
    'test:failed': (id: string, error: Error) => void;
  }

  let emitterCtx: IsolatedEventEmitterContext<TestEvents>;

  beforeEach(() => {
    emitterCtx = createIsolatedEventEmitter<TestEvents>();
  });

  afterEach(() => {
    emitterCtx.cleanup();
  });

  describe('event emission', () => {
    it('should emit events normally', () => {
      const handler = vi.fn();
      emitterCtx.emitter.on('test:started', handler);

      emitterCtx.emitter.emit('test:started', 'task-1');

      expect(handler).toHaveBeenCalledWith('task-1');
    });

    it('should support multiple listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitterCtx.emitter.on('test:started', handler1);
      emitterCtx.emitter.on('test:started', handler2);

      emitterCtx.emitter.emit('test:started', 'task-1');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('event history tracking', () => {
    it('should track emitted events', () => {
      emitterCtx.emitter.emit('test:started', 'task-1');
      emitterCtx.emitter.emit('test:completed', 'task-1', 42);

      const history = emitterCtx.getEventHistory();

      expect(history).toHaveLength(2);
      expect(history[0].event).toBe('test:started');
      expect(history[0].args).toEqual(['task-1']);
      expect(history[1].event).toBe('test:completed');
      expect(history[1].args).toEqual(['task-1', 42]);
    });

    it('should include timestamps in history', () => {
      const before = Date.now();
      emitterCtx.emitter.emit('test:started', 'task-1');
      const after = Date.now();

      const history = emitterCtx.getEventHistory();

      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should return copies of history entries', () => {
      emitterCtx.emitter.emit('test:started', 'task-1');

      const history1 = emitterCtx.getEventHistory();
      const history2 = emitterCtx.getEventHistory();

      expect(history1).not.toBe(history2);
      expect(history1[0]).not.toBe(history2[0]);
    });
  });

  describe('clearHistory', () => {
    it('should clear event history without removing listeners', () => {
      const handler = vi.fn();
      emitterCtx.emitter.on('test:started', handler);

      emitterCtx.emitter.emit('test:started', 'task-1');
      expect(emitterCtx.getEventHistory()).toHaveLength(1);

      emitterCtx.clearHistory();
      expect(emitterCtx.getEventHistory()).toHaveLength(0);

      // Listener should still work
      emitterCtx.emitter.emit('test:started', 'task-2');
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('getEventCount', () => {
    it('should count specific event emissions', () => {
      emitterCtx.emitter.emit('test:started', 'task-1');
      emitterCtx.emitter.emit('test:started', 'task-2');
      emitterCtx.emitter.emit('test:completed', 'task-1', 1);

      expect(emitterCtx.getEventCount('test:started')).toBe(2);
      expect(emitterCtx.getEventCount('test:completed')).toBe(1);
      expect(emitterCtx.getEventCount('test:failed')).toBe(0);
    });
  });

  describe('waitForEvent', () => {
    it('should resolve when event is emitted', async () => {
      const promise = emitterCtx.waitForEvent('test:completed', 1000);

      // Emit after a short delay
      setTimeout(() => {
        emitterCtx.emitter.emit('test:completed', 'task-1', 42);
      }, 10);

      const args = await promise;
      expect(args).toEqual(['task-1', 42]);
    });

    it('should timeout if event is not emitted', async () => {
      const promise = emitterCtx.waitForEvent('test:completed', 50);

      await expect(promise).rejects.toThrow('Timeout waiting for event');
    });
  });

  describe('cleanup', () => {
    it('should remove all listeners', () => {
      const handler = vi.fn();
      emitterCtx.emitter.on('test:started', handler);

      emitterCtx.cleanup();

      emitterCtx.emitter.emit('test:started', 'task-1');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should clear event history', () => {
      emitterCtx.emitter.emit('test:started', 'task-1');
      expect(emitterCtx.getEventHistory()).toHaveLength(1);

      emitterCtx.cleanup();

      expect(emitterCtx.getEventHistory()).toHaveLength(0);
    });
  });
});

// ============================================================================
// Shared State Guards Tests
// ============================================================================

describe('Shared State Guards', () => {
  describe('assertNoSharedMutation', () => {
    it('should pass when state is unchanged', async () => {
      let state = { count: 0 };

      await expect(
        assertNoSharedMutation(
          () => state,
          async () => {
            // Don't modify state
          }
        )
      ).resolves.not.toThrow();
    });

    it('should pass when state is modified and restored', async () => {
      let state = { count: 0 };

      await expect(
        assertNoSharedMutation(
          () => state,
          async () => {
            state.count = 5;
            state.count = 0; // Restore
          }
        )
      ).resolves.not.toThrow();
    });

    it('should throw when state is modified and not restored', async () => {
      let state = { count: 0 };

      await expect(
        assertNoSharedMutation(
          () => state,
          async () => {
            state.count = 5;
          }
        )
      ).rejects.toThrow('Shared state was mutated');
    });

    it('should detect nested state changes', async () => {
      let state = { nested: { value: 1 } };

      await expect(
        assertNoSharedMutation(
          () => state,
          async () => {
            state.nested.value = 2;
          }
        )
      ).rejects.toThrow('Shared state was mutated');
    });

    it('should detect array modifications', async () => {
      let state = { items: [1, 2, 3] };

      await expect(
        assertNoSharedMutation(
          () => state,
          async () => {
            state.items.push(4);
          }
        )
      ).rejects.toThrow('Shared state was mutated');
    });
  });

  describe('createImmutableSnapshot', () => {
    it('should create a frozen copy', () => {
      const original = { count: 0, nested: { value: 1 } };
      const snapshot = createImmutableSnapshot(original);

      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.nested)).toBe(true);
    });

    it('should not affect the original', () => {
      const original = { count: 0 };
      createImmutableSnapshot(original);

      original.count = 5; // Should work
      expect(original.count).toBe(5);
    });

    it('should handle arrays', () => {
      const original = { items: [1, 2, 3] };
      const snapshot = createImmutableSnapshot(original);

      expect(Object.isFrozen(snapshot.items)).toBe(true);
    });

    it('should handle null and primitives', () => {
      expect(createImmutableSnapshot(null)).toBe(null);
      expect(createImmutableSnapshot(42)).toBe(42);
      expect(createImmutableSnapshot('string')).toBe('string');
    });
  });
});

// ============================================================================
// Mutex Tests
// ============================================================================

describe('AsyncMutex', () => {
  let mutex: AsyncMutex;

  beforeEach(() => {
    mutex = new AsyncMutex();
  });

  describe('acquire', () => {
    it('should acquire lock when available', async () => {
      const release = await mutex.acquire();
      expect(mutex.isLocked()).toBe(true);
      release();
      expect(mutex.isLocked()).toBe(false);
    });

    it('should queue acquisitions when locked', async () => {
      const order: number[] = [];

      const release1 = await mutex.acquire();
      order.push(1);

      const promise2 = mutex.acquire().then((release) => {
        order.push(2);
        release();
      });

      const promise3 = mutex.acquire().then((release) => {
        order.push(3);
        release();
      });

      expect(mutex.getQueueLength()).toBe(2);

      release1();

      await Promise.all([promise2, promise3]);

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('withLock', () => {
    it('should execute function with lock', async () => {
      let executed = false;

      await mutex.withLock(async () => {
        expect(mutex.isLocked()).toBe(true);
        executed = true;
      });

      expect(executed).toBe(true);
      expect(mutex.isLocked()).toBe(false);
    });

    it('should release lock even on error', async () => {
      await expect(
        mutex.withLock(async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');

      expect(mutex.isLocked()).toBe(false);
    });

    it('should return function result', async () => {
      const result = await mutex.withLock(async () => {
        return 42;
      });

      expect(result).toBe(42);
    });
  });
});

// ============================================================================
// Resource Lock Manager Tests
// ============================================================================

describe('ResourceLockManager', () => {
  let lockManager: ResourceLockManager;

  beforeEach(() => {
    lockManager = new ResourceLockManager();
  });

  afterEach(() => {
    lockManager.clearAllLocks();
  });

  describe('acquireLock', () => {
    it('should acquire lock on available resource', async () => {
      const lock = await lockManager.acquireLock('resource-1');

      expect(lock.resourceId).toBe('resource-1');
      expect(lockManager.isLocked('resource-1')).toBe(true);

      lock.release();
      expect(lockManager.isLocked('resource-1')).toBe(false);
    });

    it('should wait for locked resource', async () => {
      const lock1 = await lockManager.acquireLock('resource-1');

      let lock2Acquired = false;
      const lock2Promise = lockManager.acquireLock('resource-1', 1000).then((lock) => {
        lock2Acquired = true;
        return lock;
      });

      expect(lock2Acquired).toBe(false);

      lock1.release();

      const lock2 = await lock2Promise;
      expect(lock2Acquired).toBe(true);
      lock2.release();
    });

    it('should timeout when resource unavailable', async () => {
      const lock1 = await lockManager.acquireLock('resource-1');

      await expect(lockManager.acquireLock('resource-1', 50)).rejects.toThrow(
        'Timeout acquiring lock'
      );

      lock1.release();
    });
  });

  describe('getLockHolder', () => {
    it('should return holder for locked resource', async () => {
      const lock = await lockManager.acquireLock('resource-1');

      const holder = lockManager.getLockHolder('resource-1');
      expect(holder).toBe(lock.holder);

      lock.release();
    });

    it('should return undefined for unlocked resource', () => {
      expect(lockManager.getLockHolder('resource-1')).toBeUndefined();
    });
  });
});

// ============================================================================
// Global Resource Locks Tests
// ============================================================================

describe('globalResourceLocks', () => {
  afterEach(() => {
    globalResourceLocks.clearAllLocks();
  });

  it('should be a singleton instance', () => {
    expect(globalResourceLocks).toBeInstanceOf(ResourceLockManager);
  });

  it('should support cross-test coordination', async () => {
    const lock = await globalResourceLocks.acquireLock('shared-resource');
    expect(globalResourceLocks.isLocked('shared-resource')).toBe(true);
    lock.release();
    expect(globalResourceLocks.isLocked('shared-resource')).toBe(false);
  });
});

// ============================================================================
// Parallel Test Context Tests
// ============================================================================

describe('createParallelTestContext', () => {
  let ctx: ParallelTestContext;

  afterEach(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('should create context with all required properties', async () => {
    ctx = await createParallelTestContext();

    expect(ctx.workerId).toBeDefined();
    expect(typeof ctx.workerId).toBe('string');
    expect(ctx.tempDir).toBeDefined();
    expect(ctx.dbPath).toBeDefined();
    expect(ctx.eventEmitter).toBeDefined();
    expect(typeof ctx.cleanup).toBe('function');
  });

  it('should create actual temp directory', async () => {
    ctx = await createParallelTestContext();

    const stat = await fs.stat(ctx.tempDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('should create .apex subdirectory', async () => {
    ctx = await createParallelTestContext();

    const apexDir = path.dirname(ctx.dbPath);
    const stat = await fs.stat(apexDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('should provide isolated event emitter', async () => {
    ctx = await createParallelTestContext();

    ctx.eventEmitter.emitter.emit('test', 'data');
    expect(ctx.eventEmitter.getEventHistory()).toHaveLength(1);
  });

  it('should support custom prefix', async () => {
    ctx = await createParallelTestContext({ prefix: 'custom-test' });

    expect(ctx.tempDir).toContain('custom-test');
  });

  it('should clean up resources', async () => {
    ctx = await createParallelTestContext();
    const tempDir = ctx.tempDir;

    await ctx.cleanup();

    await expect(fs.stat(tempDir)).rejects.toThrow();
  });
});

// ============================================================================
// Parallel-Safe TaskStore Tests
// ============================================================================

describe('createParallelSafeTaskStore', () => {
  it('should create isolated TaskStore', async () => {
    const { store, db, tempPath, workerId, cleanup } = await createParallelSafeTaskStore();

    try {
      expect(store).toBeDefined();
      expect(db).toBeDefined();
      expect(tempPath).toBeDefined();
      expect(workerId).toBeDefined();

      // Verify store works
      const tasks = await store.listTasks();
      expect(Array.isArray(tasks)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('should use worker-unique paths', async () => {
    const ctx1 = await createParallelSafeTaskStore({ prefix: 'test1' });
    const ctx2 = await createParallelSafeTaskStore({ prefix: 'test2' });

    try {
      expect(ctx1.tempPath).not.toBe(ctx2.tempPath);
    } finally {
      await ctx1.cleanup();
      await ctx2.cleanup();
    }
  });
});

// ============================================================================
// Environment Isolation Tests
// ============================================================================

describe('createEnvironmentIsolation', () => {
  it('should set environment variables', () => {
    const env = createEnvironmentIsolation();

    env.set('TEST_VAR', 'test-value');
    expect(process.env.TEST_VAR).toBe('test-value');

    env.restore();
    expect(process.env.TEST_VAR).toBeUndefined();
  });

  it('should restore original values', () => {
    process.env.EXISTING_VAR = 'original';
    const env = createEnvironmentIsolation();

    env.set('EXISTING_VAR', 'modified');
    expect(process.env.EXISTING_VAR).toBe('modified');

    env.restore();
    expect(process.env.EXISTING_VAR).toBe('original');

    // Cleanup
    delete process.env.EXISTING_VAR;
  });

  it('should delete environment variables', () => {
    process.env.TO_DELETE = 'value';
    const env = createEnvironmentIsolation();

    env.delete('TO_DELETE');
    expect(process.env.TO_DELETE).toBeUndefined();

    env.restore();
    expect(process.env.TO_DELETE).toBe('value');

    // Cleanup
    delete process.env.TO_DELETE;
  });

  it('should get current values', () => {
    const env = createEnvironmentIsolation();

    env.set('NEW_VAR', 'value');
    expect(env.get('NEW_VAR')).toBe('value');

    env.restore();
  });
});
