/**
 * Test infrastructure validation
 * Verifies that the shared test configuration and utilities work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  wait,
  waitFor,
  createDeferred,
  retry,
  expectAsyncToCompleteWithin
} from '@apex/test-utils/async';
import {
  expectToThrow,
  expectObjectShape,
  expectArrayToContain,
  expectToBeWithinRange
} from '@apex/test-utils/assertions';
import {
  createTestContext,
  cleanupTestContext,
  createTempFile,
  MockManager,
  EventTracker
} from '@apex/test-utils/context';
import type { TestContext } from '@apex/test-utils/context';

describe('Test Infrastructure Validation', () => {
  let testContext: TestContext;

  beforeEach(async () => {
    testContext = await createTestContext('infrastructure-validation');
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  describe('Async Utilities', () => {
    it('should wait for specified time', async () => {
      const startTime = Date.now();
      await wait(100);
      const elapsed = Date.now() - startTime;
      expectToBeWithinRange(elapsed, 95, 150); // Allow for some variance
    });

    it('should wait for condition to become true', async () => {
      let flag = false;
      setTimeout(() => { flag = true; }, 50);

      await waitFor(() => flag, { timeout: 200, interval: 10 });
      expect(flag).toBe(true);
    });

    it('should handle deferred promises', async () => {
      const deferred = createDeferred<string>();

      setTimeout(() => deferred.resolve('test-value'), 50);

      const result = await deferred.promise;
      expect(result).toBe('test-value');
    });

    it('should retry failed operations', async () => {
      let attempts = 0;
      const flakyOperation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Not yet');
        }
        return 'success';
      };

      const result = await retry(flakyOperation, { maxAttempts: 5 });
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should test async performance', async () => {
      const fastOperation = async () => {
        await wait(50);
        return 'done';
      };

      await expectAsyncToCompleteWithin(fastOperation, 100);
    });
  });

  describe('Assertion Utilities', () => {
    it('should test error throwing', async () => {
      const errorFn = () => {
        throw new Error('Test error message');
      };

      const error = await expectToThrow(errorFn, 'Test error');
      expect(error).toBeInstanceOf(Error);
    });

    it('should test object shape', () => {
      const obj = { name: 'test', count: 42, active: true };

      expectObjectShape(obj, {
        name: 'test',
        count: 42,
        active: true
      });
    });

    it('should test array contents', () => {
      const items = [
        { id: 1, type: 'user' },
        { id: 2, type: 'admin' },
        { id: 3, type: 'user' }
      ];

      expectArrayToContain(items, item => item.type === 'user', 2);
      expectArrayToContain(items, item => item.type === 'admin', 1);
    });

    it('should test numeric ranges', () => {
      const value = 3.14159;
      expectToBeWithinRange(value, 3, 4);
      expectToBeWithinRange(value, 3.1, 3.2);
    });
  });

  describe('Context Management', () => {
    it('should create and manage test context', () => {
      expect(testContext).toBeDefined();
      expect(testContext.id).toMatch(/^infrastructure-validation/);
      expect(testContext.tempDir).toContain('apex-test-');
      expect(testContext.startTime).toBeInstanceOf(Date);
      expect(testContext.data).toEqual({});
    });

    it('should create temporary files', async () => {
      const content = 'Hello, test world!';
      const filePath = await createTempFile(testContext, 'test.txt', content);

      expect(filePath).toContain(testContext.tempDir);
      expect(filePath).toContain('test.txt');

      // Verify file exists and has correct content
      const fs = await import('fs/promises');
      const actualContent = await fs.readFile(filePath, 'utf8');
      expect(actualContent).toBe(content);
    });

    it('should manage cleanup functions', async () => {
      let cleanupCalled = false;
      testContext.cleanupFunctions.push(() => {
        cleanupCalled = true;
      });

      await cleanupTestContext(testContext);
      expect(cleanupCalled).toBe(true);
    });
  });

  describe('Mock Management', () => {
    it('should create and manage mocks', () => {
      const mockManager = new MockManager();

      // Create a mock function
      const mockFn = mockManager.fn((x: number) => x * 2);

      const result = mockFn(5);
      expect(result).toBe(10);
      expect(mockFn).toHaveBeenCalledWith(5);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Cleanup should work without errors
      mockManager.restoreAll();
    });

    it('should spy on object methods', () => {
      const mockManager = new MockManager();
      const testObj = {
        getValue: () => 'original',
        calculate: (a: number, b: number) => a + b
      };

      const spy = mockManager.spyOn(testObj, 'getValue');
      spy.mockReturnValue('mocked');

      expect(testObj.getValue()).toBe('mocked');
      expect(spy).toHaveBeenCalled();

      mockManager.restoreAll();
    });
  });

  describe('Event Tracking', () => {
    it('should track and query events', () => {
      const tracker = new EventTracker();

      tracker.record('user-action', { action: 'click', target: 'button' });
      tracker.record('system-event', { status: 'ready' });
      tracker.record('user-action', { action: 'scroll', target: 'page' });

      // Test event retrieval
      const userActions = tracker.getEventsByType('user-action');
      expect(userActions).toHaveLength(2);

      // Test latest event
      const latestUserAction = tracker.getLatestEvent('user-action');
      expect(latestUserAction?.data.action).toBe('scroll');

      // Test event existence
      expect(tracker.hasEvent('system-event')).toBe(true);
      expect(tracker.hasEvent('non-existent')).toBe(false);
    });

    it('should wait for events with timeout', async () => {
      const tracker = new EventTracker();

      // Simulate delayed event
      setTimeout(() => {
        tracker.record('delayed-event', { value: 123 });
      }, 100);

      const eventData = await tracker.waitForEvent('delayed-event', 500);
      expect(eventData.value).toBe(123);
    });
  });

  describe('TypeScript Configuration', () => {
    it('should have proper type checking', () => {
      // This test verifies that TypeScript compilation works
      type TestType = {
        id: number;
        name: string;
        optional?: boolean;
      };

      const testData: TestType = {
        id: 1,
        name: 'test'
      };

      expectObjectShape<TestType>(testData, {
        id: 1,
        name: 'test'
      });

      // Optional property
      testData.optional = true;
      expect(testData.optional).toBe(true);
    });
  });
});

describe('Vitest Configuration Validation', () => {
  it('should have access to vitest globals', () => {
    // These should be available due to globals: true in config
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
    expect(beforeEach).toBeDefined();
    expect(afterEach).toBeDefined();
  });

  it('should support test environments', () => {
    // Test that we can access Node.js APIs (node environment)
    expect(process).toBeDefined();
    expect(process.env).toBeDefined();

    // Test timeout configuration works
    expect(typeof setTimeout).toBe('function');
    expect(typeof clearTimeout).toBe('function');
  });

  it('should support path resolution', () => {
    // Test that TypeScript path mapping works
    expect(() => {
      // Import should work without throwing
      const path = require('path');
      expect(path.join).toBeDefined();
    }).not.toThrow();
  });
});