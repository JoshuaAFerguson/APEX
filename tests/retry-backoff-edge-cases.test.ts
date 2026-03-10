import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExponentialBackoffReconnector } from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { createTask } from '../packages/core/src/factories/task-factory.js';

/**
 * Edge cases and error path testing for retry and backoff functionality
 *
 * This test suite covers:
 * 1. Boundary conditions for retry parameters
 * 2. Error handling in retry mechanisms
 * 3. Resource cleanup and memory management
 * 4. Concurrent retry scenarios
 * 5. Invalid input handling
 */
describe('Retry and Backoff Edge Cases', () => {
  let reconnector: ExponentialBackoffReconnector;
  let orchestrator: ApexOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    reconnector?.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Boundary Conditions', () => {
    it('should handle maxRetries of 0 correctly', () => {
      reconnector = new ExponentialBackoffReconnector({
        maxRetries: 0,
        baseDelayMs: 1000,
      });

      const exhaustedSpy = vi.fn();
      reconnector.on('reconnect:exhausted', exhaustedSpy);

      const connectFn = vi.fn();
      reconnector.scheduleReconnect(connectFn);

      expect(exhaustedSpy).toHaveBeenCalledWith(0, 'Max retries exceeded');
      expect(reconnector.getStats().state).toBe('failed');
      expect(reconnector.isExhausted()).toBe(true);
    });

    it('should handle zero delay configurations', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 0,
        backoffFactor: 2,
        jitterStrategy: 'none',
      });

      expect(reconnector.calculateDelay(1)).toBe(0);
      expect(reconnector.calculateDelay(2)).toBe(0);
      expect(reconnector.calculateDelay(100)).toBe(0);
    });

    it('should handle backoff factor of 1 (no exponential growth)', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 1,
        jitterStrategy: 'none',
      });

      expect(reconnector.calculateDelay(1)).toBe(1000);
      expect(reconnector.calculateDelay(2)).toBe(1000);
      expect(reconnector.calculateDelay(10)).toBe(1000);
    });

    it('should handle very large backoff factors', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        backoffFactor: 10,
        maxDelayMs: 5000,
        jitterStrategy: 'none',
      });

      expect(reconnector.calculateDelay(1)).toBe(100);
      expect(reconnector.calculateDelay(2)).toBe(1000);
      expect(reconnector.calculateDelay(3)).toBe(5000); // Capped at maxDelayMs
      expect(reconnector.calculateDelay(4)).toBe(5000); // Still capped
    });

    it('should handle extreme maxDelayMs values', () => {
      // Very small maxDelayMs
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        maxDelayMs: 500, // Smaller than baseDelay
        jitterStrategy: 'none',
      });

      expect(reconnector.calculateDelay(1)).toBe(500); // Capped immediately

      reconnector.destroy();

      // Very large maxDelayMs
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        maxDelayMs: Number.MAX_SAFE_INTEGER,
        backoffFactor: 2,
        jitterStrategy: 'none',
      });

      expect(reconnector.calculateDelay(1)).toBe(1000);
      expect(reconnector.calculateDelay(50)).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    });

    it('should handle fractional delays', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1.5,
        backoffFactor: 1.1,
        jitterStrategy: 'none',
      });

      const delay = reconnector.calculateDelay(1);
      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThan(0);
    });
  });

  describe('Invalid Input Handling', () => {
    it('should reject negative attempt numbers', () => {
      reconnector = new ExponentialBackoffReconnector();

      expect(() => reconnector.calculateDelay(-1)).toThrow('Attempt number must be positive');
      expect(() => reconnector.calculateDelay(0)).toThrow('Attempt number must be positive');
      expect(() => reconnector.calculateDelay(-100)).toThrow('Attempt number must be positive');
    });

    it('should handle negative configuration values gracefully', () => {
      // The implementation should handle negative values by treating them as valid
      // or throwing appropriate errors
      expect(() => {
        reconnector = new ExponentialBackoffReconnector({
          baseDelayMs: -1000,
          backoffFactor: -1,
          maxDelayMs: -500,
          maxRetries: -1,
        });
      }).not.toThrow(); // Constructor should not throw

      // But calculations should handle negatives appropriately
      if (reconnector) {
        const delay = reconnector.calculateDelay(1);
        expect(typeof delay).toBe('number');
        expect(delay).toBeGreaterThanOrEqual(0); // Should not return negative delays
      }
    });

    it('should handle infinite and NaN values', () => {
      expect(() => {
        reconnector = new ExponentialBackoffReconnector({
          baseDelayMs: Infinity,
          backoffFactor: NaN,
          maxDelayMs: Infinity,
        });
      }).not.toThrow();

      if (reconnector) {
        const delay = reconnector.calculateDelay(1);
        expect(Number.isFinite(delay) || delay === 0).toBe(true); // Should handle gracefully
      }
    });
  });

  describe('Resource Management and Cleanup', () => {
    it('should clean up timers when destroyed', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
      });

      const connectFn = vi.fn();
      reconnector.scheduleReconnect(connectFn);

      // Verify timer is scheduled
      expect(connectFn).not.toHaveBeenCalled();

      // Destroy and verify timer is cleared
      reconnector.destroy();

      vi.advanceTimersByTime(1000);
      expect(connectFn).not.toHaveBeenCalled();
    });

    it('should remove all event listeners on destroy', () => {
      reconnector = new ExponentialBackoffReconnector();

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      reconnector.on('state:changed', listener1);
      reconnector.on('reconnect:attempt', listener2);
      reconnector.on('reconnect:success', listener3);

      expect(reconnector.listenerCount('state:changed')).toBe(1);
      expect(reconnector.listenerCount('reconnect:attempt')).toBe(1);
      expect(reconnector.listenerCount('reconnect:success')).toBe(1);

      reconnector.destroy();

      expect(reconnector.listenerCount('state:changed')).toBe(0);
      expect(reconnector.listenerCount('reconnect:attempt')).toBe(0);
      expect(reconnector.listenerCount('reconnect:success')).toBe(0);
    });

    it('should handle multiple destroy calls gracefully', () => {
      reconnector = new ExponentialBackoffReconnector();

      expect(() => {
        reconnector.destroy();
        reconnector.destroy();
        reconnector.destroy();
      }).not.toThrow();
    });

    it('should handle operations after destruction gracefully', () => {
      reconnector = new ExponentialBackoffReconnector();
      reconnector.destroy();

      // These operations should not crash after destruction
      expect(() => {
        reconnector.scheduleReconnect(vi.fn());
        reconnector.notifyConnected();
        reconnector.notifyDisconnected('error');
        reconnector.notifyConnectionFailed('error');
        reconnector.reset();
        reconnector.getStats();
        reconnector.getConfig();
      }).not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid successive scheduleReconnect calls', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      const connectFns = [vi.fn(), vi.fn(), vi.fn()];

      // Schedule multiple reconnects rapidly
      connectFns.forEach(fn => {
        reconnector.scheduleReconnect(fn);
      });

      // Only the last one should be scheduled
      vi.advanceTimersByTime(200); // Enough time for attempt 2

      expect(connectFns[0]).not.toHaveBeenCalled();
      expect(connectFns[1]).not.toHaveBeenCalled();
      expect(connectFns[2]).toHaveBeenCalledOnce();
    });

    it('should handle state changes during timer execution', async () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
      });

      const connectFn = vi.fn().mockImplementation(async () => {
        // Simulate state change during connection
        reconnector.notifyConnected();
      });

      reconnector.scheduleReconnect(connectFn);

      // Advance time and run timers
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(reconnector.getStats().state).toBe('connected');
    });

    it('should handle reset during active reconnection', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
      });

      const connectFn = vi.fn();
      reconnector.scheduleReconnect(connectFn);

      expect(reconnector.getStats().currentAttempt).toBe(1);

      // Reset while timer is active
      reconnector.reset();

      expect(reconnector.getStats().currentAttempt).toBe(0);
      expect(reconnector.getStats().state).toBe('idle');

      // Timer should be cleared
      vi.advanceTimersByTime(100);
      expect(connectFn).not.toHaveBeenCalled();
    });
  });

  describe('Error Propagation and Handling', () => {
    it('should handle exceptions in connect function gracefully', async () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 2,
      });

      const failureSpy = vi.fn();
      reconnector.on('reconnect:failure', failureSpy);

      const throwingConnectFn = vi.fn().mockImplementation(async () => {
        throw new Error('Connection setup failed');
      });

      reconnector.scheduleReconnect(throwingConnectFn);

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(throwingConnectFn).toHaveBeenCalled();
      // The error should be handled internally and not crash the system
    });

    it('should handle synchronous exceptions in connect function', async () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
      });

      const syncThrowingConnectFn = vi.fn().mockImplementation(() => {
        throw new Error('Sync connection error');
      });

      reconnector.scheduleReconnect(syncThrowingConnectFn);

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(syncThrowingConnectFn).toHaveBeenCalled();
      // Should handle sync exceptions gracefully
    });

    it('should maintain state consistency after errors', async () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      const failingConnectFn = vi.fn().mockRejectedValue(new Error('Failed'));

      // First attempt
      reconnector.scheduleReconnect(failingConnectFn);
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      const statsAfterFailure = reconnector.getStats();
      expect(statsAfterFailure.state).toBe('connecting'); // State should be stable

      // Notify failure properly
      reconnector.notifyConnectionFailed('explicit failure');
      expect(reconnector.getStats().state).toBe('idle');
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle many event listeners without memory leaks', () => {
      reconnector = new ExponentialBackoffReconnector();

      // Add many listeners
      const listeners = Array.from({ length: 1000 }, () => vi.fn());
      listeners.forEach(listener => {
        reconnector.on('state:changed', listener);
      });

      expect(reconnector.listenerCount('state:changed')).toBe(1000);

      // Trigger an event
      reconnector.notifyConnected();

      // All listeners should have been called
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledOnce();
      });

      // Cleanup should work
      reconnector.destroy();
      expect(reconnector.listenerCount('state:changed')).toBe(0);
    });

    it('should handle rapid state transitions efficiently', () => {
      reconnector = new ExponentialBackoffReconnector();

      const stateChanges: string[] = [];
      reconnector.on('state:changed', (prev, next) => {
        stateChanges.push(`${prev}->${next}`);
      });

      // Rapid state changes
      for (let i = 0; i < 100; i++) {
        reconnector.notifyConnected();
        reconnector.notifyDisconnected('test');
      }

      expect(stateChanges.length).toBeGreaterThan(0);
      expect(reconnector.getStats().state).toBe('idle');
    });

    it('should handle very large attempt numbers in calculation', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1,
        backoffFactor: 1.1,
        maxDelayMs: 60000,
        jitterStrategy: 'none',
      });

      // Should not overflow or take excessive time
      const startTime = Date.now();
      const delay = reconnector.calculateDelay(1000);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(Number.isFinite(delay)).toBe(true);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(60000); // Respects maxDelayMs
    });
  });

  describe('Jitter Strategy Edge Cases', () => {
    beforeEach(() => {
      // Mock Math.random for predictable tests
      vi.spyOn(Math, 'random').mockReturnValue(0.75);
    });

    afterEach(() => {
      vi.mocked(Math.random).mockRestore();
    });

    it('should handle jitter with zero base delay', () => {
      const strategies = ['full', 'equal', 'decorrelated'] as const;

      strategies.forEach(strategy => {
        reconnector = new ExponentialBackoffReconnector({
          baseDelayMs: 0,
          jitterStrategy: strategy,
        });

        const delay = reconnector.calculateDelay(1);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(delay)).toBe(true);

        reconnector.destroy();
      });
    });

    it('should handle decorrelated jitter with extreme values', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: Number.MAX_SAFE_INTEGER / 1000,
        maxDelayMs: Number.MAX_SAFE_INTEGER,
        jitterStrategy: 'decorrelated',
      });

      const delay = reconnector.calculateDelay(1);
      expect(Number.isFinite(delay)).toBe(true);
      expect(delay).toBeGreaterThan(0);
    });

    it('should handle jitter with maxDelayMs smaller than baseDelayMs', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        maxDelayMs: 500,
        jitterStrategy: 'equal',
      });

      const delay = reconnector.calculateDelay(1);
      expect(delay).toBeLessThanOrEqual(500);
      expect(delay).toBeGreaterThan(0);
    });
  });

  describe('Task Retry Edge Cases', () => {
    let mockStore: any;

    beforeEach(() => {
      mockStore = {
        getTask: vi.fn(),
        updateTask: vi.fn(),
        addLog: vi.fn(),
        getConfig: vi.fn().mockResolvedValue({}),
      };

      orchestrator = new ApexOrchestrator();
      (orchestrator as any).store = mockStore;
      orchestrator.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    });

    it('should handle task with extremely high maxRetries', () => {
      const task = createTask({
        description: 'High retry task',
        maxRetries: Number.MAX_SAFE_INTEGER,
      });

      expect(task.maxRetries).toBe(Number.MAX_SAFE_INTEGER);
      expect(task.retryCount).toBe(0);

      // Verify that retry logic can handle this
      const shouldRetry = task.retryCount < task.maxRetries;
      expect(shouldRetry).toBe(true);
    });

    it('should handle task with floating point maxRetries', () => {
      // Even though types might say integer, test runtime behavior
      const task = createTask({
        description: 'Float retry task',
        maxRetries: 3.7,
      });

      // Should handle gracefully (likely floor or round)
      expect(typeof task.maxRetries).toBe('number');
      expect(task.retryCount).toBe(0);
    });

    it('should handle task retry count exceeding maxRetries', () => {
      const task = createTask({
        description: 'Over-retry task',
        maxRetries: 3,
      });

      // Simulate a corrupted state where retryCount > maxRetries
      task.retryCount = 5;

      const shouldRetry = task.retryCount < task.maxRetries;
      expect(shouldRetry).toBe(false);
    });

    it('should handle concurrent task retry operations', async () => {
      const task = createTask({
        description: 'Concurrent retry task',
        maxRetries: 3,
      });
      task.id = 'concurrent-task';

      mockStore.getTask.mockResolvedValue(task);

      // Simulate multiple concurrent retry attempts
      const promises = Array.from({ length: 5 }, () =>
        orchestrator.handleRetry(task.id).catch(() => {
          // Ignore errors for this test
        })
      );

      await Promise.allSettled(promises);

      // Verify store interactions happened
      expect(mockStore.getTask).toHaveBeenCalled();
    });
  });
});