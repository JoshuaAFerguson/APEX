/**
 * @fileoverview Tests for Performance-Optimized Isolation Utilities
 *
 * These tests validate the performance utilities work correctly for:
 * - Resource pooling and reuse
 * - Batch cleanup operations
 * - Lazy context creation
 * - Fast parallel execution
 * - Memory-efficient context management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createResourcePool,
  createBatchProcessor,
  createLazyContextFactory,
  createParallelExecutor,
  createMemoryEfficientManager,
  type ResourcePool,
  type BatchProcessor,
  type LazyContextFactory,
  type ParallelExecutor,
  type MemoryEfficientManager,
} from '../performance-isolation.js';

describe('Performance Isolation Utilities', () => {
  describe('Resource Pool', () => {
    let resourcePool: ResourcePool<{ id: number; reset: () => void }>;
    let resourceCounter = 0;

    beforeEach(() => {
      resourceCounter = 0;
    });

    afterEach(async () => {
      if (resourcePool) {
        await resourcePool.destroy();
      }
    });

    const createMockResource = () => ({
      id: ++resourceCounter,
      reset: vi.fn()
    });

    it('should create and reuse resources', async () => {
      resourcePool = createResourcePool({
        factory: createMockResource,
        poolSize: 2,
        resetOnReturn: true,
        resetFn: (resource) => resource.reset()
      });

      const resource1 = await resourcePool.acquire();
      const resource2 = await resourcePool.acquire();

      expect(resource1.id).toBe(1);
      expect(resource2.id).toBe(2);

      resourcePool.release(resource1);
      const resource3 = await resourcePool.acquire();

      // Should reuse resource1 after reset
      expect(resource3.id).toBe(1);
      expect(resource1.reset).toHaveBeenCalled();
    });

    it('should enforce pool size limits', async () => {
      resourcePool = createResourcePool({
        factory: createMockResource,
        poolSize: 2,
        acquireTimeout: 100
      });

      const resource1 = await resourcePool.acquire();
      const resource2 = await resourcePool.acquire();

      // Should timeout when trying to acquire third resource
      await expect(resourcePool.acquire()).rejects.toThrow('Resource acquisition timeout');

      resourcePool.release(resource1);
    });

    it('should provide accurate statistics', async () => {
      resourcePool = createResourcePool({
        factory: createMockResource,
        poolSize: 3
      });

      let stats = resourcePool.getStats();
      expect(stats).toEqual({ total: 0, available: 0, inUse: 0 });

      const resource1 = await resourcePool.acquire();
      stats = resourcePool.getStats();
      expect(stats).toEqual({ total: 1, available: 0, inUse: 1 });

      const resource2 = await resourcePool.acquire();
      resourcePool.release(resource1);
      stats = resourcePool.getStats();
      expect(stats).toEqual({ total: 2, available: 1, inUse: 1 });

      resourcePool.release(resource2);
    });

    it('should handle async resource creation', async () => {
      const asyncFactory = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return createMockResource();
      };

      resourcePool = createResourcePool({
        factory: asyncFactory,
        poolSize: 2
      });

      const resource = await resourcePool.acquire();
      expect(resource.id).toBe(1);

      resourcePool.release(resource);
    });

    it('should clean up idle resources', async () => {
      const destroyFn = vi.fn();

      resourcePool = createResourcePool({
        factory: createMockResource,
        poolSize: 3,
        maxIdleTime: 50,
        destroyFn
      });

      const resource = await resourcePool.acquire();
      resourcePool.release(resource);

      // Wait for idle cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Resource should be destroyed due to idle time
      expect(destroyFn).toHaveBeenCalledWith(resource);
    });

    it('should handle resource reset failures', async () => {
      const failingReset = vi.fn().mockRejectedValue(new Error('Reset failed'));
      const destroyFn = vi.fn();

      resourcePool = createResourcePool({
        factory: createMockResource,
        poolSize: 2,
        resetOnReturn: true,
        resetFn: failingReset,
        destroyFn
      });

      const resource = await resourcePool.acquire();
      resourcePool.release(resource);

      // Wait for reset to fail and resource to be destroyed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(destroyFn).toHaveBeenCalledWith(resource);
    });

    it('should queue waiters when pool is full', async () => {
      resourcePool = createResourcePool({
        factory: createMockResource,
        poolSize: 1
      });

      const resource1 = await resourcePool.acquire();

      const waiterPromise = resourcePool.acquire();

      // Release resource1, which should fulfill the waiter
      resourcePool.release(resource1);

      const resource2 = await waiterPromise;
      expect(resource2.id).toBe(1); // Reused resource

      resourcePool.release(resource2);
    });
  });

  describe('Batch Processor', () => {
    let batchProcessor: BatchProcessor;

    afterEach(async () => {
      if (batchProcessor) {
        await batchProcessor.destroy();
      }
    });

    it('should batch operations by size', async () => {
      const operations: string[] = [];

      batchProcessor = createBatchProcessor({
        batchSize: 3,
        flushInterval: 1000
      });

      batchProcessor.addCleanup(() => operations.push('op1'));
      batchProcessor.addCleanup(() => operations.push('op2'));
      expect(batchProcessor.getBatchSize()).toBe(2);

      batchProcessor.addCleanup(() => operations.push('op3'));

      // Should auto-flush after reaching batch size
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(operations).toEqual(['op1', 'op2', 'op3']);
    });

    it('should batch operations by time', async () => {
      const operations: string[] = [];

      batchProcessor = createBatchProcessor({
        batchSize: 10,
        flushInterval: 50
      });

      batchProcessor.addCleanup(() => operations.push('op1'));
      batchProcessor.addCleanup(() => operations.push('op2'));

      // Should auto-flush after interval
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(operations).toEqual(['op1', 'op2']);
    });

    it('should handle manual flush', async () => {
      const operations: string[] = [];

      batchProcessor = createBatchProcessor({
        batchSize: 10,
        flushInterval: 1000
      });

      batchProcessor.addCleanup(() => operations.push('op1'));
      batchProcessor.addCleanup(() => operations.push('op2'));

      await batchProcessor.flush();
      expect(operations).toEqual(['op1', 'op2']);
      expect(batchProcessor.getBatchSize()).toBe(0);
    });

    it('should preserve order when requested', async () => {
      const operations: string[] = [];
      let counter = 0;

      batchProcessor = createBatchProcessor({
        batchSize: 3,
        flushInterval: 1000,
        preserveOrder: true
      });

      batchProcessor.addCleanup(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        operations.push(`op${++counter}`);
      });

      batchProcessor.addCleanup(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        operations.push(`op${++counter}`);
      });

      batchProcessor.addCleanup(() => {
        operations.push(`op${++counter}`);
      });

      // Wait for batch to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(operations).toEqual(['op1', 'op2', 'op3']);
    });

    it('should handle operation failures gracefully', async () => {
      const operations: string[] = [];
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      batchProcessor = createBatchProcessor({
        batchSize: 3,
        flushInterval: 1000
      });

      batchProcessor.addCleanup(() => operations.push('op1'));
      batchProcessor.addCleanup(() => {
        throw new Error('Operation failed');
      });
      batchProcessor.addCleanup(() => operations.push('op3'));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(operations).toContain('op1');
      expect(operations).toContain('op3');
      expect(consoleWarn).toHaveBeenCalled();

      consoleWarn.mockRestore();
    });

    it('should flush remaining operations on destroy', async () => {
      const operations: string[] = [];

      batchProcessor = createBatchProcessor({
        batchSize: 10,
        flushInterval: 1000
      });

      batchProcessor.addCleanup(() => operations.push('op1'));
      batchProcessor.addCleanup(() => operations.push('op2'));

      await batchProcessor.destroy();
      expect(operations).toEqual(['op1', 'op2']);
    });
  });

  describe('Lazy Context Factory', () => {
    let contextFactory: LazyContextFactory;

    afterEach(async () => {
      if (contextFactory) {
        await contextFactory.clearCache();
      }
    });

    it('should create contexts lazily', () => {
      contextFactory = createLazyContextFactory({
        enableCaching: true,
        maxCacheSize: 5
      });

      const ctx1 = contextFactory.getContext('test1');
      const ctx2 = contextFactory.getContext('test2');

      expect(ctx1).toBeDefined();
      expect(ctx2).toBeDefined();
      expect(ctx1).not.toBe(ctx2);

      const stats = contextFactory.getCacheStats();
      expect(stats.size).toBe(2);
    });

    it('should cache and reuse contexts', () => {
      contextFactory = createLazyContextFactory({
        enableCaching: true,
        maxCacheSize: 5
      });

      const ctx1 = contextFactory.getContext('test');
      const ctx2 = contextFactory.getContext('test');

      expect(ctx1).toBe(ctx2); // Same instance from cache

      const stats = contextFactory.getCacheStats();
      expect(stats.hitRate).toBe(0.5); // 1 hit out of 2 requests
    });

    it('should evict oldest when cache is full', () => {
      contextFactory = createLazyContextFactory({
        enableCaching: true,
        maxCacheSize: 2
      });

      const ctx1 = contextFactory.getContext('test1');
      const ctx2 = contextFactory.getContext('test2');
      const ctx3 = contextFactory.getContext('test3'); // Should evict ctx1

      const ctx1Again = contextFactory.getContext('test1');
      expect(ctx1Again).not.toBe(ctx1); // New instance, old one was evicted

      const stats = contextFactory.getCacheStats();
      expect(stats.size).toBe(2);
    });

    it('should handle TTL expiration', async () => {
      contextFactory = createLazyContextFactory({
        enableCaching: true,
        cacheTTL: 50
      });

      const ctx1 = contextFactory.getContext('test');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      const ctx2 = contextFactory.getContext('test');
      expect(ctx2).not.toBe(ctx1); // New instance due to TTL
    });

    it('should work without caching', () => {
      contextFactory = createLazyContextFactory({
        enableCaching: false
      });

      const ctx1 = contextFactory.getContext('test');
      const ctx2 = contextFactory.getContext('test');

      expect(ctx1).not.toBe(ctx2); // Different instances

      const stats = contextFactory.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should provide accurate cache statistics', () => {
      contextFactory = createLazyContextFactory({
        enableCaching: true,
        maxCacheSize: 10
      });

      contextFactory.getContext('test1');
      contextFactory.getContext('test2');
      contextFactory.getContext('test1'); // Cache hit

      const stats = contextFactory.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
      expect(stats.hitRate).toBe(0.33); // 1 hit out of 3 requests
    });
  });

  describe('Parallel Executor', () => {
    let executor: ParallelExecutor;

    beforeEach(() => {
      executor = createParallelExecutor({
        maxConcurrency: 3,
        operationTimeout: 1000,
        failFast: false
      });
    });

    it('should execute operations in parallel', async () => {
      const startTime = Date.now();
      const operations = [
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'result1';
        },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'result2';
        },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'result3';
        }
      ];

      const results = await executor.execute(operations);
      const elapsed = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.map(r => r.result)).toEqual(['result1', 'result2', 'result3']);

      // Should complete in roughly 50ms (parallel) rather than 150ms (sequential)
      expect(elapsed).toBeLessThan(100);
    });

    it('should respect concurrency limits', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const operations = Array.from({ length: 10 }, () => async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(resolve => setTimeout(resolve, 20));
        concurrent--;
        return 'result';
      });

      await executor.execute(operations);

      expect(maxConcurrent).toBeLessThanOrEqual(3); // Respect maxConcurrency
    });

    it('should handle operation failures', async () => {
      const operations = [
        async () => 'success1',
        async () => {
          throw new Error('Operation failed');
        },
        async () => 'success2'
      ];

      const results = await executor.execute(operations);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[0].result).toBe('success1');
      expect(results[1].success).toBe(false);
      expect(results[1].error?.message).toBe('Operation failed');
      expect(results[2].success).toBe(true);
      expect(results[2].result).toBe('success2');
    });

    it('should handle operation timeouts', async () => {
      const timeoutExecutor = createParallelExecutor({
        maxConcurrency: 2,
        operationTimeout: 50
      });

      const operations = [
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100)); // Will timeout
          return 'result';
        }
      ];

      const results = await timeoutExecutor.execute(operations);

      expect(results[0].success).toBe(false);
      expect(results[0].error?.message).toBe('Operation timeout');
    });

    it('should support fail fast mode', async () => {
      const failFastExecutor = createParallelExecutor({
        maxConcurrency: 3,
        failFast: true
      });

      let operationsRun = 0;

      const operations = [
        async () => {
          operationsRun++;
          throw new Error('First failure');
        },
        async () => {
          operationsRun++;
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'should not complete';
        },
        async () => {
          operationsRun++;
          return 'might not run';
        }
      ];

      const results = await failFastExecutor.execute(operations);

      expect(results.some(r => !r.success)).toBe(true);
      // Some operations might not complete due to fail fast
    });

    it('should provide execution statistics', async () => {
      const operations = [
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'result1';
        },
        async () => {
          throw new Error('Failed');
        },
        async () => 'result3'
      ];

      await executor.execute(operations);

      const stats = executor.getStats();
      expect(stats.totalExecutions).toBe(3);
      expect(stats.averageTime).toBeGreaterThan(0);
      expect(stats.successRate).toBe(2/3); // 2 successes out of 3
    });
  });

  describe('Memory Efficient Manager', () => {
    let manager: MemoryEfficientManager;

    beforeEach(() => {
      manager = createMemoryEfficientManager();
    });

    afterEach(async () => {
      if (manager) {
        await manager.cleanupAll();
      }
    });

    it('should create light and full contexts', () => {
      const lightCtx = manager.createLightContext();
      const fullCtx = manager.createFullContext();

      expect(lightCtx).toBeDefined();
      expect(fullCtx).toBeDefined();
      expect(lightCtx.testId).toContain('light_');
      expect(fullCtx.testId).toContain('full_');
    });

    it('should track context creation', () => {
      manager.createLightContext();
      manager.createLightContext();
      manager.createFullContext();

      const stats = manager.getMemoryStats();
      expect(stats.lightContexts).toBe(2);
      expect(stats.fullContexts).toBe(1);
      expect(stats.totalMemoryEstimate).toBeGreaterThan(0);
    });

    it('should estimate memory usage differently for context types', () => {
      manager.createLightContext();
      const statsLight = manager.getMemoryStats();

      manager.createFullContext();
      const statsWithFull = manager.getMemoryStats();

      // Full context should use more memory
      const lightMemory = statsLight.totalMemoryEstimate;
      const totalMemory = statsWithFull.totalMemoryEstimate;

      expect(totalMemory).toBeGreaterThan(lightMemory);
    });

    it('should cleanup all contexts', async () => {
      const lightCtx = manager.createLightContext();
      const fullCtx = manager.createFullContext();

      const lightCleanup = vi.spyOn(lightCtx, 'cleanup');
      const fullCleanup = vi.spyOn(fullCtx, 'cleanup');

      await manager.cleanupAll();

      expect(lightCleanup).toHaveBeenCalled();
      expect(fullCleanup).toHaveBeenCalled();

      const stats = manager.getMemoryStats();
      expect(stats.lightContexts).toBe(0);
      expect(stats.fullContexts).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should work well together for large test suite simulation', async () => {
      // Simulate a large test suite scenario
      const resourcePool = createResourcePool({
        factory: () => ({ id: Math.random(), data: new Array(1000).fill(0) }),
        poolSize: 5
      });

      const batchProcessor = createBatchProcessor({
        batchSize: 10,
        flushInterval: 100
      });

      const contextFactory = createLazyContextFactory({
        enableCaching: true,
        maxCacheSize: 20
      });

      const executor = createParallelExecutor({
        maxConcurrency: 5,
        operationTimeout: 500
      });

      try {
        // Create operations that use multiple utilities
        const operations = Array.from({ length: 50 }, (_, i) => async () => {
          const resource = await resourcePool.acquire();
          const context = contextFactory.getContext(`test${i % 10}`);

          batchProcessor.addCleanup(() => {
            // Simulate cleanup
          });

          const result = {
            resourceId: resource.id,
            contextId: context.testId,
            operationIndex: i
          };

          resourcePool.release(resource);
          return result;
        });

        const results = await executor.execute(operations);

        expect(results.every(r => r.success)).toBe(true);
        expect(results).toHaveLength(50);

        // Verify utilities are working efficiently
        const poolStats = resourcePool.getStats();
        expect(poolStats.total).toBeLessThanOrEqual(5); // Pool size limit

        const cacheStats = contextFactory.getCacheStats();
        expect(cacheStats.size).toBeLessThanOrEqual(10); // Only 10 unique keys

        const execStats = executor.getStats();
        expect(execStats.successRate).toBe(1);

      } finally {
        await Promise.all([
          resourcePool.destroy(),
          batchProcessor.destroy(),
          contextFactory.clearCache()
        ]);
      }
    });

    it('should handle resource contention gracefully', async () => {
      const smallPool = createResourcePool({
        factory: () => ({ id: Math.random() }),
        poolSize: 2,
        acquireTimeout: 100
      });

      const executor = createParallelExecutor({
        maxConcurrency: 10,
        failFast: false
      });

      try {
        // More operations than pool size
        const operations = Array.from({ length: 5 }, () => async () => {
          const resource = await smallPool.acquire();
          await new Promise(resolve => setTimeout(resolve, 20));
          smallPool.release(resource);
          return 'success';
        });

        const results = await executor.execute(operations);

        // Some operations might timeout due to limited pool
        const successes = results.filter(r => r.success).length;
        expect(successes).toBeGreaterThan(0);

      } finally {
        await smallPool.destroy();
      }
    });
  });
});