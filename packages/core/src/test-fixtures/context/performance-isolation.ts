/**
 * @fileoverview Performance-Optimized Test Isolation Utilities
 *
 * This module provides utilities optimized for large test suites with hundreds
 * or thousands of tests. It includes patterns for:
 * - Lazy resource initialization
 * - Resource pooling and reuse
 * - Batch cleanup operations
 * - Memory-efficient context management
 * - Fast parallel test execution
 *
 * These utilities are designed to maintain isolation while maximizing
 * performance for large-scale testing scenarios.
 *
 * @example Resource Pooling
 * ```typescript
 * import { createResourcePool } from '@apex/core/test-fixtures';
 *
 * const dbPool = createResourcePool({
 *   factory: () => createTestDatabase(),
 *   poolSize: 10,
 *   resetOnReturn: true
 * });
 *
 * it('should use pooled resource', async () => {
 *   const db = await dbPool.acquire();
 *   try {
 *     // Use database
 *   } finally {
 *     dbPool.release(db);
 *   }
 * });
 * ```
 *
 * @example Batch Operations
 * ```typescript
 * import { createBatchProcessor } from '@apex/core/test-fixtures';
 *
 * const processor = createBatchProcessor({
 *   batchSize: 50,
 *   flushInterval: 1000
 * });
 *
 * // Batches cleanup operations for efficiency
 * processor.addCleanup(() => cleanupOperation());
 * ```
 */

import { vi } from 'vitest';
import { createTestContext } from './test-context.js';
import type { TestContext } from './types.js';
import { EventEmitter } from 'events';

// ============================================================================
// Resource Pool
// ============================================================================

/**
 * Options for creating a resource pool
 */
export interface ResourcePoolOptions<T> {
  /** Factory function to create new resources */
  factory: () => Promise<T> | T;
  /** Maximum number of resources in the pool */
  poolSize: number;
  /** Whether to reset resources when returned to pool */
  resetOnReturn?: boolean;
  /** Function to reset a resource */
  resetFn?: (resource: T) => Promise<void> | void;
  /** Function to destroy a resource */
  destroyFn?: (resource: T) => Promise<void> | void;
  /** Maximum time to wait for an available resource (ms) */
  acquireTimeout?: number;
  /** Maximum idle time before destroying unused resources (ms) */
  maxIdleTime?: number;
}

/**
 * Resource pool for reusing expensive objects across tests
 */
export interface ResourcePool<T> {
  /** Acquire a resource from the pool */
  acquire(): Promise<T>;
  /** Return a resource to the pool */
  release(resource: T): void;
  /** Get current pool statistics */
  getStats(): {
    total: number;
    available: number;
    inUse: number;
  };
  /** Destroy all resources and close the pool */
  destroy(): Promise<void>;
}

/**
 * Creates a resource pool for efficient resource reuse.
 * Useful for expensive objects like database connections, servers, etc.
 *
 * @param options - Resource pool configuration
 * @returns Resource pool instance
 *
 * @example Database Connection Pool
 * ```typescript
 * const dbPool = createResourcePool({
 *   factory: () => createDatabaseConnection(),
 *   poolSize: 5,
 *   resetOnReturn: true,
 *   resetFn: (db) => db.truncateAll()
 * });
 *
 * describe('Database Tests', () => {
 *   it('should use pooled connection', async () => {
 *     const db = await dbPool.acquire();
 *     try {
 *       await db.query('SELECT * FROM users');
 *     } finally {
 *       dbPool.release(db);
 *     }
 *   });
 * });
 * ```
 */
