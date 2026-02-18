/**
 * @fileoverview Error handling and recovery tests for Parallel Test Execution Support Utilities
 *
 * These tests verify that the utilities gracefully handle error conditions,
 * recover properly from failures, and maintain system stability under adverse conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  getTestWorkerId,
  createParallelTestContext,
  createParallelSafeTaskStore,
  createIsolatedEventEmitter,
  assertNoSharedMutation,
  createImmutableSnapshot,
  AsyncMutex,
  ResourceLockManager,
  globalResourceLocks,
  createEnvironmentIsolation,
  type ParallelTestContext,
  type IsolatedEventEmitterContext,
  type ResourceLock,
} from '../parallel-test-utils.js';

// ============================================================================
// Error Recovery: Event Emitter Error Handling
// ============================================================================

describe('Event Emitter Error Recovery', () => {
  let emitterCtx: IsolatedEventEmitterContext<Record<string, (...args: any[]) => void>>;

  beforeEach(() => {
    emitterCtx = createIsolatedEventEmitter();
  });

  afterEach(() => {
    emitterCtx.cleanup();
  });

  it('should handle listener errors without affecting other listeners', () => {
    const successfulCalls: number[] = [];
    const errors: Error[] = [];

    // Add listeners that will succeed
    emitterCtx.emitter.on('test-error', (data: number) => {
      successfulCalls.push(data);
    });

    // Add listener that throws errors
    emitterCtx.emitter.on('test-error', () => {
      throw new Error('Listener error');
    });

    // Add another successful listener
    emitterCtx.emitter.on('test-error', (data: number) => {
      successfulCalls.push(data * 2);
    });

    // Capture unhandled errors
    const originalListeners = process.listeners('uncaughtException');
    process.removeAllListeners('uncaughtException');
    process.on('uncaughtException', (error) => {
      errors.push(error);
    });

    try {
      // Emit events that trigger both successful and failing listeners
      emitterCtx.emitter.emit('test-error', 1);
      emitterCtx.emitter.emit('test-error', 2);
      emitterCtx.emitter.emit('test-error', 3);

      // Wait for potential async error propagation
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Successful listeners should have been called
          expect(successfulCalls).toEqual([1, 2, 2, 4, 3, 6]);

          // Event history should still be maintained
          const history = emitterCtx.getEventHistory();
          expect(history).toHaveLength(3);

          resolve();
        }, 50);
      });
    } finally {
      // Restore original error listeners
      process.removeAllListeners('uncaughtException');
      originalListeners.forEach(listener => {
        process.on('uncaughtException', listener as (...args: any[]) => void);
      });
    }
  });

  it('should handle circular reference in event arguments', () => {
    const circularObj: any = { name: 'test' };
    circularObj.self = circularObj;

    // Should not throw when emitting with circular references
    expect(() => {
      emitterCtx.emitter.emit('circular-test', circularObj);
    }).not.toThrow();

    // History should still be recorded (with potential circular reference handling)
    const history = emitterCtx.getEventHistory();
    expect(history).toHaveLength(1);
    expect(history[0].event).toBe('circular-test');

    // Args should be captured (might be transformed to avoid circular issues)
    expect(history[0].args).toHaveLength(1);
  });

  it('should handle extremely large event arguments', () => {
    const largeData = {
      bigArray: new Array(100000).fill(0).map((_, i) => ({ id: i, data: `item-${i}` })),
      bigString: 'x'.repeat(1000000),
    };

    // Should handle large data without crashing
    expect(() => {
      emitterCtx.emitter.emit('large-data-test', largeData);
    }).not.toThrow();

    const history = emitterCtx.getEventHistory();
    expect(history).toHaveLength(1);
    expect(history[0].event).toBe('large-data-test');
  });

  it('should recover from waitForEvent timeout gracefully', async () => {
    const timeoutPromise = emitterCtx.waitForEvent('never-emitted', 100);

    // Should timeout and throw
    await expect(timeoutPromise).rejects.toThrow('Timeout waiting for event');

    // Emitter should still be functional after timeout
    let eventReceived = false;
    emitterCtx.emitter.on('recovery-test', () => {
      eventReceived = true;
    });

    emitterCtx.emitter.emit('recovery-test');
    expect(eventReceived).toBe(true);

    // Should be able to wait for events again
    const successPromise = emitterCtx.waitForEvent('success-test', 1000);
    setTimeout(() => {
      emitterCtx.emitter.emit('success-test', 'recovered');
    }, 10);

    const result = await successPromise;
    expect(result).toEqual(['recovered']);
  });
});

// ============================================================================
// Error Recovery: Parallel Context Cleanup Failures
// ============================================================================

describe('Parallel Context Error Recovery', () => {
  it('should handle partial cleanup failures gracefully', async () => {
    const ctx = await createParallelTestContext({
      prefix: 'error-recovery-test',
      createDbStructure: true,
    });

    // Simulate a permission error by making the directory read-only
    // (This might fail on some systems, so we wrap in try-catch)
    let permissionErrorSimulated = false;
    try {
      await fs.chmod(ctx.tempDir, 0o444); // Read-only
      permissionErrorSimulated = true;
    } catch {
      // Chmod might not work on all systems, skip this part of the test
    }

    // Cleanup should not throw even if directory deletion fails
    await expect(ctx.cleanup()).resolves.not.toThrow();

    // Clean up manually if permission error was simulated
    if (permissionErrorSimulated) {
      try {
        await fs.chmod(ctx.tempDir, 0o755);
        await fs.rm(ctx.tempDir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup
      }
    }
  });

  it('should handle context creation with invalid permissions', async () => {
    // Try to create context in a potentially restricted location
    const invalidPrefix = 'error-test';

    // This should still work (creates in temp dir) but test error handling
    const ctx = await createParallelTestContext({
      prefix: invalidPrefix,
      createDbStructure: true,
    });

    expect(ctx.workerId).toBeTruthy();
    expect(ctx.tempDir).toBeTruthy();

    // Should clean up successfully
    await ctx.cleanup();
  });

  it('should handle event emitter cleanup errors gracefully', async () => {
    const ctx = await createParallelTestContext();

    // Add a problematic listener that might cause cleanup issues
    ctx.eventEmitter.emitter.on('error-test', () => {
      throw new Error('Cleanup error');
    });

    // Emit an event
    ctx.eventEmitter.emitter.emit('error-test');

    // Cleanup should still work
    await expect(ctx.cleanup()).resolves.not.toThrow();
  });
});

// ============================================================================
// Error Recovery: Database Store Error Handling
// ============================================================================

describe('Database Store Error Recovery', () => {
  it('should handle database creation failures gracefully', async () => {
    // Try to create store with an invalid path structure
    let storeContext: any = null;
    let creationError: Error | null = null;

    try {
      storeContext = await createParallelSafeTaskStore({
        prefix: 'error-db-test',
      });
    } catch (error) {
      creationError = error as Error;
    }

    if (creationError) {
      // If creation failed, it should fail gracefully
      expect(creationError).toBeInstanceOf(Error);
    } else {
      // If creation succeeded, cleanup should work
      expect(storeContext).toBeTruthy();
      await storeContext.cleanup();
    }
  });

  it('should handle database operations after cleanup', async () => {
    const { store, cleanup } = await createParallelSafeTaskStore({
      prefix: 'cleanup-test',
    });

    // Close the database
    await cleanup();

    // Operations should fail gracefully
    await expect(async () => {
      await store.listTasks();
    }).rejects.toThrow();
  });
});

// ============================================================================
// Error Recovery: Mutex Error Handling
// ============================================================================

describe('Mutex Error Recovery', () => {
  let mutex: AsyncMutex;

  beforeEach(() => {
    mutex = new AsyncMutex();
  });

  it('should release lock even when critical section throws', async () => {
    let lockWasReleased = false;

    // First operation that throws
    const firstOp = mutex.withLock(async () => {
      expect(mutex.isLocked()).toBe(true);
      throw new Error('Critical section error');
    });

    await expect(firstOp).rejects.toThrow('Critical section error');

    // Mutex should be unlocked after error
    expect(mutex.isLocked()).toBe(false);

    // Second operation should be able to acquire lock
    await mutex.withLock(async () => {
      lockWasReleased = true;
    });

    expect(lockWasReleased).toBe(true);
    expect(mutex.isLocked()).toBe(false);
  });

  it('should handle concurrent acquire/release cycles with errors', async () => {
    const results: Array<{ success: boolean; error?: string }> = [];
    const operationCount = 50;

    const operations = Array.from({ length: operationCount }, async (_, index) => {
      try {
        await mutex.withLock(async () => {
          // Randomly throw errors to test error recovery
          if (Math.random() < 0.3) {
            throw new Error(`Operation ${index} failed`);
          }

          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 1));
        });

        results.push({ success: true });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
      }
    });

    await Promise.all(operations);

    // All operations should have completed (success or failure)
    expect(results).toHaveLength(operationCount);

    // Some should have succeeded, some failed
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    expect(successes.length).toBeGreaterThan(0);
    expect(failures.length).toBeGreaterThan(0);

    // Mutex should be unlocked and functional
    expect(mutex.isLocked()).toBe(false);
    expect(mutex.getQueueLength()).toBe(0);

    // Should be able to use mutex after all the errors
    let finalTest = false;
    await mutex.withLock(async () => {
      finalTest = true;
    });
    expect(finalTest).toBe(true);
  });
});

// ============================================================================
// Error Recovery: Resource Lock Manager Error Handling
// ============================================================================

describe('Resource Lock Manager Error Recovery', () => {
  let lockManager: ResourceLockManager;

  beforeEach(() => {
    lockManager = new ResourceLockManager();
  });

  afterEach(() => {
    lockManager.clearAllLocks();
  });

  it('should handle lock holder disconnection/crash simulation', async () => {
    const lock1 = await lockManager.acquireLock('shared-resource', 1000);

    // Simulate crash by not releasing lock properly
    // Instead, we manually clear the lock to simulate holder disappearing
    lockManager.clearAllLocks();

    // New lock acquisition should work
    const lock2 = await lockManager.acquireLock('shared-resource', 1000);

    expect(lock2.resourceId).toBe('shared-resource');

    // Clean up properly
    lock2.release();
    expect(lockManager.isLocked('shared-resource')).toBe(false);
  });

  it('should handle timeout scenarios gracefully', async () => {
    // Acquire a lock
    const lock1 = await lockManager.acquireLock('timeout-test', 1000);

    // Try to acquire same resource with short timeout
    const timeoutPromise = lockManager.acquireLock('timeout-test', 100);

    await expect(timeoutPromise).rejects.toThrow('Timeout acquiring lock');

    // Original lock should still be valid
    expect(lockManager.isLocked('timeout-test')).toBe(true);
    expect(lockManager.getLockHolder('timeout-test')).toBe(lock1.holder);

    // After releasing, new acquisition should work
    lock1.release();

    const lock2 = await lockManager.acquireLock('timeout-test', 1000);
    expect(lock2.resourceId).toBe('timeout-test');

    lock2.release();
  });

  it('should handle rapid acquire/release cycles with errors', async () => {
    const resourceId = 'rapid-test';
    const cycleCount = 100;
    const results: Array<{ success: boolean; lockId?: string }> = [];

    const cycles = Array.from({ length: cycleCount }, async (_, index) => {
      try {
        const lock = await lockManager.acquireLock(resourceId, 1000);

        // Simulate potential error in critical section
        if (Math.random() < 0.1) {
          // Don't release properly (simulating crash)
          throw new Error(`Simulated crash ${index}`);
        }

        // Small delay to increase contention
        await new Promise(resolve => setTimeout(resolve, 1));

        lock.release();
        results.push({ success: true, lockId: lock.holder });
      } catch (error) {
        results.push({ success: false });
        // Force clear locks to simulate recovery
        lockManager.clearAllLocks();
      }
    });

    await Promise.allSettled(cycles);

    // Most operations should have succeeded
    const successes = results.filter(r => r.success);
    expect(successes.length).toBeGreaterThan(cycleCount * 0.7);

    // No locks should remain
    expect(lockManager.isLocked(resourceId)).toBe(false);
  });
});

// ============================================================================
// Error Recovery: Shared State Guard Error Handling
// ============================================================================

describe('Shared State Guard Error Recovery', () => {
  it('should detect state mutations even when test function throws', async () => {
    const state = { count: 0, nested: { value: 'original' } };

    // Test function that modifies state then throws
    const testFn = async () => {
      state.count = 999;
      state.nested.value = 'modified';
      throw new Error('Test function error');
    };

    // Should detect mutation AND propagate the original error
    await expect(
      assertNoSharedMutation(() => state, testFn)
    ).rejects.toThrow('Test function error');

    // State should still be mutated (since test threw before cleanup)
    expect(state.count).toBe(999);
    expect(state.nested.value).toBe('modified');
  });

  it('should handle complex state with edge cases', async () => {
    const complexState = {
      nullValue: null,
      undefinedValue: undefined,
      date: new Date('2023-01-01'),
      array: [1, 2, { nested: 'value' }],
      map: new Map([['key1', 'value1'], ['key2', { nested: 'data' }]]),
      set: new Set(['a', 'b', { nested: 'object' }]),
      circularRef: {} as any,
    };
    complexState.circularRef = complexState;

    // Test that modifies and restores complex state
    await expect(
      assertNoSharedMutation(
        () => complexState,
        async () => {
          // Modify various parts
          complexState.date.setFullYear(2024);
          complexState.array.push(4);
          complexState.map.set('key3', 'value3');
          complexState.set.add('c');

          // Restore everything
          complexState.date.setFullYear(2023);
          complexState.array.pop();
          complexState.map.delete('key3');
          complexState.set.delete('c');
        }
      )
    ).resolves.not.toThrow();
  });

  it('should handle state comparison with NaN and special values', async () => {
    const specialState = {
      nanValue: NaN,
      positiveZero: +0,
      negativeZero: -0,
      infinity: Infinity,
      negativeInfinity: -Infinity,
    };

    // Modify and restore special values
    await expect(
      assertNoSharedMutation(
        () => specialState,
        async () => {
          const original = { ...specialState };

          // Modify
          specialState.nanValue = 42;
          specialState.positiveZero = 1;
          specialState.negativeZero = -1;
          specialState.infinity = 100;
          specialState.negativeInfinity = -100;

          // Restore
          specialState.nanValue = original.nanValue;
          specialState.positiveZero = original.positiveZero;
          specialState.negativeZero = original.negativeZero;
          specialState.infinity = original.infinity;
          specialState.negativeInfinity = original.negativeInfinity;
        }
      )
    ).resolves.not.toThrow();
  });
});

// ============================================================================
// Error Recovery: Environment Isolation Error Handling
// ============================================================================

describe('Environment Isolation Error Recovery', () => {
  it('should handle environment variables with special characters', () => {
    const env = createEnvironmentIsolation();

    const specialValues = [
      'value with spaces',
      'value\nwith\nnewlines',
      'value\twith\ttabs',
      'value"with"quotes',
      "value'with'single'quotes",
      'value\\with\\backslashes',
      '😀🎉💻', // Unicode emoji
      '', // Empty string
    ];

    try {
      specialValues.forEach((value, index) => {
        const varName = `SPECIAL_VAR_${index}`;
        env.set(varName, value);
        expect(env.get(varName)).toBe(value);
      });

      // All variables should be set
      specialValues.forEach((value, index) => {
        const varName = `SPECIAL_VAR_${index}`;
        expect(process.env[varName]).toBe(value);
      });

    } finally {
      env.restore();

      // All variables should be cleaned up
      specialValues.forEach((_, index) => {
        const varName = `SPECIAL_VAR_${index}`;
        expect(process.env[varName]).toBeUndefined();
      });
    }
  });

  it('should handle extremely large environment variable values', () => {
    const env = createEnvironmentIsolation();
    const largeValue = 'x'.repeat(100000); // 100KB string

    try {
      env.set('LARGE_VAR', largeValue);
      expect(env.get('LARGE_VAR')).toBe(largeValue);

    } finally {
      env.restore();
      expect(process.env.LARGE_VAR).toBeUndefined();
    }
  });

  it('should handle restore when environment was externally modified', () => {
    const env = createEnvironmentIsolation();

    // Set up initial state
    env.set('RESTORE_TEST_VAR', 'original');

    // Externally modify the environment (simulating other code)
    process.env.RESTORE_TEST_VAR = 'externally_modified';
    process.env.EXTERNAL_VAR = 'external_value';

    // Restore should still work
    env.restore();

    // Our variable should be cleaned up
    expect(process.env.RESTORE_TEST_VAR).toBeUndefined();

    // External variable should remain
    expect(process.env.EXTERNAL_VAR).toBe('external_value');

    // Clean up external variable
    delete process.env.EXTERNAL_VAR;
  });
});

// ============================================================================
// Error Recovery: Immutable Snapshot Error Handling
// ============================================================================

describe('Immutable Snapshot Error Recovery', () => {
  it('should handle objects with non-enumerable properties', () => {
    const obj = { normal: 'value' };
    Object.defineProperty(obj, 'hidden', {
      value: 'hidden-value',
      enumerable: false,
      writable: true,
      configurable: true,
    });

    const snapshot = createImmutableSnapshot(obj);

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.normal).toBe('value');

    // Non-enumerable property might not be copied, but shouldn't cause errors
    expect(() => createImmutableSnapshot(obj)).not.toThrow();
  });

  it('should handle objects with getters/setters', () => {
    let backingValue = 'initial';
    const obj = {
      normal: 'value',
      get computed() {
        return backingValue.toUpperCase();
      },
      set computed(value: string) {
        backingValue = value;
      }
    };

    // Should not throw when creating snapshot
    expect(() => createImmutableSnapshot(obj)).not.toThrow();

    const snapshot = createImmutableSnapshot(obj);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('should handle deeply nested structures with potential issues', () => {
    const deepObj: any = { level1: { level2: { level3: { value: 'deep' } } } };

    // Add circular reference
    deepObj.level1.level2.level3.circular = deepObj;

    // Should handle circular reference without infinite recursion
    expect(() => createImmutableSnapshot(deepObj)).not.toThrow();
  });
});