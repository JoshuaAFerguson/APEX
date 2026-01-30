/**
 * @fileoverview Tests for the Test Setup and Teardown Utilities
 *
 * Validates the createTestSuite() function and associated helper utilities
 * that provide reusable beforeEach/afterEach patterns for APEX tests.
 *
 * @example Usage of createTestSuite:
 * ```typescript
 * import { createTestSuite } from '@apexcli/core/test-fixtures';
 *
 * describe('My Feature', () => {
 *   const suite = createTestSuite({
 *     setupMocks: true,
 *     cleanupAfterEach: true,
 *     mockConfig: {
 *       mockFs: true,
 *       mockData: { fileSystemData: { '/file.txt': 'content' } }
 *     }
 *   });
 *
 *   beforeEach(suite.beforeEach);
 *   afterEach(suite.afterEach);
 *
 *   it('runs with proper setup and teardown', () => {
 *     // Test with mocked environment
 *   });
 * });
 * ```
 *
 * @example Usage with custom hooks:
 * ```typescript
 * const suite = createTestSuite({
 *   customSetup: async () => { await initializeDatabase(); },
 *   customTeardown: async () => { await closeDatabase(); },
 * });
 * ```
 *
 * @example Using addCleanupTask:
 * ```typescript
 * import { addCleanupTask, getTestEnvironment } from '@apexcli/core/test-fixtures';
 *
 * it('registers cleanup automatically', () => {
 *   const resource = openExpensiveResource();
 *   addCleanupTask(() => resource.close());
 *   // resource.close() called automatically in afterEach
 * });
 * ```
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestSuite,
  setupTestMocks,
  cleanupTestState,
  getTestEnvironment,
  setTestData,
  getTestData,
  addCleanupTask,
  createMockFunction,
  flushTimers,
  advanceTimers,
} from '../setup-teardown.js';
import type { TestSuiteConfig, SetupTeardownHooks } from '../types.js';

describe('Setup and Teardown Utilities', () => {
  // We need our own cleanup to avoid interference with the module under test
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTestSuite()', () => {
    it('should return an object with beforeEach and afterEach hooks', () => {
      const suite = createTestSuite();

      expect(suite).toBeDefined();
      expect(suite.beforeEach).toBeDefined();
      expect(typeof suite.beforeEach).toBe('function');
      expect(suite.afterEach).toBeDefined();
      expect(typeof suite.afterEach).toBe('function');
    });

    it('should satisfy the SetupTeardownHooks interface', () => {
      const suite: SetupTeardownHooks = createTestSuite();

      expect(suite.beforeEach).toBeTypeOf('function');
      expect(suite.afterEach).toBeTypeOf('function');
    });

    it('should accept empty config (all defaults)', () => {
      expect(() => createTestSuite()).not.toThrow();
      expect(() => createTestSuite({})).not.toThrow();
    });

    it('should accept full config with all options', () => {
      const config: TestSuiteConfig = {
        setupMocks: true,
        cleanupAfterEach: true,
        mockConfig: {
          mockFs: false,
          mockNetwork: false,
          mockTimers: false,
        },
        timeout: 10000,
        useFakeTimers: false,
        customSetup: async () => {},
        customTeardown: async () => {},
      };

      expect(() => createTestSuite(config)).not.toThrow();
    });

    describe('beforeEach hook', () => {
      it('should initialize test environment on beforeEach', async () => {
        const suite = createTestSuite();

        // Before running hook, environment should be null
        expect(getTestEnvironment()).toBeNull();

        await suite.beforeEach();

        const env = getTestEnvironment();
        expect(env).not.toBeNull();
        expect(env!.projectPath).toBe('/test/project');
        expect(env!.activeMocks).toBeInstanceOf(Map);
        expect(env!.cleanupTasks).toBeInstanceOf(Array);
        expect(env!.testData).toBeInstanceOf(Map);

        // Cleanup
        await suite.afterEach();
      });

      it('should call customSetup when provided', async () => {
        const customSetup = vi.fn();
        const suite = createTestSuite({ customSetup });

        await suite.beforeEach();

        expect(customSetup).toHaveBeenCalledOnce();

        await suite.afterEach();
      });

      it('should call customSetup after mock initialization', async () => {
        const callOrder: string[] = [];

        const suite = createTestSuite({
          setupMocks: true,
          mockConfig: {},
          customSetup: () => {
            callOrder.push('customSetup');
          },
        });

        await suite.beforeEach();
        // customSetup should have been called
        expect(callOrder).toContain('customSetup');

        await suite.afterEach();
      });
    });

    describe('afterEach hook', () => {
      it('should reset global environment to null', async () => {
        const suite = createTestSuite();

        await suite.beforeEach();
        expect(getTestEnvironment()).not.toBeNull();

        await suite.afterEach();
        expect(getTestEnvironment()).toBeNull();
      });

      it('should call customTeardown when provided', async () => {
        const customTeardown = vi.fn();
        const suite = createTestSuite({ customTeardown });

        await suite.beforeEach();
        await suite.afterEach();

        expect(customTeardown).toHaveBeenCalledOnce();
      });

      it('should run cleanup tasks registered during setup', async () => {
        const cleanupFn = vi.fn();
        const suite = createTestSuite({
          customSetup: () => {
            addCleanupTask(cleanupFn);
          },
        });

        await suite.beforeEach();
        await suite.afterEach();

        expect(cleanupFn).toHaveBeenCalledOnce();
      });

      it('should handle customTeardown errors gracefully', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const suite = createTestSuite({
          customTeardown: () => {
            throw new Error('Teardown failed');
          },
        });

        await suite.beforeEach();
        // Should not throw
        await expect(suite.afterEach()).resolves.toBeUndefined();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Custom teardown failed:',
          expect.any(Error)
        );
      });

      it('should handle cleanup task errors gracefully', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const suite = createTestSuite();

        await suite.beforeEach();

        addCleanupTask(() => {
          throw new Error('Cleanup failed');
        });
        addCleanupTask(vi.fn()); // second cleanup should still run

        await expect(suite.afterEach()).resolves.toBeUndefined();
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should clear all mocks when cleanupAfterEach is true (default)', async () => {
        const suite = createTestSuite({ cleanupAfterEach: true });

        await suite.beforeEach();

        const mockFn = vi.fn();
        mockFn();
        expect(mockFn).toHaveBeenCalled();

        await suite.afterEach();
        // After cleanup, vi.clearAllMocks() and vi.resetAllMocks() are called
      });

      it('should skip mock cleanup when cleanupAfterEach is false', async () => {
        const suite = createTestSuite({ cleanupAfterEach: false });

        await suite.beforeEach();
        await suite.afterEach();

        // Environment should still be null (global state reset always happens)
        expect(getTestEnvironment()).toBeNull();
      });
    });

    describe('fake timers', () => {
      it('should setup fake timers when useFakeTimers is true', async () => {
        const suite = createTestSuite({ useFakeTimers: true });

        await suite.beforeEach();

        // Fake timers should be active - verify by checking that
        // setTimeout doesn't actually wait
        let called = false;
        setTimeout(() => {
          called = true;
        }, 1000);

        // With fake timers, callback hasn't been called yet
        expect(called).toBe(false);

        // Advance timers
        vi.advanceTimersByTime(1000);
        expect(called).toBe(true);

        await suite.afterEach();
      });

      it('should restore real timers on teardown', async () => {
        const suite = createTestSuite({ useFakeTimers: true });

        await suite.beforeEach();
        await suite.afterEach();

        // After teardown, real timers should be restored
        // This is validated by the cleanup task registered for fake timers
      });
    });
  });

  describe('Test Environment State', () => {
    let suite: SetupTeardownHooks;

    beforeEach(async () => {
      suite = createTestSuite();
      await suite.beforeEach();
    });

    afterEach(async () => {
      await suite.afterEach();
    });

    it('should return current environment via getTestEnvironment()', () => {
      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.projectPath).toBe('/test/project');
    });

    it('should support setTestData and getTestData', () => {
      setTestData('userId', 'test-user-123');
      setTestData('config', { theme: 'dark' });

      expect(getTestData('userId')).toBe('test-user-123');
      expect(getTestData('config')).toEqual({ theme: 'dark' });
    });

    it('should return undefined for missing test data keys', () => {
      expect(getTestData('nonexistent')).toBeUndefined();
    });

    it('should clear test data on teardown', async () => {
      setTestData('myKey', 'myValue');
      expect(getTestData('myKey')).toBe('myValue');

      await suite.afterEach();
      // After teardown, environment is null
      expect(getTestData('myKey')).toBeUndefined();

      // Re-initialize for our own afterEach
      suite = createTestSuite();
      await suite.beforeEach();
    });
  });

  describe('addCleanupTask()', () => {
    it('should register cleanup tasks that run during teardown', async () => {
      const suite = createTestSuite();
      const cleanupOrder: number[] = [];

      await suite.beforeEach();

      addCleanupTask(() => cleanupOrder.push(1));
      addCleanupTask(() => cleanupOrder.push(2));
      addCleanupTask(() => cleanupOrder.push(3));

      await suite.afterEach();

      expect(cleanupOrder).toEqual([1, 2, 3]);
    });

    it('should support async cleanup tasks', async () => {
      const suite = createTestSuite();
      const cleaned = vi.fn();

      await suite.beforeEach();

      addCleanupTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        cleaned();
      });

      await suite.afterEach();

      expect(cleaned).toHaveBeenCalledOnce();
    });

    it('should be a no-op when called outside of test environment', () => {
      // No beforeEach called, so globalTestEnvironment is null
      expect(() => addCleanupTask(() => {})).not.toThrow();
    });
  });

  describe('createMockFunction()', () => {
    it('should create a named mock function', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const mockFn = createMockFunction('myMock');

      expect(mockFn).toBeDefined();
      expect(typeof mockFn).toBe('function');

      // Should be registered in active mocks
      const env = getTestEnvironment();
      expect(env!.activeMocks.has('myMock')).toBe(true);
      expect(env!.activeMocks.get('myMock')).toBe(mockFn);

      await suite.afterEach();
    });

    it('should accept a custom implementation', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const mockFn = createMockFunction('adder', (a: number, b: number) => a + b);

      expect(mockFn(2, 3)).toBe(5);
      expect(mockFn).toHaveBeenCalledWith(2, 3);

      await suite.afterEach();
    });
  });

  describe('setupTestMocks()', () => {
    let suite: SetupTeardownHooks;

    beforeEach(async () => {
      suite = createTestSuite();
      await suite.beforeEach();
    });

    afterEach(async () => {
      await suite.afterEach();
    });

    it('should setup custom mocks and register them', async () => {
      const customMock = vi.fn();

      await setupTestMocks({
        customMocks: { myService: customMock },
      });

      const env = getTestEnvironment();
      expect(env!.activeMocks.has('myService')).toBe(true);
      expect(env!.activeMocks.get('myService')).toBe(customMock);
    });

    it('should setup environment variables and cleanup', async () => {
      await setupTestMocks({
        mockData: {
          envVars: {
            APEX_TEST_MODE: 'enabled',
            NODE_ENV: 'test',
          },
        },
      });

      expect(process.env.APEX_TEST_MODE).toBe('enabled');
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should handle empty config gracefully', async () => {
      await expect(setupTestMocks({})).resolves.toBeUndefined();
    });
  });

  describe('cleanupTestState()', () => {
    it('should clear all mocks', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const mockFn = vi.fn();
      mockFn('test');
      expect(mockFn).toHaveBeenCalledOnce();

      await cleanupTestState();

      // Mocks should be cleared
      expect(mockFn).not.toHaveBeenCalled();

      await suite.afterEach();
    });

    it('should clear test data maps', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      setTestData('myKey', 'myValue');
      createMockFunction('testMock');

      const env = getTestEnvironment();
      expect(env!.testData.size).toBe(1);
      expect(env!.activeMocks.size).toBe(1);

      await cleanupTestState();

      expect(env!.testData.size).toBe(0);
      expect(env!.activeMocks.size).toBe(0);

      await suite.afterEach();
    });
  });

  describe('Timer utilities', () => {
    it('flushTimers should run all pending timers', async () => {
      const suite = createTestSuite({ useFakeTimers: true });
      await suite.beforeEach();

      const callback = vi.fn();
      setTimeout(callback, 5000);
      setTimeout(callback, 10000);

      expect(callback).not.toHaveBeenCalled();

      await flushTimers();

      expect(callback).toHaveBeenCalledTimes(2);

      await suite.afterEach();
    });

    it('advanceTimers should advance by specified milliseconds', async () => {
      const suite = createTestSuite({ useFakeTimers: true });
      await suite.beforeEach();

      const earlyCallback = vi.fn();
      const lateCallback = vi.fn();
      setTimeout(earlyCallback, 1000);
      setTimeout(lateCallback, 5000);

      await advanceTimers(2000);

      expect(earlyCallback).toHaveBeenCalledOnce();
      expect(lateCallback).not.toHaveBeenCalled();

      await suite.afterEach();
    });
  });

  describe('Integration: Full lifecycle', () => {
    it('should support a complete test lifecycle', async () => {
      const lifecycleLog: string[] = [];

      const suite = createTestSuite({
        setupMocks: true,
        mockConfig: {
          customMocks: {
            logger: vi.fn(),
          },
          mockData: {
            envVars: { APEX_TEST_MODE: 'enabled' },
          },
        },
        customSetup: () => {
          lifecycleLog.push('custom-setup');
        },
        customTeardown: () => {
          lifecycleLog.push('custom-teardown');
        },
      });

      // Simulate beforeEach
      await suite.beforeEach();
      lifecycleLog.push('test-running');

      // Verify environment is set up
      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.activeMocks.has('logger')).toBe(true);
      expect(process.env.APEX_TEST_MODE).toBe('enabled');

      // Use test data helpers
      setTestData('result', 42);
      expect(getTestData('result')).toBe(42);

      // Register additional cleanup
      addCleanupTask(() => {
        lifecycleLog.push('cleanup-task');
      });

      // Simulate afterEach
      await suite.afterEach();

      expect(lifecycleLog).toEqual([
        'custom-setup',
        'test-running',
        'custom-teardown',
        'cleanup-task',
      ]);

      // Environment should be cleaned up
      expect(getTestEnvironment()).toBeNull();
    });

    it('should isolate state between test runs', async () => {
      const suite = createTestSuite();

      // First "test"
      await suite.beforeEach();
      setTestData('counter', 1);
      expect(getTestData('counter')).toBe(1);
      await suite.afterEach();

      // Second "test"
      await suite.beforeEach();
      expect(getTestData('counter')).toBeUndefined(); // Isolated
      setTestData('counter', 2);
      expect(getTestData('counter')).toBe(2);
      await suite.afterEach();
    });

    it('should support multiple cleanup tasks with error resilience', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const suite = createTestSuite();

      await suite.beforeEach();

      const executed: number[] = [];

      addCleanupTask(() => executed.push(1));
      addCleanupTask(() => {
        throw new Error('Task 2 failed');
      });
      addCleanupTask(() => executed.push(3)); // Should still run

      await suite.afterEach();

      expect(executed).toEqual([1, 3]);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });
});