export function createResourcePool<T>(
  options: ResourcePoolOptions<T>
): ResourcePool<T> {
  const available: T[] = [];
  const inUse = new Set<T>();
  const waiters: Array<(resource: T) => void> = [];
  const resourceMetadata = new Map<T, { createdAt: number; lastUsed: number }>();

  let destroyed = false;

  const createResource = async (): Promise<T> => {
    const resource = await options.factory();
    const now = Date.now();
    resourceMetadata.set(resource, { createdAt: now, lastUsed: now });
    return resource;
  };

  const cleanupIdleResources = () => {
    if (!options.maxIdleTime) return;

    const now = Date.now();
    const toDestroy: T[] = [];

    for (const resource of available) {
      const metadata = resourceMetadata.get(resource);
      if (metadata && now - metadata.lastUsed > options.maxIdleTime) {
        toDestroy.push(resource);
      }
    }

    for (const resource of toDestroy) {
      const index = available.indexOf(resource);
      if (index >= 0) {
        available.splice(index, 1);
        resourceMetadata.delete(resource);
        if (options.destroyFn) {
          const result = options.destroyFn(resource);
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch(() => {
              // Ignore cleanup errors
            });
          }
        }
      }
    }
  };

  // Periodic cleanup of idle resources
  const cleanupInterval = options.maxIdleTime
    ? setInterval(cleanupIdleResources, options.maxIdleTime / 2)
    : null;

  return {
    async acquire(): Promise<T> {
      if (destroyed) {
        throw new Error('Resource pool has been destroyed');
      }

      // Try to get from available pool
      if (available.length > 0) {
        const resource = available.pop()!;
        inUse.add(resource);
        const metadata = resourceMetadata.get(resource);
        if (metadata) {
          metadata.lastUsed = Date.now();
        }
        return resource;
      }

      // Create new resource if under limit
      if (inUse.size < options.poolSize) {
        const resource = await createResource();
        inUse.add(resource);
        return resource;
      }

      // Wait for a resource to become available
      return new Promise((resolve, reject) => {
        const timeoutId = options.acquireTimeout
          ? setTimeout(() => {
              const index = waiters.indexOf(resolve);
              if (index >= 0) {
                waiters.splice(index, 1);
              }
              reject(new Error('Resource acquisition timeout'));
            }, options.acquireTimeout)
          : null;

        waiters.push((resource: T) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          resolve(resource);
        });
      });
    },

    release(resource: T): void {
      if (!inUse.has(resource)) {
        console.warn('ResourcePool: Attempting to release resource not in use');
        return;
      }

      inUse.delete(resource);
      const metadata = resourceMetadata.get(resource);
      if (metadata) {
        metadata.lastUsed = Date.now();
      }

      // Reset resource if requested
      const resetPromise = options.resetOnReturn && options.resetFn
        ? Promise.resolve(options.resetFn(resource))
        : Promise.resolve();

      resetPromise
        .then(() => {
          // Give to waiting acquirer or return to pool
          const waiter = waiters.shift();
          if (waiter) {
            inUse.add(resource);
            waiter(resource);
          } else {
            available.push(resource);
          }
        })
        .catch((error) => {
          console.warn('ResourcePool: Reset failed, destroying resource:', error);
          resourceMetadata.delete(resource);
          if (options.destroyFn) {
            const result = options.destroyFn(resource);
            if (result && typeof (result as Promise<void>).catch === 'function') {
              (result as Promise<void>).catch(() => {
                // Ignore destruction errors
              });
            }
          }
        });
    },

    getStats(): { total: number; available: number; inUse: number } {
      return {
        total: available.length + inUse.size,
        available: available.length,
        inUse: inUse.size
      };
    },

    async destroy(): Promise<void> {
      destroyed = true;

      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }

      // Destroy all resources
      const allResources = [...available, ...inUse];
      available.length = 0;
      inUse.clear();

      if (options.destroyFn) {
        await Promise.allSettled(
          allResources.map(resource => options.destroyFn!(resource))
        );
      }

      resourceMetadata.clear();

      // Reject any waiting acquirers
      for (const waiter of waiters) {
        // Can't reject here as waiter expects a resource
        // In practice, tests should not be waiting when destroying
      }
      waiters.length = 0;
    }
  };
}

// ============================================================================
// Batch Processor
// ============================================================================

/**
 * Options for batch processing
 */
export interface BatchProcessorOptions {
  /** Maximum batch size before auto-flush */
  batchSize: number;
  /** Maximum time before auto-flush (ms) */
  flushInterval: number;
  /** Whether to preserve operation order */
  preserveOrder?: boolean;
}

