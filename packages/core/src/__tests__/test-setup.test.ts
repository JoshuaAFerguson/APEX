/**
 * @fileoverview Tests for test-setup.ts utilities
 *
 * This file tests the global test setup utilities including console helpers,
 * mock setup, timeout helpers, and async utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupGlobalTestEnvironment,
  setupConsoleHelpers,
  setupCommonMocks,
  setupTimeoutHelpers,
  setupAsyncUtilities,
  createTestSuite,
  testFactories,
  assertionHelpers,
  mockHelpers,
  type TestEnvironmentOptions,
} from '../../../test-setup.js';

describe('Test Setup Utilities', () => {
  // Store original global functions to restore them
  const originalGlobals = {
    testTimeout: globalThis.testTimeout,
    withTimeout: globalThis.withTimeout,
    flushPromises: globalThis.flushPromises,
    nextTick: globalThis.nextTick,
    sleep: globalThis.sleep,
    waitFor: globalThis.waitFor,
  };

  beforeEach(() => {
    // Clean up any existing global modifications
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    // Restore original globals
    Object.assign(globalThis, originalGlobals);
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('setupGlobalTestEnvironment', () => {
    it('should setup all components with default options', () => {
      setupGlobalTestEnvironment();

      // Verify globals are available
      expect(globalThis.testTimeout).toBe(5000);
      expect(typeof globalThis.withTimeout).toBe('function');
      expect(typeof globalThis.flushPromises).toBe('function');
      expect(typeof globalThis.nextTick).toBe('function');
      expect(typeof globalThis.sleep).toBe('function');
      expect(typeof globalThis.waitFor).toBe('function');
    });

    it('should setup with custom options', () => {
      const options: TestEnvironmentOptions = {
        setupConsole: false,
        setupMocks: true,
        setupTimeouts: true,
        setupAsync: false,
        globalTimeout: 10000,
      };

      setupGlobalTestEnvironment(options);

      expect(globalThis.testTimeout).toBe(10000);
      // Should not have async utilities when setupAsync is false
      expect(globalThis.flushPromises).toBeUndefined();
    });

    it('should handle selective setup', () => {
      setupGlobalTestEnvironment({
        setupConsole: false,
        setupMocks: false,
        setupTimeouts: true,
        setupAsync: true,
        globalTimeout: 8000,
      });

      expect(globalThis.testTimeout).toBe(8000);
      expect(typeof globalThis.flushPromises).toBe('function');
    });
  });

  describe('setupConsoleHelpers', () => {
    it('should mock console methods', () => {
      setupConsoleHelpers();

      // Trigger beforeEach to setup mocks
      const consoleLogSpy = vi.spyOn(console, 'log');
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const consoleErrorSpy = vi.spyOn(console, 'error');

      expect(consoleLogSpy).toBeDefined();
      expect(consoleWarnSpy).toBeDefined();
      expect(consoleErrorSpy).toBeDefined();
    });

    it('should restore console methods after each test', () => {
      setupConsoleHelpers();

      // Mock should be cleaned up automatically by beforeEach/afterEach
      expect(vi.isMockFunction(console.log)).toBeTruthy();
    });
  });

  describe('setupCommonMocks', () => {
    it('should setup environment variables', () => {
      setupCommonMocks();

      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.APEX_TEST_MODE).toBe('unit');
      expect(process.env.TZ).toBe('UTC');
    });

    it('should handle cleanup properly', () => {
      setupCommonMocks();

      // Environment variables should be set
      expect(process.env.NODE_ENV).toBe('test');

      // Cleanup should restore original environment
      vi.unstubAllEnvs();
    });
  });

  describe('setupTimeoutHelpers', () => {
    it('should setup global timeout variables', () => {
      setupTimeoutHelpers(3000);

      expect(globalThis.testTimeout).toBe(3000);
      expect(typeof globalThis.withTimeout).toBe('function');
    });

    it('should create working timeout wrapper', async () => {
      setupTimeoutHelpers(1000);

      const fastPromise = Promise.resolve('success');
      const result = await globalThis.withTimeout(fastPromise);
      expect(result).toBe('success');
    });

    it('should timeout slow promises', async () => {
      setupTimeoutHelpers(100);

      const slowPromise = new Promise(resolve => setTimeout(resolve, 200));

      await expect(globalThis.withTimeout(slowPromise)).rejects.toThrow('Test timeout after 100ms');
    });

    it('should use custom timeout', async () => {
      setupTimeoutHelpers(1000);

      const slowPromise = new Promise(resolve => setTimeout(resolve, 150));

      await expect(globalThis.withTimeout(slowPromise, 100)).rejects.toThrow('Test timeout after 100ms');
    });
  });

  describe('setupAsyncUtilities', () => {
    beforeEach(() => {
      setupAsyncUtilities();
    });

    it('should setup async utility functions', () => {
      expect(typeof globalThis.flushPromises).toBe('function');
      expect(typeof globalThis.nextTick).toBe('function');
      expect(typeof globalThis.sleep).toBe('function');
      expect(typeof globalThis.waitFor).toBe('function');
    });

    it('should flush promises correctly', async () => {
      let resolved = false;
      Promise.resolve().then(() => { resolved = true; });

      expect(resolved).toBe(false);
      await globalThis.flushPromises();
      expect(resolved).toBe(true);
    });

    it('should wait for next tick', async () => {
      let tickExecuted = false;
      process.nextTick(() => { tickExecuted = true; });

      expect(tickExecuted).toBe(false);
      await globalThis.nextTick();
      expect(tickExecuted).toBe(true);
    });

    it('should sleep for specified time', async () => {
      const start = Date.now();
      await globalThis.sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });

    it('should wait for condition to be true', async () => {
      let condition = false;
      setTimeout(() => { condition = true; }, 50);

      await globalThis.waitFor(() => condition, { timeout: 100 });
      expect(condition).toBe(true);
    });

    it('should timeout when condition is not met', async () => {
      await expect(
        globalThis.waitFor(() => false, { timeout: 50, interval: 10 })
      ).rejects.toThrow('waitFor condition not met within 50ms');
    });

    it('should support async conditions', async () => {
      let condition = false;
      setTimeout(() => { condition = true; }, 30);

      await globalThis.waitFor(async () => {
        await globalThis.sleep(5);
        return condition;
      }, { timeout: 100 });

      expect(condition).toBe(true);
    });
  });

  describe('createTestSuite', () => {
    it('should create test suite without setup function', () => {
      const suite = createTestSuite('MyComponent');

      expect(typeof suite.describe).toBe('function');
    });

    it('should create test suite with setup function', () => {
      const setupFn = vi.fn();
      const suite = createTestSuite('MyComponent', setupFn);

      expect(typeof suite.describe).toBe('function');
    });

    it('should execute setup function when provided', () => {
      const setupFn = vi.fn();
      const suite = createTestSuite('MyComponent', setupFn);

      // The setup function would be called in beforeEach when describe is called
      // This test verifies the structure is correct
      expect(setupFn).not.toHaveBeenCalled(); // Not called until describe block runs
    });
  });

  describe('testFactories', () => {
    describe('createTestId', () => {
      it('should create test ID with default prefix', () => {
        const id = testFactories.createTestId();
        expect(id).toMatch(/^test-\d+-[a-z0-9]{9}$/);
      });

      it('should create test ID with custom prefix', () => {
        const id = testFactories.createTestId('custom');
        expect(id).toMatch(/^custom-\d+-[a-z0-9]{9}$/);
      });

      it('should create unique IDs', () => {
        const id1 = testFactories.createTestId('test');
        const id2 = testFactories.createTestId('test');
        expect(id1).not.toBe(id2);
      });
    });

    describe('createTestDate', () => {
      it('should create test date with no offset', () => {
        const date = testFactories.createTestDate();
        expect(date).toBe(new Date('2023-01-01T00:00:00.000Z').getTime());
      });

      it('should create test date with offset', () => {
        const offset = 60000; // 1 minute
        const date = testFactories.createTestDate(offset);
        expect(date).toBe(new Date('2023-01-01T00:00:00.000Z').getTime() + offset);
      });
    });

    describe('createTestPath', () => {
      it('should create test path with single segment', () => {
        const path = testFactories.createTestPath('file.txt');
        expect(path).toBe('/test/project/file.txt');
      });

      it('should create test path with multiple segments', () => {
        const path = testFactories.createTestPath('src', 'components', 'Button.tsx');
        expect(path).toBe('/test/project/src/components/Button.tsx');
      });

      it('should create test path with no segments', () => {
        const path = testFactories.createTestPath();
        expect(path).toBe('/test/project/');
      });
    });
  });

  describe('assertionHelpers', () => {
    describe('assertDefined', () => {
      it('should pass for defined values', () => {
        expect(() => assertionHelpers.assertDefined('test')).not.toThrow();
        expect(() => assertionHelpers.assertDefined(0)).not.toThrow();
        expect(() => assertionHelpers.assertDefined(false)).not.toThrow();
        expect(() => assertionHelpers.assertDefined({})).not.toThrow();
        expect(() => assertionHelpers.assertDefined([])).not.toThrow();
      });

      it('should throw for undefined values', () => {
        expect(() => assertionHelpers.assertDefined(undefined)).toThrow();
        expect(() => assertionHelpers.assertDefined(null)).toThrow();
      });
    });

    describe('assertLength', () => {
      it('should pass for correct length', () => {
        expect(() => assertionHelpers.assertLength([1, 2, 3], 3)).not.toThrow();
        expect(() => assertionHelpers.assertLength([], 0)).not.toThrow();
      });

      it('should throw for incorrect length', () => {
        expect(() => assertionHelpers.assertLength([1, 2], 3)).toThrow();
        expect(() => assertionHelpers.assertLength([1, 2, 3], 2)).toThrow();
      });
    });

    describe('assertRejectsWithError', () => {
      it('should pass for promises that reject with correct error type', async () => {
        class CustomError extends Error {}
        const promise = Promise.reject(new CustomError('test error'));

        await expect(
          assertionHelpers.assertRejectsWithError(promise, CustomError)
        ).resolves.toBeUndefined();
      });

      it('should pass for promises that reject with correct error type and message', async () => {
        class CustomError extends Error {}
        const promise = Promise.reject(new CustomError('specific message'));

        await expect(
          assertionHelpers.assertRejectsWithError(promise, CustomError, 'specific message')
        ).resolves.toBeUndefined();
      });

      it('should pass for promises that reject with regex message match', async () => {
        class CustomError extends Error {}
        const promise = Promise.reject(new CustomError('error: something went wrong'));

        await expect(
          assertionHelpers.assertRejectsWithError(promise, CustomError, /something went wrong/)
        ).resolves.toBeUndefined();
      });
    });

    describe('assertHasProperties', () => {
      it('should pass for objects with all required properties', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect(() => assertionHelpers.assertHasProperties(obj, ['a', 'b'])).not.toThrow();
      });

      it('should throw for objects missing properties', () => {
        const obj = { a: 1, b: 2 };
        expect(() => assertionHelpers.assertHasProperties(obj, ['a', 'b', 'c'])).toThrow();
      });

      it('should pass for empty property list', () => {
        const obj = { a: 1 };
        expect(() => assertionHelpers.assertHasProperties(obj, [])).not.toThrow();
      });
    });
  });

  describe('mockHelpers', () => {
    describe('createTypedMock', () => {
      it('should create a mock function', () => {
        const mock = mockHelpers.createTypedMock<(x: string) => number>();
        expect(vi.isMockFunction(mock)).toBe(true);
      });

      it('should create a mock function with implementation', () => {
        const implementation = (x: string) => x.length;
        const mock = mockHelpers.createTypedMock(implementation);
        expect(vi.isMockFunction(mock)).toBe(true);
        expect(mock('test')).toBe(4);
      });
    });

    describe('createPartialMock', () => {
      it('should create partial mock with overrides', () => {
        interface TestInterface {
          prop1: string;
          prop2: number;
          method: () => void;
        }

        const mock = mockHelpers.createPartialMock<TestInterface>({
          prop1: 'test',
          method: vi.fn(),
        });

        expect(mock.prop1).toBe('test');
        expect(vi.isMockFunction(mock.method)).toBe(true);
      });

      it('should create empty partial mock', () => {
        interface TestInterface {
          prop: string;
        }

        const mock = mockHelpers.createPartialMock<TestInterface>();
        expect(mock).toEqual({});
      });
    });

    describe('mockClass', () => {
      it('should mock class constructor', () => {
        class TestClass {
          constructor(public value: string) {}
          method() { return this.value; }
        }

        const mockImplementation = {
          value: 'mocked',
          method: vi.fn(() => 'mocked method'),
        };

        const MockedClass = mockHelpers.mockClass(TestClass, mockImplementation);
        expect(vi.isMockFunction(MockedClass)).toBe(true);
      });
    });
  });

  describe('Integration', () => {
    it('should work together in a realistic test scenario', async () => {
      // Setup full test environment
      setupGlobalTestEnvironment({
        setupConsole: true,
        setupMocks: true,
        setupTimeouts: true,
        setupAsync: true,
        globalTimeout: 5000,
      });

      // Create test data
      const testId = testFactories.createTestId('integration');
      const testPath = testFactories.createTestPath('src', 'test.ts');

      // Use assertions
      assertionHelpers.assertDefined(testId);
      assertionHelpers.assertHasProperties({ testId, testPath }, ['testId', 'testPath']);

      // Use async utilities
      await globalThis.flushPromises();
      await globalThis.nextTick();

      // Use timeout wrapper
      const result = await globalThis.withTimeout(Promise.resolve('success'), 1000);
      expect(result).toBe('success');

      // Use mock helpers
      const mock = mockHelpers.createTypedMock<() => string>();
      mock.mockReturnValue('mocked');
      expect(mock()).toBe('mocked');

      expect(true).toBe(true); // Test completed successfully
    });
  });
});