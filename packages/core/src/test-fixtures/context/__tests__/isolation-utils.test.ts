/**
 * @fileoverview Tests for Advanced Isolation Utilities
 *
 * These tests validate the isolation utilities work correctly for:
 * - Concurrent test execution
 * - State tracking and snapshots
 * - Mock registry patterns
 * - Resource locking
 * - Environment isolation
 * - Test data factories
 * - Cleanup orchestration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createIsolatedExecution,
  withIsolatedContext,
  createStateTracker,
  createMockRegistry,
  createResourceLock,
  withLock,
  withEnvironment,
  withEnvironmentSync,
  createTestDataFactory,
  createCleanupOrchestrator,
} from '../isolation-utils.js';

describe('Isolation Utilities', () => {
  describe('createIsolatedExecution', () => {
    it('should provide an isolated TestContext', async () => {
      let capturedTestId: string = '';

      await createIsolatedExecution(async (ctx) => {
        capturedTestId = ctx.testId;
        expect(ctx.testId).toBeDefined();
        expect(ctx.testId).toMatch(/^test_\d+_[a-z0-9]+$/);
      });

      expect(capturedTestId).toBeDefined();
    });

    it('should cleanup context after execution', async () => {
      let wasCleanedUp = false;

      await createIsolatedExecution(async (ctx) => {
        ctx.addCleanupTask(() => {
          wasCleanedUp = true;
        });
      });

      expect(wasCleanedUp).toBe(true);
    });

    it('should cleanup even if executor throws', async () => {
      let wasCleanedUp = false;

      try {
        await createIsolatedExecution(async (ctx) => {
          ctx.addCleanupTask(() => {
            wasCleanedUp = true;
          });
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      expect(wasCleanedUp).toBe(true);
    });

    it('should return the executor result', async () => {
      const result = await createIsolatedExecution(async (ctx) => {
        return ctx.uniqueId('result');
      });

      expect(result).toMatch(/^result_test_/);
    });

    it('should accept custom options', async () => {
      await createIsolatedExecution(
        async (ctx) => {
          expect(ctx.testId).toMatch(/^custom_/);
        },
        { namespacePrefix: 'custom' }
      );
    });

    it('should create unique contexts for concurrent executions', async () => {
      const testIds: string[] = [];

      await Promise.all([
        createIsolatedExecution(async (ctx) => {
          testIds.push(ctx.testId);
          await new Promise((r) => setTimeout(r, 10));
        }),
        createIsolatedExecution(async (ctx) => {
          testIds.push(ctx.testId);
          await new Promise((r) => setTimeout(r, 10));
        }),
        createIsolatedExecution(async (ctx) => {
          testIds.push(ctx.testId);
          await new Promise((r) => setTimeout(r, 10));
        }),
      ]);

      // All test IDs should be unique
      const uniqueIds = new Set(testIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('withIsolatedContext', () => {
    it('should provide synchronous isolated context', () => {
      const result = withIsolatedContext((ctx) => {
        return ctx.uniqueTaskId();
      });

      expect(result).toMatch(/^task_test_/);
    });

    it('should schedule cleanup for next tick', () => {
      let ctx: any;

      withIsolatedContext((c) => {
        ctx = c;
        expect(ctx.isCleanedUp()).toBe(false);
      });

      // Cleanup is scheduled but not run yet in sync context
      expect(ctx.isCleanedUp()).toBe(false);
    });
  });

  describe('createStateTracker', () => {
    it('should take and retrieve snapshots', () => {
      const tracker = createStateTracker<{ count: number }>();

      tracker.snapshot('initial', { count: 0 });
      tracker.snapshot('final', { count: 10 });

      expect(tracker.getSnapshot('initial')?.data.count).toBe(0);
      expect(tracker.getSnapshot('final')?.data.count).toBe(10);
    });

    it('should detect state changes', () => {
      const tracker = createStateTracker<{ value: string }>();

      tracker.snapshot('before', { value: 'a' });
      tracker.snapshot('after', { value: 'b' });

      expect(tracker.hasChanged('before', 'after')).toBe(true);
    });

    it('should detect no change when state is same', () => {
      const tracker = createStateTracker<{ value: string }>();

      tracker.snapshot('first', { value: 'same' });
      tracker.snapshot('second', { value: 'same' });

      expect(tracker.hasChanged('first', 'second')).toBe(false);
    });

    it('should identify changed keys', () => {
      const tracker = createStateTracker<{ a: number; b: string; c: boolean }>();

      tracker.snapshot('before', { a: 1, b: 'hello', c: true });
      tracker.snapshot('after', { a: 2, b: 'hello', c: false });

      const changed = tracker.getChangedKeys('before', 'after');

      expect(changed).toContain('a');
      expect(changed).toContain('c');
      expect(changed).not.toContain('b');
    });

    it('should throw for missing snapshots', () => {
      const tracker = createStateTracker<{ value: number }>();

      tracker.snapshot('exists', { value: 1 });

      expect(() => tracker.hasChanged('exists', 'missing')).toThrow('Snapshot not found');
    });

    it('should clear all snapshots', () => {
      const tracker = createStateTracker<{ value: number }>();

      tracker.snapshot('a', { value: 1 });
      tracker.snapshot('b', { value: 2 });

      tracker.clear();

      expect(tracker.getLabels()).toHaveLength(0);
    });

    it('should list all snapshot labels', () => {
      const tracker = createStateTracker<{ value: number }>();

      tracker.snapshot('first', { value: 1 });
      tracker.snapshot('second', { value: 2 });
      tracker.snapshot('third', { value: 3 });

      expect(tracker.getLabels()).toEqual(['first', 'second', 'third']);
    });

    it('should deep clone snapshot data', () => {
      const tracker = createStateTracker<{ nested: { value: number } }>();
      const original = { nested: { value: 1 } };

      tracker.snapshot('snap', original);
      original.nested.value = 999;

      // Snapshot should not be affected by mutation
      expect(tracker.getSnapshot('snap')?.data.nested.value).toBe(1);
    });
  });

  describe('createMockRegistry', () => {
    it('should register and retrieve mocks', () => {
      const registry = createMockRegistry();
      const mockFn = vi.fn();

      registry.register('myMock', mockFn);

      const retrieved = registry.get('myMock');
      expect(retrieved).toBeDefined();
    });

    it('should reset all mocks', () => {
      const registry = createMockRegistry();
      const mock1 = vi.fn().mockReturnValue('a');
      const mock2 = vi.fn().mockReturnValue('b');

      registry.register('mock1', mock1);
      registry.register('mock2', mock2);

      registry.reset();

      expect(mock1.mock.calls).toHaveLength(0);
      expect(mock2.mock.calls).toHaveLength(0);
    });

    it('should clear all mocks from registry', () => {
      const registry = createMockRegistry();

      registry.register('a', vi.fn());
      registry.register('b', vi.fn());

      registry.clear();

      expect(registry.get('a')).toBeUndefined();
      expect(registry.get('b')).toBeUndefined();
    });

    it('should verify expected calls', () => {
      const registry = createMockRegistry();
      const mockFn = vi.fn();

      const wrappedMock = registry.register('api', mockFn, { expectedCalls: 2 });

      wrappedMock();
      wrappedMock();

      // Should not throw
      expect(() => registry.verifyExpectations()).not.toThrow();
    });

    it('should throw when expected calls not met', () => {
      const registry = createMockRegistry();
      const mockFn = vi.fn();

      const wrappedMock = registry.register('api', mockFn, { expectedCalls: 3 });

      wrappedMock(); // Only 1 call

      expect(() => registry.verifyExpectations()).toThrow('Mock verification failed');
    });

    it('should check if any mock was called', () => {
      const registry = createMockRegistry();
      const mock1 = registry.register('a', vi.fn());
      registry.register('b', vi.fn());

      expect(registry.anyCalled()).toBe(false);

      mock1();

      expect(registry.anyCalled()).toBe(true);
    });

    it('should provide call summary', () => {
      const registry = createMockRegistry();
      const mock1 = registry.register('fetch', vi.fn(), { expectedCalls: 2 });
      const mock2 = registry.register('save', vi.fn());

      mock1();
      mock1();
      mock2();

      const summary = registry.getSummary();

      expect(summary).toContainEqual({ name: 'fetch', calls: 2, expected: 2 });
      expect(summary).toContainEqual({ name: 'save', calls: 1, expected: undefined });
    });
  });

  describe('createResourceLock', () => {
    it('should acquire and release lock', async () => {
      const lock = createResourceLock('test');

      expect(lock.isLocked()).toBe(false);

      await lock.acquire();
      expect(lock.isLocked()).toBe(true);

      lock.release();
      expect(lock.isLocked()).toBe(false);
    });

    it('should queue waiters when locked', async () => {
      const lock = createResourceLock('test');
      const order: number[] = [];

      await lock.acquire();

      // These will wait
      const waiter1 = lock.acquire().then(() => order.push(1));
      const waiter2 = lock.acquire().then(() => order.push(2));

      // Release to first waiter
      lock.release();
      await waiter1;
      expect(order).toEqual([1]);

      // Release to second waiter
      lock.release();
      await waiter2;
      expect(order).toEqual([1, 2]);

      lock.release();
    });

    it('should work with withLock helper', async () => {
      const lock = createResourceLock('resource');
      let executed = false;

      await withLock(lock, async () => {
        executed = true;
        expect(lock.isLocked()).toBe(true);
      });

      expect(executed).toBe(true);
      expect(lock.isLocked()).toBe(false);
    });

    it('should release lock even on error', async () => {
      const lock = createResourceLock('resource');

      try {
        await withLock(lock, async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      expect(lock.isLocked()).toBe(false);
    });

    it('should handle concurrent access correctly', async () => {
      const lock = createResourceLock('shared');
      const results: number[] = [];

      await Promise.all([
        withLock(lock, async () => {
          results.push(1);
          await new Promise((r) => setTimeout(r, 10));
          results.push(1);
        }),
        withLock(lock, async () => {
          results.push(2);
          await new Promise((r) => setTimeout(r, 10));
          results.push(2);
        }),
      ]);

      // Results should show sequential execution (1,1 then 2,2 or 2,2 then 1,1)
      expect(
        (results[0] === 1 && results[1] === 1) ||
          (results[0] === 2 && results[1] === 2)
      ).toBe(true);
    });
  });

  describe('withEnvironment', () => {
    const originalValue = process.env.TEST_VAR;

    afterEach(() => {
      if (originalValue === undefined) {
        delete process.env.TEST_VAR;
      } else {
        process.env.TEST_VAR = originalValue;
      }
    });

    it('should set environment variables during execution', async () => {
      await withEnvironment({ TEST_VAR: 'test-value' }, async () => {
        expect(process.env.TEST_VAR).toBe('test-value');
      });
    });

    it('should restore original values after execution', async () => {
      process.env.TEST_VAR = 'original';

      await withEnvironment({ TEST_VAR: 'modified' }, async () => {
        expect(process.env.TEST_VAR).toBe('modified');
      });

      expect(process.env.TEST_VAR).toBe('original');
    });

    it('should restore undefined values correctly', async () => {
      delete process.env.TEST_VAR;

      await withEnvironment({ TEST_VAR: 'temp' }, async () => {
        expect(process.env.TEST_VAR).toBe('temp');
      });

      expect(process.env.TEST_VAR).toBeUndefined();
    });

    it('should delete variables when set to undefined', async () => {
      process.env.TEST_VAR = 'existing';

      await withEnvironment({ TEST_VAR: undefined }, async () => {
        expect(process.env.TEST_VAR).toBeUndefined();
      });

      expect(process.env.TEST_VAR).toBe('existing');
    });

    it('should restore values even on error', async () => {
      process.env.TEST_VAR = 'original';

      try {
        await withEnvironment({ TEST_VAR: 'modified' }, async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      expect(process.env.TEST_VAR).toBe('original');
    });
  });

  describe('withEnvironmentSync', () => {
    const originalValue = process.env.TEST_VAR_SYNC;

    afterEach(() => {
      if (originalValue === undefined) {
        delete process.env.TEST_VAR_SYNC;
      } else {
        process.env.TEST_VAR_SYNC = originalValue;
      }
    });

    it('should work synchronously', () => {
      const result = withEnvironmentSync({ TEST_VAR_SYNC: 'sync-value' }, () => {
        return process.env.TEST_VAR_SYNC;
      });

      expect(result).toBe('sync-value');
      expect(process.env.TEST_VAR_SYNC).toBeUndefined();
    });
  });

  describe('createTestDataFactory', () => {
    it('should create instances with incrementing sequence', () => {
      const factory = createTestDataFactory('user', (seq) => ({
        id: seq,
        name: `User ${seq}`,
      }));

      const user1 = factory.create();
      const user2 = factory.create();

      expect(user1.id).toBe(1);
      expect(user2.id).toBe(2);
      expect(user1.name).toBe('User 1');
      expect(user2.name).toBe('User 2');
    });

    it('should apply overrides', () => {
      const factory = createTestDataFactory('user', (seq) => ({
        id: seq,
        name: `User ${seq}`,
        role: 'member',
      }));

      const admin = factory.create({ role: 'admin' });

      expect(admin.role).toBe('admin');
      expect(admin.id).toBe(1);
    });

    it('should create many instances', () => {
      const factory = createTestDataFactory('item', (seq) => ({
        id: seq,
        value: seq * 10,
      }));

      const items = factory.createMany(5);

      expect(items).toHaveLength(5);
      expect(items[0].id).toBe(1);
      expect(items[4].id).toBe(5);
    });

    it('should reset sequence', () => {
      const factory = createTestDataFactory('item', (seq) => ({ id: seq }));

      factory.create();
      factory.create();
      expect(factory.getSequence()).toBe(2);

      factory.reset();
      expect(factory.getSequence()).toBe(0);

      const item = factory.create();
      expect(item.id).toBe(1);
    });

    it('should provide factory context to generator', () => {
      const factory = createTestDataFactory('product', (seq, ctx) => ({
        code: `${ctx.factoryName}-${seq}`,
      }));

      const product = factory.create();

      expect(product.code).toBe('product-1');
    });
  });

  describe('createCleanupOrchestrator', () => {
    it('should add and run cleanup tasks', async () => {
      const orchestrator = createCleanupOrchestrator();
      const executed: string[] = [];

      orchestrator.add('task1', () => executed.push('task1'));
      orchestrator.add('task2', () => executed.push('task2'));

      await orchestrator.runAll();

      expect(executed).toContain('task1');
      expect(executed).toContain('task2');
    });

    it('should run tasks in reverse order', async () => {
      const orchestrator = createCleanupOrchestrator();
      const order: string[] = [];

      orchestrator.add('first', () => order.push('first'));
      orchestrator.add('second', () => order.push('second'));
      orchestrator.add('third', () => order.push('third'));

      await orchestrator.runAll();

      expect(order).toEqual(['third', 'second', 'first']);
    });

    it('should handle async cleanup tasks', async () => {
      const orchestrator = createCleanupOrchestrator();
      let cleaned = false;

      orchestrator.add('async', async () => {
        await new Promise((r) => setTimeout(r, 10));
        cleaned = true;
      });

      await orchestrator.runAll();

      expect(cleaned).toBe(true);
    });

    it('should continue on task failure and collect errors', async () => {
      const orchestrator = createCleanupOrchestrator();
      const executed: string[] = [];

      orchestrator.add('succeeds', () => executed.push('succeeds'));
      orchestrator.add('fails', () => {
        throw new Error('Cleanup failed');
      });
      orchestrator.add('also-succeeds', () => executed.push('also-succeeds'));

      await orchestrator.runAll();

      expect(executed).toContain('succeeds');
      expect(executed).toContain('also-succeeds');

      const errors = orchestrator.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe('fails');
    });

    it('should remove task by name', async () => {
      const orchestrator = createCleanupOrchestrator();
      let executed = false;

      orchestrator.add('removable', () => {
        executed = true;
      });
      orchestrator.remove('removable');

      await orchestrator.runAll();

      expect(executed).toBe(false);
    });

    it('should reset without running tasks', async () => {
      const orchestrator = createCleanupOrchestrator();
      let executed = false;

      orchestrator.add('task', () => {
        executed = true;
      });

      orchestrator.reset();

      await orchestrator.runAll();

      expect(executed).toBe(false);
    });

    it('should report pending tasks', () => {
      const orchestrator = createCleanupOrchestrator();

      expect(orchestrator.hasPendingTasks()).toBe(false);

      orchestrator.add('task1', () => {});
      orchestrator.add('task2', () => {});

      expect(orchestrator.hasPendingTasks()).toBe(true);
      expect(orchestrator.getPendingTaskNames()).toEqual(['task1', 'task2']);
    });

    it('should clear tasks after runAll', async () => {
      const orchestrator = createCleanupOrchestrator();

      orchestrator.add('task', () => {});

      await orchestrator.runAll();

      expect(orchestrator.hasPendingTasks()).toBe(false);
    });
  });
});
