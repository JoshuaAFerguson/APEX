/**
 * Edge case tests for ExponentialBackoffReconnector
 *
 * Tests edge cases and error conditions for the exponential backoff
 * reconnector, particularly focusing on cleanup and resource management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExponentialBackoffReconnector,
  type ExponentialBackoffConfig,
  type ReconnectionState,
} from '../exponential-backoff.js';

describe('ExponentialBackoffReconnector Edge Cases', () => {
  let reconnector: ExponentialBackoffReconnector;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    reconnector?.destroy();
    vi.useRealTimers();
  });

  describe('Cleanup and Resource Management', () => {
    it('should clean up timers when notifyDisconnected is called during reconnection', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      const connectFn = vi.fn().mockResolvedValue(undefined);

      // Schedule a reconnection
      reconnector.scheduleReconnect(connectFn);
      expect(reconnector.getStats().currentAttempt).toBe(1);

      // Notify disconnected should clear the timer and reset state
      reconnector.notifyDisconnected('forced disconnect');

      const stats = reconnector.getStats();
      expect(stats.state).toBe('idle');
      expect(stats.currentAttempt).toBe(0);
      expect(stats.lastError).toBe('forced disconnect');

      // Advance time - connection function should not be called
      vi.advanceTimersByTime(1000);
      expect(connectFn).not.toHaveBeenCalled();
    });

    it('should handle notifyDisconnected called multiple times', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      // Call notifyDisconnected multiple times
      reconnector.notifyDisconnected('error 1');
      reconnector.notifyDisconnected('error 2');
      reconnector.notifyDisconnected('error 3');

      const stats = reconnector.getStats();
      expect(stats.state).toBe('idle');
      expect(stats.currentAttempt).toBe(0);
      expect(stats.lastError).toBe('error 3'); // Should use the latest error
    });

    it('should clean up when destroy is called during active reconnection', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      const connectFn = vi.fn().mockResolvedValue(undefined);
      const stateChangeSpy = vi.fn();
      const attemptSpy = vi.fn();

      reconnector.on('state:changed', stateChangeSpy);
      reconnector.on('reconnect:attempt', attemptSpy);

      // Schedule reconnection
      reconnector.scheduleReconnect(connectFn);

      // Destroy should clean up everything
      reconnector.destroy();

      // Should have removed all listeners
      expect(reconnector.listenerCount('state:changed')).toBe(0);
      expect(reconnector.listenerCount('reconnect:attempt')).toBe(0);

      // Advance time - nothing should happen
      vi.advanceTimersByTime(1000);
      expect(connectFn).not.toHaveBeenCalled();
      expect(stateChangeSpy).not.toHaveBeenCalled();
      expect(attemptSpy).toHaveBeenCalledTimes(1); // Called before destroy
    });

    it('should handle destroy called multiple times safely', () => {
      reconnector = new ExponentialBackoffReconnector();

      const listener = vi.fn();
      reconnector.on('state:changed', listener);

      // Multiple destroy calls should not throw
      expect(() => {
        reconnector.destroy();
        reconnector.destroy();
        reconnector.destroy();
      }).not.toThrow();

      expect(reconnector.listenerCount('state:changed')).toBe(0);
    });

    it('should reset state when updateConfig is called during reconnection', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      const connectFn = vi.fn().mockResolvedValue(undefined);

      // Start reconnection process
      reconnector.scheduleReconnect(connectFn);
      expect(reconnector.getStats().currentAttempt).toBe(1);

      // Update config should reset state
      reconnector.updateConfig({ baseDelayMs: 200 });

      const stats = reconnector.getStats();
      expect(stats.state).toBe('idle');
      expect(stats.currentAttempt).toBe(0);
      expect(stats.totalReconnections).toBe(0);

      // Timer should be cleared
      vi.advanceTimersByTime(1000);
      expect(connectFn).not.toHaveBeenCalled();

      // New config should be applied
      expect(reconnector.getConfig().baseDelayMs).toBe(200);
    });

    it('should handle timer cleanup when scheduleReconnect is called multiple times rapidly', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 5,
        jitterStrategy: 'none',
      });

      const connectFns: Array<vi.MockedFunction<() => Promise<void>>> = [];

      // Schedule multiple reconnections rapidly
      for (let i = 0; i < 5; i++) {
        const connectFn = vi.fn().mockResolvedValue(undefined);
        connectFns.push(connectFn);
        reconnector.scheduleReconnect(connectFn);
      }

      // Only the last function should be scheduled
      expect(reconnector.getStats().currentAttempt).toBe(5);

      // Advance time for the last scheduled delay
      vi.advanceTimersByTime(500); // 100 * 2^4 = 1600ms for attempt 5, but we schedule a new one

      // Only the last connect function should have been called
      connectFns.slice(0, 4).forEach(fn => {
        expect(fn).not.toHaveBeenCalled();
      });
      expect(connectFns[4]).toHaveBeenCalledOnce();
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should handle notifyConnected called when not reconnecting', () => {
      reconnector = new ExponentialBackoffReconnector();

      const successSpy = vi.fn();
      reconnector.on('reconnect:success', successSpy);

      // Call notifyConnected without being in reconnecting state
      reconnector.notifyConnected();

      const stats = reconnector.getStats();
      expect(stats.state).toBe('connected');
      expect(stats.totalReconnections).toBe(0); // No increment since currentAttempt was 0

      // Should not emit success event
      expect(successSpy).not.toHaveBeenCalled();
    });

    it('should handle notifyConnectionFailed when not reconnecting', () => {
      reconnector = new ExponentialBackoffReconnector();

      const failureSpy = vi.fn();
      reconnector.on('reconnect:failure', failureSpy);

      // Call notifyConnectionFailed without being in reconnecting state
      reconnector.notifyConnectionFailed('unexpected error');

      const stats = reconnector.getStats();
      expect(stats.lastError).toBe('unexpected error');
      expect(stats.state).toBe('failed'); // Should go to failed since currentAttempt (0) < maxRetries

      // Should emit failure event
      expect(failureSpy).toHaveBeenCalledWith(0, 'unexpected error');
    });

    it('should handle rapid state transitions correctly', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      const stateChanges: Array<{ prev: ReconnectionState; next: ReconnectionState }> = [];
      reconnector.on('state:changed', (prev, next) => {
        stateChanges.push({ prev, next });
      });

      // Rapid state transitions
      reconnector.notifyDisconnected('error');
      const connectFn = vi.fn().mockResolvedValue(undefined);
      reconnector.scheduleReconnect(connectFn);
      reconnector.notifyConnectionFailed('failed');
      reconnector.scheduleReconnect(connectFn);
      reconnector.notifyConnected();

      const expectedTransitions = [
        { prev: 'idle', next: 'reconnecting' },
        { prev: 'reconnecting', next: 'idle' },
        { prev: 'idle', next: 'reconnecting' },
        { prev: 'reconnecting', next: 'connected' },
      ];

      expect(stateChanges).toEqual(expectedTransitions);
    });

    it('should not emit duplicate state change events', () => {
      reconnector = new ExponentialBackoffReconnector();

      const stateChangeSpy = vi.fn();
      reconnector.on('state:changed', stateChangeSpy);

      // Multiple calls to the same state
      reconnector.notifyConnected();
      reconnector.notifyConnected();
      reconnector.notifyConnected();

      // Should only emit one state change
      expect(stateChangeSpy).toHaveBeenCalledTimes(1);
      expect(stateChangeSpy).toHaveBeenCalledWith('idle', 'connected');
    });
  });

  describe('Concurrent Operation Edge Cases', () => {
    it('should handle overlapping reset and scheduleReconnect calls', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      const connectFn = vi.fn().mockResolvedValue(undefined);

      // Schedule reconnection
      reconnector.scheduleReconnect(connectFn);

      // Reset while reconnection is scheduled
      reconnector.reset();

      // Should be in idle state
      expect(reconnector.getStats().state).toBe('idle');
      expect(reconnector.getStats().currentAttempt).toBe(0);

      // Timer should be cleared
      vi.advanceTimersByTime(1000);
      expect(connectFn).not.toHaveBeenCalled();
    });

    it('should handle notifyConnected called during scheduled reconnection', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });

      const connectFn = vi.fn().mockResolvedValue(undefined);

      // Schedule reconnection
      reconnector.scheduleReconnect(connectFn);

      // Before timer fires, notify connected externally
      reconnector.notifyConnected();

      const stats = reconnector.getStats();
      expect(stats.state).toBe('connected');
      expect(stats.currentAttempt).toBe(0);

      // Timer should be cleared
      vi.advanceTimersByTime(1000);
      expect(connectFn).not.toHaveBeenCalled();
    });

    it('should handle async connect function that throws synchronously', async () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 2,
      });

      const failureSpy = vi.fn();
      reconnector.on('reconnect:failure', failureSpy);

      // Connect function that throws synchronously
      const connectFn = vi.fn().mockImplementation(() => {
        throw new Error('Synchronous connection error');
      });

      reconnector.scheduleReconnect(connectFn);

      // Advance timer to trigger connection
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Should handle the error
      expect(failureSpy).toHaveBeenCalledWith(1, 'Synchronous connection error');
      expect(reconnector.getStats().lastError).toBe('Synchronous connection error');
    });

    it('should handle async connect function that rejects', async () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 2,
      });

      const failureSpy = vi.fn();
      reconnector.on('reconnect:failure', failureSpy);

      // Connect function that rejects
      const connectFn = vi.fn().mockRejectedValue(new Error('Async connection error'));

      reconnector.scheduleReconnect(connectFn);

      // Advance timer to trigger connection
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Should handle the rejection
      expect(failureSpy).toHaveBeenCalledWith(1, 'Async connection error');
      expect(reconnector.getStats().lastError).toBe('Async connection error');
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should not leak memory with many event listeners', () => {
      reconnector = new ExponentialBackoffReconnector();

      // Add many listeners
      const listeners: Array<() => void> = [];
      for (let i = 0; i < 1000; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        reconnector.on('state:changed', listener);
      }

      expect(reconnector.listenerCount('state:changed')).toBe(1000);

      // Remove all listeners
      listeners.forEach(listener => {
        reconnector.off('state:changed', listener);
      });

      expect(reconnector.listenerCount('state:changed')).toBe(0);
    });

    it('should handle rapid calculateDelay calls efficiently', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1,
        backoffFactor: 2,
        maxDelayMs: 1000,
        jitterStrategy: 'none',
      });

      const startTime = Date.now();

      // Calculate many delays
      const delays: number[] = [];
      for (let i = 1; i <= 10000; i++) {
        delays.push(reconnector.calculateDelay(i));
      }

      const endTime = Date.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100);

      // All delays should be calculated correctly
      expect(delays).toHaveLength(10000);
      expect(delays[0]).toBe(1); // 1 * 2^0
      expect(delays[9]).toBe(512); // 1 * 2^9
      expect(delays[999]).toBe(1000); // Capped at maxDelayMs
    });

    it('should handle extreme configuration values', () => {
      // Test with very large values
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: Number.MAX_SAFE_INTEGER / 1000,
        backoffFactor: 1.1,
        maxDelayMs: Number.MAX_SAFE_INTEGER,
        maxRetries: 1000000,
      });

      // Should not crash or produce invalid results
      expect(() => {
        const delay = reconnector.calculateDelay(1);
        expect(delay).toBeGreaterThan(0);
        expect(delay).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
      }).not.toThrow();

      // Test with very small values
      reconnector.updateConfig({
        baseDelayMs: 0.1,
        backoffFactor: 1.01,
        maxDelayMs: 1,
        maxRetries: 0,
      });

      expect(() => {
        const delay = reconnector.calculateDelay(1);
        expect(delay).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle non-Error objects in notifyConnectionFailed', () => {
      reconnector = new ExponentialBackoffReconnector({
        maxRetries: 3,
      });

      const failureSpy = vi.fn();
      reconnector.on('reconnect:failure', failureSpy);

      // Should convert non-string errors to strings
      reconnector.notifyConnectionFailed(null as any);
      expect(reconnector.getStats().lastError).toBe('null');

      reconnector.notifyConnectionFailed(undefined as any);
      expect(reconnector.getStats().lastError).toBe('undefined');

      reconnector.notifyConnectionFailed(42 as any);
      expect(reconnector.getStats().lastError).toBe('42');

      reconnector.notifyConnectionFailed({ message: 'object error' } as any);
      expect(reconnector.getStats().lastError).toBe('[object Object]');
    });

    it('should handle invalid jitter strategies gracefully', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        jitterStrategy: 'invalid' as any,
      });

      // Should default to no jitter for unknown strategies
      const delay = reconnector.calculateDelay(1);
      expect(delay).toBe(1000);
    });

    it('should handle event emission errors gracefully', () => {
      reconnector = new ExponentialBackoffReconnector();

      // Add a listener that throws
      const badListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      reconnector.on('state:changed', badListener);
      reconnector.on('state:changed', goodListener);

      // Should not crash when emitting events
      expect(() => {
        reconnector.notifyConnected();
      }).not.toThrow();

      // Good listener should still be called
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('Configuration Validation Edge Cases', () => {
    it('should handle partial configuration updates correctly', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 10000,
        maxRetries: 5,
        jitterStrategy: 'equal',
      });

      // Update only some properties
      reconnector.updateConfig({
        baseDelayMs: 500,
        maxRetries: 10,
      });

      const config = reconnector.getConfig();
      expect(config.baseDelayMs).toBe(500);
      expect(config.maxRetries).toBe(10);
      // Other properties should remain unchanged
      expect(config.backoffFactor).toBe(2);
      expect(config.maxDelayMs).toBe(10000);
      expect(config.jitterStrategy).toBe('equal');
    });

    it('should handle empty configuration updates', () => {
      const originalConfig = {
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 10000,
        maxRetries: 5,
        jitterStrategy: 'equal' as const,
      };

      reconnector = new ExponentialBackoffReconnector(originalConfig);

      // Update with empty object
      reconnector.updateConfig({});

      const config = reconnector.getConfig();
      expect(config).toEqual(originalConfig);
    });
  });
});