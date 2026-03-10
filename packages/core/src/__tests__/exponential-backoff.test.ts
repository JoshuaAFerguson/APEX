import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExponentialBackoffReconnector,
  type ExponentialBackoffConfig,
  type ReconnectionState,
  type JitterStrategy,
  DEFAULT_EXPONENTIAL_BACKOFF_CONFIG,
} from '../exponential-backoff';

describe('ExponentialBackoffReconnector', () => {
  let reconnector: ExponentialBackoffReconnector;

  beforeEach(() => {
    // Reset timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    reconnector?.destroy();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      reconnector = new ExponentialBackoffReconnector();
      expect(reconnector.getConfig()).toEqual(DEFAULT_EXPONENTIAL_BACKOFF_CONFIG);
    });

    it('should merge provided config with defaults', () => {
      const customConfig: Partial<ExponentialBackoffConfig> = {
        baseDelayMs: 500,
        maxRetries: 10,
      };
      reconnector = new ExponentialBackoffReconnector(customConfig);

      const config = reconnector.getConfig();
      expect(config.baseDelayMs).toBe(500);
      expect(config.maxRetries).toBe(10);
      expect(config.backoffFactor).toBe(DEFAULT_EXPONENTIAL_BACKOFF_CONFIG.backoffFactor);
    });

    it('should start in idle state', () => {
      reconnector = new ExponentialBackoffReconnector();
      const stats = reconnector.getStats();
      expect(stats.state).toBe('idle');
      expect(stats.currentAttempt).toBe(0);
      expect(stats.totalReconnections).toBe(0);
    });
  });

  describe('calculateDelay', () => {
    beforeEach(() => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 10000,
        jitterStrategy: 'none', // No jitter for predictable tests
      });
    });

    it('should calculate exponential delays correctly', () => {
      expect(reconnector.calculateDelay(1)).toBe(1000); // 1000 * 2^0 = 1000
      expect(reconnector.calculateDelay(2)).toBe(2000); // 1000 * 2^1 = 2000
      expect(reconnector.calculateDelay(3)).toBe(4000); // 1000 * 2^2 = 4000
      expect(reconnector.calculateDelay(4)).toBe(8000); // 1000 * 2^3 = 8000
    });

    it('should cap delay at maxDelayMs', () => {
      expect(reconnector.calculateDelay(5)).toBe(10000); // Would be 16000, capped at 10000
      expect(reconnector.calculateDelay(10)).toBe(10000); // Much higher, still capped
    });

    it('should throw error for invalid attempt numbers', () => {
      expect(() => reconnector.calculateDelay(0)).toThrow('Attempt number must be positive');
      expect(() => reconnector.calculateDelay(-1)).toThrow('Attempt number must be positive');
    });

    it('should handle different backoff factors', () => {
      reconnector.updateConfig({ backoffFactor: 1.5 });
      expect(reconnector.calculateDelay(1)).toBe(1000); // 1000 * 1.5^0 = 1000
      expect(reconnector.calculateDelay(2)).toBe(1500); // 1000 * 1.5^1 = 1500
      expect(reconnector.calculateDelay(3)).toBe(2250); // 1000 * 1.5^2 = 2250
    });
  });

  describe('jitter strategies', () => {
    beforeEach(() => {
      // Mock Math.random to return 0.5 for predictable jitter tests
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.mocked(Math.random).mockRestore();
    });

    it('should apply no jitter with "none" strategy', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        jitterStrategy: 'none',
      });
      expect(reconnector.calculateDelay(1)).toBe(1000);
      expect(reconnector.calculateDelay(2)).toBe(2000);
    });

    it('should apply full jitter with "full" strategy', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        jitterStrategy: 'full',
      });
      // With Math.random() = 0.5, full jitter should be 0.5 * delay
      expect(reconnector.calculateDelay(1)).toBe(500); // 0.5 * 1000
      expect(reconnector.calculateDelay(2)).toBe(1000); // 0.5 * 2000
    });

    it('should apply equal jitter with "equal" strategy', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        jitterStrategy: 'equal',
      });
      // With Math.random() = 0.5, equal jitter should be delay * 0.5 + 0.5 * delay * 0.5 = 0.75 * delay
      expect(reconnector.calculateDelay(1)).toBe(750); // 500 + 250
      expect(reconnector.calculateDelay(2)).toBe(1500); // 1000 + 500
    });

    it('should apply decorrelated jitter with "decorrelated" strategy', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        jitterStrategy: 'decorrelated',
      });

      const delay1 = reconnector.calculateDelay(1);
      expect(delay1).toBeGreaterThanOrEqual(1000); // min = baseDelayMs
      expect(delay1).toBeLessThanOrEqual(3000); // max = min(delay * 3, maxDelayMs)

      const delay2 = reconnector.calculateDelay(2);
      expect(delay2).toBeGreaterThanOrEqual(1000);
      expect(delay2).toBeLessThanOrEqual(6000);
    });
  });

  describe('state management', () => {
    beforeEach(() => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });
    });

    it('should emit state change events', () => {
      const stateChanges: Array<{ prev: ReconnectionState; next: ReconnectionState }> = [];
      reconnector.on('state:changed', (prev, next) => {
        stateChanges.push({ prev, next });
      });

      reconnector.notifyDisconnected('test error');
      expect(stateChanges).toEqual([]);

      const connectFn = vi.fn().mockResolvedValue(undefined);
      reconnector.scheduleReconnect(connectFn);
      expect(stateChanges).toEqual([{ prev: 'idle', next: 'reconnecting' }]);

      // Advance time to trigger reconnection
      vi.advanceTimersByTime(100);
      expect(stateChanges).toEqual([
        { prev: 'idle', next: 'reconnecting' },
        { prev: 'reconnecting', next: 'connecting' },
      ]);
    });

    it('should track state correctly through connection lifecycle', () => {
      expect(reconnector.getStats().state).toBe('idle');
      expect(reconnector.isConnected()).toBe(false);
      expect(reconnector.isReconnecting()).toBe(false);
      expect(reconnector.isExhausted()).toBe(false);

      reconnector.notifyConnected();
      expect(reconnector.getStats().state).toBe('connected');
      expect(reconnector.isConnected()).toBe(true);

      reconnector.notifyDisconnected('connection lost');
      expect(reconnector.getStats().state).toBe('idle');

      const connectFn = vi.fn().mockResolvedValue(undefined);
      reconnector.scheduleReconnect(connectFn);
      expect(reconnector.getStats().state).toBe('reconnecting');
      expect(reconnector.isReconnecting()).toBe(true);
    });
  });

  describe('scheduleReconnect', () => {
    beforeEach(() => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
        jitterStrategy: 'none',
      });
    });

    it('should schedule reconnection with correct delay', async () => {
      const connectFn = vi.fn().mockResolvedValue(undefined);
      const attemptSpy = vi.fn();
      reconnector.on('reconnect:attempt', attemptSpy);

      reconnector.scheduleReconnect(connectFn);

      expect(attemptSpy).toHaveBeenCalledWith(1, 100);
      expect(connectFn).not.toHaveBeenCalled();

      // Advance time to trigger reconnection
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(connectFn).toHaveBeenCalledOnce();
    });

    it('should increment attempt counter correctly', () => {
      const connectFn = vi.fn().mockRejectedValue(new Error('failed'));

      expect(reconnector.getStats().currentAttempt).toBe(0);

      reconnector.scheduleReconnect(connectFn);
      expect(reconnector.getStats().currentAttempt).toBe(1);

      vi.advanceTimersByTime(100);
      reconnector.scheduleReconnect(connectFn);
      expect(reconnector.getStats().currentAttempt).toBe(2);
    });

    it('should not schedule beyond max retries', () => {
      const connectFn = vi.fn().mockRejectedValue(new Error('failed'));
      const exhaustedSpy = vi.fn();
      reconnector.on('reconnect:exhausted', exhaustedSpy);

      // Exhaust all attempts
      reconnector.scheduleReconnect(connectFn); // 1
      vi.advanceTimersByTime(100);
      reconnector.scheduleReconnect(connectFn); // 2
      vi.advanceTimersByTime(200);
      reconnector.scheduleReconnect(connectFn); // 3
      vi.advanceTimersByTime(400);

      // Fourth attempt should not be scheduled
      reconnector.scheduleReconnect(connectFn);

      expect(exhaustedSpy).toHaveBeenCalledWith(3, 'Max retries exceeded');
      expect(reconnector.getStats().state).toBe('failed');
      expect(reconnector.isExhausted()).toBe(true);
    });

    it('should clear existing timer when called again', () => {
      const connectFn1 = vi.fn();
      const connectFn2 = vi.fn();

      reconnector.scheduleReconnect(connectFn1);
      reconnector.scheduleReconnect(connectFn2);

      // First function should not be called (timer cleared)
      // Second function delay is calculated for attempt 2 (200ms with backoffFactor 2)
      vi.advanceTimersByTime(100);
      expect(connectFn1).not.toHaveBeenCalled();
      expect(connectFn2).not.toHaveBeenCalled(); // Not yet - delay is 200ms for attempt 2

      vi.advanceTimersByTime(100); // Now at 200ms total
      expect(connectFn1).not.toHaveBeenCalled();
      expect(connectFn2).toHaveBeenCalledOnce();
    });
  });

  describe('notification methods', () => {
    beforeEach(() => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        maxRetries: 3,
      });
    });

    it('should handle notifyDisconnected correctly', () => {
      const connectFn = vi.fn();
      reconnector.scheduleReconnect(connectFn);

      reconnector.notifyDisconnected('network error');

      const stats = reconnector.getStats();
      expect(stats.state).toBe('idle');
      expect(stats.currentAttempt).toBe(0); // Reset on disconnection
      expect(stats.lastError).toBe('network error');

      // Timer should be cleared
      vi.advanceTimersByTime(100);
      expect(connectFn).not.toHaveBeenCalled();
    });

    it('should handle notifyConnected correctly', () => {
      const successSpy = vi.fn();
      reconnector.on('reconnect:success', successSpy);

      // Simulate a reconnection attempt
      const connectFn = vi.fn();
      reconnector.scheduleReconnect(connectFn);

      reconnector.notifyConnected();

      const stats = reconnector.getStats();
      expect(stats.state).toBe('connected');
      expect(stats.currentAttempt).toBe(0); // Reset on success
      expect(stats.totalReconnections).toBe(1);
      expect(stats.lastSuccessTime).toBeInstanceOf(Date);
      expect(successSpy).toHaveBeenCalledWith(1, expect.any(Number));
    });

    it('should handle notifyConnectionFailed correctly', () => {
      const failureSpy = vi.fn();
      reconnector.on('reconnect:failure', failureSpy);

      const connectFn = vi.fn();
      reconnector.scheduleReconnect(connectFn);

      reconnector.notifyConnectionFailed('connection timeout');

      const stats = reconnector.getStats();
      expect(stats.lastError).toBe('connection timeout');
      expect(failureSpy).toHaveBeenCalledWith(1, 'connection timeout');
    });

    it('should emit exhausted event when max retries exceeded', () => {
      const exhaustedSpy = vi.fn();
      reconnector.on('reconnect:exhausted', exhaustedSpy);

      // Set current attempt to max
      for (let i = 0; i < 3; i++) {
        const connectFn = vi.fn();
        reconnector.scheduleReconnect(connectFn);
        vi.advanceTimersByTime(100 * (i + 1));
      }

      reconnector.notifyConnectionFailed('final failure');

      expect(exhaustedSpy).toHaveBeenCalledWith(3, 'final failure');
      expect(reconnector.getStats().state).toBe('failed');
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      reconnector = new ExponentialBackoffReconnector();
    });

    it('should reset all state and statistics', () => {
      // Set up some state
      const connectFn = vi.fn();
      reconnector.scheduleReconnect(connectFn);
      reconnector.notifyConnectionFailed('error');
      reconnector.notifyConnected();

      let stats = reconnector.getStats();
      expect(stats.totalReconnections).toBe(1);

      // Reset
      reconnector.reset();

      stats = reconnector.getStats();
      expect(stats.state).toBe('idle');
      expect(stats.currentAttempt).toBe(0);
      expect(stats.totalReconnections).toBe(0);
      expect(stats.lastDelayMs).toBe(0);
      expect(stats.lastError).toBeUndefined();
      expect(stats.lastAttemptTime).toBeUndefined();
      expect(stats.lastSuccessTime).toBeUndefined();
    });

    it('should clear pending timers', () => {
      const connectFn = vi.fn();
      reconnector.scheduleReconnect(connectFn);

      reconnector.reset();

      // Timer should be cleared
      vi.advanceTimersByTime(1000);
      expect(connectFn).not.toHaveBeenCalled();
    });
  });

  describe('configuration updates', () => {
    beforeEach(() => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        maxRetries: 3,
      });
    });

    it('should update configuration and reset state', () => {
      // Set up some state
      const connectFn = vi.fn();
      reconnector.scheduleReconnect(connectFn);

      const newConfig = { baseDelayMs: 500, maxRetries: 5 };
      reconnector.updateConfig(newConfig);

      const config = reconnector.getConfig();
      expect(config.baseDelayMs).toBe(500);
      expect(config.maxRetries).toBe(5);

      // State should be reset
      const stats = reconnector.getStats();
      expect(stats.state).toBe('idle');
      expect(stats.currentAttempt).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero base delay', () => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 0,
        jitterStrategy: 'none',
      });

      expect(reconnector.calculateDelay(1)).toBe(0);
      expect(reconnector.calculateDelay(2)).toBe(0);
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

    it('should handle max retries of 0', () => {
      reconnector = new ExponentialBackoffReconnector({
        maxRetries: 0,
      });

      const connectFn = vi.fn();
      const exhaustedSpy = vi.fn();
      reconnector.on('reconnect:exhausted', exhaustedSpy);

      reconnector.scheduleReconnect(connectFn);

      expect(exhaustedSpy).toHaveBeenCalledWith(0, 'Max retries exceeded');
      expect(reconnector.getStats().state).toBe('failed');
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      reconnector = new ExponentialBackoffReconnector();
    });

    it('should clean up timers and listeners', () => {
      const connectFn = vi.fn();
      const listener = vi.fn();

      reconnector.on('state:changed', listener);
      reconnector.scheduleReconnect(connectFn);

      reconnector.destroy();

      // Timer should be cleared
      vi.advanceTimersByTime(1000);
      expect(connectFn).not.toHaveBeenCalled();

      // Listeners should be removed
      expect(reconnector.listenerCount('state:changed')).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 100,
        backoffFactor: 2,
        maxRetries: 3,
        jitterStrategy: 'none',
      });
    });

    it('should handle successful reconnection after failures', async () => {
      const events: string[] = [];
      reconnector.on('state:changed', (prev, next) => events.push(`${prev}->${next}`));
      reconnector.on('reconnect:attempt', (attempt) => events.push(`attempt-${attempt}`));
      reconnector.on('reconnect:success', (attempt) => events.push(`success-${attempt}`));
      reconnector.on('reconnect:failure', (attempt) => events.push(`failure-${attempt}`));

      // First attempt fails - use resolved and manually notify to avoid double failure event
      let connectFn = vi.fn().mockResolvedValue(undefined);
      reconnector.scheduleReconnect(connectFn);
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
      // Manually signal failure (simulating external failure detection)
      reconnector.notifyConnectionFailed('failed');

      // Second attempt succeeds
      connectFn = vi.fn().mockResolvedValue(undefined);
      reconnector.scheduleReconnect(connectFn);
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
      reconnector.notifyConnected();

      expect(events).toEqual([
        'idle->reconnecting',
        'attempt-1',
        'reconnecting->connecting',
        'failure-1',
        'connecting->idle',
        'idle->reconnecting',
        'attempt-2',
        'reconnecting->connecting',
        'success-2',
        'connecting->connected',
      ]);

      const stats = reconnector.getStats();
      expect(stats.totalReconnections).toBe(1);
      expect(stats.state).toBe('connected');
    });

    it('should handle complete exhaustion scenario', async () => {
      const events: string[] = [];
      reconnector.on('reconnect:exhausted', (attempts, error) => {
        events.push(`exhausted-${attempts}-${error}`);
      });

      // Fail first two attempts - use resolved and manually notify to avoid double events
      for (let i = 1; i <= 2; i++) {
        const connectFn = vi.fn().mockResolvedValue(undefined);
        reconnector.scheduleReconnect(connectFn);
        vi.advanceTimersByTime(100 * Math.pow(2, i - 1));
        await vi.runAllTimersAsync();
        reconnector.notifyConnectionFailed(`failed-${i}`);
      }

      // Third attempt (maxRetries = 3)
      const connectFn3 = vi.fn().mockResolvedValue(undefined);
      reconnector.scheduleReconnect(connectFn3);
      vi.advanceTimersByTime(400);
      await vi.runAllTimersAsync();
      // This notifyConnectionFailed on attempt 3 triggers exhausted
      reconnector.notifyConnectionFailed('final failure');

      // The exhausted event is emitted when we fail at maxRetries (attempt 3)
      expect(events).toEqual(['exhausted-3-final failure']);
      expect(reconnector.getStats().state).toBe('failed');
    });
  });
});