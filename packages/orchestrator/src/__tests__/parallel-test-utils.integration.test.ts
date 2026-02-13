/**
 * @fileoverview Integration tests for Parallel Test Execution Support Utilities
 *
 * These tests verify the utilities work together as a complete system
 * in realistic parallel testing scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';

import {
  getTestWorkerId,
  isParallelTestExecution,
  createParallelTestContext,
  createParallelSafeTaskStore,
  createEnvironmentIsolation,
  globalResourceLocks,
  AsyncMutex,
  assertNoSharedMutation,
  type ParallelTestContext,
} from '../parallel-test-utils.js';

// ============================================================================
// Integration Test: Complete Parallel Test Workflow
// ============================================================================

describe('Complete Parallel Test Workflow Integration', () => {
  let contexts: ParallelTestContext[] = [];

  afterEach(async () => {
    // Clean up all contexts
    await Promise.all(contexts.map(ctx => ctx.cleanup()));
    contexts = [];
    globalResourceLocks.clearAllLocks();
  });

  it('should handle complete parallel test scenario', async () => {
    // Simulate 3 workers running tests in parallel
    const workerCount = 3;
    const testResults: Array<{
      workerId: string;
      dbPath: string;
      eventHistory: any[];
      storeOperations: boolean;
      sharedResourceAccess: boolean;
    }> = [];

    // Create contexts for each "worker"
    for (let i = 0; i < workerCount; i++) {
      const ctx = await createParallelTestContext({
        prefix: `integration-worker-${i}`,
      });
      contexts.push(ctx);
    }

    // Run "tests" in parallel
    const workerPromises = contexts.map(async (ctx, index) => {
      // Each worker does isolated work
      const workerId = ctx.workerId;

      // 1. Test database isolation
      const { store, cleanup: storeCleanup } = await createParallelSafeTaskStore({
        prefix: `worker-${index}-store`,
      });

      let storeOperations = false;
      try {
        const tasks = await store.listTasks();
        storeOperations = Array.isArray(tasks);
      } catch {
        storeOperations = false;
      }

      // 2. Test event emission isolation
      ctx.eventEmitter.emitter.emit('worker:started', workerId, index);
      ctx.eventEmitter.emitter.emit('worker:processing', workerId, `task-${index}`);

      // Simulate some async work
      await new Promise(resolve => setTimeout(resolve, 10));

      ctx.eventEmitter.emitter.emit('worker:completed', workerId, `result-${index}`);

      // 3. Test shared resource coordination
      let sharedResourceAccess = false;
      try {
        const lock = await globalResourceLocks.acquireLock(`shared-file-${index % 2}`, 1000);

        // Simulate exclusive access to a shared resource
        await new Promise(resolve => setTimeout(resolve, 5));
        sharedResourceAccess = true;

        lock.release();
      } catch {
        sharedResourceAccess = false;
      }

      await storeCleanup();

      return {
        workerId,
        dbPath: ctx.dbPath,
        eventHistory: ctx.eventEmitter.getEventHistory(),
        storeOperations,
        sharedResourceAccess,
      };
    });

    // Wait for all workers to complete
    const results = await Promise.all(workerPromises);

    // Verify isolation and correctness
    expect(results).toHaveLength(workerCount);

    // 1. All workers should have unique IDs and paths
    const workerIds = results.map(r => r.workerId);
    const dbPaths = results.map(r => r.dbPath);

    expect(new Set(workerIds).size).toBe(workerCount);
    expect(new Set(dbPaths).size).toBe(workerCount);

    // 2. All workers should have their own event history
    results.forEach((result, index) => {
      expect(result.eventHistory.length).toBeGreaterThan(0);

      // Events should be specific to this worker
      const workerEvents = result.eventHistory.filter(
        event => event.args[0] === result.workerId
      );
      expect(workerEvents.length).toBeGreaterThan(0);
    });

    // 3. All workers should have successful store operations
    results.forEach(result => {
      expect(result.storeOperations).toBe(true);
    });

    // 4. All workers should have accessed shared resources
    results.forEach(result => {
      expect(result.sharedResourceAccess).toBe(true);
    });

    // 5. No global locks should remain
    expect(globalResourceLocks.isLocked('shared-file-0')).toBe(false);
    expect(globalResourceLocks.isLocked('shared-file-1')).toBe(false);
  });
});

// ============================================================================
// Integration Test: Environment Isolation with TaskStore
// ============================================================================

describe('Environment Isolation with TaskStore Integration', () => {
  it('should maintain environment isolation across parallel store operations', async () => {
    const originalNodeEnv = process.env.NODE_ENV;

    const testScenarios = [
      { env: 'test', prefix: 'env-test' },
      { env: 'development', prefix: 'env-dev' },
      { env: 'production', prefix: 'env-prod' },
    ];

    const results = await Promise.all(
      testScenarios.map(async (scenario) => {
        const envCtx = createEnvironmentIsolation();
        const { store, tempPath, workerId, cleanup } = await createParallelSafeTaskStore({
          prefix: scenario.prefix,
        });

        try {
          // Set environment for this scenario
          envCtx.set('NODE_ENV', scenario.env);
          envCtx.set('TEST_SCENARIO', scenario.prefix);

          // Verify environment is set
          expect(process.env.NODE_ENV).toBe(scenario.env);
          expect(process.env.TEST_SCENARIO).toBe(scenario.prefix);

          // Use TaskStore with this environment
          const tasks = await store.listTasks();

          return {
            scenario: scenario.prefix,
            nodeEnv: process.env.NODE_ENV,
            testScenario: process.env.TEST_SCENARIO,
            workerId,
            tempPath,
            tasksLength: tasks.length,
          };
        } finally {
          await cleanup();
          envCtx.restore();
        }
      })
    );

    // Verify each scenario ran with its own environment
    expect(results).toHaveLength(3);

    results.forEach((result, index) => {
      expect(result.nodeEnv).toBe(testScenarios[index].env);
      expect(result.testScenario).toBe(testScenarios[index].prefix);
      expect(result.workerId).toBeDefined();
      expect(result.tempPath).toContain(testScenarios[index].prefix);
    });

    // Verify original environment is restored
    expect(process.env.NODE_ENV).toBe(originalNodeEnv);
    expect(process.env.TEST_SCENARIO).toBeUndefined();

    // Verify all scenarios had unique paths and worker IDs
    const workerIds = results.map(r => r.workerId);
    const tempPaths = results.map(r => r.tempPath);

    expect(new Set(workerIds).size).toBe(3);
    expect(new Set(tempPaths).size).toBe(3);
  });
});

// ============================================================================
// Integration Test: Mutex with Shared State Protection
// ============================================================================

describe('Mutex with Shared State Protection Integration', () => {
  it('should coordinate access to shared state using mutex and guards', async () => {
    const sharedState = { counter: 0, operations: [] as string[] };
    const mutex = new AsyncMutex();
    const workerCount = 5;

    // Simulate multiple workers accessing shared state
    const workerPromises = Array.from({ length: workerCount }, async (_, index) => {
      const workerId = `worker-${index}`;

      await mutex.withLock(async () => {
        // Use shared state guard to ensure no unexpected mutations
        await assertNoSharedMutation(
          () => ({ counter: sharedState.counter }),
          async () => {
            // Temporarily modify state
            const originalCounter = sharedState.counter;
            sharedState.counter = originalCounter + 1;
            sharedState.operations.push(`${workerId}: increment`);

            // Simulate async work
            await new Promise(resolve => setTimeout(resolve, 5));

            // Verify state is as expected
            expect(sharedState.counter).toBe(originalCounter + 1);

            // Restore counter for the test (simulating cleanup)
            sharedState.counter = originalCounter;
            sharedState.operations.push(`${workerId}: restore`);
          }
        );
      });

      return workerId;
    });

    const workerIds = await Promise.all(workerPromises);

    // Verify all workers completed
    expect(workerIds).toHaveLength(workerCount);

    // Verify operations were serialized (each worker did increment + restore)
    expect(sharedState.operations).toHaveLength(workerCount * 2);

    // Verify final state is as expected
    expect(sharedState.counter).toBe(0);

    // Verify mutex is released
    expect(mutex.isLocked()).toBe(false);
  });
});

// ============================================================================
// Integration Test: Resource Locking with Real File Operations
// ============================================================================

describe('Resource Locking with File Operations Integration', () => {
  let tempFiles: string[] = [];

  afterEach(async () => {
    // Clean up temp files
    await Promise.all(
      tempFiles.map(async (file) => {
        try {
          await fs.unlink(file);
        } catch {
          // Ignore cleanup errors
        }
      })
    );
    tempFiles = [];
    globalResourceLocks.clearAllLocks();
  });

  it('should coordinate file access across parallel operations', async () => {
    const contexts = await Promise.all([
      createParallelTestContext({ prefix: 'file-worker-1' }),
      createParallelTestContext({ prefix: 'file-worker-2' }),
      createParallelTestContext({ prefix: 'file-worker-3' }),
    ]);

    try {
      const sharedFileName = 'shared-test-file.txt';
      const sharedFilePath = path.join(contexts[0].tempDir, '..', sharedFileName);
      tempFiles.push(sharedFilePath);

      // Initialize shared file
      await fs.writeFile(sharedFilePath, 'initial content\n');

      const fileOperations = await Promise.all(
        contexts.map(async (ctx, index) => {
          // Each worker tries to append to the shared file
          const lock = await globalResourceLocks.acquireLock(sharedFileName, 2000);

          try {
            // Read current content
            const currentContent = await fs.readFile(sharedFilePath, 'utf8');

            // Append worker-specific content
            const newContent = currentContent + `Worker ${ctx.workerId} was here (${index})\n`;

            // Simulate file processing time
            await new Promise(resolve => setTimeout(resolve, 10));

            // Write back
            await fs.writeFile(sharedFilePath, newContent);

            // Emit event about file operation
            ctx.eventEmitter.emitter.emit('file:written', ctx.workerId, index);

            return {
              workerId: ctx.workerId,
              index,
              success: true,
            };
          } finally {
            lock.release();
          }
        })
      );

      // Verify all operations succeeded
      expect(fileOperations).toHaveLength(3);
      fileOperations.forEach(op => {
        expect(op.success).toBe(true);
      });

      // Verify file content has all worker contributions
      const finalContent = await fs.readFile(sharedFilePath, 'utf8');
      expect(finalContent).toContain('initial content');

      contexts.forEach((ctx, index) => {
        expect(finalContent).toContain(`Worker ${ctx.workerId} was here (${index})`);
      });

      // Verify events were recorded
      contexts.forEach(ctx => {
        const fileEvents = ctx.eventEmitter.getEventHistory().filter(
          event => event.event === 'file:written'
        );
        expect(fileEvents).toHaveLength(1);
      });

      // Verify no locks remain
      expect(globalResourceLocks.isLocked(sharedFileName)).toBe(false);
    } finally {
      await Promise.all(contexts.map(ctx => ctx.cleanup()));
    }
  });
});

// ============================================================================
// Integration Test: End-to-End Parallel Test Context Usage
// ============================================================================

describe('End-to-End Parallel Test Context Usage', () => {
  it('should support complete test lifecycle with all utilities', async () => {
    // This test simulates how a real test suite would use all utilities together

    const testSuite = {
      name: 'E2E Integration Test Suite',
      workers: 3,
      results: [] as any[],
    };

    // Simulate test execution across multiple workers
    const workerPromises = Array.from({ length: testSuite.workers }, async (_, workerIndex) => {
      // 1. Create isolated test context
      const ctx = await createParallelTestContext({
        prefix: `e2e-worker-${workerIndex}`,
        createDbStructure: true,
      });

      // 2. Set up environment isolation
      const env = createEnvironmentIsolation();
      env.set('TEST_WORKER_ID', ctx.workerId);
      env.set('TEST_WORKER_INDEX', String(workerIndex));

      // 3. Create isolated task store
      const { store, cleanup: storeCleanup } = await createParallelSafeTaskStore({
        prefix: `e2e-store-${workerIndex}`,
      });

      try {
        // 4. Emit test lifecycle events
        ctx.eventEmitter.emitter.emit('test:started', ctx.workerId, testSuite.name);

        // 5. Perform test operations with shared resource coordination
        const sharedResource = 'e2e-shared-config';
        const lock = await globalResourceLocks.acquireLock(sharedResource, 3000);

        try {
          // Simulate test that requires exclusive access
          await new Promise(resolve => setTimeout(resolve, 20));

          // Test database operations
          const tasks = await store.listTasks();
          expect(Array.isArray(tasks)).toBe(true);

          // Test event system
          ctx.eventEmitter.emitter.emit('test:database-check', ctx.workerId, tasks.length);

          // Test shared state protection
          const testState = { testRunning: true, workerId: ctx.workerId };
          await assertNoSharedMutation(
            () => testState,
            async () => {
              // Simulate test that temporarily modifies state
              const original = testState.testRunning;
              testState.testRunning = false;
              await new Promise(resolve => setTimeout(resolve, 5));
              testState.testRunning = original; // Restore
            }
          );

          ctx.eventEmitter.emitter.emit('test:completed', ctx.workerId, 'success');

          return {
            workerId: ctx.workerId,
            workerIndex,
            envWorkerIndex: env.get('TEST_WORKER_INDEX'),
            dbPath: ctx.dbPath,
            tempDir: ctx.tempDir,
            eventHistory: ctx.eventEmitter.getEventHistory(),
            tasksCount: tasks.length,
            success: true,
          };
        } finally {
          lock.release();
        }
      } finally {
        env.restore();
        await storeCleanup();
        await ctx.cleanup();
      }
    });

    const results = await Promise.all(workerPromises);

    // Verify complete test suite execution
    expect(results).toHaveLength(testSuite.workers);

    // 1. Verify worker isolation
    const workerIds = results.map(r => r.workerId);
    const dbPaths = results.map(r => r.dbPath);
    const tempDirs = results.map(r => r.tempDir);

    expect(new Set(workerIds).size).toBe(testSuite.workers);
    expect(new Set(dbPaths).size).toBe(testSuite.workers);
    expect(new Set(tempDirs).size).toBe(testSuite.workers);

    // 2. Verify environment isolation worked
    results.forEach((result, index) => {
      expect(result.envWorkerIndex).toBe(String(index));
    });

    // 3. Verify all tests succeeded
    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    // 4. Verify event isolation and tracking
    results.forEach(result => {
      const events = result.eventHistory;
      expect(events.length).toBeGreaterThan(0);

      // Each worker should have its own event sequence
      const startEvent = events.find(e => e.event === 'test:started');
      const completedEvent = events.find(e => e.event === 'test:completed');

      expect(startEvent).toBeDefined();
      expect(completedEvent).toBeDefined();
      expect(startEvent.args[0]).toBe(result.workerId);
      expect(completedEvent.args[0]).toBe(result.workerId);
    });

    // 5. Verify no global locks remain
    expect(globalResourceLocks.isLocked('e2e-shared-config')).toBe(false);

    // 6. Verify environment is clean
    expect(process.env.TEST_WORKER_ID).toBeUndefined();
    expect(process.env.TEST_WORKER_INDEX).toBeUndefined();
  });
});