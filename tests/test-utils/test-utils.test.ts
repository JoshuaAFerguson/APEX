/**
 * Test for test utilities to verify they work correctly
 */

import { describe, it, expect } from 'vitest';
import {
  // Async utilities
  wait,
  waitFor,
  createDeferred,
  retry,
  // Assertion helpers
  expectToThrow,
  expectObjectShape,
  expectToBeWithinRange,
  // Context management
  createTestContext,
  cleanupTestContext,
  createExtendedTestContext,
  EventTracker,
  TestTimer,
  // Cleanup utilities
  createCleanupManager,
  CleanupRegistry,
  // Main exports
  createTestEnvironment,
  setupTest,
  testFixtures,
  testUtils,
} from './index';

describe('Test Utils - Async Utilities', () => {
  it('wait should delay execution', async () => {
    const start = Date.now();
    await wait(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45); // Allow for small timing variance
  });

  it('waitFor should wait for condition to be true', async () => {
    let condition = false;
    setTimeout(() => { condition = true; }, 50);

    await waitFor(() => condition, { timeout: 100 });
    expect(condition).toBe(true);
  });

  it('createDeferred should create externally controllable promise', async () => {
    const deferred = createDeferred<string>();

    setTimeout(() => deferred.resolve('test'), 10);

    const result = await deferred.promise;
    expect(result).toBe('test');
  });

  it('retry should retry on failure', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Not yet');
      }
      return 'success';
    };

    const result = await retry(operation, { maxAttempts: 3, delay: 1 });
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
});

describe('Test Utils - Assertion Helpers', () => {
  it('expectToThrow should verify error throwing', async () => {
    const error = await expectToThrow(() => {
      throw new Error('Test error');
    }, 'Test error');

    expect(error.message).toBe('Test error');
  });

  it('expectObjectShape should verify object structure', () => {
    const obj = { name: 'test', age: 25, active: true };
    expectObjectShape(obj, { name: 'test', age: 25 });
  });

  it('expectToBeWithinRange should verify numeric ranges', () => {
    expectToBeWithinRange(50, 0, 100);
    expectToBeWithinRange(75, 50, 100);

    expect(() => expectToBeWithinRange(150, 0, 100)).toThrow();
  });
});

describe('Test Utils - Context Management', () => {
  it('should create and cleanup test context', async () => {
    const context = await createTestContext();

    expect(context.id).toBeDefined();
    expect(context.tempDir).toBeDefined();
    expect(context.data).toEqual({});
    expect(context.startTime).toBeInstanceOf(Date);

    await cleanupTestContext(context);
  });

  it('should create extended test context with mocks', async () => {
    const context = await createExtendedTestContext();

    expect(context.mocks).toBeDefined();
    expect(typeof context.mocks.fn).toBe('function');
    expect(typeof context.mocks.restoreAll).toBe('function');

    await cleanupTestContext(context);
  });

  it('should track events with EventTracker', () => {
    const tracker = new EventTracker();

    tracker.record('test-event', { data: 'test' });

    expect(tracker.hasEvent('test-event')).toBe(true);
    expect(tracker.getEventsByType('test-event')).toHaveLength(1);
  });

  it('should measure time with TestTimer', () => {
    const timer = new TestTimer();
    timer.start();

    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Busy wait for 10ms
    }

    const elapsed = timer.stop();
    expect(elapsed).toBeGreaterThanOrEqual(5);
  });
});

describe('Test Utils - Cleanup Utilities', () => {
  it('should create cleanup manager', () => {
    const cleanup = createCleanupManager();

    expect(cleanup.registry).toBeInstanceOf(CleanupRegistry);
    expect(cleanup.fileSystem).toBeDefined();
    expect(cleanup.environment).toBeDefined();
    expect(cleanup.mocks).toBeDefined();
    expect(cleanup.timers).toBeDefined();
  });

  it('should register and execute cleanup functions', async () => {
    const registry = new CleanupRegistry();
    let cleaned = false;

    registry.add(() => { cleaned = true; });
    await registry.cleanup();

    expect(cleaned).toBe(true);
  });
});

describe('Test Utils - Integration', () => {
  it('should create complete test environment', async () => {
    const env = await createTestEnvironment();

    expect(env.context).toBeDefined();
    expect(env.cleanup).toBeDefined();
    expect(env.tempDir).toBeDefined();
    expect(env.mocks).toBeDefined();

    await env.cleanup.cleanup();
    await cleanupTestContext(env.context);
  });

  it('should provide test fixtures', () => {
    expect(testFixtures.sampleTask).toBeDefined();
    expect(testFixtures.sampleConfig).toBeDefined();
    expect(testFixtures.sampleAgent).toBeDefined();
    expect(testFixtures.sampleWorkflow).toBeDefined();

    expect(testFixtures.sampleTask.id).toBe('test-task-123');
    expect(testFixtures.sampleConfig.project.name).toBe('test-project');
  });

  it('should provide test utilities', () => {
    expect(testUtils.generateTestId).toBeTypeOf('function');
    expect(testUtils.mockPath).toBeTypeOf('function');
    expect(testUtils.testDate).toBeTypeOf('function');

    const testId = testUtils.generateTestId();
    expect(testId).toMatch(/^test_\d+_[a-z0-9]+$/);

    const mockPath = testUtils.mockPath('a', 'b', 'c');
    expect(mockPath).toBe('a/b/c');

    const testDate = testUtils.testDate();
    expect(testDate).toBeInstanceOf(Date);
  });
});