/**
 * Batch processor for efficient cleanup operations
 */
export interface BatchProcessor {
  /** Add a cleanup operation to the batch */
  addCleanup(operation: () => Promise<void> | void): void;
  /** Manually flush all pending operations */
  flush(): Promise<void>;
  /** Get current batch size */
  getBatchSize(): number;
  /** Destroy the processor */
  destroy(): Promise<void>;
}

/**
 * Creates a batch processor for efficient cleanup operations.
 * Groups operations together to reduce overhead.
 *
 * @param options - Batch processor configuration
 * @returns Batch processor instance
 *
 * @example
 * ```typescript
 * const processor = createBatchProcessor({
 *   batchSize: 100,
 *   flushInterval: 2000
 * });
 *
 * // Operations are batched automatically
 * processor.addCleanup(() => cleanupFile('file1.txt'));
 * processor.addCleanup(() => cleanupFile('file2.txt'));
 * // ... continues batching until batchSize or flushInterval
 * ```
 */
export function createBatchProcessor(
  options: BatchProcessorOptions
): BatchProcessor {
  const operations: Array<() => Promise<void> | void> = [];
  let flushTimer: NodeJS.Timeout | null = null;
  let destroyed = false;

  const scheduleFlush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
    }
    flushTimer = setTimeout(flush, options.flushInterval);
  };

  const flush = async (): Promise<void> => {
    if (operations.length === 0) return;

    const batch = operations.splice(0);
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    if (options.preserveOrder) {
      // Execute in order
      for (const operation of batch) {
        try {
          await operation();
        } catch (error) {
          console.warn('Batch operation failed:', error);
        }
      }
    } else {
      // Execute in parallel
      await Promise.allSettled(
        batch.map(operation => Promise.resolve(operation()))
      );
    }
  };

  return {
    addCleanup(operation: () => Promise<void> | void): void {
      if (destroyed) {
        console.warn('BatchProcessor: Adding operation to destroyed processor');
        return;
      }

      operations.push(operation);

      if (operations.length >= options.batchSize) {
        flush();
      } else if (operations.length === 1) {
        // Schedule flush for first operation
        scheduleFlush();
      }
    },

    flush,

    getBatchSize(): number {
      return operations.length;
    },

    async destroy(): Promise<void> {
      destroyed = true;

      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }

      // Flush remaining operations
      await flush();
    }
  };
}

// ============================================================================
// Lazy Context Factory
// ============================================================================

/**
 * Options for lazy context factory
 */
export interface LazyContextOptions {
  /** Base context options */
  contextOptions?: Parameters<typeof createTestContext>[0];
  /** Whether to cache contexts */
  enableCaching?: boolean;
  /** Maximum cache size */
  maxCacheSize?: number;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
}

/**
 * Lazy test context factory for performance optimization
 */
export interface LazyContextFactory {
  /** Get a test context (creates if needed) */
  getContext(key?: string): TestContext;
  /** Clear all cached contexts */
  clearCache(): Promise<void>;
  /** Get cache statistics */
  getCacheStats(): {
    size: number;
    hitRate: number;
    maxSize: number;
  };
}

/**
 * Creates a lazy context factory for efficient context management.
 * Only creates contexts when needed and can cache them for reuse.
 *
 * @param options - Lazy context options
 * @returns Lazy context factory
 *
 * @example
 * ```typescript
 * const contextFactory = createLazyContextFactory({
 *   enableCaching: true,
 *   maxCacheSize: 50,
 *   cacheTTL: 30000
 * });
 *
 * // Contexts are created lazily and cached
 * const ctx1 = contextFactory.getContext('feature1');
 * const ctx2 = contextFactory.getContext('feature2');
 * ```
 */
