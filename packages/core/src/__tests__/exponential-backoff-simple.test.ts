import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExponentialBackoffReconnector,
  ExponentialBackoffConfig,
  ReconnectionState,
  JitterStrategy,
  DEFAULT_EXPONENTIAL_BACKOFF_CONFIG
} from '../exponential-backoff.js';

describe('ExponentialBackoffReconnector', () => {
  let reconnector: ExponentialBackoffReconnector;

  beforeEach(() => {
    vi.useFakeTimers();
    reconnector = new ExponentialBackoffReconnector();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    reconnector.destroy();
  });

  describe('Configuration and Initialization', () => {
    it('should use default configuration when none provided', () => {
      const defaultReconnector = new ExponentialBackoffReconnector();

      const config = defaultReconnector.getConfig();
      expect(config.baseDelayMs).toBe(DEFAULT_EXPONENTIAL_BACKOFF_CONFIG.baseDelayMs);
      expect(config.backoffFactor).toBe(DEFAULT_EXPONENTIAL_BACKOFF_CONFIG.backoffFactor);
      expect(config.maxDelayMs).toBe(DEFAULT_EXPONENTIAL_BACKOFF_CONFIG.maxDelayMs);
      expect(config.maxRetries).toBe(DEFAULT_EXPONENTIAL_BACKOFF_CONFIG.maxRetries);
      expect(config.jitterStrategy).toBe(DEFAULT_EXPONENTIAL_BACKOFF_CONFIG.jitterStrategy);
    });

    it('should accept custom configuration', () => {
      const customConfig: ExponentialBackoffConfig = {
        baseDelayMs: 500,
        backoffFactor: 1.5,
        maxDelayMs: 60000,
        maxRetries: 5,
        jitterStrategy: 'full'
      };

      const customReconnector = new ExponentialBackoffReconnector(customConfig);

      const config = customReconnector.getConfig();
      expect(config).toEqual(customConfig);
    });

    it('should merge partial configuration with defaults', () => {
      const partialConfig = {
        baseDelayMs: 2000,
        maxRetries: 10
      };

      const customReconnector = new ExponentialBackoffReconnector(partialConfig);
      const config = customReconnector.getConfig();

      expect(config.baseDelayMs).toBe(2000);
      expect(config.maxRetries).toBe(10);
      expect(config.backoffFactor).toBe(DEFAULT_EXPONENTIAL_BACKOFF_CONFIG.backoffFactor);
    });
  });

  describe('Delay Calculation', () => {
    it('should calculate exponential delays correctly', () => {
      const testReconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 30000,
        maxRetries: 5,
        jitterStrategy: 'none'
      });

      expect(testReconnector.calculateDelay(1)).toBe(1000);
      expect(testReconnector.calculateDelay(2)).toBe(2000);
      expect(testReconnector.calculateDelay(3)).toBe(4000);
      expect(testReconnector.calculateDelay(4)).toBe(8000);
      expect(testReconnector.calculateDelay(5)).toBe(16000);
    });

    it('should respect maximum delay', () => {
      const testReconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 5000,
        maxRetries: 10,
        jitterStrategy: 'none'
      });

      expect(testReconnector.calculateDelay(1)).toBe(1000);
      expect(testReconnector.calculateDelay(2)).toBe(2000);
      expect(testReconnector.calculateDelay(3)).toBe(4000);
      expect(testReconnector.calculateDelay(4)).toBe(5000); // Capped
      expect(testReconnector.calculateDelay(5)).toBe(5000); // Capped
    });

    it('should throw for invalid attempt numbers', () => {
      expect(() => reconnector.calculateDelay(0)).toThrow();
      expect(() => reconnector.calculateDelay(-1)).toThrow();
    });
  });

  describe('Jitter Strategies', () => {
    it('should apply no jitter for "none" strategy', () => {
      const testReconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 30000,
        maxRetries: 3,
        jitterStrategy: 'none'
      });

      const delay1 = testReconnector.calculateDelay(1);
      const delay2 = testReconnector.calculateDelay(1);

      expect(delay1).toBe(delay2);
      expect(delay1).toBe(1000);
    });

    it('should apply full jitter strategy', () => {
      const testReconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 30000,
        maxRetries: 3,
        jitterStrategy: 'full'
      });

      const delays = Array.from({ length: 10 }, () =>
        testReconnector.calculateDelay(1)
      );

      // With full jitter, delays should vary but be <= baseDelayMs
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
      expect(delays.every(delay => delay <= 1000 && delay >= 0)).toBe(true);
    });

    it('should apply equal jitter strategy', () => {
      const testReconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 30000,
        maxRetries: 3,
        jitterStrategy: 'equal'
      });

      const delays = Array.from({ length: 10 }, () =>
        testReconnector.calculateDelay(1)
      );

      // With equal jitter, delays should be between baseDelayMs/2 and baseDelayMs
      expect(delays.every(delay => delay >= 500 && delay <= 1000)).toBe(true);
    });

    it('should apply decorrelated jitter strategy', () => {
      const testReconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 30000,
        maxRetries: 3,
        jitterStrategy: 'decorrelated'
      });

      const delays = Array.from({ length: 10 }, () =>
        testReconnector.calculateDelay(2) // Use attempt 2 for more interesting range
      );

      // Decorrelated jitter should produce varied delays
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
      expect(delays.every(delay => delay > 0)).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should start in idle state', () => {
      expect(reconnector.getStats().state).toBe('idle');
    });

    it('should track statistics correctly', () => {
      const stats = reconnector.getStats();
      expect(stats.currentAttempt).toBe(0);
      expect(stats.totalReconnections).toBe(0);
      expect(stats.state).toBe('idle');
    });

    it('should emit state change events', () => {
      const stateChanges: Array<{prev: ReconnectionState, next: ReconnectionState}> = [];

      reconnector.on('state:changed', (prev, next) => {
        stateChanges.push({ prev, next });
      });

      // Simulate state changes
      reconnector.notifyDisconnected('Connection lost');
      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0]).toEqual({ prev: 'idle', next: 'idle' });
    });
  });

  describe('Reconnection Logic', () => {
    it('should schedule reconnections with calculated delays', () => {
      const mockConnectFn = vi.fn().mockResolvedValue(undefined);
      const attemptEvents: Array<{attempt: number, delay: number}> = [];

      reconnector.on('reconnect:attempt', (attempt, delay) => {
        attemptEvents.push({ attempt, delay });
      });

      reconnector.scheduleReconnect(mockConnectFn);

      // Should immediately schedule first attempt
      expect(attemptEvents).toHaveLength(1);
      expect(attemptEvents[0].attempt).toBe(1);
    });

    it('should handle connection failures and retry', async () => {
      let callCount = 0;
      const mockConnectFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Connection failed');
        }
        return Promise.resolve();
      });

      const events: string[] = [];
      reconnector.on('reconnect:failure', () => events.push('failure'));
      reconnector.on('reconnect:success', () => events.push('success'));

      reconnector.notifyDisconnected('Test disconnection');
      reconnector.scheduleReconnect(mockConnectFn);

      // Fast-forward through retries
      await vi.runAllTimersAsync();

      expect(events).toContain('failure');
      expect(events).toContain('success');
    });

    it('should stop retrying after max attempts', async () => {
      const mockConnectFn = vi.fn().mockRejectedValue(new Error('Always fails'));

      const exhaustedEvents: Array<{attempts: number, error: string}> = [];
      reconnector.on('reconnect:exhausted', (attempts, error) => {
        exhaustedEvents.push({ attempts, error });
      });

      reconnector.notifyDisconnected('Test disconnection');
      reconnector.scheduleReconnect(mockConnectFn);

      await vi.runAllTimersAsync();

      expect(exhaustedEvents).toHaveLength(1);
      expect(exhaustedEvents[0].attempts).toBe(DEFAULT_EXPONENTIAL_BACKOFF_CONFIG.maxRetries + 1);
    });
  });

  describe('Lifecycle Management', () => {
    it('should allow stopping reconnection attempts', () => {
      const mockConnectFn = vi.fn().mockRejectedValue(new Error('Failed'));

      reconnector.notifyDisconnected('Test');
      reconnector.scheduleReconnect(mockConnectFn);

      reconnector.destroy();

      // Advance time - should not trigger more connection attempts
      vi.advanceTimersByTime(30000);

      expect(mockConnectFn).toHaveBeenCalledTimes(1); // Only initial attempt
    });

    it('should reset state when stopped', () => {
      reconnector.notifyDisconnected('Test');

      expect(reconnector.getStats().state).toBe('idle');

      reconnector.reset();

      expect(reconnector.getStats().state).toBe('idle');
      expect(reconnector.getStats().currentAttempt).toBe(0);
    });

    it('should handle successful connection notification', () => {
      const successEvents: Array<{attempt: number, totalTime: number}> = [];

      reconnector.on('reconnect:success', (attempt, totalTime) => {
        successEvents.push({ attempt, totalTime });
      });

      reconnector.notifyDisconnected('Test');
      reconnector.notifyConnected();

      expect(reconnector.isConnected()).toBe(true);
      expect(successEvents).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection function throwing synchronously', () => {
      const mockConnectFn = vi.fn().mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      const failureEvents: string[] = [];
      reconnector.on('reconnect:failure', (attempt, error) => {
        failureEvents.push(error);
      });

      reconnector.notifyDisconnected('Test');
      reconnector.scheduleReconnect(mockConnectFn);

      expect(failureEvents).toHaveLength(1);
      expect(failureEvents[0]).toContain('Synchronous error');
    });

    it('should handle invalid configuration gracefully', () => {
      expect(() => {
        new ExponentialBackoffReconnector({
          baseDelayMs: -1000
        });
      }).toThrow();

      expect(() => {
        new ExponentialBackoffReconnector({
          backoffFactor: 0.5
        });
      }).toThrow();
    });
  });

  describe('Advanced Features', () => {
    it('should provide configuration access', () => {
      const config = reconnector.getConfig();

      expect(config).toHaveProperty('baseDelayMs');
      expect(config).toHaveProperty('backoffFactor');
      expect(config).toHaveProperty('maxDelayMs');
      expect(config).toHaveProperty('maxRetries');
      expect(config).toHaveProperty('jitterStrategy');
    });

    it('should track detailed statistics', () => {
      const stats = reconnector.getStats();

      expect(stats).toHaveProperty('currentAttempt');
      expect(stats).toHaveProperty('totalReconnections');
      expect(stats).toHaveProperty('lastDelayMs');
      expect(stats).toHaveProperty('state');
    });

    it('should handle rapid disconnect/connect cycles', () => {
      for (let i = 0; i < 5; i++) {
        reconnector.notifyDisconnected(`Disconnect ${i}`);
        reconnector.notifyConnected();
      }

      expect(reconnector.getState()).toBe('connected');
      expect(reconnector.getStats().totalReconnections).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle notification when already in target state', () => {
      // Multiple disconnect notifications
      reconnector.notifyDisconnected('First');
      const state1 = reconnector.getState();
      reconnector.notifyDisconnected('Second');
      const state2 = reconnector.getState();

      expect(state1).toBe(state2);

      // Multiple connect notifications
      reconnector.notifyConnected();
      const state3 = reconnector.getState();
      reconnector.notifyConnected();
      const state4 = reconnector.getState();

      expect(state3).toBe(state4);
    });

    it('should handle very large attempt numbers', () => {
      const testReconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1,
        backoffFactor: 2,
        maxDelayMs: Number.MAX_SAFE_INTEGER,
        maxRetries: 100,
        jitterStrategy: 'none'
      });

      // Should not overflow or throw
      expect(() => {
        testReconnector.calculateDelay(50);
        testReconnector.calculateDelay(100);
      }).not.toThrow();
    });

    it('should handle zero base delay', () => {
      const testReconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 0,
        backoffFactor: 2,
        maxDelayMs: 1000,
        maxRetries: 3,
        jitterStrategy: 'none'
      });

      expect(testReconnector.calculateDelay(1)).toBe(0);
      expect(testReconnector.calculateDelay(2)).toBe(0);
    });
  });
});