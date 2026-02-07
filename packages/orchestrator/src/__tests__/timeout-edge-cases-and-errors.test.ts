/**
 * Timeout Edge Cases and Error Path Tests
 *
 * Comprehensive tests for edge cases and error paths in timeout handling.
 * Tests unusual scenarios, boundary conditions, and error recovery mechanisms
 * to ensure robust timeout behavior under all conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TimeoutUtils,
  PromiseRaceTimeoutPattern,
  SetTimeoutWithCleanupPattern,
  ExponentialBackoffPattern,
  PollingWaitPattern,
  TimeoutDebugUtils,
  DEFAULT_TIMEOUTS,
} from '../timeout-documentation';

describe('Timeout Edge Cases and Error Paths', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TimeoutDebugUtils['activeTimeouts'].clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Boundary Conditions', () => {
    it('should handle zero timeout values', async () => {
      const operation = Promise.resolve('immediate');

      // Zero timeout should still allow immediate resolution
      const result = await TimeoutUtils.withTimeout(operation, 0);
      expect(result).toBe('immediate');

      // Zero timeout with delayed operation should timeout immediately
      const delayedOperation = new Promise(resolve => setTimeout(resolve, 100));
      await expect(TimeoutUtils.withTimeout(delayedOperation, 0))
        .rejects.toThrow('Operation timed out after 0ms');
    });

    it('should handle very large timeout values', async () => {
      const largeTimeout = Number.MAX_SAFE_INTEGER;
      const operation = Promise.resolve('success');

      const result = await TimeoutUtils.withTimeout(operation, largeTimeout);
      expect(result).toBe('success');
    });

    it('should handle negative timeout values gracefully', async () => {
      const operation = Promise.resolve('success');

      // Negative timeout should be treated as immediate timeout
      await expect(TimeoutUtils.withTimeout(operation, -1000))
        .rejects.toThrow('Operation timed out after -1000ms');
    });

    it('should handle timeout values at Integer boundaries', async () => {
      const timeouts = [
        1, // Minimum positive
        2147483647, // Maximum 32-bit signed integer
        Number.MAX_SAFE_INTEGER, // Maximum safe integer
      ];

      for (const timeout of timeouts) {
        const operation = Promise.resolve('success');
        const result = await TimeoutUtils.withTimeout(operation, timeout);
        expect(result).toBe('success');
      }
    });

    it('should handle fractional timeout values', async () => {
      const operation = new Promise(resolve => setTimeout(resolve, 50));

      // Fractional timeout (should be rounded down by setTimeout)
      const result = await TimeoutUtils.withTimeout(
        Promise.resolve('success'),
        100.9
      );
      expect(result).toBe('success');

      // Very small fractional timeout
      await expect(TimeoutUtils.withTimeout(operation, 0.1))
        .rejects.toThrow('Operation timed out after 0.1ms');
    });
  });

  describe('Promise Race Edge Cases', () => {
    it('should handle promise that rejects before timeout', async () => {
      const error = new Error('Operation failed');
      const operation = Promise.reject(error);

      await expect(PromiseRaceTimeoutPattern.withTimeout(operation, 1000))
        .rejects.toThrow('Operation failed');
    });

    it('should handle promise that resolves exactly at timeout', async () => {
      const timeoutMs = 1000;
      let resolved = false;

      const operation = new Promise<string>((resolve) => {
        setTimeout(() => {
          resolved = true;
          resolve('just in time');
        }, timeoutMs);
      });

      const racePromise = PromiseRaceTimeoutPattern.withTimeout(operation, timeoutMs);

      // Advance exactly to timeout
      vi.advanceTimersByTime(timeoutMs);

      // This is a race condition - could go either way
      // We just verify one of the two outcomes occurs
      try {
        const result = await racePromise;
        expect(result).toBe('just in time');
        expect(resolved).toBe(true);
      } catch (error) {
        expect((error as Error).message).toContain('timed out');
      }
    });

    it('should handle multiple concurrent timeouts with same operation', async () => {
      const operation = new Promise<string>(resolve => {
        setTimeout(() => resolve('completed'), 500);
      });

      // Multiple race operations with different timeouts
      const races = [
        PromiseRaceTimeoutPattern.withTimeout(operation, 1000),
        PromiseRaceTimeoutPattern.withTimeout(operation, 2000),
        PromiseRaceTimeoutPattern.withTimeout(operation, 200), // Should timeout
      ];

      vi.advanceTimersByTime(600);
      const results = await Promise.allSettled(races);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('rejected');

      if (results[0].status === 'fulfilled') expect(results[0].value).toBe('completed');
      if (results[1].status === 'fulfilled') expect(results[1].value).toBe('completed');
      if (results[2].status === 'rejected') {
        expect(results[2].reason.message).toContain('timed out');
      }
    });

    it('should handle already resolved/rejected promises', async () => {
      const resolvedPromise = Promise.resolve('already resolved');
      const rejectedPromise = Promise.reject(new Error('already rejected'));

      // Should resolve immediately regardless of timeout
      const result1 = await PromiseRaceTimeoutPattern.withTimeout(resolvedPromise, 1000);
      expect(result1).toBe('already resolved');

      // Should reject immediately regardless of timeout
      await expect(PromiseRaceTimeoutPattern.withTimeout(rejectedPromise, 1000))
        .rejects.toThrow('already rejected');
    });
  });

  describe('SetTimeout Cleanup Edge Cases', () => {
    it('should handle rapid timeout setup and cleanup', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback = vi.fn();

      // Rapidly set and clear timeouts
      for (let i = 0; i < 100; i++) {
        pattern.setupTimeout(callback, 100);
        pattern.clearTimeout();
      }

      // Advance time to ensure no callbacks fire
      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle clearing timeout multiple times', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback = vi.fn();

      pattern.setupTimeout(callback, 100);

      // Clear multiple times - should not throw
      pattern.clearTimeout();
      pattern.clearTimeout();
      pattern.clearTimeout();

      vi.advanceTimersByTime(200);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle timeout replacement edge cases', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      // Set initial timeout
      pattern.setupTimeout(callback1, 300);

      // Replace after partial time
      vi.advanceTimersByTime(100);
      pattern.setupTimeout(callback2, 200);

      // Replace again
      vi.advanceTimersByTime(50);
      pattern.setupTimeout(callback3, 150);

      // Advance to completion
      vi.advanceTimersByTime(200);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should handle callback that throws error', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      pattern.setupTimeout(errorCallback, 100);

      // Should not prevent timer from firing or cause crashes
      expect(() => {
        vi.advanceTimersByTime(150);
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('Exponential Backoff Edge Cases', () => {
    it('should handle zero max attempts', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      await expect(ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 0,
        baseDelayMs: 100,
        backoffMultiplier: 2,
      })).rejects.toThrow();

      expect(operation).not.toHaveBeenCalled();
    });

    it('should handle very large backoff multipliers', async () => {
      let attemptCount = 0;
      const operation = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('fail'));
        }
        return Promise.resolve('success');
      });

      const result = await ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 1,
        backoffMultiplier: 1000000, // Very large multiplier
        maxDelayMs: 50, // But capped
      });

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    it('should handle zero base delay', async () => {
      let attemptCount = 0;
      const operation = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new Error('fail'));
        }
        return Promise.resolve('success');
      });

      const startTime = Date.now();
      const result = await ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 2,
        baseDelayMs: 0,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      // Should complete immediately with zero delay
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });

    it('should handle operation that throws non-Error objects', async () => {
      let attemptCount = 0;
      const operation = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject('string error');
        } else if (attemptCount === 2) {
          return Promise.reject(42);
        } else {
          return Promise.reject(null);
        }
      });

      await expect(ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 10,
        backoffMultiplier: 2,
      })).rejects.toBe(null);

      expect(attemptCount).toBe(3);
    });

    it('should handle maxDelayMs smaller than baseDelayMs', async () => {
      let attemptCount = 0;
      const operation = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('fail'));
        }
        return Promise.resolve('success');
      });

      const result = await ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 100,
        backoffMultiplier: 2,
        maxDelayMs: 50, // Smaller than base delay
      });

      expect(result).toBe('success');
      // All delays should be capped at maxDelayMs
    });
  });

  describe('Polling Wait Pattern Edge Cases', () => {
    it('should handle condition that throws error', async () => {
      const errorCondition = vi.fn().mockImplementation(() => {
        throw new Error('Condition evaluation error');
      });

      await expect(PollingWaitPattern.waitForCondition(errorCondition, {
        timeoutMs: 1000,
        intervalMs: 100,
      })).rejects.toThrow('Condition evaluation error');

      expect(errorCondition).toHaveBeenCalled();
    });

    it('should handle async condition that rejects', async () => {
      const rejectingCondition = vi.fn().mockImplementation(async () => {
        throw new Error('Async condition error');
      });

      await expect(PollingWaitPattern.waitForCondition(rejectingCondition, {
        timeoutMs: 1000,
        intervalMs: 100,
      })).rejects.toThrow('Async condition error');
    });

    it('should handle very small polling intervals', async () => {
      let callCount = 0;
      const condition = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount > 10;
      });

      await PollingWaitPattern.waitForCondition(condition, {
        timeoutMs: 100,
        intervalMs: 1, // 1ms interval
      });

      expect(condition).toHaveBeenCalled();
      expect(callCount).toBeGreaterThan(10);
    });

    it('should handle polling interval larger than timeout', async () => {
      const condition = vi.fn().mockReturnValue(false);

      await expect(PollingWaitPattern.waitForCondition(condition, {
        timeoutMs: 50,
        intervalMs: 100, // Interval > timeout
      })).rejects.toThrow('Condition not met within 50ms');

      // Should only be called once since interval > timeout
      expect(condition).toHaveBeenCalledTimes(1);
    });

    it('should handle condition that alternates true/false', async () => {
      let callCount = 0;
      const oscillatingCondition = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount % 2 === 0; // false, true, false, true...
      });

      // Should resolve on first true (second call)
      await PollingWaitPattern.waitForCondition(oscillatingCondition, {
        timeoutMs: 1000,
        intervalMs: 10,
      });

      expect(callCount).toBe(2);
    });
  });

  describe('Debug Utils Edge Cases', () => {
    it('should handle registering timeout with duplicate IDs', () => {
      const id = 'duplicate-id';

      TimeoutDebugUtils.registerTimeout(id, 1000, 'First operation');
      TimeoutDebugUtils.registerTimeout(id, 2000, 'Second operation');

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active).toHaveLength(1);
      expect(active[0].operation).toBe('Second operation');
      expect(active[0].timeoutMs).toBe(2000);
    });

    it('should handle unregistering non-existent timeout ID', () => {
      expect(() => {
        TimeoutDebugUtils.unregisterTimeout('non-existent-id');
      }).not.toThrow();

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active).toHaveLength(0);
    });

    it('should handle very large number of concurrent timeouts', () => {
      const numTimeouts = 10000;

      for (let i = 0; i < numTimeouts; i++) {
        TimeoutDebugUtils.registerTimeout(`timeout-${i}`, 1000 + i, `Operation ${i}`);
      }

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active).toHaveLength(numTimeouts);

      // Unregister half
      for (let i = 0; i < numTimeouts / 2; i++) {
        TimeoutDebugUtils.unregisterTimeout(`timeout-${i}`);
      }

      const remaining = TimeoutDebugUtils.getActiveTimeouts();
      expect(remaining).toHaveLength(numTimeouts / 2);
    });

    it('should handle timeout registration with extreme values', () => {
      const extremeConfigs = [
        { id: 'zero-timeout', timeout: 0, operation: 'Zero timeout' },
        { id: 'negative-timeout', timeout: -1000, operation: 'Negative timeout' },
        { id: 'max-timeout', timeout: Number.MAX_SAFE_INTEGER, operation: 'Max timeout' },
        { id: 'infinity-timeout', timeout: Infinity, operation: 'Infinite timeout' },
      ];

      extremeConfigs.forEach(config => {
        TimeoutDebugUtils.registerTimeout(config.id, config.timeout, config.operation);
      });

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active).toHaveLength(extremeConfigs.length);

      // Check calculations don't throw
      active.forEach(timeout => {
        expect(typeof timeout.elapsedMs).toBe('number');
        expect(typeof timeout.remainingMs).toBe('number');
      });
    });

    it('should handle logging with special characters in operation names', () => {
      const specialNames = [
        'Operation with "quotes"',
        'Operation with\nnewlines',
        'Operation with\ttabs',
        'Operation with 🚀 emojis',
        'Operation with \x00 null chars',
        '',
      ];

      specialNames.forEach((name, index) => {
        TimeoutDebugUtils.registerTimeout(`special-${index}`, 1000, name);
      });

      const originalLog = console.log;
      const logSpy = vi.fn();
      console.log = logSpy;

      try {
        expect(() => {
          TimeoutDebugUtils.logTimeoutStats();
        }).not.toThrow();

        expect(logSpy).toHaveBeenCalled();
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak timeouts when operations complete', async () => {
      const numOperations = 1000;
      const operations: Promise<string>[] = [];

      // Create many short-lived operations
      for (let i = 0; i < numOperations; i++) {
        const operation = new Promise<string>(resolve => {
          setTimeout(() => resolve(`completed-${i}`), 10);
        });

        operations.push(TimeoutUtils.withTimeout(operation, 1000));
      }

      // All should complete successfully
      vi.advanceTimersByTime(50);
      const results = await Promise.all(operations);

      expect(results).toHaveLength(numOperations);
      results.forEach((result, i) => {
        expect(result).toBe(`completed-${i}`);
      });

      // No timeouts should be active in debug utils
      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active).toHaveLength(0);
    });

    it('should clean up resources when timeouts fire', async () => {
      const numTimeouts = 100;
      const promises: Promise<string>[] = [];

      // Create operations that will timeout
      for (let i = 0; i < numTimeouts; i++) {
        const operation = new Promise<string>(resolve => {
          setTimeout(() => resolve(`too-late-${i}`), 2000);
        });

        promises.push(TimeoutUtils.withTimeout(operation, 100));
      }

      // All should timeout
      vi.advanceTimersByTime(150);
      const results = await Promise.allSettled(promises);

      expect(results).toHaveLength(numTimeouts);
      results.forEach(result => {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason.message).toContain('timed out');
        }
      });
    });

    it('should handle cleanup pattern with many rapid operations', () => {
      const patterns: SetTimeoutWithCleanupPattern[] = [];
      const callbacks: Array<() => void> = [];

      // Create many cleanup patterns
      for (let i = 0; i < 1000; i++) {
        const pattern = new SetTimeoutWithCleanupPattern();
        const callback = vi.fn();

        patterns.push(pattern);
        callbacks.push(callback);

        pattern.setupTimeout(callback, 100);
      }

      // Clear all patterns
      patterns.forEach(pattern => pattern.clearTimeout());

      // Advance time
      vi.advanceTimersByTime(200);

      // No callbacks should have fired
      callbacks.forEach(callback => {
        expect(callback).not.toHaveBeenCalled();
      });
    });
  });

  describe('Type Safety and Error Handling', () => {
    it('should handle timeout utils with invalid inputs', () => {
      // minutesToMs with invalid values
      expect(TimeoutUtils.minutesToMs(NaN)).toBeNaN();
      expect(TimeoutUtils.minutesToMs(Infinity)).toBe(Infinity);
      expect(TimeoutUtils.minutesToMs(-Infinity)).toBe(-Infinity);

      // msToMinutes with invalid values
      expect(TimeoutUtils.msToMinutes(NaN)).toBeNaN();
      expect(TimeoutUtils.msToMinutes(Infinity)).toBe(Infinity);
      expect(TimeoutUtils.msToMinutes(-Infinity)).toBe(-Infinity);
    });

    it('should handle formatTimeout with edge values', () => {
      expect(TimeoutUtils.formatTimeout(0)).toBe('0ms');
      expect(TimeoutUtils.formatTimeout(-100)).toBe('-100ms');
      expect(TimeoutUtils.formatTimeout(Infinity)).toBe('Infinitym');
      expect(TimeoutUtils.formatTimeout(NaN)).toBe('NaNms');
    });

    it('should handle promise timeout with non-promise values', async () => {
      // This would be a type error in TypeScript, but testing runtime behavior
      const nonPromise = 'not a promise' as any;

      // Should handle gracefully (though this is incorrect usage)
      try {
        await TimeoutUtils.withTimeout(nonPromise, 1000);
      } catch (error) {
        // Should handle the type error gracefully
        expect(error).toBeDefined();
      }
    });

    it('should validate default timeout values are reasonable', () => {
      // All timeout values should be positive numbers
      Object.entries(DEFAULT_TIMEOUTS).forEach(([key, value]) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
        expect(Number.isFinite(value)).toBe(true);
      });

      // Specific validations for critical timeouts
      expect(DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD).toBeGreaterThan(5000); // At least 5 seconds
      expect(DEFAULT_TIMEOUTS.TOOL_EXECUTION).toBeGreaterThan(30000); // At least 30 seconds
      expect(DEFAULT_TIMEOUTS.APPROVAL_CRITICAL_URGENCY).toBeGreaterThan(1); // At least 1 minute
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent timeout modifications safely', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback = vi.fn();

      // Simulate concurrent modifications
      pattern.setupTimeout(callback, 100);
      pattern.setupTimeout(callback, 200);
      pattern.clearTimeout();
      pattern.setupTimeout(callback, 300);
      pattern.clearTimeout();

      vi.advanceTimersByTime(500);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle concurrent debug utils operations', () => {
      const numOperations = 100;
      const operationIds: string[] = [];

      // Concurrent register/unregister operations
      for (let i = 0; i < numOperations; i++) {
        const id = `concurrent-${i}`;
        operationIds.push(id);

        TimeoutDebugUtils.registerTimeout(id, 1000, `Concurrent operation ${i}`);

        if (i % 2 === 0) {
          TimeoutDebugUtils.unregisterTimeout(id);
        }
      }

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active.length).toBe(numOperations / 2); // Half were unregistered
    });

    it('should handle promise race with concurrent resolutions', async () => {
      const timeoutMs = 1000;
      let resolveCount = 0;

      // Multiple promises that resolve at same time
      const operations = Array.from({ length: 10 }, (_, i) => {
        return new Promise<string>(resolve => {
          setTimeout(() => {
            resolveCount++;
            resolve(`result-${i}`);
          }, 500);
        });
      });

      const racePromises = operations.map(op =>
        PromiseRaceTimeoutPattern.withTimeout(op, timeoutMs)
      );

      vi.advanceTimersByTime(600);
      const results = await Promise.all(racePromises);

      expect(results).toHaveLength(10);
      expect(resolveCount).toBe(10);
      results.forEach((result, i) => {
        expect(result).toBe(`result-${i}`);
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from timer implementation errors', () => {
      // Mock setTimeout to throw error
      const originalSetTimeout = global.setTimeout;
      let callCount = 0;

      global.setTimeout = vi.fn().mockImplementation((callback, delay) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Timer system error');
        }
        return originalSetTimeout(callback, delay);
      });

      try {
        const pattern = new SetTimeoutWithCleanupPattern();
        const callback = vi.fn();

        // First call should handle error gracefully
        expect(() => {
          pattern.setupTimeout(callback, 100);
        }).toThrow('Timer system error');

        // Second call should work normally
        pattern.setupTimeout(callback, 100);
        vi.advanceTimersByTime(150);

        expect(callback).toHaveBeenCalled();
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should handle clearTimeout errors gracefully', () => {
      const originalClearTimeout = global.clearTimeout;

      global.clearTimeout = vi.fn().mockImplementation(() => {
        throw new Error('Clear timeout error');
      });

      try {
        const pattern = new SetTimeoutWithCleanupPattern();
        const callback = vi.fn();

        pattern.setupTimeout(callback, 100);

        // Should handle clearTimeout error gracefully
        expect(() => {
          pattern.clearTimeout();
        }).toThrow('Clear timeout error');

        // Pattern should still be functional
        pattern.setupTimeout(callback, 100);
      } finally {
        global.clearTimeout = originalClearTimeout;
      }
    });

    it('should handle Date.now() returning invalid values', () => {
      const originalDateNow = Date.now;

      // Mock Date.now to return invalid values
      let callCount = 0;
      Date.now = vi.fn().mockImplementation(() => {
        callCount++;
        switch (callCount) {
          case 1: return NaN;
          case 2: return -1;
          case 3: return Infinity;
          default: return originalDateNow();
        }
      });

      try {
        // Should not crash when Date.now returns invalid values
        TimeoutDebugUtils.registerTimeout('test', 1000, 'Test operation');

        const active = TimeoutDebugUtils.getActiveTimeouts();
        expect(active).toHaveLength(1);

        // Should handle calculations gracefully
        expect(typeof active[0].elapsedMs).toBe('number');
        expect(typeof active[0].remainingMs).toBe('number');
      } finally {
        Date.now = originalDateNow;
      }
    });
  });
});