/**
 * @fileoverview Unified Parallel Test Utilities
 *
 * This module provides a comprehensive set of utilities for parallel-safe test execution.
 * It combines utilities from both the orchestrator package and test-utils package to
 * provide a single entry point for all parallel testing needs.
 *
 * ## Core Features
 *
 * - **Database Isolation**: Unique database paths per test worker
 * - **Event Emitter Isolation**: Isolated event emitter instances with history tracking
 * - **State Guards**: Prevention of shared mutable state interference
 * - **Coordination Primitives**: Mutex, semaphore, barriers for resource coordination
 * - **Worker Management**: Cross-worker communication and synchronization
 * - **Test Context**: Complete parallel-safe test environments
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createParallelTestContext, withIsolation } from '../test-utils/parallel-utils';
 *
 * describe('Parallel Feature Tests', () => {
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
 *     // Use ctx.dbPath, ctx.eventEmitter, etc.
 *     // Each worker gets isolated resources
 *   });
 *
 *   it('should use isolation wrapper', async () => {
 *     await withIsolation(async (isolationCtx) => {
 *       // Automatic cleanup of files, env vars, mocks, etc.
 *       await isolationCtx.files.createTempFile('test.txt');
 *       isolationCtx.env.setEnv('TEST_VAR', 'value');
 *     });
 *   });
 * });
 * ```
 *
 * @module tests/test-utils/parallel-utils
 */

// =============================================================================
// Re-exports from orchestrator parallel-test-utils
// =============================================================================

// Worker ID and detection
export {
  getTestWorkerId,
  isParallelTestExecution,
} from '@apex/orchestrator';

// Database isolation
export {
  getWorkerUniqueDbPath,
  getWorkerUniqueTempDir,
  createWorkerUniqueTempDir,
  createParallelSafeTaskStore,
} from '@apex/orchestrator';

// Event emitter isolation
export {
  createIsolatedEventEmitter,
  type IsolatedEventEmitterContext,
  type EventMap,
  type EventHistoryEntry,
} from '@apex/orchestrator';

// Shared state guards
export {
  assertNoSharedMutation,
  createImmutableSnapshot,
} from '@apex/orchestrator';

// Mutex and locking
export {
  AsyncMutex,
  ResourceLockManager,
  globalResourceLocks,
  type ReleaseLock,
  type ResourceLock,
} from '@apex/orchestrator';

// Complete test context
export {
  createParallelTestContext,
  type ParallelTestContext,
  type ParallelTestContextOptions,
} from '@apex/orchestrator';

// Environment isolation
export {
  createEnvironmentIsolation,
  type EnvironmentIsolationContext,
} from '@apex/orchestrator';

// =============================================================================
// Re-exports from test-utils parallel execution modules
// =============================================================================

// Generic parallel execution utilities
export {
  generateWorkerId,
  createWorkerDatabasePath,
  createWorkerEventEmitter,
  createWorkerState,
  getWorkerStateManager,
  createDatabasePool,
  ResourcePool,
  WorkerIsolatedEventEmitter,
  type WorkerIsolationOptions,
  type WorkerDatabasePath,
} from './parallel-execution.js';

// Coordination primitives
export {
  AsyncMutex as GenericAsyncMutex,
  Semaphore,
  ReadWriteLock,
  Barrier,
  coordination,
} from './parallel-coordination.js';

// Worker coordination
export {
  WorkerCoordinator,
  workerUtils,
  type WorkerInfo,
  type WorkerMessage,
  type WorkerCoordinatorOptions,
  type WorkerCoordinatorEvents,
} from './worker-coordination.js';

// =============================================================================
// Re-exports from isolation system
// =============================================================================

export {
  createIsolatedTest,
  withIsolation,
  createTestContextFactory,
  generateTestId,
  type IsolatedTestContext,
  type IsolationOptions,
  type WithIsolationOptions,
  CleanupPriority,
} from './isolation/index.js';

// =============================================================================
// Unified Utilities
// =============================================================================

/**
 * Configuration options for creating a comprehensive parallel test environment
 */
export interface ComprehensiveTestOptions {
  /** Prefix for temporary directories and files */
  prefix?: string;
  /** Whether to create database structure */
  withDatabase?: boolean;
  /** Whether to enable worker coordination */
  withWorkerCoordination?: boolean;
  /** Whether to include full isolation (files, env, mocks, etc.) */
  withIsolation?: boolean;
  /** Custom worker ID */
  workerId?: string;
}

/**
 * Comprehensive test environment combining all parallel utilities
 */
export interface ComprehensiveTestEnvironment {
  /** Unique worker identifier */
  workerId: string;
  /** Parallel test context (database, event emitter, temp dirs) */
  parallel: ParallelTestContext;
  /** Isolation context (files, env, mocks, timers, processes) */
  isolation?: IsolatedTestContext;
  /** Worker coordinator for cross-worker communication */
  coordinator?: WorkerCoordinator;
  /** Cleanup function to release all resources */
  cleanup: () => Promise<void>;
}