export function createLazyContextFactory(
  options: LazyContextOptions = {}
): LazyContextFactory {
  const cache = new Map<string, { context: TestContext; createdAt: number }>();
  let cacheHits = 0;
  let cacheRequests = 0;

  const cleanupExpired = () => {
    if (!options.cacheTTL || !options.enableCaching) return;

    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of cache) {
      if (now - entry.createdAt > options.cacheTTL) {
        toDelete.push(key);
        entry.context.cleanup().catch(() => {
          // Ignore cleanup errors
        });
      }
    }

    for (const key of toDelete) {
      cache.delete(key);
    }
  };

  // Periodic cleanup of expired contexts
  const cleanupInterval = options.cacheTTL
    ? setInterval(cleanupExpired, options.cacheTTL / 2)
    : null;

  return {
    getContext(key: string = 'default'): TestContext {
      cacheRequests++;

      if (options.enableCaching && cache.has(key)) {
        const entry = cache.get(key)!;

        // Check if expired
        if (options.cacheTTL && Date.now() - entry.createdAt > options.cacheTTL) {
          cache.delete(key);
          entry.context.cleanup().catch(() => {
            // Ignore cleanup errors
          });
        } else {
          cacheHits++;
          return entry.context;
        }
      }

      // Create new context
      const context = createTestContext({
        namespacePrefix: `lazy_${key}`,
        ...options.contextOptions
      });

      if (options.enableCaching) {
        // Evict oldest if cache is full
        if (options.maxCacheSize && cache.size >= options.maxCacheSize) {
          const oldestKey = cache.keys().next().value;
          const oldest = cache.get(oldestKey);
          cache.delete(oldestKey);
          oldest?.context.cleanup().catch(() => {
            // Ignore cleanup errors
          });
        }

        cache.set(key, {
          context,
          createdAt: Date.now()
        });
      }

      return context;
    },

    async clearCache(): Promise<void> {
      const cleanupPromises = Array.from(cache.values()).map(entry =>
        entry.context.cleanup()
      );

      await Promise.allSettled(cleanupPromises);
      cache.clear();

      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
    },

    getCacheStats(): { size: number; hitRate: number; maxSize: number } {
      const hitRate = cacheRequests > 0 ? cacheHits / cacheRequests : 0;

      return {
        size: cache.size,
        hitRate: Math.round(hitRate * 100) / 100,
        maxSize: options.maxCacheSize || 0
      };
    }
  };
}

// ============================================================================
// Fast Parallel Executor
// ============================================================================

/**
 * Options for parallel test executor
 */
export interface ParallelExecutorOptions {
  /** Maximum concurrent executions */
  maxConcurrency: number;
  /** Timeout for individual operations (ms) */
  operationTimeout?: number;
  /** Whether to fail fast on first error */
  failFast?: boolean;
  /** Resource allocation strategy */
  resourceStrategy?: 'pool' | 'create' | 'shared';
}

/**
 * Fast parallel executor for test operations
 */
export interface ParallelExecutor {
  /** Execute multiple operations in parallel */
  execute<T>(
    operations: Array<() => Promise<T> | T>
  ): Promise<Array<{ success: boolean; result?: T; error?: Error }>>;
  /** Get execution statistics */
  getStats(): {
    totalExecutions: number;
    averageTime: number;
    successRate: number;
  };
}

/**
 * Creates a fast parallel executor for test operations.
 * Optimizes parallel execution with controlled concurrency.
 *
 * @param options - Parallel executor options
 * @returns Parallel executor instance
 *
 * @example
 * ```typescript
 * const executor = createParallelExecutor({
 *   maxConcurrency: 10,
 *   operationTimeout: 5000,
 *   failFast: false
 * });
 *
 * const operations = [
 *   () => testOperation1(),
 *   () => testOperation2(),
 *   () => testOperation3(),
 * ];
 *
 * const results = await executor.execute(operations);
 * ```
 */
