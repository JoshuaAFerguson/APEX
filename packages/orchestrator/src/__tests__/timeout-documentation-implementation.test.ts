/**
 * @fileoverview Comprehensive tests for timeout configurations and wait strategies implementation
 *
 * This test file validates that all timeout configurations and wait strategies
 * documented in timeout-documentation.ts are correctly implemented and functional.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_TIMEOUTS,
  PRODUCTION_TIMEOUT_CONFIG,
  DEVELOPMENT_TIMEOUT_CONFIG,
  TimeoutUtils,
  TimeoutDebugUtils,
  PromiseRaceTimeoutPattern,
  SetTimeoutWithCleanupPattern,
  ExponentialBackoffPattern,
  PollingWaitPattern,
  WaitStrategyType,
  type BrowserTimeoutConfig,
  type BrowserWaitStrategy,
} from '../timeout-documentation';

describe('Timeout Documentation Implementation', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
    TimeoutDebugUtils.clearAll();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    TimeoutDebugUtils.clearAll();
  });

  describe('Default Timeout Constants', () => {
    it('should have all required browser timeout constants', () => {
      expect(DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD).toBe(30000);
      expect(DEFAULT_TIMEOUTS.BROWSER_NAVIGATION).toBe(30000);
      expect(DEFAULT_TIMEOUTS.BROWSER_SELECTOR_WAIT).toBe(30000);
      expect(DEFAULT_TIMEOUTS.BROWSER_PREVIEW).toBe(5000);
    });

    it('should have all required tool execution timeout constants', () => {
      expect(DEFAULT_TIMEOUTS.TOOL_EXECUTION).toBe(60000);
      expect(DEFAULT_TIMEOUTS.TOOL_INVOCATION).toBe(30000);
      expect(DEFAULT_TIMEOUTS.HOOK_EXECUTION).toBe(30000);
      expect(DEFAULT_TIMEOUTS.LINTER_EXECUTION).toBe(30000);
      expect(DEFAULT_TIMEOUTS.GLOBAL_LINTER).toBe(60000);
    });

    it('should have all required MCP timeout constants', () => {
      expect(DEFAULT_TIMEOUTS.MCP_CONNECTION).toBe(10000);
      expect(DEFAULT_TIMEOUTS.MCP_REQUEST).toBe(30000);
      expect(DEFAULT_TIMEOUTS.MCP_IDLE).toBe(300000);
      expect(DEFAULT_TIMEOUTS.MCP_HEALTH_CHECK).toBe(5000);
    });

    it('should have all required approval timeout constants', () => {
      expect(DEFAULT_TIMEOUTS.APPROVAL_GLOBAL).toBe(60);
      expect(DEFAULT_TIMEOUTS.APPROVAL_LOW_URGENCY).toBe(1440);
      expect(DEFAULT_TIMEOUTS.APPROVAL_NORMAL_URGENCY).toBe(60);
      expect(DEFAULT_TIMEOUTS.APPROVAL_HIGH_URGENCY).toBe(15);
      expect(DEFAULT_TIMEOUTS.APPROVAL_CRITICAL_URGENCY).toBe(5);
    });

    it('should have other timeout constants', () => {
      expect(DEFAULT_TIMEOUTS.DEPENDENCY_INSTALL).toBe(300000);
      expect(DEFAULT_TIMEOUTS.POLICY_EVALUATION).toBe(5000);
    });
  });

  describe('Environment-Specific Configurations', () => {
    it('should have valid production configuration', () => {
      expect(PRODUCTION_TIMEOUT_CONFIG.browser.pageLoadTimeout).toBe(45000);
      expect(PRODUCTION_TIMEOUT_CONFIG.browser.navigationTimeout).toBe(60000);
      expect(PRODUCTION_TIMEOUT_CONFIG.browser.defaultTimeout).toBe(30000);
      expect(PRODUCTION_TIMEOUT_CONFIG.browser.previewTimeout).toBe(10000);

      expect(PRODUCTION_TIMEOUT_CONFIG.tools.executionTimeoutMs).toBe(120000);
      expect(PRODUCTION_TIMEOUT_CONFIG.tools.invocationTimeoutMs).toBe(45000);

      expect(PRODUCTION_TIMEOUT_CONFIG.approval.autoApproveOnTimeout).toBe(false);
      expect(PRODUCTION_TIMEOUT_CONFIG.approval.globalApprovalTimeoutMinutes).toBe(120);
    });

    it('should have valid development configuration', () => {
      expect(DEVELOPMENT_TIMEOUT_CONFIG.browser.pageLoadTimeout).toBe(15000);
      expect(DEVELOPMENT_TIMEOUT_CONFIG.browser.navigationTimeout).toBe(20000);
      expect(DEVELOPMENT_TIMEOUT_CONFIG.browser.defaultTimeout).toBe(10000);

      expect(DEVELOPMENT_TIMEOUT_CONFIG.tools.executionTimeoutMs).toBe(30000);
      expect(DEVELOPMENT_TIMEOUT_CONFIG.tools.invocationTimeoutMs).toBe(15000);

      expect(DEVELOPMENT_TIMEOUT_CONFIG.approval.autoApproveOnTimeout).toBe(true);
      expect(DEVELOPMENT_TIMEOUT_CONFIG.approval.globalApprovalTimeoutMinutes).toBe(30);
    });

    it('should have production timeouts longer than development timeouts', () => {
      expect(PRODUCTION_TIMEOUT_CONFIG.browser.pageLoadTimeout)
        .toBeGreaterThan(DEVELOPMENT_TIMEOUT_CONFIG.browser.pageLoadTimeout);

      expect(PRODUCTION_TIMEOUT_CONFIG.tools.executionTimeoutMs)
        .toBeGreaterThan(DEVELOPMENT_TIMEOUT_CONFIG.tools.executionTimeoutMs);

      expect(PRODUCTION_TIMEOUT_CONFIG.approval.globalApprovalTimeoutMinutes)
        .toBeGreaterThan(DEVELOPMENT_TIMEOUT_CONFIG.approval.globalApprovalTimeoutMinutes);
    });
  });

  describe('Wait Strategy Types', () => {
    it('should have all required wait strategy types', () => {
      expect(WaitStrategyType.TIMEOUT).toBe('timeout');
      expect(WaitStrategyType.POLLING).toBe('polling');
      expect(WaitStrategyType.EVENT_BASED).toBe('event_based');
      expect(WaitStrategyType.RACE).toBe('race');
      expect(WaitStrategyType.EXPONENTIAL_BACKOFF).toBe('exponential_backoff');
      expect(WaitStrategyType.LINEAR_BACKOFF).toBe('linear_backoff');
    });
  });

  describe('PromiseRaceTimeoutPattern', () => {
    it('should resolve when operation completes before timeout', async () => {
      const operation = new Promise(resolve => {
        setTimeout(() => resolve('success'), 100);
      });

      const promise = PromiseRaceTimeoutPattern.withTimeout(operation, 200);

      vi.advanceTimersByTime(150);

      await expect(promise).resolves.toBe('success');
    });

    it('should reject when operation times out', async () => {
      const operation = new Promise(resolve => {
        setTimeout(() => resolve('success'), 300);
      });

      const promise = PromiseRaceTimeoutPattern.withTimeout(operation, 200, 'Custom timeout message');

      vi.advanceTimersByTime(250);

      await expect(promise).rejects.toThrow('Custom timeout message');
    });

    it('should use default timeout message when none provided', async () => {
      const operation = new Promise(resolve => {
        setTimeout(() => resolve('success'), 300);
      });

      const promise = PromiseRaceTimeoutPattern.withTimeout(operation, 200);

      vi.advanceTimersByTime(250);

      await expect(promise).rejects.toThrow('Operation timed out after 200ms');
    });
  });

  describe('SetTimeoutWithCleanupPattern', () => {
    it('should execute timeout callback when timeout expires', async () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback = vi.fn();

      pattern.setupTimeout(callback, 1000);

      expect(pattern.isTimeoutActive()).toBe(true);

      vi.advanceTimersByTime(1100);

      expect(callback).toHaveBeenCalledOnce();
      expect(pattern.isTimeoutActive()).toBe(false);
    });

    it('should not execute callback when timeout is cleared', async () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback = vi.fn();

      pattern.setupTimeout(callback, 1000);
      pattern.clearTimeout();

      expect(pattern.isTimeoutActive()).toBe(false);

      vi.advanceTimersByTime(1100);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear previous timeout when setting new one', async () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      pattern.setupTimeout(callback1, 1000);
      pattern.setupTimeout(callback2, 500);

      vi.advanceTimersByTime(600);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it('should return correct timeout active status', () => {
      const pattern = new SetTimeoutWithCleanupPattern();

      expect(pattern.isTimeoutActive()).toBe(false);

      pattern.setupTimeout(() => {}, 1000);
      expect(pattern.isTimeoutActive()).toBe(true);

      pattern.clearTimeout();
      expect(pattern.isTimeoutActive()).toBe(false);
    });
  });

  describe('ExponentialBackoffPattern', () => {
    it('should succeed on first attempt when operation succeeds', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 100,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should retry with exponential backoff on failure', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('attempt 1'))
        .mockRejectedValueOnce(new Error('attempt 2'))
        .mockResolvedValue('success');

      const promise = ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 100,
        backoffMultiplier: 2,
      });

      // Advance through the first failure and delay
      vi.advanceTimersByTime(100); // First delay: 100ms

      // Advance through the second failure and delay
      vi.advanceTimersByTime(200); // Second delay: 200ms

      // Third attempt should succeed
      vi.advanceTimersByTime(1);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect maxDelayMs parameter', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('attempt 1'))
        .mockRejectedValueOnce(new Error('attempt 2'))
        .mockResolvedValue('success');

      const promise = ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffMultiplier: 5,
        maxDelayMs: 2000, // Cap at 2 seconds
      });

      // First delay would be 1000ms, second would be 5000ms but capped at 2000ms
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(2000); // Should be capped at maxDelayMs
      vi.advanceTimersByTime(1);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should throw last error when max attempts reached', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new Error('persistent failure'));

      const promise = ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 2,
        baseDelayMs: 100,
        backoffMultiplier: 2,
      });

      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(1);

      await expect(promise).rejects.toThrow('Operation failed after 2 attempts. Last error: persistent failure');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('PollingWaitPattern', () => {
    it('should resolve when condition becomes true', async () => {
      let conditionMet = false;
      const condition = () => conditionMet;

      const promise = PollingWaitPattern.waitForCondition(condition, {
        timeoutMs: 1000,
        intervalMs: 100,
      });

      // Make condition true after some time
      setTimeout(() => { conditionMet = true; }, 250);

      vi.advanceTimersByTime(300);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject when timeout is reached', async () => {
      const condition = () => false;

      const promise = PollingWaitPattern.waitForCondition(condition, {
        timeoutMs: 500,
        intervalMs: 100,
        timeoutError: 'Custom timeout error',
      });

      vi.advanceTimersByTime(600);

      await expect(promise).rejects.toThrow('Custom timeout error');
    });

    it('should use default timeout message when none provided', async () => {
      const condition = () => false;

      const promise = PollingWaitPattern.waitForCondition(condition, {
        timeoutMs: 500,
        intervalMs: 100,
      });

      vi.advanceTimersByTime(600);

      await expect(promise).rejects.toThrow('Condition not met within 500ms');
    });

    it('should work with async conditions', async () => {
      let conditionMet = false;
      const condition = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return conditionMet;
      };

      const promise = PollingWaitPattern.waitForCondition(condition, {
        timeoutMs: 1000,
        intervalMs: 100,
      });

      setTimeout(() => { conditionMet = true; }, 250);

      vi.advanceTimersByTime(300);

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('TimeoutUtils', () => {
    describe('createTimeout', () => {
      it('should create a timeout promise that rejects', async () => {
        const promise = TimeoutUtils.createTimeout(100, 'Test timeout');

        vi.advanceTimersByTime(150);

        await expect(promise).rejects.toThrow('Test timeout');
      });

      it('should use default message when none provided', async () => {
        const promise = TimeoutUtils.createTimeout(100);

        vi.advanceTimersByTime(150);

        await expect(promise).rejects.toThrow('Timeout after 100ms');
      });
    });

    describe('withTimeout', () => {
      it('should resolve when operation completes before timeout', async () => {
        const operation = Promise.resolve('success');

        const result = await TimeoutUtils.withTimeout(operation, 100);

        expect(result).toBe('success');
      });

      it('should reject when timeout is reached', async () => {
        const operation = new Promise(resolve => setTimeout(() => resolve('success'), 200));

        const promise = TimeoutUtils.withTimeout(operation, 100, 'Custom timeout');

        vi.advanceTimersByTime(150);

        await expect(promise).rejects.toThrow('Custom timeout');
      });
    });

    describe('time conversion utilities', () => {
      it('should convert minutes to milliseconds correctly', () => {
        expect(TimeoutUtils.minutesToMs(1)).toBe(60000);
        expect(TimeoutUtils.minutesToMs(5)).toBe(300000);
        expect(TimeoutUtils.minutesToMs(0.5)).toBe(30000);
      });

      it('should convert milliseconds to minutes correctly', () => {
        expect(TimeoutUtils.msToMinutes(60000)).toBe(1);
        expect(TimeoutUtils.msToMinutes(300000)).toBe(5);
        expect(TimeoutUtils.msToMinutes(30000)).toBe(0.5);
      });
    });

    describe('formatTimeout', () => {
      it('should format milliseconds correctly', () => {
        expect(TimeoutUtils.formatTimeout(500)).toBe('500ms');
        expect(TimeoutUtils.formatTimeout(0)).toBe('No timeout');
      });

      it('should format seconds correctly', () => {
        expect(TimeoutUtils.formatTimeout(1500)).toBe('1.5s');
        expect(TimeoutUtils.formatTimeout(30000)).toBe('30.0s');
      });

      it('should format minutes correctly', () => {
        expect(TimeoutUtils.formatTimeout(90000)).toBe('1.5m');
        expect(TimeoutUtils.formatTimeout(300000)).toBe('5.0m');
      });

      it('should format hours correctly', () => {
        expect(TimeoutUtils.formatTimeout(3660000)).toBe('1.0h');
        expect(TimeoutUtils.formatTimeout(7200000)).toBe('2.0h');
      });
    });
  });

  describe('TimeoutDebugUtils', () => {
    beforeEach(() => {
      TimeoutDebugUtils.clearAll();
    });

    it('should register and unregister timeouts', () => {
      TimeoutDebugUtils.registerTimeout('test1', 5000, 'Test operation');

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('test1');
      expect(active[0].operation).toBe('Test operation');
      expect(active[0].timeoutMs).toBe(5000);

      TimeoutDebugUtils.unregisterTimeout('test1');
      expect(TimeoutDebugUtils.getActiveTimeouts()).toHaveLength(0);
    });

    it('should track elapsed and remaining time', () => {
      const startTime = Date.now();
      TimeoutDebugUtils.registerTimeout('test1', 5000, 'Test operation');

      vi.advanceTimersByTime(2000);

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active[0].elapsedMs).toBe(2000);
      expect(active[0].remainingMs).toBe(3000);
    });

    it('should handle multiple timeouts', () => {
      TimeoutDebugUtils.registerTimeout('test1', 5000, 'Operation 1');
      TimeoutDebugUtils.registerTimeout('test2', 3000, 'Operation 2');

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active).toHaveLength(2);

      const ids = active.map(t => t.id);
      expect(ids).toContain('test1');
      expect(ids).toContain('test2');
    });

    it('should clear all timeouts', () => {
      TimeoutDebugUtils.registerTimeout('test1', 5000, 'Operation 1');
      TimeoutDebugUtils.registerTimeout('test2', 3000, 'Operation 2');

      expect(TimeoutDebugUtils.getActiveTimeouts()).toHaveLength(2);

      TimeoutDebugUtils.clearAll();
      expect(TimeoutDebugUtils.getActiveTimeouts()).toHaveLength(0);
    });

    it('should log timeout stats without throwing', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      TimeoutDebugUtils.registerTimeout('test1', 5000, 'Test operation');
      TimeoutDebugUtils.logTimeoutStats();

      expect(consoleSpy).toHaveBeenCalledWith('Active timeouts: 1');

      consoleSpy.mockRestore();
    });
  });

  describe('Configuration Type Validation', () => {
    it('should accept valid browser wait strategy configurations', () => {
      const validStrategies: BrowserWaitStrategy[] = [
        { type: 'load', timeout: 30000 },
        { type: 'domcontentloaded' },
        { type: 'networkidle', timeout: 5000 },
        { type: 'selector', timeout: 10000, visible: true },
        { type: 'function', evaluateFunction: '() => document.readyState === "complete"' },
      ];

      validStrategies.forEach(strategy => {
        expect(() => {
          // This would be validated by TypeScript in real usage
          const _: BrowserWaitStrategy = strategy;
        }).not.toThrow();
      });
    });

    it('should accept valid browser timeout configurations', () => {
      const validConfig: BrowserTimeoutConfig = {
        pageLoadTimeout: 30000,
        navigationTimeout: 30000,
        defaultTimeout: 30000,
        selectorWaitTimeout: 30000,
        previewTimeout: 5000,
      };

      expect(() => {
        // This would be validated by TypeScript in real usage
        const _: BrowserTimeoutConfig = validConfig;
      }).not.toThrow();
    });
  });

  describe('Integration with Real Timeout Scenarios', () => {
    it('should handle concurrent timeout operations', async () => {
      const operations = [
        { delay: 100, timeout: 200, shouldSucceed: true },
        { delay: 300, timeout: 200, shouldSucceed: false },
        { delay: 50, timeout: 100, shouldSucceed: true },
      ];

      const promises = operations.map(({ delay, timeout, shouldSucceed }) => {
        const operation = new Promise(resolve => {
          setTimeout(() => resolve(`success-${delay}`), delay);
        });

        const timeoutPromise = PromiseRaceTimeoutPattern.withTimeout(
          operation,
          timeout,
          `Timeout after ${timeout}ms`
        );

        return { promise: timeoutPromise, shouldSucceed, delay };
      });

      // Advance time to complete all operations
      vi.advanceTimersByTime(350);

      const results = await Promise.allSettled(
        promises.map(p => p.promise)
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });

    it('should properly clean up resources on timeout', async () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const cleanupFn = vi.fn();

      // Setup a timeout that should trigger cleanup
      pattern.setupTimeout(() => {
        cleanupFn();
      }, 500);

      // Verify timeout is active
      expect(pattern.isTimeoutActive()).toBe(true);

      // Trigger timeout
      vi.advanceTimersByTime(600);

      // Verify cleanup was called and timeout is no longer active
      expect(cleanupFn).toHaveBeenCalledOnce();
      expect(pattern.isTimeoutActive()).toBe(false);
    });

    it('should handle timeout monitoring across multiple operations', () => {
      // Start multiple operations with different timeouts
      TimeoutDebugUtils.registerTimeout('op1', 5000, 'Long operation');
      TimeoutDebugUtils.registerTimeout('op2', 1000, 'Short operation');
      TimeoutDebugUtils.registerTimeout('op3', 3000, 'Medium operation');

      // Advance time partially
      vi.advanceTimersByTime(1500);

      const active = TimeoutDebugUtils.getActiveTimeouts();

      // All operations should still be active
      expect(active).toHaveLength(3);

      // Check that elapsed times are calculated correctly
      const op1 = active.find(t => t.id === 'op1');
      const op2 = active.find(t => t.id === 'op2');
      const op3 = active.find(t => t.id === 'op3');

      expect(op1?.elapsedMs).toBe(1500);
      expect(op1?.remainingMs).toBe(3500);

      expect(op2?.elapsedMs).toBe(1500);
      expect(op2?.remainingMs).toBe(0); // Already past timeout

      expect(op3?.elapsedMs).toBe(1500);
      expect(op3?.remainingMs).toBe(1500);
    });
  });
});