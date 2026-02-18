/**
 * @fileoverview Error Recovery and Resilience Tests
 *
 * This test suite validates the error recovery and resilience capabilities
 * of the test fixtures infrastructure, ensuring graceful handling of
 * various failure scenarios and proper recovery mechanisms.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestSuite,
  setupTestMocks,
  setupFileSystemMocks,
  setupNetworkMocks,
  getTestEnvironment,
  setTestData,
  getTestData,
  addCleanupTask,
  createMockFunction,
  cleanupTestState,
  createTempDir,
  browserFixtures,
  browserHelpers,
  createBrowserState,
  flushTimers,
  advanceTimers
} from '../index.js';
import type { SetupTeardownHooks, MockConfig } from '../types.js';

describe('Error Recovery and Resilience Tests', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('Setup Failure Recovery', () => {
    it('should recover gracefully from partial setup failures', async () => {
      let setupAttempt = 0;
      const customSetup = vi.fn().mockImplementation(() => {
        setupAttempt++;
        if (setupAttempt === 1) {
          throw new Error('First setup attempt failed');
        }
        // Second attempt succeeds
        setTestData('setup-successful', true);
      });

      const suite = createTestSuite({
        customSetup,
        cleanupAfterEach: true
      });

      // First attempt should fail
      await expect(suite.beforeEach()).rejects.toThrow('First setup attempt failed');

      // Should be able to retry successfully
      await expect(suite.beforeEach()).resolves.toBeUndefined();
      expect(getTestData('setup-successful')).toBe(true);

      await suite.afterEach();
    });

    it('should handle mock setup failures and continue with partial functionality', async () => {
      const brokenMockConfig: MockConfig = {
        mockFs: true,
        mockNetwork: true,
        customMocks: {
          workingMock: vi.fn(() => 'working'),
          // @ts-expect-error - Testing broken mock
          brokenMock: null
        },
        mockData: {
          fileSystemData: { '/test.txt': 'content' },
          apiResponses: { 'https://api.test.com': { data: 'test' } }
        }
      };

      const suite = createTestSuite({
        setupMocks: true,
        mockConfig: brokenMockConfig
      });

      // Setup should not throw even with broken mocks
      await expect(suite.beforeEach()).resolves.toBeUndefined();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();

      // Working mock should be available
      expect(env!.activeMocks.has('workingMock')).toBe(true);
      const workingMock = env!.activeMocks.get('workingMock');
      expect(workingMock()).toBe('working');

      await suite.afterEach();
    });

    it('should recover from environment initialization failures', async () => {
      // Mock a critical function to fail initially
      const originalSetTimeout = global.setTimeout;
      let timeoutCalls = 0;

      global.setTimeout = vi.fn().mockImplementation((...args: any[]) => {
        timeoutCalls++;
        if (timeoutCalls === 1) {
          throw new Error('Timeout setup failed');
        }
        return originalSetTimeout(...args);
      });

      const suite = createTestSuite({
        useFakeTimers: false, // Don't use fake timers to test real setTimeout
        customSetup: () => {
          // This will trigger setTimeout usage
          setTimeout(() => {}, 0);
        }
      });

      // First attempt should fail
      await expect(suite.beforeEach()).rejects.toThrow('Timeout setup failed');

      // Second attempt should succeed
      await expect(suite.beforeEach()).resolves.toBeUndefined();

      await suite.afterEach();

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Runtime Error Resilience', () => {
    it('should handle errors during test execution without affecting cleanup', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const cleanupExecuted: string[] = [];

      // Register cleanup tasks that should run even if test fails
      addCleanupTask(() => cleanupExecuted.push('cleanup-1'));
      addCleanupTask(() => cleanupExecuted.push('cleanup-2'));
      addCleanupTask(() => cleanupExecuted.push('cleanup-3'));

      // Create test data
      setTestData('test-data', 'important-data');

      // Create mock that will be used
      const testMock = createMockFunction('test-mock', () => 'mock-result');
      testMock();

      // Cleanup should execute normally even if test had errors
      await suite.afterEach();

      expect(cleanupExecuted).toEqual(['cleanup-1', 'cleanup-2', 'cleanup-3']);
      expect(getTestEnvironment()).toBeNull();
    });

    it('should handle corrupted test environment state gracefully', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();

      // Corrupt the environment state
      if (env) {
        // @ts-expect-error - Intentionally corrupting state
        env.testData = { corrupted: true, set: null, clear: null };
        // @ts-expect-error - Intentionally corrupting state
        env.activeMocks = { corrupted: true, has: null, set: null, clear: null };
      }

      // Operations should handle corrupted state gracefully
      expect(() => setTestData('test', 'value')).not.toThrow();
      expect(() => createMockFunction('test-mock')).not.toThrow();

      // Cleanup should handle corrupted state
      await expect(cleanupTestState()).resolves.toBeUndefined();
      await expect(suite.afterEach()).resolves.toBeUndefined();
    });

    it('should handle memory pressure during test execution', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Create memory pressure
      const largeObjects: any[] = [];

      try {
        // Try to allocate large amounts of memory
        for (let i = 0; i < 1000; i++) {
          largeObjects.push({
            id: i,
            data: new Array(10000).fill(i),
            moreData: new Array(10000).fill(`string-${i}`)
          });
        }
      } catch (error) {
        // If we can't allocate memory, that's part of the test
      }

      // Test infrastructure should still work under memory pressure
      setTestData('memory-pressure-test', 'working');
      expect(getTestData('memory-pressure-test')).toBe('working');

      const mock = createMockFunction('memory-mock', (value: number) => value);
      expect(mock(42)).toBe(42);

      // Cleanup should work even under memory pressure
      await suite.afterEach();

      // Clear large objects
      largeObjects.length = 0;
    });
  });

  describe('Cleanup Error Resilience', () => {
    it('should handle cascading cleanup failures and still complete cleanup', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const cleanupResults: Array<{ task: string; success: boolean }> = [];

      // Add mix of failing and succeeding cleanup tasks
      addCleanupTask(() => {
        cleanupResults.push({ task: 'task-1', success: true });
      });

      addCleanupTask(() => {
        throw new Error('Task 2 failed');
      });

      addCleanupTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        cleanupResults.push({ task: 'task-3', success: true });
      });

      addCleanupTask(() => {
        throw new Error('Task 4 failed');
      });

      addCleanupTask(() => {
        cleanupResults.push({ task: 'task-5', success: true });
      });

      // Custom teardown that also fails
      const customTeardown = vi.fn().mockImplementation(() => {
        throw new Error('Custom teardown failed');
      });

      const suiteWithFailingTeardown = createTestSuite({ customTeardown });
      await suiteWithFailingTeardown.beforeEach();

      await suite.afterEach();
      await suiteWithFailingTeardown.afterEach();

      // Successful tasks should have completed
      const successfulTasks = cleanupResults.filter(r => r.success);
      expect(successfulTasks).toHaveLength(3);
      expect(successfulTasks.map(t => t.task)).toEqual(['task-1', 'task-3', 'task-5']);

      // Warnings should have been logged for failures
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3); // 2 cleanup failures + 1 teardown failure
    });

    it('should recover from file system cleanup errors', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Create temp directory
      const tempDir = await createTempDir();

      // Mock file system to fail on cleanup
      const originalRm = require('fs/promises').rm;
      const rmSpy = vi.fn().mockImplementation((path: string) => {
        if (path === tempDir) {
          throw new Error('Permission denied');
        }
        return originalRm(path);
      });

      vi.doMock('fs/promises', () => ({
        ...require('fs/promises'),
        rm: rmSpy
      }));

      const cleanupCompleted: string[] = [];
      addCleanupTask(() => cleanupCompleted.push('other-cleanup'));

      // Cleanup should handle file system errors gracefully
      await suite.afterEach();

      expect(cleanupCompleted).toEqual(['other-cleanup']);
      expect(consoleWarnSpy).toHaveBeenCalled();

      vi.doUnmock('fs/promises');
    });

    it('should handle infinite loop in cleanup tasks', async () => {
      const suite = createTestSuite({ timeout: 5000 });
      await suite.beforeEach();

      const completedTasks: string[] = [];

      addCleanupTask(() => {
        completedTasks.push('before-infinite');
      });

      addCleanupTask(() => {
        // Simulate problematic cleanup that takes too long
        const start = Date.now();
        while (Date.now() - start < 100) {
          // Busy wait for 100ms (simulating stuck cleanup)
        }
        completedTasks.push('slow-task');
      });

      addCleanupTask(() => {
        completedTasks.push('after-infinite');
      });

      const cleanupStart = Date.now();
      await suite.afterEach();
      const cleanupDuration = Date.now() - cleanupStart;

      // Should complete in reasonable time despite slow task
      expect(cleanupDuration).toBeLessThan(2000);
      expect(completedTasks).toContain('before-infinite');
      expect(completedTasks).toContain('after-infinite');
    });
  });

  describe('Mock Function Error Recovery', () => {
    it('should handle mock function implementation errors gracefully', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const errorResults: Array<{ mockName: string; error: string }> = [];

      // Create mocks with different types of errors
      const throwingMock = createMockFunction('throwing-mock', () => {
        throw new Error('Mock implementation error');
      });

      const asyncErrorMock = createMockFunction('async-error-mock', async () => {
        throw new Error('Async mock error');
      });

      const workingMock = createMockFunction('working-mock', (value: number) => value * 2);

      // Test error handling
      try {
        throwingMock();
      } catch (error) {
        errorResults.push({
          mockName: 'throwing-mock',
          error: error instanceof Error ? error.message : String(error)
        });
      }

      try {
        await asyncErrorMock();
      } catch (error) {
        errorResults.push({
          mockName: 'async-error-mock',
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Working mock should still work
      expect(workingMock(5)).toBe(10);

      expect(errorResults).toHaveLength(2);
      expect(errorResults[0].error).toBe('Mock implementation error');
      expect(errorResults[1].error).toBe('Async mock error');

      // Environment should still be valid
      const env = getTestEnvironment();
      expect(env!.activeMocks.size).toBe(3);

      await suite.afterEach();
    });

    it('should recover from mock function memory corruption', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const env = getTestEnvironment();
      const originalMock = createMockFunction('original-mock', (x: number) => x + 1);

      // Corrupt the mock in the environment
      if (env) {
        env.activeMocks.set('original-mock', null as any);
        env.activeMocks.set('corrupted-mock', undefined as any);
      }

      // Should be able to create new mocks despite corruption
      const newMock = createMockFunction('new-mock', (x: number) => x * 2);
      expect(newMock(3)).toBe(6);

      // Cleanup should handle corrupted mocks gracefully
      await expect(cleanupTestState()).resolves.toBeUndefined();

      expect(env!.activeMocks.size).toBe(0);

      await suite.afterEach();
    });

    it('should handle circular references in mock call history', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const circularMock = createMockFunction('circular-mock', function mockImpl(this: any, data: any) {
        if (!this.history) {
          this.history = [];
        }

        // Create circular reference in call history
        const callInfo = { args: data, timestamp: Date.now() };
        callInfo.self = callInfo; // Circular reference
        this.history.push(callInfo);

        return data;
      });

      // Call mock multiple times to create complex circular structure
      circularMock({ value: 1 });
      circularMock({ value: 2, ref: circularMock });
      circularMock({ value: 3 });

      // Cleanup should handle circular references gracefully
      await expect(cleanupTestState()).resolves.toBeUndefined();

      await suite.afterEach();
    });
  });

  describe('Browser State Error Recovery', () => {
    it('should handle browser state creation errors gracefully', async () => {
      // Mock Date constructor to fail occasionally
      const originalDate = global.Date;
      let dateCallCount = 0;

      global.Date = function DateMock(...args: any[]) {
        dateCallCount++;
        if (dateCallCount === 3) {
          throw new Error('Date creation failed');
        }
        return new originalDate(...args);
      } as any;

      global.Date.now = originalDate.now;

      const errorResults: Array<{ operation: string; success: boolean }> = [];

      // Create browser state with potential date errors
      try {
        const state = createBrowserState()
          .withUrl('https://test.example.com')
          .withConsoleMessages([
            { type: 'info', message: 'Test message 1' }, // This should work
            { type: 'warn', message: 'Test message 2' }, // This should work
            { type: 'error', message: 'Test message 3' } // This might fail due to Date
          ])
          .build();

        errorResults.push({ operation: 'browser-state-creation', success: true });
        expect(state.url).toBe('https://test.example.com');
      } catch (error) {
        errorResults.push({ operation: 'browser-state-creation', success: false });
      }

      global.Date = originalDate;

      // At least some operations should succeed
      expect(errorResults.some(r => r.success)).toBe(true);
    });

    it('should recover from browser helper operation failures', async () => {
      let baseState = browserFixtures.cleanState();
      const operationResults: Array<{ operation: string; success: boolean }> = [];

      // Mock JSON.stringify to fail occasionally
      const originalStringify = JSON.stringify;
      let stringifyCallCount = 0;

      JSON.stringify = vi.fn().mockImplementation((value: any) => {
        stringifyCallCount++;
        if (stringifyCallCount === 2) {
          throw new Error('JSON.stringify failed');
        }
        return originalStringify(value);
      });

      // Perform operations that might trigger JSON.stringify
      try {
        baseState = browserHelpers.setLocalStorage(baseState, 'key1', 'value1');
        operationResults.push({ operation: 'localStorage-1', success: true });
      } catch (error) {
        operationResults.push({ operation: 'localStorage-1', success: false });
      }

      try {
        baseState = browserHelpers.setSessionStorage(baseState, 'complex-data', JSON.stringify({ test: 'data' }));
        operationResults.push({ operation: 'sessionStorage', success: true });
      } catch (error) {
        operationResults.push({ operation: 'sessionStorage', success: false });
      }

      try {
        baseState = browserHelpers.setLocalStorage(baseState, 'key3', 'value3');
        operationResults.push({ operation: 'localStorage-3', success: true });
      } catch (error) {
        operationResults.push({ operation: 'localStorage-3', success: false });
      }

      JSON.stringify = originalStringify;

      // Some operations should succeed despite JSON.stringify failure
      const successfulOperations = operationResults.filter(r => r.success);
      expect(successfulOperations.length).toBeGreaterThan(0);
    });

    it('should handle browser state immutability violations gracefully', async () => {
      const baseState = browserFixtures.loggedInPage();

      // Try to corrupt the state object
      try {
        // @ts-expect-error - Intentionally violating immutability
        baseState.localStorage = null;
        // @ts-expect-error - Intentionally violating immutability
        baseState.consoleMessages = 'not-an-array';
      } catch (error) {
        // May or may not throw depending on runtime
      }

      // Operations should still work or fail gracefully
      let modifiedState;
      try {
        modifiedState = browserHelpers.addConsoleMessage(baseState, 'info', 'Test message');
        expect(modifiedState).toBeDefined();
      } catch (error) {
        // Should fail gracefully if state is corrupted
        expect(error).toBeInstanceOf(Error);
      }

      // Creating new state should always work
      const newState = browserFixtures.cleanState();
      expect(newState).toBeDefined();
      expect(newState.url).toBe('about:blank');
    });
  });

  describe('Timer and Async Error Recovery', () => {
    it('should handle timer operation failures gracefully', async () => {
      const suite = createTestSuite({ useFakeTimers: true });
      await suite.beforeEach();

      const timerResults: Array<{ operation: string; success: boolean }> = [];

      // Mock timer functions to fail occasionally
      const originalAdvanceTimers = vi.advanceTimersByTimeAsync;
      let advanceCallCount = 0;

      vi.advanceTimersByTimeAsync = vi.fn().mockImplementation((ms: number) => {
        advanceCallCount++;
        if (advanceCallCount === 2) {
          throw new Error('Timer advance failed');
        }
        return originalAdvanceTimers(ms);
      });

      // Perform timer operations
      try {
        await advanceTimers(100);
        timerResults.push({ operation: 'advance-1', success: true });
      } catch (error) {
        timerResults.push({ operation: 'advance-1', success: false });
      }

      try {
        await advanceTimers(200);
        timerResults.push({ operation: 'advance-2', success: true });
      } catch (error) {
        timerResults.push({ operation: 'advance-2', success: false });
      }

      try {
        await advanceTimers(300);
        timerResults.push({ operation: 'advance-3', success: true });
      } catch (error) {
        timerResults.push({ operation: 'advance-3', success: false });
      }

      vi.advanceTimersByTimeAsync = originalAdvanceTimers;

      // Some timer operations should succeed
      const successfulOperations = timerResults.filter(r => r.success);
      expect(successfulOperations.length).toBeGreaterThan(0);

      // Should at least have one failure (the second call)
      const failedOperations = timerResults.filter(r => !r.success);
      expect(failedOperations.length).toBeGreaterThan(0);

      await suite.afterEach();
    });

    it('should recover from async operation timeouts', async () => {
      const suite = createTestSuite({ timeout: 1000 });
      await suite.beforeEach();

      const asyncResults: Array<{ operation: string; completed: boolean; timedOut: boolean }> = [];

      // Create async operations with different timeouts
      const operations = [
        {
          name: 'fast-operation',
          delay: 50,
          operation: () => new Promise(resolve => setTimeout(resolve, 50))
        },
        {
          name: 'slow-operation',
          delay: 2000,
          operation: () => new Promise(resolve => setTimeout(resolve, 2000))
        },
        {
          name: 'normal-operation',
          delay: 200,
          operation: () => new Promise(resolve => setTimeout(resolve, 200))
        }
      ];

      // Run operations with timeout handling
      await Promise.allSettled(
        operations.map(async (op) => {
          try {
            await Promise.race([
              op.operation(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Operation timeout')), 500)
              )
            ]);
            asyncResults.push({ operation: op.name, completed: true, timedOut: false });
          } catch (error) {
            const timedOut = error instanceof Error && error.message === 'Operation timeout';
            asyncResults.push({ operation: op.name, completed: false, timedOut });
          }
        })
      );

      // Fast and normal operations should complete
      const fastResult = asyncResults.find(r => r.operation === 'fast-operation');
      const normalResult = asyncResults.find(r => r.operation === 'normal-operation');
      const slowResult = asyncResults.find(r => r.operation === 'slow-operation');

      expect(fastResult?.completed).toBe(true);
      expect(normalResult?.completed).toBe(true);
      expect(slowResult?.timedOut).toBe(true);

      await suite.afterEach();
    });
  });

  describe('Resource Exhaustion Recovery', () => {
    it('should handle resource exhaustion gracefully', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const resourceResults: Array<{ type: string; allocated: boolean }> = [];

      try {
        // Try to allocate many resources
        for (let i = 0; i < 10000; i++) {
          try {
            const resource = {
              id: i,
              data: new Array(1000).fill(i),
              mock: createMockFunction(`resource-mock-${i}`, () => i)
            };

            setTestData(`resource-${i}`, resource);
            resourceResults.push({ type: 'data-storage', allocated: true });

            if (i % 100 === 0) {
              addCleanupTask(() => {
                // Cleanup resource
                resource.data.length = 0;
              });
            }

            // Break if we're using too much memory
            if (process.memoryUsage().heapUsed > 100 * 1024 * 1024) { // 100MB
              break;
            }
          } catch (error) {
            resourceResults.push({ type: 'allocation-failure', allocated: false });
            break;
          }
        }
      } catch (error) {
        // Resource exhaustion is expected
      }

      // Should have allocated some resources before exhaustion
      const successfulAllocations = resourceResults.filter(r => r.allocated);
      expect(successfulAllocations.length).toBeGreaterThan(0);

      // Cleanup should still work
      await expect(suite.afterEach()).resolves.toBeUndefined();
    });

    it('should recover from file descriptor exhaustion', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const fileResults: Array<{ operation: string; success: boolean }> = [];

      // Mock file operations to simulate descriptor exhaustion
      const originalOpenAsync = require('fs/promises').open;
      let openCallCount = 0;

      const mockOpen = vi.fn().mockImplementation(async (path: string) => {
        openCallCount++;
        if (openCallCount > 10) {
          const error = new Error('EMFILE: too many open files');
          (error as any).code = 'EMFILE';
          throw error;
        }
        return originalOpenAsync(path);
      });

      vi.doMock('fs/promises', () => ({
        ...require('fs/promises'),
        open: mockOpen
      }));

      // Try to perform many file operations
      for (let i = 0; i < 20; i++) {
        try {
          await createTempDir();
          fileResults.push({ operation: `temp-dir-${i}`, success: true });
        } catch (error) {
          fileResults.push({ operation: `temp-dir-${i}`, success: false });
        }
      }

      const successfulOperations = fileResults.filter(r => r.success);
      const failedOperations = fileResults.filter(r => !r.success);

      expect(successfulOperations.length).toBeGreaterThan(0);
      expect(failedOperations.length).toBeGreaterThan(0);

      vi.doUnmock('fs/promises');

      await suite.afterEach();
    });
  });

  describe('Complete System Recovery', () => {
    it('should recover from complete system failure and partial restoration', async () => {
      const recoverySteps: string[] = [];

      // Create initial suite
      const suite1 = createTestSuite({
        customSetup: () => {
          recoverySteps.push('suite1-setup');
          setTestData('suite1-data', 'initial-data');
        },
        customTeardown: () => {
          recoverySteps.push('suite1-teardown');
          throw new Error('Suite 1 teardown failed');
        }
      });

      // Setup and use suite 1
      await suite1.beforeEach();
      createMockFunction('suite1-mock', () => 'suite1-result');
      recoverySteps.push('suite1-execution');

      // Teardown should fail but not crash
      await suite1.afterEach();

      // Create new suite - should work despite previous failure
      const suite2 = createTestSuite({
        customSetup: () => {
          recoverySteps.push('suite2-setup');
          setTestData('suite2-data', 'recovery-data');
        },
        customTeardown: () => {
          recoverySteps.push('suite2-teardown');
        }
      });

      await suite2.beforeEach();

      // Should have clean environment
      expect(getTestData('suite1-data')).toBeUndefined();
      expect(getTestData('suite2-data')).toBe('recovery-data');

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.activeMocks.size).toBe(0); // Should be clean

      createMockFunction('suite2-mock', () => 'suite2-result');
      recoverySteps.push('suite2-execution');

      await suite2.afterEach();

      expect(recoverySteps).toEqual([
        'suite1-setup',
        'suite1-execution',
        'suite1-teardown',
        'suite2-setup',
        'suite2-execution',
        'suite2-teardown'
      ]);

      // Environment should be clean after recovery
      expect(getTestEnvironment()).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Custom teardown failed:',
        expect.any(Error)
      );
    });

    it('should handle catastrophic failure with graceful degradation', async () => {
      const degradationLog: string[] = [];

      // Create suite with multiple failure points
      const catastrophicSuite = createTestSuite({
        customSetup: () => {
          degradationLog.push('setup-attempted');

          // Simulate partial setup success
          setTestData('partial-data', 'exists');

          // Then simulate critical failure
          throw new Error('Critical setup failure');
        },
        customTeardown: () => {
          degradationLog.push('teardown-attempted');
          throw new Error('Teardown also failed');
        }
      });

      // Setup should fail
      await expect(catastrophicSuite.beforeEach()).rejects.toThrow('Critical setup failure');

      // Environment should still be in some state
      let env = getTestEnvironment();
      if (env) {
        degradationLog.push('environment-partially-available');
      }

      // Attempt cleanup despite setup failure
      await catastrophicSuite.afterEach();
      degradationLog.push('cleanup-attempted');

      // Should be able to create new suite and recover
      const recoverySuite = createTestSuite();
      await recoverySuite.beforeEach();

      env = getTestEnvironment();
      expect(env).not.toBeNull();
      degradationLog.push('recovery-successful');

      await recoverySuite.afterEach();

      expect(degradationLog).toContain('setup-attempted');
      expect(degradationLog).toContain('cleanup-attempted');
      expect(degradationLog).toContain('recovery-successful');

      // Should have logged appropriate warnings
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });
});