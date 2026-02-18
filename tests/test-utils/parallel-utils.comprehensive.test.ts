/**
 * @fileoverview Comprehensive tests for unified parallel test utilities
 *
 * These tests verify the complete integration of all parallel testing utilities
 * from orchestrator package, test-utils package, and the unified exports.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';

import {
  // Core utilities
  getTestWorkerId,
  isParallelTestExecution,
  createParallelTestContext,
  createComprehensiveTestEnvironment,
  runWithComprehensiveIsolation,
  parallelTestPatterns,

  // Database utilities
  getWorkerUniqueDbPath,
  createWorkerUniqueTempDir,
  createParallelSafeTaskStore,

  // Event utilities
  createIsolatedEventEmitter,
  type IsolatedEventEmitterContext,

  // Coordination utilities
  AsyncMutex,
  ResourceLockManager,
  globalResourceLocks,

  // State utilities
  assertNoSharedMutation,
  createImmutableSnapshot,

  // Environment utilities
  createEnvironmentIsolation,

  // Worker coordination
  WorkerCoordinator,

  // Isolation system
  withIsolation,
  createIsolatedTest,

  // Types
  type ParallelTestContext,
  type ComprehensiveTestEnvironment,
  type ComprehensiveTestOptions,
} from './parallel-utils';

// ============================================================================
// Comprehensive Integration Tests
// ============================================================================

describe('Unified Parallel Utils - Complete Integration', () => {
  describe('Export Completeness', () => {
    it('should export all required orchestrator utilities', () => {
      // Worker utilities
      expect(typeof getTestWorkerId).toBe('function');
      expect(typeof isParallelTestExecution).toBe('function');

      // Database utilities
      expect(typeof getWorkerUniqueDbPath).toBe('function');
      expect(typeof createWorkerUniqueTempDir).toBe('function');
      expect(typeof createParallelSafeTaskStore).toBe('function');

      // Event utilities
      expect(typeof createIsolatedEventEmitter).toBe('function');

      // State utilities
      expect(typeof assertNoSharedMutation).toBe('function');
      expect(typeof createImmutableSnapshot).toBe('function');

      // Coordination utilities
      expect(AsyncMutex).toBeDefined();
      expect(ResourceLockManager).toBeDefined();
      expect(globalResourceLocks).toBeDefined();

      // Environment utilities
      expect(typeof createEnvironmentIsolation).toBe('function');

      // Context utilities
      expect(typeof createParallelTestContext).toBe('function');
    });

    it('should export all test-utils coordination utilities', () => {
      // Worker coordination
      expect(WorkerCoordinator).toBeDefined();

      // Isolation system
      expect(typeof withIsolation).toBe('function');
      expect(typeof createIsolatedTest).toBe('function');
    });

    it('should export unified utilities', () => {
      expect(typeof createComprehensiveTestEnvironment).toBe('function');
      expect(typeof runWithComprehensiveIsolation).toBe('function');
      expect(typeof parallelTestPatterns).toBe('object');
    });
  });

  describe('Full Stack Integration', () => {
    let env: ComprehensiveTestEnvironment;

    afterEach(async () => {
      if (env) {
        await env.cleanup();
      }
    });

    it('should integrate all parallel utilities in a realistic test scenario', async () => {
      // Create comprehensive environment with all features
      env = await createComprehensiveTestEnvironment({
        prefix: 'full-integration',
        withDatabase: true,
        withIsolation: true,
        withWorkerCoordination: true,
      });

      expect(env.workerId).toBeTruthy();
      expect(env.parallel).toBeTruthy();
      expect(env.isolation).toBeTruthy();
      expect(env.coordinator).toBeTruthy();

      // Test 1: Database isolation
      const { store, cleanup: storeCleanup } = await createParallelSafeTaskStore({
        prefix: 'integration-store',
      });

      try {
        const tasks = await store.listTasks();
        expect(Array.isArray(tasks)).toBe(true);

        // Test 2: Event emission and tracking
        let eventReceived = false;
        env.parallel.eventEmitter.emitter.on('integration-test', () => {
          eventReceived = true;
        });

        env.parallel.eventEmitter.emitter.emit('integration-test', 'data');
        expect(eventReceived).toBe(true);
        expect(env.parallel.eventEmitter.getEventHistory()).toHaveLength(1);

        // Test 3: File isolation
        if (env.isolation) {
          const tempFile = await env.isolation.files.createTempFile('test.txt', 'content');
          expect(tempFile).toBeTruthy();

          const content = await fs.readFile(tempFile, 'utf8');
          expect(content).toBe('content');
        }

        // Test 4: Environment isolation
        if (env.isolation) {
          env.isolation.env.setEnv('INTEGRATION_TEST_VAR', 'test-value');
          expect(process.env.INTEGRATION_TEST_VAR).toBe('test-value');
        }

        // Test 5: Worker coordination
        if (env.coordinator) {
          const workers = env.coordinator.getWorkers();
          expect(Array.isArray(workers)).toBe(true);
          expect(env.coordinator.getWorkerId()).toBe(env.workerId);
        }

        // Test 6: Resource locking
        const lock = await globalResourceLocks.acquireLock('integration-resource', 5000);

        try {
          expect(globalResourceLocks.isLocked('integration-resource')).toBe(true);

          // Test 7: Shared state protection
          const testState = { value: 0, counter: 0 };
          await assertNoSharedMutation(
            () => testState,
            async () => {
              testState.value = 42;
              testState.counter = 100;

              // Simulate work
              await new Promise(resolve => setTimeout(resolve, 10));

              // Restore
              testState.value = 0;
              testState.counter = 0;
            }
          );

          expect(testState.value).toBe(0);
          expect(testState.counter).toBe(0);

        } finally {
          lock.release();
        }

        expect(globalResourceLocks.isLocked('integration-resource')).toBe(false);

      } finally {
        await storeCleanup();
      }

      // Environment variables should be restored after cleanup
      if (env.isolation) {
        await env.cleanup();
        expect(process.env.INTEGRATION_TEST_VAR).toBeUndefined();
      }
    });

    it('should handle complex parallel scenarios with all utilities', async () => {
      // Simulate multiple workers using all utilities
      const workerCount = 3;
      const results: Array<{
        workerId: string;
        databaseOperations: boolean;
        eventHistory: any[];
        fileOperations: boolean;
        environmentVariables: boolean;
        resourceLocking: boolean;
        stateProtection: boolean;
      }> = [];

      const workerPromises = Array.from({ length: workerCount }, async (_, workerIndex) => {
        const workerEnv = await createComprehensiveTestEnvironment({
          prefix: `complex-worker-${workerIndex}`,
          withDatabase: true,
          withIsolation: true,
          withWorkerCoordination: false, // Disable to avoid conflicts
        });

        try {
          const workerId = workerEnv.workerId;

          // Database operations
          let databaseOperations = false;
          const { store, cleanup: storeCleanup } = await createParallelSafeTaskStore({
            prefix: `worker-${workerIndex}-db`,
          });

          try {
            await store.listTasks();
            databaseOperations = true;
          } catch {
            databaseOperations = false;
          } finally {
            await storeCleanup();
          }

          // Event operations
          workerEnv.parallel.eventEmitter.emitter.emit('worker-start', workerId, workerIndex);
          workerEnv.parallel.eventEmitter.emitter.emit('worker-process', workerId, `task-${workerIndex}`);

          await new Promise(resolve => setTimeout(resolve, 10));

          workerEnv.parallel.eventEmitter.emitter.emit('worker-complete', workerId, `result-${workerIndex}`);

          // File operations
          let fileOperations = false;
          if (workerEnv.isolation) {
            try {
              const testFile = await workerEnv.isolation.files.createTempFile(
                `worker-${workerIndex}.txt`,
                `Worker ${workerId} data`
              );
              const content = await fs.readFile(testFile, 'utf8');
              fileOperations = content.includes(workerId);
            } catch {
              fileOperations = false;
            }
          }

          // Environment variables
          let environmentVariables = false;
          if (workerEnv.isolation) {
            try {
              workerEnv.isolation.env.setEnv(`WORKER_${workerIndex}_VAR`, `worker-${workerId}`);
              environmentVariables = process.env[`WORKER_${workerIndex}_VAR`] === `worker-${workerId}`;
            } catch {
              environmentVariables = false;
            }
          }

          // Resource locking
          let resourceLocking = false;
          try {
            const lock = await globalResourceLocks.acquireLock(`worker-resource-${workerIndex}`, 2000);
            await new Promise(resolve => setTimeout(resolve, 5));
            lock.release();
            resourceLocking = true;
          } catch {
            resourceLocking = false;
          }

          // State protection
          let stateProtection = false;
          const workerState = { workerId, processed: false };
          try {
            await assertNoSharedMutation(
              () => workerState,
              async () => {
                workerState.processed = true;
                await new Promise(resolve => setTimeout(resolve, 5));
                workerState.processed = false;
              }
            );
            stateProtection = true;
          } catch {
            stateProtection = false;
          }

          return {
            workerId,
            databaseOperations,
            eventHistory: workerEnv.parallel.eventEmitter.getEventHistory(),
            fileOperations,
            environmentVariables,
            resourceLocking,
            stateProtection,
          };

        } finally {
          await workerEnv.cleanup();
        }
      });

      const workerResults = await Promise.all(workerPromises);

      // Verify all workers completed successfully
      expect(workerResults).toHaveLength(workerCount);

      workerResults.forEach((result, index) => {
        expect(result.workerId).toBeTruthy();
        expect(result.databaseOperations).toBe(true);
        expect(result.eventHistory.length).toBeGreaterThan(0);
        expect(result.fileOperations).toBe(true);
        expect(result.environmentVariables).toBe(true);
        expect(result.resourceLocking).toBe(true);
        expect(result.stateProtection).toBe(true);

        // Verify event isolation
        const workerEvents = result.eventHistory.filter(
          event => event.args[0] === result.workerId
        );
        expect(workerEvents.length).toBeGreaterThan(0);
      });

      // Verify worker isolation
      const workerIds = workerResults.map(r => r.workerId);
      const uniqueWorkerIds = new Set(workerIds);
      expect(uniqueWorkerIds.size).toBe(workerCount);
    });
  });

  describe('runWithComprehensiveIsolation Integration', () => {
    it('should run complex operations with automatic cleanup', async () => {
      let operationCompleted = false;
      let finalCleanupState = '';

      const result = await runWithComprehensiveIsolation(async (testEnv) => {
        expect(testEnv.parallel).toBeTruthy();
        expect(testEnv.isolation).toBeTruthy();

        // Use database
        const { store, cleanup: storeCleanup } = await createParallelSafeTaskStore({
          prefix: 'wrapper-integration',
        });

        try {
          await store.listTasks();

          // Use events
          testEnv.parallel.eventEmitter.emitter.emit('wrapper-test', 'data');

          // Use files
          const testFile = await testEnv.isolation!.files.createTempFile('wrapper.txt', 'test content');

          // Use environment
          testEnv.isolation!.env.setEnv('WRAPPER_TEST_VAR', 'wrapper-value');

          // Use resource locking
          const lock = await globalResourceLocks.acquireLock('wrapper-resource', 2000);

          try {
            // Use state protection
            const state = { value: 0 };
            await assertNoSharedMutation(
              () => state,
              async () => {
                state.value = 100;
                await new Promise(resolve => setTimeout(resolve, 5));
                state.value = 0;
              }
            );

            operationCompleted = true;
            return 'comprehensive-operation-complete';

          } finally {
            lock.release();
          }

        } finally {
          await storeCleanup();
        }

      }, {
        prefix: 'comprehensive-wrapper',
        withDatabase: true,
        withIsolation: true,
        withWorkerCoordination: false,
      });

      expect(result).toBe('comprehensive-operation-complete');
      expect(operationCompleted).toBe(true);

      // Environment should be cleaned up
      expect(process.env.WRAPPER_TEST_VAR).toBeUndefined();

      // Resources should be cleaned up
      expect(globalResourceLocks.isLocked('wrapper-resource')).toBe(false);
    });
  });

  describe('Pattern Utilities Integration', () => {
    it('should use all pattern utilities together', async () => {
      // Test simple database pattern
      const { store, cleanup: dbCleanup } = await parallelTestPatterns.simpleDatabase('pattern-integration');

      try {
        await store.listTasks();

        // Test simple event emitter pattern
        const { emitter, cleanup: emitterCleanup } = parallelTestPatterns.simpleEventEmitter();

        try {
          let eventFired = false;
          emitter.on('pattern-test', () => { eventFired = true; });
          emitter.emit('pattern-test');
          expect(eventFired).toBe(true);

          // Test environment pattern
          const envResult = await parallelTestPatterns.withCleanEnvironment(async (envCtx) => {
            envCtx.set('PATTERN_INTEGRATION_VAR', 'pattern-value');
            expect(process.env.PATTERN_INTEGRATION_VAR).toBe('pattern-value');

            // Test resource sharing pattern
            const lock = await parallelTestPatterns.shareResource('pattern-resource', 2000);

            try {
              expect(globalResourceLocks.isLocked('pattern-resource')).toBe(true);

              // Test worker temp directory pattern
              const tempDir = await parallelTestPatterns.createWorkerTempDir('pattern-temp');
              expect(tempDir).toBeTruthy();

              return 'all-patterns-integrated';

            } finally {
              lock.release();
            }
          });

          expect(envResult).toBe('all-patterns-integrated');
          expect(process.env.PATTERN_INTEGRATION_VAR).toBeUndefined();
          expect(globalResourceLocks.isLocked('pattern-resource')).toBe(false);

        } finally {
          emitterCleanup();
        }

      } finally {
        await dbCleanup();
      }
    });
  });

  describe('Cross-Package Compatibility', () => {
    it('should work with both orchestrator and test-utils utilities', async () => {
      // Create orchestrator context
      const orchestratorCtx = await createParallelTestContext({
        prefix: 'orchestrator-compat',
      });

      // Create test-utils isolation
      const isolationCtx = await createIsolatedTest({
        prefix: 'test-utils-compat',
      });

      try {
        // Use both together
        orchestratorCtx.eventEmitter.emitter.emit('cross-package-test', 'data');

        const tempFile = await isolationCtx.files.createTempFile('cross-package.txt', 'content');
        isolationCtx.env.setEnv('CROSS_PACKAGE_VAR', 'value');

        // Verify they work independently
        expect(orchestratorCtx.eventEmitter.getEventHistory()).toHaveLength(1);
        expect(process.env.CROSS_PACKAGE_VAR).toBe('value');

        const content = await fs.readFile(tempFile, 'utf8');
        expect(content).toBe('content');

      } finally {
        await orchestratorCtx.cleanup();
        await isolationCtx.teardown();

        expect(process.env.CROSS_PACKAGE_VAR).toBeUndefined();
      }
    });
  });

  describe('Error Propagation and Recovery', () => {
    it('should handle errors across all integrated utilities', async () => {
      let errorsCaught = 0;

      try {
        await runWithComprehensiveIsolation(async (testEnv) => {
          // Create multiple resource dependencies
          const { store, cleanup: storeCleanup } = await createParallelSafeTaskStore();

          try {
            // Set up environment
            testEnv.isolation!.env.setEnv('ERROR_TEST_VAR', 'test');

            // Set up event listeners
            testEnv.parallel.eventEmitter.emitter.on('error-test', () => {
              throw new Error('Event listener error');
            });

            // Acquire resource lock
            const lock = await globalResourceLocks.acquireLock('error-test-resource', 1000);

            try {
              // Trigger event error (should be handled gracefully)
              testEnv.parallel.eventEmitter.emitter.emit('error-test');

              // Throw main test error
              throw new Error('Main test error');

            } finally {
              lock.release();
            }

          } finally {
            await storeCleanup();
          }

        }, {
          withDatabase: true,
          withIsolation: true,
        });

      } catch (error) {
        errorsCaught++;
        expect((error as Error).message).toBe('Main test error');
      }

      expect(errorsCaught).toBe(1);

      // All resources should still be cleaned up despite errors
      expect(process.env.ERROR_TEST_VAR).toBeUndefined();
      expect(globalResourceLocks.isLocked('error-test-resource')).toBe(false);
    });
  });
});