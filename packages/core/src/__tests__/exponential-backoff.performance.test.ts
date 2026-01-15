/**
 * Performance tests for ExponentialBackoffReconnector
 *
 * Tests performance characteristics of the exponential backoff algorithm
 * under various load conditions and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExponentialBackoffReconnector,
  type ExponentialBackoffConfig,
} from '../exponential-backoff.js';

describe('ExponentialBackoffReconnector Performance Tests', () => {
  let reconnector: ExponentialBackoffReconnector;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    reconnector?.destroy();
    vi.useRealTimers();
  });

  describe('Calculation Performance', () => {
    it('should calculate delays efficiently for large attempt numbers', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        backoffFactor: 2,
        maxDelayMs: 60000,
        jitterStrategy: 'none',
      });

      const startTime = performance.now();
      const results: number[] = [];

      // Test calculation performance for many attempts
      for (let attempt = 1; attempt <= 1000; attempt++) {
        results.push(reconnector.calculateDelay(attempt));
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete calculations in reasonable time
      expect(executionTime).toBeLessThan(50); // Less than 50ms for 1000 calculations

      // Verify some key results to ensure calculations are correct
      expect(results[0]).toBe(100); // 100 * 2^0
      expect(results[1]).toBe(200); // 100 * 2^1
      expect(results[9]).toBe(51200); // 100 * 2^9 = 51200, capped at 60000
      expect(results[999]).toBe(60000); // All high attempts should be capped
    });

    it('should handle rapid successive delay calculations with jitter', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 1.5,
        maxDelayMs: 30000,
        jitterStrategy: 'equal',
      });

      const startTime = performance.now();
      const results: number[] = [];

      // Calculate many delays rapidly
      for (let i = 0; i < 10000; i++) {
        const attempt = (i % 50) + 1; // Cycle through attempts 1-50
        results.push(reconnector.calculateDelay(attempt));
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete in reasonable time even with jitter
      expect(executionTime).toBeLessThan(100); // Less than 100ms for 10000 calculations
      expect(results).toHaveLength(10000);

      // All results should be positive and reasonable
      results.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(30000);
      });
    });

    it('should handle extreme backoff factors efficiently', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1,
        backoffFactor: 10, // Very high factor
        maxDelayMs: 1000000,
        jitterStrategy: 'none',
      });

      const startTime = performance.now();

      // Calculate delays for many attempts with high factor
      const results: number[] = [];
      for (let attempt = 1; attempt <= 100; attempt++) {
        results.push(reconnector.calculateDelay(attempt));
      }

      const endTime = performance.now();

      // Should still be fast even with extreme values
      expect(endTime - startTime).toBeLessThan(10);

      // Verify exponential growth and capping
      expect(results[0]).toBe(1); // 1 * 10^0
      expect(results[1]).toBe(10); // 1 * 10^1
      expect(results[2]).toBe(100); // 1 * 10^2
      expect(results[5]).toBe(1000000); // Should be capped at maxDelayMs
    });

    it('should perform well with decorrelated jitter strategy', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 60000,
        jitterStrategy: 'decorrelated',
      });

      const startTime = performance.now();
      const results: number[] = [];

      // Decorrelated jitter is more complex - test its performance
      for (let attempt = 1; attempt <= 1000; attempt++) {
        results.push(reconnector.calculateDelay(attempt));
      }

      const endTime = performance.now();

      // Should still be performant despite more complex calculation
      expect(endTime - startTime).toBeLessThan(50);
      expect(results).toHaveLength(1000);

      // All results should be within expected bounds
      results.forEach((delay, index) => {
        const attempt = index + 1;
        expect(delay).toBeGreaterThanOrEqual(1000); // At least baseDelayMs
        expect(delay).toBeLessThanOrEqual(60000); // At most maxDelayMs
      });
    });
  });

  describe('Event Emission Performance', () => {
    it('should handle many event listeners efficiently', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      const listeners: Array<vi.MockedFunction<any>> = [];

      // Add many event listeners
      for (let i = 0; i < 1000; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        reconnector.on('state:changed', listener);
      }

      const startTime = performance.now();

      // Trigger state change to fire all listeners
      reconnector.notifyConnected();

      const endTime = performance.now();

      // Should handle many listeners efficiently
      expect(endTime - startTime).toBeLessThan(50);

      // All listeners should have been called
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith('idle', 'connected');
      });
    });

    it('should handle rapid event emissions efficiently', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 10,
      });

      const events: string[] = [];
      const listener = vi.fn((prev, next) => {
        events.push(`${prev}->${next}`);
      });

      reconnector.on('state:changed', listener);

      const startTime = performance.now();

      // Rapidly trigger many state changes
      for (let i = 0; i < 1000; i++) {
        const connectFn = vi.fn().mockResolvedValue(undefined);
        reconnector.scheduleReconnect(connectFn);
        reconnector.notifyConnectionFailed('test error');
      }

      const endTime = performance.now();

      // Should handle rapid events efficiently
      expect(endTime - startTime).toBeLessThan(100);

      // Events should be recorded
      expect(events.length).toBeGreaterThan(0);
    });

    it('should maintain performance with mixed event types', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 5,
      });

      const allEvents: string[] = [];

      // Add listeners for all event types
      reconnector.on('state:changed', () => allEvents.push('state'));
      reconnector.on('reconnect:attempt', () => allEvents.push('attempt'));
      reconnector.on('reconnect:success', () => allEvents.push('success'));
      reconnector.on('reconnect:failure', () => allEvents.push('failure'));
      reconnector.on('reconnect:exhausted', () => allEvents.push('exhausted'));

      const startTime = performance.now();

      // Trigger multiple event types rapidly
      for (let i = 0; i < 100; i++) {
        const connectFn = vi.fn().mockResolvedValue(undefined);
        reconnector.scheduleReconnect(connectFn);

        if (i % 3 === 0) {
          reconnector.notifyConnected();
        } else if (i % 3 === 1) {
          reconnector.notifyConnectionFailed('error');
        } else {
          reconnector.notifyDisconnected('disconnect');
        }
      }

      const endTime = performance.now();

      // Should handle mixed events efficiently
      expect(endTime - startTime).toBeLessThan(100);
      expect(allEvents.length).toBeGreaterThan(100);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not accumulate memory with repeated operations', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      const initialStats = reconnector.getStats();

      // Perform many reconnection cycles
      for (let cycle = 0; cycle < 1000; cycle++) {
        // Simulate a complete reconnection cycle
        reconnector.notifyDisconnected('cycle disconnect');

        const connectFn = vi.fn().mockResolvedValue(undefined);
        reconnector.scheduleReconnect(connectFn);

        // Advance minimal time to trigger connection attempt
        vi.advanceTimersByTime(100);

        // Sometimes succeed, sometimes fail
        if (cycle % 3 === 0) {
          reconnector.notifyConnected();
        } else {
          reconnector.notifyConnectionFailed('cycle error');
        }

        reconnector.reset();
      }

      const finalStats = reconnector.getStats();

      // Stats should be reset properly (no memory accumulation)
      expect(finalStats.currentAttempt).toBe(0);
      expect(finalStats.totalReconnections).toBe(0);
      expect(finalStats.lastDelayMs).toBe(0);
      expect(finalStats.state).toBe('idle');
    });

    it('should handle rapid listener add/remove operations efficiently', () => {
      reconnector = new ExponentialBackoffReconnector();

      const startTime = performance.now();

      // Rapidly add and remove listeners
      for (let i = 0; i < 1000; i++) {
        const listener = vi.fn();

        // Add listener
        reconnector.on('state:changed', listener);
        expect(reconnector.listenerCount('state:changed')).toBe(1);

        // Remove listener
        reconnector.off('state:changed', listener);
        expect(reconnector.listenerCount('state:changed')).toBe(0);
      }

      const endTime = performance.now();

      // Should handle rapid add/remove efficiently
      expect(endTime - startTime).toBeLessThan(100);

      // No listeners should remain
      expect(reconnector.listenerCount('state:changed')).toBe(0);
    });

    it('should clean up efficiently when destroying with many listeners', () => {
      reconnector = new ExponentialBackoffReconnector();

      const listeners: Array<() => void> = [];

      // Add many listeners
      for (let i = 0; i < 10000; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        reconnector.on('state:changed', listener);
      }

      expect(reconnector.listenerCount('state:changed')).toBe(10000);

      const startTime = performance.now();

      // Destroy should clean up all listeners efficiently
      reconnector.destroy();

      const endTime = performance.now();

      // Should clean up quickly even with many listeners
      expect(endTime - startTime).toBeLessThan(50);
      expect(reconnector.listenerCount('state:changed')).toBe(0);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent scheduleReconnect calls efficiently', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 10,
        jitterStrategy: 'none',
      });

      const connectFns: Array<vi.MockedFunction<any>> = [];

      const startTime = performance.now();

      // Schedule many reconnection attempts concurrently
      for (let i = 0; i < 1000; i++) {
        const connectFn = vi.fn().mockResolvedValue(undefined);
        connectFns.push(connectFn);
        reconnector.scheduleReconnect(connectFn);
      }

      const endTime = performance.now();

      // Should handle concurrent scheduling efficiently
      expect(endTime - startTime).toBeLessThan(100);

      // Only the last function should be scheduled (others should be cleared)
      expect(reconnector.getStats().currentAttempt).toBe(1000);

      // Advance time to trigger the last scheduled connection
      vi.advanceTimersByTime(reconnector.calculateDelay(1000));

      // Only the last connect function should be called
      const calledFunctions = connectFns.filter(fn => fn.mock.calls.length > 0);
      expect(calledFunctions).toHaveLength(1);
      expect(calledFunctions[0]).toBe(connectFns[999]);
    });

    it('should handle rapid configuration updates efficiently', () => {
      reconnector = new ExponentialBackoffReconnector();

      const startTime = performance.now();

      // Rapidly update configuration
      for (let i = 0; i < 1000; i++) {
        reconnector.updateConfig({
          baseDelayMs: 100 + i,
          maxRetries: 3 + (i % 10),
        });
      }

      const endTime = performance.now();

      // Should handle rapid config updates efficiently
      expect(endTime - startTime).toBeLessThan(100);

      // Final config should reflect last update
      const config = reconnector.getConfig();
      expect(config.baseDelayMs).toBe(1099); // 100 + 999
      expect(config.maxRetries).toBe(12); // 3 + (999 % 10)
    });

    it('should maintain performance during stress test scenario', async () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 10,
        backoffFactor: 1.5,
        maxDelayMs: 1000,
        maxRetries: 100,
        jitterStrategy: 'equal',
      });

      const events: string[] = [];
      reconnector.on('reconnect:attempt', () => events.push('attempt'));
      reconnector.on('reconnect:failure', () => events.push('failure'));
      reconnector.on('state:changed', () => events.push('state'));

      const startTime = performance.now();

      // Stress test with many rapid operations
      for (let i = 0; i < 100; i++) {
        const connectFn = vi.fn().mockRejectedValue(new Error('stress test error'));

        // Schedule reconnection
        reconnector.scheduleReconnect(connectFn);

        // Advance time by delay amount
        const delay = reconnector.calculateDelay(i + 1);
        vi.advanceTimersByTime(delay);
        await vi.runAllTimersAsync();

        // Notify of failure
        reconnector.notifyConnectionFailed(`stress error ${i}`);
      }

      const endTime = performance.now();

      // Should complete stress test in reasonable time
      expect(endTime - startTime).toBeLessThan(500);

      // Should have generated appropriate events
      expect(events.length).toBeGreaterThan(100);
      expect(events.filter(e => e === 'attempt').length).toBeGreaterThan(50);
      expect(events.filter(e => e === 'failure').length).toBeGreaterThan(50);
    });
  });

  describe('Real-world Scenario Performance', () => {
    it('should handle realistic reconnection patterns efficiently', async () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 30000,
        maxRetries: 10,
        jitterStrategy: 'equal',
      });

      const startTime = performance.now();
      let totalEvents = 0;

      reconnector.on('state:changed', () => totalEvents++);
      reconnector.on('reconnect:attempt', () => totalEvents++);
      reconnector.on('reconnect:success', () => totalEvents++);
      reconnector.on('reconnect:failure', () => totalEvents++);

      // Simulate realistic usage patterns over time
      for (let scenario = 0; scenario < 50; scenario++) {
        // Scenario 1: Quick successful reconnection
        if (scenario % 4 === 0) {
          reconnector.notifyDisconnected('brief outage');

          const connectFn = vi.fn().mockResolvedValue(undefined);
          reconnector.scheduleReconnect(connectFn);

          vi.advanceTimersByTime(1000);
          await vi.runAllTimersAsync();

          reconnector.notifyConnected();
        }

        // Scenario 2: Multiple failed attempts before success
        else if (scenario % 4 === 1) {
          reconnector.notifyDisconnected('network issue');

          for (let attempt = 1; attempt <= 3; attempt++) {
            const connectFn = vi.fn().mockRejectedValue(new Error('network error'));
            reconnector.scheduleReconnect(connectFn);

            const delay = reconnector.calculateDelay(attempt);
            vi.advanceTimersByTime(delay);
            await vi.runAllTimersAsync();

            if (attempt < 3) {
              reconnector.notifyConnectionFailed('network error');
            } else {
              reconnector.notifyConnected();
            }
          }
        }

        // Scenario 3: Immediate reconnection after disconnect
        else if (scenario % 4 === 2) {
          reconnector.notifyDisconnected('server restart');
          reconnector.notifyConnected(); // Immediate recovery
        }

        // Scenario 4: Configuration update during operation
        else {
          reconnector.updateConfig({
            baseDelayMs: 500 + (scenario * 10),
            maxRetries: 5 + (scenario % 3),
          });
        }

        // Periodically reset to simulate long-running usage
        if (scenario % 10 === 0) {
          reconnector.reset();
        }
      }

      const endTime = performance.now();

      // Should handle realistic scenarios efficiently
      expect(endTime - startTime).toBeLessThan(1000);
      expect(totalEvents).toBeGreaterThan(50);

      // Reconnector should be in a clean state
      const finalStats = reconnector.getStats();
      expect(finalStats.state).toBe('idle');
    });
  });
});