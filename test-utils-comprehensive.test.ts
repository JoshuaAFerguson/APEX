/**
 * Comprehensive test utilities validation
 * Tests edge cases, error conditions, and advanced functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  wait,
  waitFor,
  waitForPromise,
  createDeferred,
  retry,
  sequence,
  parallel,
  createAsyncMock,
  createAsyncErrorMock,
  expectAsyncToCompleteWithin,
  expectAsyncToTakeAtLeast
} from '@apex/test-utils/async';
import {
  expectToThrow,
  expectObjectShape,
  expectArrayToContain,
  expectArrayToBeSorted,
  expectToHaveBeenCalledWithShape,
  expectToBeWithinRange,
  expectDatesToBeClose,
  expectStringToMatchPattern,
  expectEventsToHaveBeenEmitted,
  expectPathToExist,
  expectToResolveWithin,
  expectToBeOneOf,
  expectToHaveExactShape
} from '@apex/test-utils/assertions';
import {
  createTestContext,
  createExtendedTestContext,
  createDatabaseTestContext,
  cleanupTestContext,
  addCleanup,
  createTempFile,
  createTempDir,
  MockManager,
  EventTracker,
  TestTimer,
  createTestTimer,
  withRetry
} from '@apex/test-utils/context';
import type { TestContext, ExtendedTestContext, DatabaseTestContext } from '@apex/test-utils/context';

describe('Comprehensive Test Utilities', () => {
  describe('Advanced Async Utilities', () => {
    it('should handle promise timeouts', async () => {
      const slowPromise = new Promise(resolve => setTimeout(resolve, 1000));

      await expectToThrow(
        () => waitForPromise(slowPromise, 100),
        'Promise timed out after 100ms'
      );
    });

    it('should execute functions in sequence', async () => {
      const results: number[] = [];
      const functions = [
        async () => { results.push(1); return 1; },
        async () => { results.push(2); return 2; },
        async () => { results.push(3); return 3; }
      ];

      const sequenceResults = await sequence(functions);
      expect(results).toEqual([1, 2, 3]);
      expect(sequenceResults).toEqual([1, 2, 3]);
    });

    it('should execute functions in parallel', async () => {
      const startTime = Date.now();
      const functions = [
        () => wait(50).then(() => 'a'),
        () => wait(100).then(() => 'b'),
        () => wait(75).then(() => 'c')
      ];

      const results = await parallel(functions, 200);
      const elapsed = Date.now() - startTime;

      expect(results).toEqual(['a', 'b', 'c']);
      expect(elapsed).toBeLessThan(150); // Should be roughly 100ms (longest delay)
    });

    it('should create async mocks', async () => {
      const mockFn = createAsyncMock('test-value', 50);
      const errorFn = createAsyncErrorMock('test-error', 50);

      const result = await mockFn();
      expect(result).toBe('test-value');

      await expectToThrow(() => errorFn(), 'test-error');
    });

    it('should test async performance', async () => {
      const fastOp = async () => {
        await wait(30);
        return 'fast';
      };

      const slowOp = async () => {
        await wait(120);
        return 'slow';
      };

      await expectAsyncToCompleteWithin(fastOp, 50);
      await expectAsyncToTakeAtLeast(slowOp, 100);
    });

    it('should handle waitFor edge cases', async () => {
      // Test condition that throws initially but then succeeds
      let attempts = 0;
      const condition = () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Not ready');
        }
        return true;
      };

      await waitFor(condition, { timeout: 1000, interval: 10 });
      expect(attempts).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Advanced Assertion Utilities', () => {
    it('should test array sorting', () => {
      const numbers = [1, 3, 5, 7, 9];
      const dates = [
        new Date('2023-01-01'),
        new Date('2023-06-15'),
        new Date('2023-12-31')
      ];
      const objects = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
        { name: 'Charlie', age: 35 }
      ];

      expectArrayToBeSorted(numbers, x => x, 'asc');
      expectArrayToBeSorted(dates, x => x, 'asc');
      expectArrayToBeSorted(objects, x => x.age, 'asc');

      // Test descending order
      const reversed = [...numbers].reverse();
      expectArrayToBeSorted(reversed, x => x, 'desc');
    });

    it('should test spy call shapes', () => {
      const spy = vi.fn();

      spy({ id: 1, name: 'test' }, 'action', true);

      expectToHaveBeenCalledWithShape(spy, [
        { id: 1, name: 'test' },
        'action',
        true
      ]);
    });

    it('should test date proximity', () => {
      const now = new Date();
      const almostNow = new Date(now.getTime() + 500);
      const wayLater = new Date(now.getTime() + 5000);

      expectDatesToBeClose(now, almostNow, 1000);

      // This should throw
      await expectToThrow(() =>
        expectDatesToBeClose(now, wayLater, 1000)
      );
    });

    it('should test string patterns with variables', () => {
      const template = 'User {name} has {count} items';
      const actual = 'User Alice has 5 items';

      expectStringToMatchPattern(actual, template, {
        name: 'Alice',
        count: '5'
      });
    });

    it('should test event emission', () => {
      const tracker = { events: [
        { type: 'start', data: { id: 1 } },
        { type: 'progress', data: { percent: 50 } },
        { type: 'complete', data: { id: 1, success: true } }
      ]};

      expectEventsToHaveBeenEmitted(tracker, [
        'start',
        { type: 'complete', data: { id: 1, success: true } },
        'progress'
      ]);
    });

    it('should test path existence', async () => {
      const context = await createTestContext('path-test');
      const filePath = await createTempFile(context, 'test-file.txt', 'content');
      const dirPath = await createTempDir(context, 'test-dir');

      await expectPathToExist(filePath, { isFile: true });
      await expectPathToExist(dirPath, { isDirectory: true });

      await cleanupTestContext(context);
    });

    it('should test promise resolution with timeout', async () => {
      const promise = new Promise(resolve =>
        setTimeout(() => resolve('resolved'), 50)
      );

      await expectToResolveWithin(promise, 'resolved', 200);
    });

    it('should test one-of values', () => {
      expectToBeOneOf('apple', ['apple', 'banana', 'orange']);
      expectToBeOneOf(42, [1, 2, 42, 100]);

      // This should throw
      await expectToThrow(() =>
        expectToBeOneOf('grape', ['apple', 'banana'])
      );
    });

    it('should test exact object shape', () => {
      const user = { id: 1, name: 'John', email: 'john@test.com' };

      expectToHaveExactShape(user, ['id', 'name', 'email']);

      // Test with unexpected property
      const userWithExtra = { ...user, extra: 'value' };
      await expectToThrow(() =>
        expectToHaveExactShape(userWithExtra, ['id', 'name', 'email'])
      );
    });
  });

  describe('Extended Context Management', () => {
    let extendedContext: ExtendedTestContext;

    beforeEach(async () => {
      extendedContext = await createExtendedTestContext('extended-test');
    });

    afterEach(async () => {
      await cleanupTestContext(extendedContext);
    });

    it('should manage extended context with mocks', () => {
      expect(extendedContext.mocks).toBeInstanceOf(MockManager);
      expect(extendedContext.id).toMatch(/^extended-test/);
    });

    it('should handle mock lifecycle', () => {
      const testObj = { getValue: () => 'original' };
      const spy = extendedContext.mocks.spyOn(testObj, 'getValue');

      spy.mockReturnValue('mocked');
      expect(testObj.getValue()).toBe('mocked');

      // Cleanup is automatic in extended context
    });

    it('should support custom cleanup functions', async () => {
      let cleanupExecuted = false;

      addCleanup(extendedContext, () => {
        cleanupExecuted = true;
      });

      await cleanupTestContext(extendedContext);
      expect(cleanupExecuted).toBe(true);
    });
  });

  describe('Database Context', () => {
    let dbContext: DatabaseTestContext;

    beforeEach(async () => {
      dbContext = await createDatabaseTestContext('db-test');
    });

    afterEach(async () => {
      await cleanupTestContext(dbContext);
    });

    it('should provide database path', () => {
      expect(dbContext.dbPath).toBeDefined();
      expect(dbContext.dbPath).toContain('test.db');
      expect(dbContext.dbPath).toContain(dbContext.tempDir);
    });

    it('should have all extended context features', () => {
      expect(dbContext.mocks).toBeInstanceOf(MockManager);
      expect(dbContext.cleanupFunctions).toBeDefined();
      expect(dbContext.data).toBeDefined();
    });
  });

  describe('Event Tracker Advanced Features', () => {
    let tracker: EventTracker;

    beforeEach(() => {
      tracker = new EventTracker();
    });

    it('should handle event filtering and queries', () => {
      tracker.record('user-action', { userId: 1, action: 'click' });
      tracker.record('user-action', { userId: 2, action: 'scroll' });
      tracker.record('system-event', { type: 'error', code: 500 });
      tracker.record('user-action', { userId: 1, action: 'hover' });

      // Filter by type
      const userActions = tracker.getEventsByType('user-action');
      expect(userActions).toHaveLength(3);

      // Check specific event existence
      expect(tracker.hasEvent('user-action', { userId: 1, action: 'click' })).toBe(true);
      expect(tracker.hasEvent('user-action', { userId: 3, action: 'click' })).toBe(false);

      // Get latest events
      const latestUserAction = tracker.getLatestEvent('user-action');
      expect(latestUserAction?.data.action).toBe('hover');
    });

    it('should handle event waiting with predicates', async () => {
      // Start tracking
      setTimeout(() => {
        tracker.record('status-change', { status: 'loading' });
      }, 50);

      setTimeout(() => {
        tracker.record('status-change', { status: 'complete' });
      }, 100);

      // Wait for specific event
      const eventData = await tracker.waitForEvent(
        'status-change',
        500,
        data => data.status === 'complete'
      );

      expect(eventData.status).toBe('complete');
    });

    it('should timeout when waiting for events', async () => {
      await expectToThrow(
        () => tracker.waitForEvent('non-existent-event', 100),
        'was not recorded within 100ms'
      );
    });

    it('should clear events', () => {
      tracker.record('event1', { data: 'test' });
      tracker.record('event2', { data: 'test' });

      expect(tracker.events).toHaveLength(2);

      tracker.clear();
      expect(tracker.events).toHaveLength(0);
    });
  });

  describe('Test Timers', () => {
    let context: TestContext;

    beforeEach(async () => {
      context = await createTestContext('timer-test');
    });

    afterEach(async () => {
      await cleanupTestContext(context);
    });

    it('should measure elapsed time', () => {
      const timer = createTestTimer(context, 'test-timer');

      timer.start();
      // Simulate some work (sync)
      const work = Array.from({ length: 10000 }, (_, i) => i * 2);
      timer.stop();

      const elapsed = timer.getElapsed();
      expect(elapsed).toBeGreaterThan(0);
      expect(work).toHaveLength(10000);
    });

    it('should reset timers', () => {
      const timer = createTestTimer(context, 'reset-timer');

      timer.start();
      setTimeout(() => timer.stop(), 50);

      const initialElapsed = timer.getElapsed();
      timer.reset();

      expect(timer.getElapsed()).toBe(0);
      expect(initialElapsed).toBeGreaterThan(0);
    });

    it('should store timers in context', () => {
      const timer = createTestTimer(context, 'stored-timer');

      expect(context.data.timer_stored-timer).toBe(timer);
    });
  });

  describe('Retry Utilities', () => {
    it('should retry operations with backoff', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return 'success';
      };

      const result = await withRetry(operation, 5, 10);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail after max attempts', async () => {
      const operation = async () => {
        throw new Error('Always fails');
      };

      await expectToThrow(
        () => withRetry(operation, 2, 5),
        'Always fails'
      );
    });

    it('should handle successful first attempt', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        return 'immediate-success';
      };

      const result = await withRetry(operation, 3, 10);
      expect(result).toBe('immediate-success');
      expect(attempts).toBe(1);
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should support complex testing workflows', async () => {
      const context = await createExtendedTestContext('complex-workflow');
      const tracker = new EventTracker();
      const timer = createTestTimer(context, 'workflow-timer');

      try {
        timer.start();

        // Simulate async workflow
        tracker.record('workflow-start', { id: 'test-123' });

        const mockService = {
          process: async (data: any) => {
            await wait(50);
            return { processed: true, ...data };
          }
        };

        const spy = context.mocks.spyOn(mockService, 'process');

        const result = await mockService.process({ value: 42 });
        timer.stop();

        tracker.record('workflow-complete', { result, duration: timer.getElapsed() });

        // Assertions
        expect(result.processed).toBe(true);
        expect(result.value).toBe(42);
        expect(spy).toHaveBeenCalledWith({ value: 42 });

        expectEventsToHaveBeenEmitted(tracker, [
          'workflow-start',
          'workflow-complete'
        ]);

        const elapsedTime = timer.getElapsed();
        expectToBeWithinRange(elapsedTime, 45, 100);

      } finally {
        await cleanupTestContext(context);
      }
    });

    it('should handle error scenarios gracefully', async () => {
      const context = await createExtendedTestContext('error-scenario');
      const tracker = new EventTracker();

      try {
        tracker.record('error-test-start');

        const errorService = {
          riskyOperation: async () => {
            throw new Error('Service unavailable');
          }
        };

        const spy = context.mocks.spyOn(errorService, 'riskyOperation');

        const error = await expectToThrow(
          () => errorService.riskyOperation(),
          'Service unavailable'
        );

        tracker.record('error-caught', { error: error.message });

        expect(spy).toHaveBeenCalled();
        expect(tracker.hasEvent('error-caught')).toBe(true);

      } finally {
        await cleanupTestContext(context);
      }
    });
  });
});