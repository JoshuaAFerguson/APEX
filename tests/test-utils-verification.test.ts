/**
 * Verification test to ensure test utilities meet acceptance criteria
 */

import { describe, it, expect } from 'vitest';

// Test that we can import from the central test-utils location
import {
  // Async utilities
  wait,
  waitFor,
  createDeferred,
  retry,
  sequence,
  parallel,
  // Assertion helpers
  expectToThrow,
  expectObjectShape,
  expectArrayToContain,
  expectToBeWithinRange,
  expectDatesToBeClose,
  // Test context management
  createTestContext,
  cleanupTestContext,
  createExtendedTestContext,
  createDatabaseTestContext,
  TestContext,
  ExtendedTestContext,
  EventTracker,
  MockManager,
  TestTimer,
  // Cleanup utilities
  createCleanupManager,
  CleanupRegistry,
  CleanupManager,
  FileSystemCleanup,
  ProcessCleanup,
  EnvironmentCleanup,
  MockCleanup,
  TimerCleanup,
  withCleanup,
  // Main integration functions
  createTestEnvironment,
  setupTest,
  runWithCleanup,
  testFixtures,
  testUtils,
} from './test-utils/index';

describe('Test Utils Acceptance Criteria Verification', () => {
  describe('Async Utilities', () => {
    it('should provide wait function for time delays', async () => {
      expect(typeof wait).toBe('function');
      const start = Date.now();
      await wait(10);
      expect(Date.now() - start).toBeGreaterThanOrEqual(8);
    });

    it('should provide waitFor function for condition polling', async () => {
      expect(typeof waitFor).toBe('function');
      let condition = false;
      setTimeout(() => { condition = true; }, 20);
      await waitFor(() => condition, { timeout: 100 });
      expect(condition).toBe(true);
    });

    it('should provide createDeferred for promise control', async () => {
      expect(typeof createDeferred).toBe('function');
      const { promise, resolve } = createDeferred<string>();
      resolve('test');
      const result = await promise;
      expect(result).toBe('test');
    });

    it('should provide retry function for flaky operations', async () => {
      expect(typeof retry).toBe('function');
      let attempts = 0;
      const result = await retry(async () => {
        attempts++;
        if (attempts < 2) throw new Error('retry');
        return 'success';
      }, { maxAttempts: 3, delay: 1 });
      expect(result).toBe('success');
    });

    it('should provide sequence function for serial execution', async () => {
      expect(typeof sequence).toBe('function');
      const results = await sequence([
        async () => 'first',
        async () => 'second',
      ]);
      expect(results).toEqual(['first', 'second']);
    });

    it('should provide parallel function for concurrent execution', async () => {
      expect(typeof parallel).toBe('function');
      const results = await parallel([
        async () => 'first',
        async () => 'second',
      ]);
      expect(results).toEqual(['first', 'second']);
    });
  });

  describe('Assertion Helpers', () => {
    it('should provide expectToThrow for error verification', async () => {
      expect(typeof expectToThrow).toBe('function');
      const error = await expectToThrow(() => {
        throw new Error('test error');
      });
      expect(error.message).toBe('test error');
    });

    it('should provide expectObjectShape for object structure validation', () => {
      expect(typeof expectObjectShape).toBe('function');
      const obj = { a: 1, b: 'test' };
      expectObjectShape(obj, { a: 1 }); // Should not throw
    });

    it('should provide expectArrayToContain for array content validation', () => {
      expect(typeof expectArrayToContain).toBe('function');
      const arr = [1, 2, 3, 4];
      expectArrayToContain(arr, (n: number) => n > 2, 2);
    });

    it('should provide expectToBeWithinRange for numeric validation', () => {
      expect(typeof expectToBeWithinRange).toBe('function');
      expectToBeWithinRange(50, 0, 100); // Should not throw
    });

    it('should provide expectDatesToBeClose for timestamp validation', () => {
      expect(typeof expectDatesToBeClose).toBe('function');
      const now = new Date();
      const close = new Date(now.getTime() + 100);
      expectDatesToBeClose(now, close, 500);
    });
  });

  describe('Test Context Management', () => {
    it('should provide createTestContext function', async () => {
      expect(typeof createTestContext).toBe('function');
      const context = await createTestContext();
      expect(context).toMatchObject({
        id: expect.any(String),
        tempDir: expect.any(String),
        cleanupFunctions: expect.any(Array),
        data: expect.any(Object),
        startTime: expect.any(Date),
      });
      await cleanupTestContext(context);
    });

    it('should provide createExtendedTestContext with mock management', async () => {
      expect(typeof createExtendedTestContext).toBe('function');
      const context = await createExtendedTestContext();
      expect(context.mocks).toBeInstanceOf(MockManager);
      expect(typeof context.mocks.fn).toBe('function');
      expect(typeof context.mocks.spyOn).toBe('function');
      await cleanupTestContext(context);
    });

    it('should provide createDatabaseTestContext', async () => {
      expect(typeof createDatabaseTestContext).toBe('function');
      const context = await createDatabaseTestContext();
      expect(context.dbPath).toMatch(/test\.db$/);
      await cleanupTestContext(context);
    });

    it('should provide EventTracker for event testing', () => {
      expect(EventTracker).toBeDefined();
      const tracker = new EventTracker();
      tracker.record('test', { data: 'test' });
      expect(tracker.hasEvent('test')).toBe(true);
    });

    it('should provide TestTimer for timing tests', () => {
      expect(TestTimer).toBeDefined();
      const timer = new TestTimer();
      timer.start();
      const elapsed = timer.stop();
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cleanup Utilities', () => {
    it('should provide createCleanupManager function', () => {
      expect(typeof createCleanupManager).toBe('function');
      const cleanup = createCleanupManager();
      expect(cleanup).toBeInstanceOf(CleanupManager);
      expect(cleanup.registry).toBeInstanceOf(CleanupRegistry);
    });

    it('should provide CleanupRegistry for cleanup management', async () => {
      expect(CleanupRegistry).toBeDefined();
      const registry = new CleanupRegistry();
      let cleaned = false;
      registry.add(() => { cleaned = true; });
      await registry.cleanup();
      expect(cleaned).toBe(true);
    });

    it('should provide specialized cleanup utilities', () => {
      expect(FileSystemCleanup).toBeDefined();
      expect(ProcessCleanup).toBeDefined();
      expect(EnvironmentCleanup).toBeDefined();
      expect(MockCleanup).toBeDefined();
      expect(TimerCleanup).toBeDefined();
    });

    it('should provide withCleanup helper', async () => {
      expect(typeof withCleanup).toBe('function');
      let cleanupCalled = false;
      await withCleanup(async (cleanup) => {
        cleanup.add(() => { cleanupCalled = true; });
        return 'result';
      });
      expect(cleanupCalled).toBe(true);
    });
  });

  describe('Central Export Location', () => {
    it('should provide createTestEnvironment for complete setup', async () => {
      expect(typeof createTestEnvironment).toBe('function');
      const env = await createTestEnvironment();
      expect(env.context).toBeDefined();
      expect(env.cleanup).toBeDefined();
      expect(env.tempDir).toBeDefined();
      await env.cleanup.cleanup();
    });

    it('should provide setupTest for minimal setup', async () => {
      expect(typeof setupTest).toBe('function');
      const setup = await setupTest();
      expect(setup.context).toBeDefined();
      expect(setup.cleanup).toBeDefined();
      expect(setup.tempDir).toBeDefined();
      await setup.cleanup.cleanup();
    });

    it('should provide runWithCleanup for test execution', async () => {
      expect(typeof runWithCleanup).toBe('function');
      const result = await runWithCleanup(async (env) => {
        expect(env.context).toBeDefined();
        return 'test-result';
      });
      expect(result).toBe('test-result');
    });

    it('should provide testFixtures for common test data', () => {
      expect(testFixtures).toBeDefined();
      expect(testFixtures.sampleTask).toMatchObject({
        id: expect.any(String),
        description: expect.any(String),
        status: 'pending',
      });
      expect(testFixtures.sampleConfig).toMatchObject({
        version: expect.any(String),
        project: expect.any(Object),
      });
    });

    it('should provide testUtils for common utilities', () => {
      expect(testUtils).toBeDefined();
      expect(typeof testUtils.generateTestId).toBe('function');
      expect(typeof testUtils.mockPath).toBe('function');
      expect(typeof testUtils.testDate).toBe('function');

      const testId = testUtils.generateTestId();
      expect(testId).toMatch(/test_\d+_[a-z0-9]+/);
    });
  });

  describe('Integration and Usage', () => {
    it('should support complete test workflow', async () => {
      // Create test environment
      const env = await createTestEnvironment({
        contextId: 'integration-test',
        withMocks: true,
      });

      // Use async utilities
      const deferred = createDeferred<string>();
      setTimeout(() => deferred.resolve('async-result'), 10);
      const asyncResult = await deferred.promise;

      // Use assertion helpers
      expectObjectShape(env.context, {
        id: 'integration-test',
        tempDir: expect.any(String),
      });

      // Use context for test data
      env.context.data.testResult = asyncResult;

      // Use cleanup
      let cleanupExecuted = false;
      env.cleanup.add(() => { cleanupExecuted = true; });

      await env.cleanup.cleanup();
      expect(cleanupExecuted).toBe(true);
      expect(asyncResult).toBe('async-result');
    });

    it('should work with runWithCleanup pattern', async () => {
      const result = await runWithCleanup(async (env) => {
        // Create temporary file
        const filePath = await env.cleanup.fileSystem.createTempFile('test.txt', 'test content');
        env.context.data.filePath = filePath;

        // Use event tracker
        const tracker = new EventTracker();
        tracker.record('file-created', { path: filePath });

        // Assert event was recorded
        expect(tracker.hasEvent('file-created')).toBe(true);

        return { success: true, filePath };
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
    });
  });
});