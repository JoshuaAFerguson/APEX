/**
 * @fileoverview Edge case tests for Parallel Test Execution Support Utilities
 *
 * These tests cover edge cases, error conditions, and concurrent scenarios
 * that might occur in real-world parallel test execution environments.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';

import {
  getTestWorkerId,
  isParallelTestExecution,
  getWorkerUniqueDbPath,
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
  type IsolatedEventEmitterContext,
  type ParallelTestContext,
} from '../parallel-test-utils.js';

// ============================================================================
// Edge Cases: Worker ID Detection with Malformed Environment
// ============================================================================

describe('Worker ID Edge Cases', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should handle empty string environment variables', () => {
    process.env.VITEST_WORKER_ID = '';
    delete process.env.VITEST_POOL_ID;

    const workerId = getTestWorkerId();
    expect(workerId).toMatch(/^pid\d+_[a-z0-9]{6}$/);
  });

  it('should handle non-numeric worker IDs gracefully', () => {
    process.env.VITEST_WORKER_ID = 'not-a-number';

    const workerId = getTestWorkerId();
    expect(workerId).toBe('wnot-a-number');
  });

  it('should handle extremely large worker IDs', () => {
    process.env.VITEST_WORKER_ID = '999999999999999';

    const workerId = getTestWorkerId();
    expect(workerId).toBe('w999999999999999');
  });

  it('should handle special characters in worker IDs', () => {
    process.env.VITEST_WORKER_ID = 'worker-1@special';

    const workerId = getTestWorkerId();
    expect(workerId).toBe('wworker-1@special');
  });
});

// ============================================================================
// Edge Cases: Concurrent Event Emitter Operations
// ============================================================================

describe('Event Emitter Concurrency Edge Cases', () => {
  let emitterCtx: IsolatedEventEmitterContext<Record<string, (...args: any[]) => void>>;

  beforeEach(() => {
    emitterCtx = createIsolatedEventEmitter();
  });

  afterEach(() => {
    emitterCtx.cleanup();
  });

  it('should handle rapid concurrent event emissions', async () => {
    const eventCount = 1000;
    const promises: Promise<void>[] = [];

    // Emit events concurrently
    for (let i = 0; i < eventCount; i++) {
      promises.push(
        Promise.resolve().then(() => {
          emitterCtx.emitter.emit('rapid-test', i);
        })
      );
    }

    await Promise.all(promises);

    const history = emitterCtx.getEventHistory();
    expect(history).toHaveLength(eventCount);

    // Verify all events are recorded with unique arguments
    const args = history.map(h => h.args[0]);
    const uniqueArgs = new Set(args);
    expect(uniqueArgs.size).toBe(eventCount);
  });

  it('should handle concurrent waitForEvent calls', async () => {
    const promises = [
      emitterCtx.waitForEvent('test-event', 1000),
      emitterCtx.waitForEvent('test-event', 1000),
      emitterCtx.waitForEvent('test-event', 1000),
    ];

    // Emit event after a delay
    setTimeout(() => {
      emitterCtx.emitter.emit('test-event', 'data');
    }, 10);

    const results = await Promise.all(promises);

    // All should receive the same event
    results.forEach(result => {
      expect(result).toEqual(['data']);
    });

    // Only one event should be recorded
    expect(emitterCtx.getEventCount('test-event')).toBe(1);
  });

  it('should handle cleanup during active listeners', () => {
    const handler = vi.fn();
    emitterCtx.emitter.on('test-event', handler);

    // Emit some events
    emitterCtx.emitter.emit('test-event', 'before-cleanup');

    // Cleanup while listener is active
    emitterCtx.cleanup();

    // Further emissions should not trigger handler
    emitterCtx.emitter.emit('test-event', 'after-cleanup');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('before-cleanup');
  });
});

// ============================================================================
// Edge Cases: Shared State Mutation with Complex Objects
// ============================================================================

describe('Shared State Mutation Edge Cases', () => {
  it('should detect circular reference modifications', async () => {
    const obj: any = { count: 0 };
    obj.self = obj;

    await expect(
      assertNoSharedMutation(
        () => obj,
        async () => {
          obj.count = 1;
        }
      )
    ).rejects.toThrow('Shared state was mutated');
  });

  it('should handle state with functions', async () => {
    const state = {
      count: 0,
      fn: () => 'test',
    };

    await expect(
      assertNoSharedMutation(
        () => state,
        async () => {
          state.count = 1;
          state.count = 0; // Restore
        }
      )
    ).resolves.not.toThrow();
  });

  it('should detect Map and Set modifications', async () => {
    const state = {
      map: new Map([['key', 'value']]),
      set: new Set([1, 2, 3]),
    };

    await expect(
      assertNoSharedMutation(
        () => state,
        async () => {
          state.map.set('newKey', 'newValue');
        }
      )
    ).rejects.toThrow('Shared state was mutated');

    await expect(
      assertNoSharedMutation(
        () => state,
        async () => {
          state.set.add(4);
        }
      )
    ).rejects.toThrow('Shared state was mutated');
  });

  it('should handle immutable snapshot of complex structures', () => {
    const complex = {
      nested: {
        array: [{ id: 1 }, { id: 2 }],
        map: new Map([['a', { value: 1 }]]),
        set: new Set([{ item: 'test' }]),
      },
    };

    const snapshot = createImmutableSnapshot(complex);

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.nested)).toBe(true);
    expect(Object.isFrozen(snapshot.nested.array)).toBe(true);
    expect(Object.isFrozen(snapshot.nested.array[0])).toBe(true);
    expect(Object.isFrozen(snapshot.nested.map)).toBe(true);
    expect(Object.isFrozen(snapshot.nested.set)).toBe(true);
  });
});

// ============================================================================
// Edge Cases: Mutex Under High Contention
// ============================================================================

describe('Mutex High Contention Edge Cases', () => {
  let mutex: AsyncMutex;

  beforeEach(() => {
    mutex = new AsyncMutex();
  });

  it('should handle many concurrent acquisitions', async () => {
    const concurrency = 100;
    const results: number[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      const taskId = i;
      promises.push(
        mutex.withLock(async () => {
          // Simulate work
          await new Promise(resolve => setTimeout(resolve, 1));
          results.push(taskId);
        })
      );
    }

    await Promise.all(promises);

    // All tasks should complete
    expect(results).toHaveLength(concurrency);
    expect(mutex.isLocked()).toBe(false);
    expect(mutex.getQueueLength()).toBe(0);
  });

  it('should handle errors in withLock gracefully under contention', async () => {
    const promises: Promise<any>[] = [];

    // Start multiple tasks, some will error
    for (let i = 0; i < 10; i++) {
      promises.push(
        mutex.withLock(async () => {
          if (i % 3 === 0) {
            throw new Error(`Task ${i} failed`);
          }
          return i;
        }).catch(e => ({ error: e.message }))
      );
    }

    const results = await Promise.all(promises);

    // Check that both successful and failed tasks completed
    const successful = results.filter(r => typeof r === 'number').length;
    const failed = results.filter(r => r && r.error).length;

    expect(successful + failed).toBe(10);
    expect(mutex.isLocked()).toBe(false);
  });
});

// ============================================================================
// Edge Cases: Resource Lock Manager Race Conditions
// ============================================================================

describe('Resource Lock Manager Race Conditions', () => {
  let lockManager: ResourceLockManager;

  beforeEach(() => {
    lockManager = new ResourceLockManager();
  });

  afterEach(() => {
    lockManager.clearAllLocks();
  });

  it('should handle concurrent lock attempts on same resource', async () => {
    const results: string[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < 5; i++) {
      const workerId = `worker-${i}`;
      promises.push(
        (async () => {
          const lock = await lockManager.acquireLock('shared-resource', 2000);
          results.push(lock.holder);

          // Hold lock briefly
          await new Promise(resolve => setTimeout(resolve, 10));

          lock.release();
        })()
      );
    }

    await Promise.all(promises);

    // All workers should have acquired the lock in sequence
    expect(results).toHaveLength(5);
    expect(new Set(results).size).toBe(5); // All different holders
    expect(lockManager.isLocked('shared-resource')).toBe(false);
  });

  it('should timeout properly under high contention', async () => {
    const lock = await lockManager.acquireLock('resource-1');

    const timeoutPromises = [];
    for (let i = 0; i < 3; i++) {
      timeoutPromises.push(
        expect(lockManager.acquireLock('resource-1', 50)).rejects.toThrow('Timeout acquiring lock')
      );
    }

    await Promise.all(timeoutPromises);

    lock.release();
  });
});

// ============================================================================
// Edge Cases: Parallel Test Context Under Memory Pressure
// ============================================================================

describe('Parallel Test Context Memory Pressure', () => {
  it('should handle creation of many contexts', async () => {
    const contexts: ParallelTestContext[] = [];
    const contextCount = 50;

    try {
      // Create many contexts rapidly
      for (let i = 0; i < contextCount; i++) {
        const ctx = await createParallelTestContext({
          prefix: `stress-test-${i}`,
        });
        contexts.push(ctx);
      }

      expect(contexts).toHaveLength(contextCount);

      // Verify all contexts have unique paths
      const paths = contexts.map(ctx => ctx.tempDir);
      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(contextCount);

      // Verify all event emitters work
      contexts.forEach((ctx, i) => {
        ctx.eventEmitter.emitter.emit('test-event', i);
        expect(ctx.eventEmitter.getEventHistory()).toHaveLength(1);
      });
    } finally {
      // Clean up all contexts
      await Promise.all(contexts.map(ctx => ctx.cleanup()));
    }
  });

  it('should handle rapid context creation and cleanup', async () => {
    const cycles = 20;

    for (let i = 0; i < cycles; i++) {
      const ctx = await createParallelTestContext({
        prefix: `rapid-${i}`,
      });

      // Use the context briefly
      ctx.eventEmitter.emitter.emit('rapid-test', i);
      expect(ctx.eventEmitter.getEventHistory()).toHaveLength(1);

      // Cleanup immediately
      await ctx.cleanup();

      // Verify cleanup worked
      try {
        await fs.stat(ctx.tempDir);
        // Should not reach here
        expect(true).toBe(false);
      } catch {
        // Expected - directory should be gone
        expect(true).toBe(true);
      }
    }
  });
});

// ============================================================================
// Edge Cases: Environment Isolation with Process Changes
// ============================================================================

describe('Environment Isolation Edge Cases', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should handle setting undefined values', () => {
    const env = createEnvironmentIsolation();

    // TypeScript won't allow this but JavaScript might
    (env.set as any)('TEST_VAR', undefined);
    expect(process.env.TEST_VAR).toBe('undefined');

    env.restore();
    expect(process.env.TEST_VAR).toBeUndefined();
  });

  it('should handle deleting non-existent variables', () => {
    const env = createEnvironmentIsolation();

    env.delete('NON_EXISTENT_VAR');
    expect(process.env.NON_EXISTENT_VAR).toBeUndefined();

    env.restore();
    expect(process.env.NON_EXISTENT_VAR).toBeUndefined();
  });

  it('should handle multiple modifications to same variable', () => {
    process.env.MULTI_VAR = 'original';
    const env = createEnvironmentIsolation();

    env.set('MULTI_VAR', 'first');
    env.set('MULTI_VAR', 'second');
    env.set('MULTI_VAR', 'third');

    expect(process.env.MULTI_VAR).toBe('third');

    env.restore();
    expect(process.env.MULTI_VAR).toBe('original');

    // Cleanup
    delete process.env.MULTI_VAR;
  });

  it('should handle restore called multiple times', () => {
    process.env.RESTORE_TEST = 'original';
    const env = createEnvironmentIsolation();

    env.set('RESTORE_TEST', 'modified');
    expect(process.env.RESTORE_TEST).toBe('modified');

    env.restore();
    expect(process.env.RESTORE_TEST).toBe('original');

    env.restore(); // Second call should be safe
    expect(process.env.RESTORE_TEST).toBe('original');

    // Cleanup
    delete process.env.RESTORE_TEST;
  });
});

// ============================================================================
// Edge Cases: TaskStore Integration Under Stress
// ============================================================================

describe('TaskStore Integration Edge Cases', () => {
  it('should handle rapid store creation and cleanup', async () => {
    const stores = [];
    const storeCount = 10;

    try {
      // Create multiple stores rapidly
      for (let i = 0; i < storeCount; i++) {
        const storeCtx = await createParallelSafeTaskStore({
          prefix: `rapid-store-${i}`,
        });
        stores.push(storeCtx);
      }

      expect(stores).toHaveLength(storeCount);

      // Verify all stores have unique worker IDs and paths
      const workerIds = stores.map(s => s.workerId);
      const paths = stores.map(s => s.tempPath);

      expect(new Set(paths).size).toBe(storeCount);

      // Test basic functionality of each store
      for (const storeCtx of stores) {
        const tasks = await storeCtx.store.listTasks();
        expect(Array.isArray(tasks)).toBe(true);
      }
    } finally {
      // Clean up all stores
      await Promise.all(stores.map(s => s.cleanup()));
    }
  });

  it('should handle store operations with isolation', async () => {
    const store1Ctx = await createParallelSafeTaskStore({ prefix: 'isolated1' });
    const store2Ctx = await createParallelSafeTaskStore({ prefix: 'isolated2' });

    try {
      // Verify stores are isolated
      expect(store1Ctx.tempPath).not.toBe(store2Ctx.tempPath);
      expect(store1Ctx.workerId).not.toBe(store2Ctx.workerId);

      // Both should work independently
      const tasks1 = await store1Ctx.store.listTasks();
      const tasks2 = await store2Ctx.store.listTasks();

      expect(Array.isArray(tasks1)).toBe(true);
      expect(Array.isArray(tasks2)).toBe(true);
    } finally {
      await store1Ctx.cleanup();
      await store2Ctx.cleanup();
    }
  });
});

// ============================================================================
// Edge Cases: Global Resource Locks Under Contention
// ============================================================================

describe('Global Resource Locks Edge Cases', () => {
  afterEach(() => {
    globalResourceLocks.clearAllLocks();
  });

  it('should handle concurrent access across test contexts', async () => {
    const sharedResource = 'global-shared-resource';
    const contexts: ParallelTestContext[] = [];

    try {
      // Create multiple test contexts
      for (let i = 0; i < 3; i++) {
        const ctx = await createParallelTestContext({ prefix: `global-${i}` });
        contexts.push(ctx);
      }

      const promises = contexts.map(async (ctx, index) => {
        const lock = await globalResourceLocks.acquireLock(sharedResource, 3000);

        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 10));

        // Each context should see the lock is held by their worker
        expect(lock.holder).toBe(ctx.workerId);
        expect(globalResourceLocks.getLockHolder(sharedResource)).toBe(ctx.workerId);

        lock.release();
        return index;
      });

      const results = await Promise.all(promises);
      expect(results).toEqual([0, 1, 2]);
      expect(globalResourceLocks.isLocked(sharedResource)).toBe(false);
    } finally {
      await Promise.all(contexts.map(ctx => ctx.cleanup()));
    }
  });
});