/**
 * Creates a comprehensive parallel-safe test environment with all features enabled.
 * This is the recommended way to set up complex tests that need multiple isolation
 * and coordination features.
 *
 * @param options - Configuration options
 * @returns Promise resolving to the comprehensive test environment
 *
 * @example
 * ```typescript
 * describe('Complex Feature Tests', () => {
 *   let env: ComprehensiveTestEnvironment;
 *
 *   beforeEach(async () => {
 *     env = await createComprehensiveTestEnvironment({
 *       prefix: 'complex-feature',
 *       withDatabase: true,
 *       withIsolation: true,
 *       withWorkerCoordination: true,
 *     });
 *   });
 *
 *   afterEach(async () => {
 *     await env.cleanup();
 *   });
 *
 *   it('should coordinate between workers', async () => {
 *     // Use database
 *     const store = new TaskStore(env.parallel.tempDir);
 *     await store.initialize();
 *
 *     // Use files
 *     const configFile = await env.isolation!.files.createTempFile('config.json', '{}');
 *
 *     // Coordinate with other workers
 *     await env.coordinator!.createBarrier('test-barrier', 3);
 *     await env.coordinator!.waitAtBarrier('test-barrier', 3);
 *
 *     // Everything cleaned up automatically
 *   });
 * });
 * ```
 */
export async function createComprehensiveTestEnvironment(
  options: ComprehensiveTestOptions = {}
): Promise<ComprehensiveTestEnvironment> {
  const {
    prefix = 'comprehensive-test',
    withDatabase = true,
    withWorkerCoordination = false,
    withIsolation = true,
    workerId,
  } = options;

  // Create parallel test context
  const parallel = await createParallelTestContext({
    prefix,
    createDbStructure: withDatabase,
  });

  // Create isolation context if requested
  let isolation: IsolatedTestContext | undefined;
  if (withIsolation) {
    const { createIsolatedTest } = await import('./isolation/index.js');
    isolation = await createIsolatedTest({
      prefix,
      withDatabase,
    });
  }

  // Create worker coordinator if requested
  let coordinator: WorkerCoordinator | undefined;
  if (withWorkerCoordination) {
    const { WorkerCoordinator } = await import('./worker-coordination.js');
    coordinator = WorkerCoordinator.getInstance({
      workerId: workerId || parallel.workerId,
    });
    await coordinator.joinAsWorker({
      workerId: parallel.workerId,
      capabilities: ['test'],
      metadata: { testPrefix: prefix },
    });
  }

  return {
    workerId: parallel.workerId,
    parallel,
    isolation,
    coordinator,
    cleanup: async () => {
      const cleanupTasks: Promise<void>[] = [];

      // Cleanup worker coordinator
      if (coordinator) {
        cleanupTasks.push(coordinator.leaveAsWorker());
      }

      // Cleanup isolation context
      if (isolation) {
        cleanupTasks.push(isolation.teardown());
      }

      // Cleanup parallel context
      cleanupTasks.push(parallel.cleanup());

      // Wait for all cleanup operations
      await Promise.allSettled(cleanupTasks);
    },
  };
}

/**
 * Simplified wrapper for running tests with comprehensive parallel isolation.
 * Automatically sets up and tears down all parallel utilities.
 *
 * @param testFn - Test function to execute
 * @param options - Configuration options
 * @returns Promise resolving to test result
 *
 * @example
 * ```typescript
 * it('should run with comprehensive isolation', async () => {
 *   const result = await runWithComprehensiveIsolation(async (env) => {
 *     // Use any combination of parallel utilities
 *     await env.parallel.eventEmitter.emitter.emit('test:event');
 *     await env.isolation!.files.createTempFile('test.txt');
 *
 *     return 'test completed';
 *   }, {
 *     withDatabase: true,
 *     withIsolation: true,
 *   });
 *
 *   expect(result).toBe('test completed');
 * });
 * ```
 */
export async function runWithComprehensiveIsolation<T>(
  testFn: (env: ComprehensiveTestEnvironment) => Promise<T> | T,
  options: ComprehensiveTestOptions = {}
): Promise<T> {
  const env = await createComprehensiveTestEnvironment(options);
  try {
    return await testFn(env);
  } finally {
    await env.cleanup();
  }
}

/**
 * Collection of common parallel test patterns and utilities
 */
export const parallelTestPatterns = {
  /**
   * Create a simple isolated database test context
   */
  async simpleDatabase(prefix = 'test-db') {
    return await createParallelSafeTaskStore({ prefix });
  },

  /**
   * Create an isolated event emitter for testing
   */
  simpleEventEmitter<T extends EventMap = Record<string, (...args: any[]) => void>>() {
    return createIsolatedEventEmitter<T>();
  },

  /**
   * Create a resource lock for coordinating access to shared resources
   */
  async shareResource(resourceId: string, timeout = 30000) {
    return await globalResourceLocks.acquireLock(resourceId, timeout);
  },

  /**
   * Run a test with automatic environment restoration
   */
  async withCleanEnvironment<T>(testFn: (env: EnvironmentIsolationContext) => Promise<T> | T): Promise<T> {
    const envCtx = createEnvironmentIsolation();
    try {
      return await testFn(envCtx);
    } finally {
      envCtx.restore();
    }
  },

  /**
   * Create a worker-specific temporary directory
   */
  async createWorkerTempDir(prefix = 'worker-temp') {
    return await createWorkerUniqueTempDir(prefix);
  },
};

/**
 * Default export providing all parallel utilities
 */
export default {
  // Core functions
  createParallelTestContext,
  createComprehensiveTestEnvironment,
  runWithComprehensiveIsolation,
  withIsolation,

  // Worker utilities
  getTestWorkerId,
  isParallelTestExecution,

  // Database utilities
  getWorkerUniqueDbPath,
  createWorkerUniqueTempDir,
  createParallelSafeTaskStore,

  // Event utilities
  createIsolatedEventEmitter,

  // Coordination utilities
  AsyncMutex,
  GenericAsyncMutex,
  Semaphore,
  ReadWriteLock,
  Barrier,
  coordination,
  ResourceLockManager,
  globalResourceLocks,

  // Common patterns
  parallelTestPatterns,
};