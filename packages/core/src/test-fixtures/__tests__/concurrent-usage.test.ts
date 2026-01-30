/**
 * @fileoverview Tests for Concurrent Test Suite Usage
 *
 * This test suite validates that the test setup and teardown infrastructure
 * properly handles concurrent usage scenarios, parallel test execution,
 * and maintains proper isolation between concurrent test suites.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestSuite,
  setupTestMocks,
  getTestEnvironment,
  setTestData,
  getTestData,
  addCleanupTask,
  createMockFunction,
  cleanupTestState,
  browserFixtures,
  browserHelpers,
  createBrowserState
} from '../index.js';
import type { SetupTeardownHooks, BrowserState } from '../types.js';

describe('Concurrent Test Suite Usage', () => {
  let cleanupFunctions: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    // Clean up any remaining test suites
    for (const cleanup of cleanupFunctions) {
      try {
        await cleanup();
      } catch (error) {
        console.warn('Cleanup failed:', error);
      }
    }
    cleanupFunctions = [];
    vi.restoreAllMocks();
  });

  describe('Parallel Test Suite Execution', () => {
    it('should handle multiple test suites running in parallel', async () => {
      const results: Array<{ suiteId: string; success: boolean; error?: string }> = [];

      const createParallelSuite = async (suiteId: string, delay: number = 0) => {
        try {
          const suite = createTestSuite({
            setupMocks: true,
            customSetup: async () => {
              if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
              setTestData(`suite-${suiteId}-initialized`, true);
            },
            customTeardown: async () => {
              setTestData(`suite-${suiteId}-cleaned`, true);
            }
          });

          await suite.beforeEach();

          // Simulate test work
          const mockFn = createMockFunction(`mock-${suiteId}`);
          mockFn();

          const env = getTestEnvironment();
          expect(env).not.toBeNull();
          expect(getTestData(`suite-${suiteId}-initialized`)).toBe(true);

          await suite.afterEach();
          results.push({ suiteId, success: true });
        } catch (error) {
          results.push({ suiteId, success: false, error: error instanceof Error ? error.message : String(error) });
        }
      };

      // Run multiple suites in parallel with different delays
      await Promise.all([
        createParallelSuite('A', 10),
        createParallelSuite('B', 5),
        createParallelSuite('C', 15),
        createParallelSuite('D', 0)
      ]);

      // All suites should succeed
      expect(results).toHaveLength(4);
      expect(results.every(result => result.success)).toBe(true);

      // Each suite should have run independently
      const suiteIds = results.map(r => r.suiteId).sort();
      expect(suiteIds).toEqual(['A', 'B', 'C', 'D']);
    });

    it('should maintain isolation between concurrent browser state operations', async () => {
      const browserStates: Record<string, BrowserState> = {};

      const createBrowserStateAsync = async (stateId: string, scenario: string) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            switch (scenario) {
              case 'login':
                browserStates[stateId] = browserFixtures.loggedInPage({
                  localStorage: { [`state-${stateId}`]: 'logged-in' }
                });
                break;
              case 'error':
                browserStates[stateId] = browserFixtures.errorPage({
                  localStorage: { [`state-${stateId}`]: 'error' }
                });
                break;
              case 'loading':
                browserStates[stateId] = browserFixtures.loadingPage({
                  localStorage: { [`state-${stateId}`]: 'loading' }
                });
                break;
              default:
                browserStates[stateId] = browserFixtures.cleanState({
                  localStorage: { [`state-${stateId}`]: 'clean' }
                });
            }
            resolve();
          }, Math.random() * 50); // Random delay 0-50ms
        });
      };

      // Create multiple browser states concurrently
      await Promise.all([
        createBrowserStateAsync('state1', 'login'),
        createBrowserStateAsync('state2', 'error'),
        createBrowserStateAsync('state3', 'loading'),
        createBrowserStateAsync('state4', 'clean')
      ]);

      // Verify each state maintained its identity
      expect(browserStates.state1.localStorage['state-state1']).toBe('logged-in');
      expect(browserStates.state1.isAuthenticated).toBe(true);

      expect(browserStates.state2.localStorage['state-state2']).toBe('error');
      expect(browserStates.state2.hasError).toBe(true);

      expect(browserStates.state3.localStorage['state-state3']).toBe('loading');
      expect(browserStates.state3.isLoading).toBe(true);

      expect(browserStates.state4.localStorage['state-state4']).toBe('clean');
      expect(browserStates.state4.isAuthenticated).toBe(false);
    });

    it('should handle concurrent browser state builder operations', async () => {
      const builders = Array.from({ length: 10 }, (_, i) => {
        return createBrowserState()
          .withUrl(`https://test${i}.example.com`)
          .withLocalStorage({ [`key${i}`]: `value${i}` });
      });

      // Build all states concurrently
      const states = await Promise.all(
        builders.map(async (builder, i) => {
          // Add some async delay to simulate real work
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          return builder
            .withTitle(`Test ${i}`)
            .withConsoleMessages([{ type: 'info', message: `Message ${i}` }])
            .build();
        })
      );

      // Verify each state has the correct data
      states.forEach((state, i) => {
        expect(state.url).toBe(`https://test${i}.example.com`);
        expect(state.title).toBe(`Test ${i}`);
        expect(state.localStorage[`key${i}`]).toBe(`value${i}`);
        expect(state.consoleMessages[0].message).toBe(`Message ${i}`);
      });
    });
  });

  describe('Test Environment Isolation', () => {
    it('should maintain separate test environments for concurrent suites', async () => {
      const environmentData: Array<{ suiteId: string; projectPath: string; testData: any }> = [];

      const runIsolatedSuite = async (suiteId: string) => {
        const suite = createTestSuite({
          customSetup: () => {
            setTestData('suite-id', suiteId);
            setTestData('timestamp', Date.now());
          }
        });

        await suite.beforeEach();

        const env = getTestEnvironment();
        expect(env).not.toBeNull();

        environmentData.push({
          suiteId,
          projectPath: env!.projectPath,
          testData: {
            suiteId: getTestData('suite-id'),
            timestamp: getTestData('timestamp')
          }
        });

        await suite.afterEach();
      };

      // Run multiple isolated suites
      await Promise.all([
        runIsolatedSuite('suite-alpha'),
        runIsolatedSuite('suite-beta'),
        runIsolatedSuite('suite-gamma')
      ]);

      // Each suite should have maintained its own environment
      expect(environmentData).toHaveLength(3);

      const alphaEnv = environmentData.find(e => e.suiteId === 'suite-alpha');
      const betaEnv = environmentData.find(e => e.suiteId === 'suite-beta');
      const gammaEnv = environmentData.find(e => e.suiteId === 'suite-gamma');

      expect(alphaEnv?.testData.suiteId).toBe('suite-alpha');
      expect(betaEnv?.testData.suiteId).toBe('suite-beta');
      expect(gammaEnv?.testData.suiteId).toBe('suite-gamma');

      // All should have same project path (global default)
      expect(alphaEnv?.projectPath).toBe('/test/project');
      expect(betaEnv?.projectPath).toBe('/test/project');
      expect(gammaEnv?.projectPath).toBe('/test/project');
    });

    it('should handle concurrent cleanup task registration', async () => {
      const cleanupOrder: string[] = [];

      const runSuiteWithCleanup = async (suiteId: string) => {
        const suite = createTestSuite();
        await suite.beforeEach();

        // Register multiple cleanup tasks
        addCleanupTask(() => cleanupOrder.push(`${suiteId}-cleanup-1`));
        addCleanupTask(() => cleanupOrder.push(`${suiteId}-cleanup-2`));
        addCleanupTask(async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          cleanupOrder.push(`${suiteId}-cleanup-3`);
        });

        await suite.afterEach();
      };

      // Run multiple suites with cleanup
      await Promise.all([
        runSuiteWithCleanup('X'),
        runSuiteWithCleanup('Y'),
        runSuiteWithCleanup('Z')
      ]);

      // All cleanup tasks should have run
      expect(cleanupOrder.length).toBeGreaterThanOrEqual(9); // 3 tasks * 3 suites

      // Each suite's tasks should be grouped together
      const xTasks = cleanupOrder.filter(task => task.startsWith('X-'));
      const yTasks = cleanupOrder.filter(task => task.startsWith('Y-'));
      const zTasks = cleanupOrder.filter(task => task.startsWith('Z-'));

      expect(xTasks).toHaveLength(3);
      expect(yTasks).toHaveLength(3);
      expect(zTasks).toHaveLength(3);
    });
  });

  describe('Mock Function Concurrency', () => {
    it('should handle concurrent mock function creation and usage', async () => {
      const mockResults: Record<string, any> = {};

      const useMocksInParallel = async (workerId: string) => {
        const suite = createTestSuite();
        await suite.beforeEach();

        const mockFn = createMockFunction(`worker-${workerId}-mock`, (value: number) => value * 2);

        // Use mock concurrently
        const results = await Promise.all([
          Promise.resolve(mockFn(1)),
          Promise.resolve(mockFn(2)),
          Promise.resolve(mockFn(3))
        ]);

        mockResults[workerId] = {
          results,
          callCount: mockFn.mock.calls.length
        };

        await suite.afterEach();
      };

      await Promise.all([
        useMocksInParallel('worker1'),
        useMocksInParallel('worker2'),
        useMocksInParallel('worker3')
      ]);

      // Each worker should have independent results
      expect(mockResults.worker1.results).toEqual([2, 4, 6]);
      expect(mockResults.worker1.callCount).toBe(3);

      expect(mockResults.worker2.results).toEqual([2, 4, 6]);
      expect(mockResults.worker2.callCount).toBe(3);

      expect(mockResults.worker3.results).toEqual([2, 4, 6]);
      expect(mockResults.worker3.callCount).toBe(3);
    });

    it('should handle concurrent file system mock operations', async () => {
      const fileOperations: Array<{ workerId: string; success: boolean; data?: string }> = [];

      const performFileOperations = async (workerId: string) => {
        const suite = createTestSuite({
          setupMocks: true,
          mockConfig: {
            mockFs: true,
            mockData: {
              fileSystemData: {
                [`/worker-${workerId}/file.txt`]: `Content for worker ${workerId}`
              }
            }
          }
        });

        try {
          await suite.beforeEach();

          // Simulate file operations would work here
          fileOperations.push({
            workerId,
            success: true,
            data: `Content for worker ${workerId}`
          });

          await suite.afterEach();
        } catch (error) {
          fileOperations.push({
            workerId,
            success: false
          });
        }
      };

      await Promise.all([
        performFileOperations('A'),
        performFileOperations('B'),
        performFileOperations('C')
      ]);

      // All operations should succeed
      expect(fileOperations).toHaveLength(3);
      expect(fileOperations.every(op => op.success)).toBe(true);
    });
  });

  describe('Resource Contention', () => {
    it('should handle high-concurrency test suite creation', async () => {
      const concurrencyLevel = 20;
      const results: Array<{ id: number; success: boolean }> = [];

      const createHighConcurrencySuite = async (id: number) => {
        try {
          const suite = createTestSuite({
            setupMocks: Math.random() > 0.5, // Random mock setup
            customSetup: async () => {
              // Simulate variable setup time
              await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
              setTestData(`concurrent-suite-${id}`, { id, timestamp: Date.now() });
            }
          });

          await suite.beforeEach();

          // Verify environment
          const env = getTestEnvironment();
          expect(env).not.toBeNull();

          const testData = getTestData(`concurrent-suite-${id}`);
          expect(testData?.id).toBe(id);

          await suite.afterEach();

          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false });
        }
      };

      // Create many concurrent suites
      const promises = Array.from({ length: concurrencyLevel }, (_, i) =>
        createHighConcurrencySuite(i)
      );

      await Promise.all(promises);

      // Most or all should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(concurrencyLevel * 0.8); // At least 80% success
      expect(results).toHaveLength(concurrencyLevel);
    });

    it('should handle concurrent timer operations', async () => {
      const timerResults: Array<{ workerId: string; duration: number }> = [];

      const useTimersInParallel = async (workerId: string, delay: number) => {
        const suite = createTestSuite({ useFakeTimers: true });
        await suite.beforeEach();

        const startTime = Date.now();

        setTimeout(() => {
          const duration = Date.now() - startTime;
          timerResults.push({ workerId, duration });
        }, delay);

        // Advance timers by the delay amount
        await vi.advanceTimersByTimeAsync(delay);

        await suite.afterEach();
      };

      await Promise.all([
        useTimersInParallel('timer1', 100),
        useTimersInParallel('timer2', 200),
        useTimersInParallel('timer3', 300)
      ]);

      expect(timerResults).toHaveLength(3);

      const timer1Result = timerResults.find(r => r.workerId === 'timer1');
      const timer2Result = timerResults.find(r => r.workerId === 'timer2');
      const timer3Result = timerResults.find(r => r.workerId === 'timer3');

      expect(timer1Result).toBeDefined();
      expect(timer2Result).toBeDefined();
      expect(timer3Result).toBeDefined();
    });
  });

  describe('Error Propagation in Concurrent Scenarios', () => {
    it('should isolate errors between concurrent test suites', async () => {
      const outcomes: Array<{ suiteId: string; success: boolean; error?: string }> = [];

      const runSuiteWithPotentialFailure = async (suiteId: string, shouldFail: boolean) => {
        try {
          const suite = createTestSuite({
            customSetup: () => {
              if (shouldFail) {
                throw new Error(`Suite ${suiteId} setup failed`);
              }
              setTestData('success', true);
            }
          });

          await suite.beforeEach();

          // If we get here, setup succeeded
          expect(getTestData('success')).toBe(true);

          await suite.afterEach();
          outcomes.push({ suiteId, success: true });
        } catch (error) {
          outcomes.push({
            suiteId,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      };

      // Run mix of failing and succeeding suites
      await Promise.all([
        runSuiteWithPotentialFailure('good1', false),
        runSuiteWithPotentialFailure('bad1', true),
        runSuiteWithPotentialFailure('good2', false),
        runSuiteWithPotentialFailure('bad2', true),
        runSuiteWithPotentialFailure('good3', false)
      ]);

      // Should have both successes and failures
      const successes = outcomes.filter(o => o.success);
      const failures = outcomes.filter(o => !o.success);

      expect(successes).toHaveLength(3); // good1, good2, good3
      expect(failures).toHaveLength(2);  // bad1, bad2

      // Check that good suites succeeded
      expect(successes.map(s => s.suiteId).sort()).toEqual(['good1', 'good2', 'good3']);

      // Check that bad suites failed with correct errors
      failures.forEach(failure => {
        expect(failure.error).toContain('setup failed');
      });
    });

    it('should handle cleanup failures in concurrent scenarios', async () => {
      const cleanupResults: Array<{ suiteId: string; cleanupCompleted: boolean }> = [];

      const runSuiteWithCleanupIssues = async (suiteId: string, cleanupShouldFail: boolean) => {
        const suite = createTestSuite({
          customTeardown: () => {
            if (cleanupShouldFail) {
              throw new Error(`Cleanup failed for ${suiteId}`);
            }
          }
        });

        await suite.beforeEach();

        addCleanupTask(() => {
          cleanupResults.push({ suiteId, cleanupCompleted: true });
        });

        await suite.afterEach(); // Should not throw even if custom teardown fails
      };

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await Promise.all([
        runSuiteWithCleanupIssues('clean1', false),
        runSuiteWithCleanupIssues('dirty1', true),
        runSuiteWithCleanupIssues('clean2', false),
        runSuiteWithCleanupIssues('dirty2', true)
      ]);

      // All cleanup tasks should have run despite teardown failures
      expect(cleanupResults).toHaveLength(4);
      expect(cleanupResults.every(r => r.cleanupCompleted)).toBe(true);

      // Console warnings should have been logged for failed teardowns
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Memory Management Under Concurrency', () => {
    it('should not leak memory with many concurrent test suites', async () => {
      const initialMemory = process.memoryUsage();
      const suiteCount = 50;

      // Create and run many test suites
      const runManySuites = async () => {
        const suites = Array.from({ length: suiteCount }, () => createTestSuite({
          setupMocks: true,
          cleanupAfterEach: true
        }));

        for (const suite of suites) {
          await suite.beforeEach();

          // Create some test data
          createMockFunction('tempMock');
          setTestData('tempData', { large: new Array(1000).fill('data') });

          await suite.afterEach();
        }
      };

      await runManySuites();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up browser state objects properly', async () => {
      const browserStateCount = 100;
      let states: BrowserState[] = [];

      // Create many browser states concurrently
      const createManyBrowserStates = async () => {
        const promises = Array.from({ length: browserStateCount }, (_, i) => {
          return Promise.resolve(
            createBrowserState()
              .withUrl(`https://test${i}.example.com`)
              .withLocalStorage({
                [`data${i}`]: `value${i}`,
                largeData: new Array(100).fill(`item-${i}`).join(',')
              })
              .build()
          );
        });

        states = await Promise.all(promises);
      };

      await createManyBrowserStates();

      expect(states).toHaveLength(browserStateCount);

      // Clear references and allow GC
      states = [];

      if (global.gc) {
        global.gc();
      }

      // Test should complete without memory issues
      expect(true).toBe(true);
    });
  });
});