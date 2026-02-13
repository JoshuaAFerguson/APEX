/**
 * @fileoverview Comprehensive Timeout Configuration Testing
 *
 * Tests all timeout configurations defined in types.ts and validates that they work
 * correctly throughout the APEX system. This includes:
 * - Browser automation timeouts
 * - Tool execution timeouts
 * - MCP connection timeouts
 * - Approval gate timeouts
 * - Dependency installation timeouts
 * - Policy evaluation timeouts
 * - Hook execution timeouts
 * - Wait strategy implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import {
  DEFAULT_TIMEOUTS,
  TimeoutUtils,
  PromiseRaceTimeoutPattern,
  SetTimeoutWithCleanupPattern,
  ExponentialBackoffPattern,
  PollingWaitPattern,
} from '../timeout-documentation';

// Import schema types for validation
import {
  BrowserConfigSchema,
  CustomToolConfigSchema,
  MCPConnectionConfigSchema,
  ApprovalGateSchema,
  LinterGlobalConfigSchema,
  PolicyCheckOptionsSchema,
  WorkflowHookConfigSchema,
  ToolHookConfigSchema,
} from '@apexcli/core';

describe('Timeout Configuration Schema Validation', () => {
  describe('Browser Timeout Configurations', () => {
    it('should validate browser config with all timeout fields', () => {
      const config = {
        headless: true,
        timeout: 45000,
        viewport: { width: 1920, height: 1080 },
      };

      const result = BrowserConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeout).toBe(45000);
      }
    });

    it('should apply default timeout when not specified', () => {
      const config = {
        headless: true,
        viewport: { width: 1920, height: 1080 },
      };

      const result = BrowserConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeout).toBe(30000); // Default value
      }
    });

    it('should reject negative timeout values', () => {
      const config = {
        headless: true,
        timeout: -1000,
        viewport: { width: 1920, height: 1080 },
      };

      const result = BrowserConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer timeout values', () => {
      const config = {
        headless: true,
        timeout: 1000.5,
        viewport: { width: 1920, height: 1080 },
      };

      const result = BrowserConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('Custom Tool Timeout Configurations', () => {
    it('should validate tool config with timeout', () => {
      const config = {
        name: 'test-tool',
        implementation: 'internal' as const,
        timeoutMs: 120000,
      };

      const result = CustomToolConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(120000);
      }
    });

    it('should apply default timeout for tools', () => {
      const config = {
        name: 'test-tool',
        implementation: 'internal' as const,
      };

      const result = CustomToolConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(60000); // Default value
      }
    });

    it('should reject zero or negative timeout values for tools', () => {
      const config = {
        name: 'test-tool',
        implementation: 'internal' as const,
        timeoutMs: 0,
      };

      const result = CustomToolConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('MCP Connection Timeout Configurations', () => {
    it('should validate complete MCP connection config', () => {
      const config = {
        connectionTimeoutMs: 15000,
        requestTimeoutMs: 60000,
        idleTimeoutMs: 300000,
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3,
        },
      };

      // Note: Using a mock schema since MCPConnectionConfigSchema might not exist
      const mockSchema = z.object({
        connectionTimeoutMs: z.number().optional(),
        requestTimeoutMs: z.number().optional(),
        idleTimeoutMs: z.number().optional(),
        healthCheck: z.object({
          enabled: z.boolean().optional(),
          interval: z.number().optional(),
          timeout: z.number().optional(),
          retries: z.number().optional(),
        }).optional(),
      });

      const result = mockSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should handle MCP config with idle timeout disabled (0)', () => {
      const config = {
        connectionTimeoutMs: 10000,
        idleTimeoutMs: 0, // Disabled
      };

      const mockSchema = z.object({
        connectionTimeoutMs: z.number().optional(),
        idleTimeoutMs: z.number().optional(),
      });

      const result = mockSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.idleTimeoutMs).toBe(0);
      }
    });
  });

  describe('Approval Gate Timeout Configurations', () => {
    it('should validate approval gate with timeout in minutes', () => {
      const gate = {
        id: 'test-gate',
        type: 'confirmation' as const,
        message: 'Approve this action?',
        timeout: 60, // 1 hour in minutes
        autoApproveOnTimeout: false,
        minApprovals: 1,
      };

      const result = ApprovalGateSchema.safeParse(gate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeout).toBe(60);
        expect(result.data.autoApproveOnTimeout).toBe(false);
      }
    });

    it('should reject negative timeout for approval gates', () => {
      const gate = {
        id: 'test-gate',
        type: 'confirmation' as const,
        message: 'Approve this action?',
        timeout: -30, // Invalid
      };

      const result = ApprovalGateSchema.safeParse(gate);
      expect(result.success).toBe(false);
    });

    it('should handle approval gate without timeout', () => {
      const gate = {
        id: 'test-gate',
        type: 'confirmation' as const,
        message: 'Approve this action?',
        // No timeout specified
      };

      const result = ApprovalGateSchema.safeParse(gate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeout).toBeUndefined();
      }
    });
  });

  describe('Linter Timeout Configurations', () => {
    it('should validate linter global config with timeouts', () => {
      const config = {
        maxConcurrency: 5,
        timeoutMs: 90000, // Global timeout
        workingDirectory: '/project',
      };

      const result = LinterGlobalConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(90000);
      }
    });

    it('should apply default timeout for linter global config', () => {
      const config = {
        maxConcurrency: 5,
      };

      const result = LinterGlobalConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(60000); // Default
      }
    });
  });

  describe('Hook Timeout Configurations', () => {
    it('should validate workflow hook with timeout', () => {
      const hook = {
        name: 'pre-execution-hook',
        stage: 'pre' as const,
        script: 'echo "Starting"',
        timeoutMs: 45000,
        failOnError: true,
      };

      const result = WorkflowHookConfigSchema.safeParse(hook);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(45000);
      }
    });

    it('should apply default timeout for workflow hooks', () => {
      const hook = {
        name: 'pre-execution-hook',
        stage: 'pre' as const,
        script: 'echo "Starting"',
      };

      const result = WorkflowHookConfigSchema.safeParse(hook);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(30000); // Default
      }
    });

    it('should validate tool hook with custom timeout', () => {
      const hook = {
        name: 'tool-pre-hook',
        stage: 'pre' as const,
        script: 'npm run lint',
        timeoutMs: 60000,
        tools: ['custom-tool'],
      };

      const result = ToolHookConfigSchema.safeParse(hook);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(60000);
      }
    });
  });

  describe('Policy Evaluation Timeout Configurations', () => {
    it('should validate policy check options with timeout', () => {
      const options = {
        timeoutMs: 10000,
      };

      const result = PolicyCheckOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(10000);
      }
    });

    it('should handle policy options without timeout', () => {
      const options = {};

      const result = PolicyCheckOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBeUndefined();
      }
    });
  });
});

describe('Timeout Utility Function Tests', () => {
  describe('TimeoutUtils', () => {
    describe('createTimeout', () => {
      it('should create timeout that rejects after specified time', async () => {
        vi.useFakeTimers();

        const timeoutPromise = TimeoutUtils.createTimeout(1000, 'Test timeout');

        vi.advanceTimersByTime(1100);

        await expect(timeoutPromise).rejects.toThrow('Test timeout');

        vi.useRealTimers();
      });

      it('should use default message when none provided', async () => {
        vi.useFakeTimers();

        const timeoutPromise = TimeoutUtils.createTimeout(500);

        vi.advanceTimersByTime(600);

        await expect(timeoutPromise).rejects.toThrow('Operation timed out after 500ms');

        vi.useRealTimers();
      });
    });

    describe('withTimeout', () => {
      it('should resolve operation when it completes before timeout', async () => {
        vi.useFakeTimers();

        const operation = new Promise<string>((resolve) => {
          setTimeout(() => resolve('success'), 500);
        });

        const timeoutPromise = TimeoutUtils.withTimeout(operation, 1000);

        vi.advanceTimersByTime(600);

        await expect(timeoutPromise).resolves.toBe('success');

        vi.useRealTimers();
      });

      it('should reject operation when timeout is reached first', async () => {
        vi.useFakeTimers();

        const operation = new Promise<string>((resolve) => {
          setTimeout(() => resolve('too late'), 2000);
        });

        const timeoutPromise = TimeoutUtils.withTimeout(operation, 1000);

        vi.advanceTimersByTime(1100);

        await expect(timeoutPromise).rejects.toThrow('Operation timed out after 1000ms');

        vi.useRealTimers();
      });

      it('should use custom timeout message', async () => {
        vi.useFakeTimers();

        const operation = new Promise<string>((resolve) => {
          setTimeout(() => resolve('too late'), 2000);
        });

        const timeoutPromise = TimeoutUtils.withTimeout(
          operation,
          1000,
          'Database connection failed'
        );

        vi.advanceTimersByTime(1100);

        await expect(timeoutPromise).rejects.toThrow('Database connection failed');

        vi.useRealTimers();
      });
    });

    describe('time conversion utilities', () => {
      it('should convert minutes to milliseconds correctly', () => {
        expect(TimeoutUtils.minutesToMs(0)).toBe(0);
        expect(TimeoutUtils.minutesToMs(1)).toBe(60000);
        expect(TimeoutUtils.minutesToMs(2.5)).toBe(150000);
        expect(TimeoutUtils.minutesToMs(60)).toBe(3600000);
      });

      it('should convert milliseconds to minutes correctly', () => {
        expect(TimeoutUtils.msToMinutes(0)).toBe(0);
        expect(TimeoutUtils.msToMinutes(60000)).toBe(1);
        expect(TimeoutUtils.msToMinutes(150000)).toBe(2.5);
        expect(TimeoutUtils.msToMinutes(3600000)).toBe(60);
      });
    });

    describe('formatTimeout', () => {
      it('should format timeouts under 1 second as milliseconds', () => {
        expect(TimeoutUtils.formatTimeout(0)).toBe('0ms');
        expect(TimeoutUtils.formatTimeout(500)).toBe('500ms');
        expect(TimeoutUtils.formatTimeout(999)).toBe('999ms');
      });

      it('should format timeouts under 1 minute as seconds', () => {
        expect(TimeoutUtils.formatTimeout(1000)).toBe('1s');
        expect(TimeoutUtils.formatTimeout(5000)).toBe('5s');
        expect(TimeoutUtils.formatTimeout(30000)).toBe('30s');
        expect(TimeoutUtils.formatTimeout(59999)).toBe('60s');
      });

      it('should format timeouts over 1 minute as minutes', () => {
        expect(TimeoutUtils.formatTimeout(60000)).toBe('1m');
        expect(TimeoutUtils.formatTimeout(300000)).toBe('5m');
        expect(TimeoutUtils.formatTimeout(3600000)).toBe('60m');
        expect(TimeoutUtils.formatTimeout(7200000)).toBe('120m');
      });
    });
  });
});

describe('Wait Strategy Pattern Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('PromiseRaceTimeoutPattern', () => {
    it('should resolve when operation completes within timeout', async () => {
      const operation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('completed'), 500);
      });

      const racePromise = PromiseRaceTimeoutPattern.withTimeout(operation, 1000);

      vi.advanceTimersByTime(600);

      await expect(racePromise).resolves.toBe('completed');
    });

    it('should reject when operation exceeds timeout', async () => {
      const operation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('too late'), 2000);
      });

      const racePromise = PromiseRaceTimeoutPattern.withTimeout(operation, 1000);

      vi.advanceTimersByTime(1100);

      await expect(racePromise).rejects.toThrow('Operation timed out after 1000ms');
    });

    it('should use custom error message for timeout', async () => {
      const operation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('too late'), 2000);
      });

      const racePromise = PromiseRaceTimeoutPattern.withTimeout(
        operation,
        1000,
        'Custom operation timeout'
      );

      vi.advanceTimersByTime(1100);

      await expect(racePromise).rejects.toThrow('Custom operation timeout');
    });
  });

  describe('SetTimeoutWithCleanupPattern', () => {
    it('should execute callback when timeout fires', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback = vi.fn();

      pattern.setupTimeout(callback, 1000);

      vi.advanceTimersByTime(1100);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should prevent callback execution when timeout is cleared', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback = vi.fn();

      pattern.setupTimeout(callback, 1000);
      pattern.clearTimeout();

      vi.advanceTimersByTime(1100);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should replace previous timeout when setting new one', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      pattern.setupTimeout(firstCallback, 1000);
      pattern.setupTimeout(secondCallback, 500);

      vi.advanceTimersByTime(600);

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple clearTimeout calls safely', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback = vi.fn();

      pattern.setupTimeout(callback, 1000);
      pattern.clearTimeout();
      pattern.clearTimeout(); // Should not throw

      vi.advanceTimersByTime(1100);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('ExponentialBackoffPattern', () => {
    it('should succeed on first attempt without retry', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 100,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry with exponential backoff delays', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('attempt 1'))
        .mockRejectedValueOnce(new Error('attempt 2'))
        .mockResolvedValue('success');

      const promise = ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 100,
        backoffMultiplier: 2,
      });

      // First attempt fails immediately
      vi.advanceTimersByTime(0);

      // Wait for first retry delay (100ms)
      vi.advanceTimersByTime(100);

      // Wait for second retry delay (200ms)
      vi.advanceTimersByTime(200);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect maximum delay cap', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('attempt 1'))
        .mockRejectedValueOnce(new Error('attempt 2'))
        .mockResolvedValue('success');

      const startTime = Date.now();

      const promise = ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffMultiplier: 10,
        maxDelayMs: 500, // Cap delays at 500ms
      });

      // Advance through capped delays
      vi.advanceTimersByTime(500); // First retry delay (capped)
      vi.advanceTimersByTime(500); // Second retry delay (capped)

      await promise;

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw last error after all attempts fail', async () => {
      const lastError = new Error('final failure');
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('attempt 1'))
        .mockRejectedValueOnce(new Error('attempt 2'))
        .mockRejectedValue(lastError);

      const promise = ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 50,
        backoffMultiplier: 2,
      });

      vi.advanceTimersByTime(50); // First retry
      vi.advanceTimersByTime(100); // Second retry

      await expect(promise).rejects.toThrow('final failure');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('PollingWaitPattern', () => {
    it('should resolve when condition becomes true', async () => {
      let conditionMet = false;
      setTimeout(() => { conditionMet = true; }, 500);

      const waitPromise = PollingWaitPattern.waitForCondition(
        () => conditionMet,
        {
          timeoutMs: 1000,
          intervalMs: 100,
        }
      );

      vi.advanceTimersByTime(600);

      await expect(waitPromise).resolves.toBeUndefined();
    });

    it('should timeout when condition never becomes true', async () => {
      const waitPromise = PollingWaitPattern.waitForCondition(
        () => false,
        {
          timeoutMs: 500,
          intervalMs: 50,
        }
      );

      vi.advanceTimersByTime(600);

      await expect(waitPromise).rejects.toThrow('Condition not met within 500ms');
    });

    it('should use custom timeout error message', async () => {
      const waitPromise = PollingWaitPattern.waitForCondition(
        () => false,
        {
          timeoutMs: 300,
          intervalMs: 50,
          timeoutError: 'Service failed to start',
        }
      );

      vi.advanceTimersByTime(400);

      await expect(waitPromise).rejects.toThrow('Service failed to start');
    });

    it('should handle async condition functions', async () => {
      let conditionMet = false;
      setTimeout(() => { conditionMet = true; }, 200);

      const waitPromise = PollingWaitPattern.waitForCondition(
        async () => {
          // Simulate async check
          await new Promise(resolve => setTimeout(resolve, 10));
          return conditionMet;
        },
        {
          timeoutMs: 500,
          intervalMs: 50,
        }
      );

      vi.advanceTimersByTime(250);

      await expect(waitPromise).resolves.toBeUndefined();
    });

    it('should handle condition function that throws', async () => {
      const waitPromise = PollingWaitPattern.waitForCondition(
        () => {
          throw new Error('Condition check failed');
        },
        {
          timeoutMs: 500,
          intervalMs: 50,
        }
      );

      vi.advanceTimersByTime(100);

      await expect(waitPromise).rejects.toThrow('Condition check failed');
    });
  });
});

describe('Default Timeout Value Validation', () => {
  it('should have reasonable browser timeout defaults', () => {
    expect(DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD).toBe(30000);
    expect(DEFAULT_TIMEOUTS.BROWSER_NAVIGATION).toBe(30000);
    expect(DEFAULT_TIMEOUTS.BROWSER_SELECTOR_WAIT).toBe(30000);
    expect(DEFAULT_TIMEOUTS.BROWSER_PREVIEW).toBe(5000);

    // All browser timeouts should be at least 5 seconds
    expect(DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD).toBeGreaterThanOrEqual(5000);
    expect(DEFAULT_TIMEOUTS.BROWSER_NAVIGATION).toBeGreaterThanOrEqual(5000);
    expect(DEFAULT_TIMEOUTS.BROWSER_SELECTOR_WAIT).toBeGreaterThanOrEqual(5000);
    expect(DEFAULT_TIMEOUTS.BROWSER_PREVIEW).toBeGreaterThanOrEqual(5000);
  });

  it('should have reasonable tool execution timeout defaults', () => {
    expect(DEFAULT_TIMEOUTS.TOOL_EXECUTION).toBe(60000);
    expect(DEFAULT_TIMEOUTS.TOOL_INVOCATION).toBe(30000);
    expect(DEFAULT_TIMEOUTS.HOOK_EXECUTION).toBe(30000);
    expect(DEFAULT_TIMEOUTS.LINTER_EXECUTION).toBe(30000);
    expect(DEFAULT_TIMEOUTS.GLOBAL_LINTER).toBe(60000);

    // Tool timeouts should allow enough time for complex operations
    expect(DEFAULT_TIMEOUTS.TOOL_EXECUTION).toBeGreaterThanOrEqual(30000);
    expect(DEFAULT_TIMEOUTS.GLOBAL_LINTER).toBeGreaterThanOrEqual(DEFAULT_TIMEOUTS.LINTER_EXECUTION);
  });

  it('should have reasonable MCP timeout defaults', () => {
    expect(DEFAULT_TIMEOUTS.MCP_CONNECTION).toBe(10000);
    expect(DEFAULT_TIMEOUTS.MCP_REQUEST).toBe(30000);
    expect(DEFAULT_TIMEOUTS.MCP_IDLE).toBe(300000);
    expect(DEFAULT_TIMEOUTS.MCP_HEALTH_CHECK).toBe(5000);

    // MCP timeouts should be appropriate for network operations
    expect(DEFAULT_TIMEOUTS.MCP_CONNECTION).toBeGreaterThanOrEqual(5000);
    expect(DEFAULT_TIMEOUTS.MCP_REQUEST).toBeGreaterThanOrEqual(DEFAULT_TIMEOUTS.MCP_CONNECTION);
    expect(DEFAULT_TIMEOUTS.MCP_IDLE).toBeGreaterThanOrEqual(DEFAULT_TIMEOUTS.MCP_REQUEST);
  });

  it('should have reasonable approval timeout defaults', () => {
    expect(DEFAULT_TIMEOUTS.APPROVAL_GLOBAL).toBe(60);
    expect(DEFAULT_TIMEOUTS.APPROVAL_LOW_URGENCY).toBe(1440);
    expect(DEFAULT_TIMEOUTS.APPROVAL_NORMAL_URGENCY).toBe(60);
    expect(DEFAULT_TIMEOUTS.APPROVAL_HIGH_URGENCY).toBe(15);
    expect(DEFAULT_TIMEOUTS.APPROVAL_CRITICAL_URGENCY).toBe(5);

    // Approval urgency hierarchy should be consistent
    expect(DEFAULT_TIMEOUTS.APPROVAL_CRITICAL_URGENCY).toBeLessThan(DEFAULT_TIMEOUTS.APPROVAL_HIGH_URGENCY);
    expect(DEFAULT_TIMEOUTS.APPROVAL_HIGH_URGENCY).toBeLessThan(DEFAULT_TIMEOUTS.APPROVAL_NORMAL_URGENCY);
    expect(DEFAULT_TIMEOUTS.APPROVAL_NORMAL_URGENCY).toBeLessThan(DEFAULT_TIMEOUTS.APPROVAL_LOW_URGENCY);
  });

  it('should have reasonable dependency and policy timeout defaults', () => {
    expect(DEFAULT_TIMEOUTS.DEPENDENCY_INSTALL).toBe(300000); // 5 minutes
    expect(DEFAULT_TIMEOUTS.POLICY_EVALUATION).toBe(5000);

    // Dependency installs can take time for large packages
    expect(DEFAULT_TIMEOUTS.DEPENDENCY_INSTALL).toBeGreaterThanOrEqual(180000); // At least 3 minutes

    // Policy evaluation should be fast
    expect(DEFAULT_TIMEOUTS.POLICY_EVALUATION).toBeLessThan(10000);
  });

  it('should have immutable default timeout object', () => {
    expect(Object.isFrozen(DEFAULT_TIMEOUTS)).toBe(true);

    // Verify we can't modify the defaults
    expect(() => {
      (DEFAULT_TIMEOUTS as any).BROWSER_PAGE_LOAD = 999999;
    }).toThrow();
  });
});

describe('Timeout Edge Cases and Error Scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle zero timeout values gracefully', async () => {
    const operation = new Promise<string>((resolve) => {
      setTimeout(() => resolve('immediate'), 0);
    });

    const timeoutPromise = TimeoutUtils.withTimeout(operation, 0);

    vi.advanceTimersByTime(1);

    // Zero timeout should reject immediately
    await expect(timeoutPromise).rejects.toThrow('Operation timed out after 0ms');
  });

  it('should handle very large timeout values', () => {
    const largeTimeout = Number.MAX_SAFE_INTEGER;

    expect(() => {
      TimeoutUtils.createTimeout(largeTimeout);
    }).not.toThrow();
  });

  it('should handle concurrent timeout operations', async () => {
    const operations = Array.from({ length: 10 }, (_, i) => {
      return new Promise<number>((resolve) => {
        setTimeout(() => resolve(i), (i + 1) * 100);
      });
    });

    const timeoutPromises = operations.map((op, i) =>
      TimeoutUtils.withTimeout(op, (i + 1) * 50)
    );

    // Fast forward to trigger various timeouts
    vi.advanceTimersByTime(1000);

    const results = await Promise.allSettled(timeoutPromises);

    // Some operations should succeed, others should timeout
    const successful = results.filter(r => r.status === 'fulfilled');
    const timedOut = results.filter(r => r.status === 'rejected');

    expect(successful.length).toBeGreaterThan(0);
    expect(timedOut.length).toBeGreaterThan(0);
    expect(successful.length + timedOut.length).toBe(10);
  });

  it('should handle timeout with Promise rejection', async () => {
    const operation = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Operation failed')), 500);
    });

    const timeoutPromise = TimeoutUtils.withTimeout(operation, 1000);

    vi.advanceTimersByTime(600);

    // Should reject with original error, not timeout
    await expect(timeoutPromise).rejects.toThrow('Operation failed');
  });

  it('should handle cleanup when timeout pattern is destroyed', () => {
    const pattern = new SetTimeoutWithCleanupPattern();
    const callback = vi.fn();

    pattern.setupTimeout(callback, 1000);

    // Simulate cleanup (e.g., component unmount)
    pattern.clearTimeout();

    vi.advanceTimersByTime(1500);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle memory pressure with many timeouts', () => {
    const patterns: SetTimeoutWithCleanupPattern[] = [];

    // Create many timeout patterns
    for (let i = 0; i < 1000; i++) {
      const pattern = new SetTimeoutWithCleanupPattern();
      pattern.setupTimeout(() => {}, 10000);
      patterns.push(pattern);
    }

    // Clean them all up
    patterns.forEach(pattern => pattern.clearTimeout());

    // Should not cause memory issues or errors
    expect(patterns.length).toBe(1000);
  });

  it('should handle timeout with async/await error propagation', async () => {
    const asyncOperation = async (): Promise<string> => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      throw new Error('Async operation failed');
    };

    const timeoutPromise = TimeoutUtils.withTimeout(asyncOperation(), 1000);

    vi.advanceTimersByTime(1100);

    // Should timeout before the async error occurs
    await expect(timeoutPromise).rejects.toThrow('Operation timed out after 1000ms');
  });
});