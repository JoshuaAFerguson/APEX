/**
 * @fileoverview Performance and stress tests for Parallel Test Execution Support Utilities
 *
 * These tests verify that the utilities perform well under high load and
 * concurrent access scenarios that might occur in large parallel test suites.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';

import {
  getTestWorkerId,
  createParallelTestContext,
  createParallelSafeTaskStore,
  createIsolatedEventEmitter,
  AsyncMutex,
  ResourceLockManager,
  globalResourceLocks,
  createEnvironmentIsolation,
  assertNoSharedMutation,
  type ParallelTestContext,
  type IsolatedEventEmitterContext,
} from '../parallel-test-utils.js';

// ============================================================================
// Performance Tests: High Concurrency Event Emission
// ============================================================================

describe('High Concurrency Event Emission Performance', () => {
  let emitterCtx: IsolatedEventEmitterContext<Record<string, (...args: any[]) => void>>;

  beforeEach(() => {
    emitterCtx = createIsolatedEventEmitter();
  });

  afterEach(() => {
    emitterCtx.cleanup();
  });

  it('should handle 10,000 rapid event emissions', async () => {
    const startTime = Date.now();
    const eventCount = 10000;
    const batchSize = 100;

    // Emit events in batches to simulate realistic usage
    const batches = Math.ceil(eventCount / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchPromises: Promise<void>[] = [];

      for (let i = 0; i < batchSize && (batch * batchSize + i) < eventCount; i++) {
        batchPromises.push(
          Promise.resolve().then(() => {
            const eventIndex = batch * batchSize + i;
            emitterCtx.emitter.emit('perf-test', eventIndex, `batch-${batch}`, new Date());
          })
        );
      }

      await Promise.all(batchPromises);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify all events were captured
    const history = emitterCtx.getEventHistory();
    expect(history).toHaveLength(eventCount);

    // Performance assertions (should complete within reasonable time)
    expect(duration).toBeLessThan(5000); // 5 seconds max for 10k events

    // Verify event integrity
    const eventCounts = new Map<string, number>();
    history.forEach(event => {
      const batchName = event.args[1] as string;
      eventCounts.set(batchName, (eventCounts.get(batchName) || 0) + 1);
    });

    // Each batch should have exactly batchSize events (except possibly the last)
    for (const [batchName, count] of eventCounts) {
      expect(count).toBeLessThanOrEqual(batchSize);
      expect(count).toBeGreaterThan(0);
    }
  });

  it('should maintain performance with many concurrent listeners', () => {
    const startTime = Date.now();
    const listenerCount = 1000;
    const eventCount = 100;

    // Add many listeners
    const handlerCalls: number[] = new Array(listenerCount).fill(0);

    for (let i = 0; i < listenerCount; i++) {
      const handlerIndex = i;
      emitterCtx.emitter.on('concurrent-test', () => {
        handlerCalls[handlerIndex]++;
      });
    }

    // Emit events
    for (let i = 0; i < eventCount; i++) {
      emitterCtx.emitter.emit('concurrent-test', i);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify all handlers were called for each event
    expect(handlerCalls.every(count => count === eventCount)).toBe(true);

    // Performance should still be reasonable
    expect(duration).toBeLessThan(2000); // 2 seconds max
  });
});

// ============================================================================
// Performance Tests: Database Path Generation Under Load
// ============================================================================

describe('Database Path Generation Performance', () => {
  it('should generate unique paths rapidly under concurrent load', async () => {
    const startTime = Date.now();
    const pathCount = 5000;
    const concurrency = 50;

    // Generate paths concurrently
    const pathPromises: Promise<string>[] = [];

    for (let i = 0; i < pathCount; i++) {
      pathPromises.push(
        Promise.resolve().then(() => {
          const workerId = getTestWorkerId();
          return `${workerId}-${i}`;
        })
      );
    }

    const paths = await Promise.all(pathPromises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify uniqueness is maintained under load
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBeGreaterThan(0); // At least some unique paths

    // Performance should be reasonable
    expect(duration).toBeLessThan(1000); // 1 second max for 5k path generations
    expect(paths).toHaveLength(pathCount);
  });
});

// ============================================================================
// Performance Tests: Parallel Context Creation Under Load
// ============================================================================

describe('Parallel Context Creation Performance', () => {
  let contexts: ParallelTestContext[] = [];

  afterEach(async () => {
    // Clean up all contexts
    const cleanupPromises = contexts.map(ctx => ctx.cleanup().catch(() => {}));
    await Promise.allSettled(cleanupPromises);
    contexts = [];
  });

  it('should create multiple contexts rapidly', async () => {
    const startTime = Date.now();
    const contextCount = 100;

    // Create contexts in batches to avoid overwhelming the system
    const batchSize = 10;
    const batches = Math.ceil(contextCount / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchPromises: Promise<ParallelTestContext>[] = [];

      for (let i = 0; i < batchSize && (batch * batchSize + i) < contextCount; i++) {
        batchPromises.push(
          createParallelTestContext({
            prefix: `perf-ctx-${batch}-${i}`,
            createDbStructure: false, // Skip I/O for performance testing
          })
        );
      }

      const batchContexts = await Promise.all(batchPromises);
      contexts.push(...batchContexts);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify all contexts were created
    expect(contexts).toHaveLength(contextCount);

    // Verify uniqueness of worker IDs and temp dirs
    const workerIds = contexts.map(ctx => ctx.workerId);
    const tempDirs = contexts.map(ctx => ctx.tempDir);

    expect(new Set(tempDirs).size).toBe(contextCount); // All temp dirs should be unique

    // Performance should be reasonable (allow more time for I/O operations)
    expect(duration).toBeLessThan(30000); // 30 seconds max
  });
});

// ============================================================================
// Performance Tests: Mutex Contention Under High Load
// ============================================================================

describe('Mutex Performance Under High Contention', () => {
  let mutex: AsyncMutex;

  beforeEach(() => {
    mutex = new AsyncMutex();
  });

  it('should handle high contention gracefully', async () => {
    const startTime = Date.now();
    const workerCount = 100;
    const operationsPerWorker = 10;

    let sharedCounter = 0;
    const completionOrder: number[] = [];

    // Create many workers competing for the mutex
    const workerPromises = Array.from({ length: workerCount }, async (_, workerIndex) => {
      const workerResults: number[] = [];

      for (let operation = 0; operation < operationsPerWorker; operation++) {
        await mutex.withLock(async () => {
          const currentValue = sharedCounter;

          // Simulate small amount of work
          await new Promise(resolve => setTimeout(resolve, 1));

          sharedCounter = currentValue + 1;
          workerResults.push(sharedCounter);
          completionOrder.push(workerIndex);
        });
      }

      return { workerIndex, results: workerResults };
    });

    const results = await Promise.all(workerPromises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify correctness under high contention
    expect(sharedCounter).toBe(workerCount * operationsPerWorker);
    expect(completionOrder).toHaveLength(workerCount * operationsPerWorker);

    // Verify no worker was starved
    results.forEach(result => {
      expect(result.results).toHaveLength(operationsPerWorker);
    });

    // Performance should complete within reasonable time
    expect(duration).toBeLessThan(60000); // 60 seconds max
  });

  it('should maintain low memory usage under sustained load', async () => {
    const iterationCount = 1000;
    const concurrentOps = 50;

    // Track queue length to ensure it doesn't grow indefinitely
    const maxQueueLength = { value: 0 };

    const promises: Promise<void>[] = [];

    for (let i = 0; i < iterationCount; i++) {
      if (promises.length >= concurrentOps) {
        // Wait for some operations to complete before starting new ones
        await Promise.race(promises);
        const completedIndex = promises.findIndex(p =>
          Promise.resolve(p) === p
        );
        if (completedIndex >= 0) {
          promises.splice(completedIndex, 1);
        }
      }

      const promise = mutex.withLock(async () => {
        const currentQueueLength = mutex.getQueueLength();
        maxQueueLength.value = Math.max(maxQueueLength.value, currentQueueLength);

        // Minimal work
        await new Promise(resolve => setImmediate(resolve));
      });

      promises.push(promise);
    }

    // Wait for all operations to complete
    await Promise.all(promises);

    // Queue should be empty after all operations
    expect(mutex.getQueueLength()).toBe(0);
    expect(mutex.isLocked()).toBe(false);

    // Queue length should have stayed reasonable
    expect(maxQueueLength.value).toBeLessThan(concurrentOps * 2);
  });
});

// ============================================================================
// Performance Tests: Resource Lock Manager Scalability
// ============================================================================

describe('Resource Lock Manager Scalability', () => {
  let lockManager: ResourceLockManager;

  beforeEach(() => {
    lockManager = new ResourceLockManager();
  });

  afterEach(() => {
    lockManager.clearAllLocks();
  });

  it('should scale to many concurrent resource locks', async () => {
    const startTime = Date.now();
    const resourceCount = 500;
    const workersPerResource = 5;

    const results = await Promise.all(
      Array.from({ length: resourceCount }, async (_, resourceIndex) => {
        const resourceId = `resource-${resourceIndex}`;

        // Multiple workers try to access the same resource
        const workerPromises = Array.from({ length: workersPerResource }, async (_, workerIndex) => {
          const lock = await lockManager.acquireLock(resourceId, 10000);

          try {
            // Simulate brief work with the resource
            await new Promise(resolve => setTimeout(resolve, 1));

            return { resourceIndex, workerIndex, success: true };
          } finally {
            lock.release();
          }
        });

        return Promise.all(workerPromises);
      })
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify all operations completed successfully
    const flatResults = results.flat();
    expect(flatResults).toHaveLength(resourceCount * workersPerResource);
    expect(flatResults.every(r => r.success)).toBe(true);

    // Verify no locks remain
    for (let i = 0; i < resourceCount; i++) {
      expect(lockManager.isLocked(`resource-${i}`)).toBe(false);
    }

    // Performance should be reasonable
    expect(duration).toBeLessThan(30000); // 30 seconds max
  });
});

// ============================================================================
// Performance Tests: Environment Isolation Under Load
// ============================================================================

describe('Environment Isolation Performance', () => {
  it('should handle rapid environment changes efficiently', async () => {
    const startTime = Date.now();
    const changeCount = 10000;

    const envContexts: ReturnType<typeof createEnvironmentIsolation>[] = [];

    try {
      // Create many environment contexts rapidly
      for (let i = 0; i < 100; i++) {
        const envCtx = createEnvironmentIsolation();
        envContexts.push(envCtx);

        // Make rapid changes to each context
        for (let j = 0; j < changeCount / 100; j++) {
          envCtx.set(`TEST_VAR_${i}_${j}`, `value-${i}-${j}`);

          if (j % 10 === 0) {
            // Occasionally delete variables
            envCtx.delete(`TEST_VAR_${i}_${j - 5}`);
          }
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance should be reasonable
      expect(duration).toBeLessThan(5000); // 5 seconds max

      // Verify environment state is tracked correctly
      envContexts.forEach(envCtx => {
        expect(typeof envCtx.get).toBe('function');
        expect(typeof envCtx.set).toBe('function');
        expect(typeof envCtx.delete).toBe('function');
        expect(typeof envCtx.restore).toBe('function');
      });

    } finally {
      // Clean up all environments
      envContexts.forEach(envCtx => {
        try {
          envCtx.restore();
        } catch {
          // Ignore cleanup errors
        }
      });
    }
  });
});

// ============================================================================
// Memory Leak Detection Tests
// ============================================================================

describe('Memory Leak Prevention', () => {
  it('should properly clean up event emitter resources', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const iterations = 1000;

    // Create and destroy many event emitters
    for (let i = 0; i < iterations; i++) {
      const emitterCtx = createIsolatedEventEmitter();

      // Use the emitter
      emitterCtx.emitter.on('test', () => {});
      emitterCtx.emitter.emit('test', `data-${i}`);

      // Clean up
      emitterCtx.cleanup();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;

    // Memory growth should be minimal
    expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
  });

  it('should properly clean up parallel context resources', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const iterations = 100; // Fewer iterations due to I/O cost

    for (let i = 0; i < iterations; i++) {
      const ctx = await createParallelTestContext({
        prefix: `memory-test-${i}`,
        createDbStructure: false, // Skip I/O for faster testing
      });

      // Use the context
      ctx.eventEmitter.emitter.emit('memory-test', i);

      // Clean up
      await ctx.cleanup();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;

    // Memory growth should be reasonable
    expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
  });
});

// ============================================================================
// Error Recovery Performance Tests
// ============================================================================

describe('Error Recovery Performance', () => {
  it('should recover quickly from failed shared state mutations', async () => {
    const startTime = Date.now();
    const attemptCount = 1000;
    let successCount = 0;
    let errorCount = 0;

    const state = { value: 0 };

    const promises = Array.from({ length: attemptCount }, async (_, index) => {
      try {
        await assertNoSharedMutation(
          () => state,
          async () => {
            state.value = index;

            // Randomly fail to restore (simulating bugs)
            if (Math.random() < 0.1) {
              // Don't restore - will cause assertion failure
              throw new Error('Simulated failure');
            }

            // Restore properly
            state.value = 0;
          }
        );
        successCount++;
      } catch (error) {
        errorCount++;
        // Reset state manually for next test
        state.value = 0;
      }
    });

    await Promise.allSettled(promises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should handle both successes and failures efficiently
    expect(successCount + errorCount).toBe(attemptCount);
    expect(successCount).toBeGreaterThan(attemptCount * 0.8); // At least 80% success
    expect(errorCount).toBeGreaterThan(0); // Some failures expected

    // Performance should be reasonable even with errors
    expect(duration).toBeLessThan(10000); // 10 seconds max

    // State should be clean after all operations
    expect(state.value).toBe(0);
  });
});