export function createParallelExecutor(
  options: ParallelExecutorOptions
): ParallelExecutor {
  let totalExecutions = 0;
  let totalTime = 0;
  let successfulExecutions = 0;

  return {
    async execute<T>(
      operations: Array<() => Promise<T> | T>
    ): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
      const startTime = Date.now();
      const results: Array<{ success: boolean; result?: T; error?: Error }> = [];
      const executing = new Set<Promise<void>>();

      let operationIndex = 0;
      let hasError = false;

      const executeOperation = async (
        operation: () => Promise<T> | T,
        index: number
      ): Promise<void> => {
        try {
          const operationStart = Date.now();

          let result: T;
          if (options.operationTimeout) {
            result = await Promise.race([
              Promise.resolve(operation()),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Operation timeout')), options.operationTimeout)
              )
            ]);
          } else {
            result = await Promise.resolve(operation());
          }

          const operationTime = Date.now() - operationStart;
          totalTime += operationTime;
          successfulExecutions++;

          results[index] = { success: true, result };
        } catch (error) {
          hasError = true;
          results[index] = {
            success: false,
            error: error instanceof Error ? error : new Error(String(error))
          };

          if (options.failFast) {
            // Cancel remaining operations
            return;
          }
        }
      };

      // Execute operations with controlled concurrency
      while (operationIndex < operations.length && (!options.failFast || !hasError)) {
        // Start up to maxConcurrency operations
        while (executing.size < options.maxConcurrency && operationIndex < operations.length) {
          const currentIndex = operationIndex++;
          const execution = executeOperation(operations[currentIndex], currentIndex);
          execution.finally(() => executing.delete(execution));
          executing.add(execution);
        }

        // Wait for at least one to complete
        if (executing.size > 0) {
          await Promise.race(executing);
        }
      }

      // Wait for all remaining operations
      await Promise.allSettled(executing);

      totalExecutions += operations.length;
      const executionTime = Date.now() - startTime;

      return results;
    },

    getStats(): { totalExecutions: number; averageTime: number; successRate: number } {
      return {
        totalExecutions,
        averageTime: totalExecutions > 0 ? totalTime / totalExecutions : 0,
        successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0
      };
    }
  };
}

// ============================================================================
// Memory-Efficient Context Manager
// ============================================================================

/**
 * Memory-efficient context manager for large test suites
 */
export interface MemoryEfficientManager {
  /** Create a lightweight context */
  createLightContext(): TestContext;
  /** Create a full context with all features */
  createFullContext(): TestContext;
  /** Clean up all managed contexts */
  cleanupAll(): Promise<void>;
  /** Get memory usage statistics */
  getMemoryStats(): {
    lightContexts: number;
    fullContexts: number;
    totalMemoryEstimate: number;
  };
}

/**
 * Creates a memory-efficient context manager.
 * Provides different context types based on test requirements.
 *
 * @example
 * ```typescript
 * const manager = createMemoryEfficientManager();
 *
 * // For simple unit tests
 * const lightCtx = manager.createLightContext();
 *
 * // For complex integration tests
 * const fullCtx = manager.createFullContext();
 * ```
 */
export function createMemoryEfficientManager(): MemoryEfficientManager {
  const lightContexts: TestContext[] = [];
  const fullContexts: TestContext[] = [];

  return {
    createLightContext(): TestContext {
      const context = createTestContext({
        namespacePrefix: 'light',
        createTempDirOnInit: false // Don't create temp dir for light contexts
      });

      lightContexts.push(context);
      return context;
    },

    createFullContext(): TestContext {
      const context = createTestContext({
        namespacePrefix: 'full',
        createTempDirOnInit: true
      });

      fullContexts.push(context);
      return context;
    },

    async cleanupAll(): Promise<void> {
      const allCleanups = [
        ...lightContexts.map(ctx => ctx.cleanup()),
        ...fullContexts.map(ctx => ctx.cleanup())
      ];

      await Promise.allSettled(allCleanups);

      lightContexts.length = 0;
      fullContexts.length = 0;
    },

    getMemoryStats(): {
      lightContexts: number;
      fullContexts: number;
      totalMemoryEstimate: number;
    } {
      // Rough memory estimates (in bytes)
      const lightMemoryPerContext = 1024; // ~1KB per light context
      const fullMemoryPerContext = 10240; // ~10KB per full context

      const totalMemoryEstimate =
        (lightContexts.length * lightMemoryPerContext) +
        (fullContexts.length * fullMemoryPerContext);

      return {
        lightContexts: lightContexts.length,
        fullContexts: fullContexts.length,
        totalMemoryEstimate
      };
    }
  };
}