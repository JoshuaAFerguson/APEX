/**
 * Timeout Configurations Tests
 *
 * Comprehensive unit tests for all timeout configuration types and patterns
 * defined in the APEX system. This test suite validates timeout configurations,
 * default values, edge cases, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BrowserTimeoutConfig,
  ToolExecutionTimeoutConfig,
  MCPTimeoutConfig,
  ApprovalTimeoutConfig,
  DependencyTimeoutConfig,
  PolicyTimeoutConfig,
  DEFAULT_TIMEOUTS,
  PRODUCTION_TIMEOUT_CONFIG,
  DEVELOPMENT_TIMEOUT_CONFIG,
  TimeoutUtils,
  PromiseRaceTimeoutPattern,
  SetTimeoutWithCleanupPattern,
  ExponentialBackoffPattern,
  PollingWaitPattern,
  TimeoutDebugUtils,
} from '../timeout-documentation';

describe('Timeout Configuration Types', () => {
  describe('BrowserTimeoutConfig', () => {
    it('should handle complete browser timeout configuration', () => {
      const config: BrowserTimeoutConfig = {
        pageLoadTimeout: 45000,
        navigationTimeout: 60000,
        defaultTimeout: 30000,
        selectorWaitTimeout: 10000,
        previewTimeout: 5000,
      };

      expect(config.pageLoadTimeout).toBe(45000);
      expect(config.navigationTimeout).toBe(60000);
      expect(config.defaultTimeout).toBe(30000);
      expect(config.selectorWaitTimeout).toBe(10000);
      expect(config.previewTimeout).toBe(5000);
    });

    it('should handle partial browser timeout configuration with optional fields', () => {
      const config: BrowserTimeoutConfig = {
        pageLoadTimeout: 30000,
      };

      expect(config.pageLoadTimeout).toBe(30000);
      expect(config.navigationTimeout).toBeUndefined();
      expect(config.defaultTimeout).toBeUndefined();
    });

    it('should handle empty browser timeout configuration', () => {
      const config: BrowserTimeoutConfig = {};

      expect(config).toEqual({});
    });
  });

  describe('ToolExecutionTimeoutConfig', () => {
    it('should handle complete tool execution timeout configuration', () => {
      const config: ToolExecutionTimeoutConfig = {
        executionTimeoutMs: 120000,
        invocationTimeoutMs: 45000,
        hookTimeoutMs: 60000,
        defaultHookTimeoutMs: 30000,
        linterTimeoutMs: 45000,
        globalLinterTimeoutMs: 90000,
      };

      expect(config.executionTimeoutMs).toBe(120000);
      expect(config.invocationTimeoutMs).toBe(45000);
      expect(config.hookTimeoutMs).toBe(60000);
      expect(config.defaultHookTimeoutMs).toBe(30000);
      expect(config.linterTimeoutMs).toBe(45000);
      expect(config.globalLinterTimeoutMs).toBe(90000);
    });

    it('should handle minimum tool execution configuration', () => {
      const config: ToolExecutionTimeoutConfig = {
        executionTimeoutMs: 60000,
      };

      expect(config.executionTimeoutMs).toBe(60000);
      expect(config.invocationTimeoutMs).toBeUndefined();
    });
  });

  describe('MCPTimeoutConfig', () => {
    it('should handle complete MCP timeout configuration', () => {
      const config: MCPTimeoutConfig = {
        connectionTimeoutMs: 15000,
        requestTimeoutMs: 60000,
        idleTimeoutMs: 600000,
        healthCheckTimeoutMs: 10000,
      };

      expect(config.connectionTimeoutMs).toBe(15000);
      expect(config.requestTimeoutMs).toBe(60000);
      expect(config.idleTimeoutMs).toBe(600000);
      expect(config.healthCheckTimeoutMs).toBe(10000);
    });

    it('should handle MCP configuration with no idle timeout (0)', () => {
      const config: MCPTimeoutConfig = {
        idleTimeoutMs: 0,
      };

      expect(config.idleTimeoutMs).toBe(0);
    });
  });

  describe('ApprovalTimeoutConfig', () => {
    it('should handle complete approval timeout configuration', () => {
      const config: ApprovalTimeoutConfig = {
        gateTimeoutMinutes: 60,
        autoApproveOnTimeout: true,
        globalApprovalTimeoutMinutes: 120,
        agentApprovalTimeouts: {
          developer: 30,
          reviewer: 45,
          tester: 15,
        },
      };

      expect(config.gateTimeoutMinutes).toBe(60);
      expect(config.autoApproveOnTimeout).toBe(true);
      expect(config.globalApprovalTimeoutMinutes).toBe(120);
      expect(config.agentApprovalTimeouts?.developer).toBe(30);
      expect(config.agentApprovalTimeouts?.reviewer).toBe(45);
      expect(config.agentApprovalTimeouts?.tester).toBe(15);
    });

    it('should handle approval configuration with no timeout', () => {
      const config: ApprovalTimeoutConfig = {
        autoApproveOnTimeout: false,
      };

      expect(config.gateTimeoutMinutes).toBeUndefined();
      expect(config.autoApproveOnTimeout).toBe(false);
    });
  });

  describe('DependencyTimeoutConfig', () => {
    it('should handle dependency timeout configuration', () => {
      const config: DependencyTimeoutConfig = {
        installTimeoutMs: 600000,
        defaultInstallTimeoutMs: 300000,
      };

      expect(config.installTimeoutMs).toBe(600000);
      expect(config.defaultInstallTimeoutMs).toBe(300000);
    });
  });

  describe('PolicyTimeoutConfig', () => {
    it('should handle policy timeout configuration', () => {
      const config: PolicyTimeoutConfig = {
        evaluationTimeoutMs: 10000,
      };

      expect(config.evaluationTimeoutMs).toBe(10000);
    });
  });
});

describe('Default Timeout Values', () => {
  it('should have correct default timeout values', () => {
    expect(DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD).toBe(30000);
    expect(DEFAULT_TIMEOUTS.BROWSER_NAVIGATION).toBe(30000);
    expect(DEFAULT_TIMEOUTS.BROWSER_SELECTOR_WAIT).toBe(30000);
    expect(DEFAULT_TIMEOUTS.BROWSER_PREVIEW).toBe(5000);

    expect(DEFAULT_TIMEOUTS.TOOL_EXECUTION).toBe(60000);
    expect(DEFAULT_TIMEOUTS.TOOL_INVOCATION).toBe(30000);
    expect(DEFAULT_TIMEOUTS.HOOK_EXECUTION).toBe(30000);
    expect(DEFAULT_TIMEOUTS.LINTER_EXECUTION).toBe(30000);
    expect(DEFAULT_TIMEOUTS.GLOBAL_LINTER).toBe(60000);

    expect(DEFAULT_TIMEOUTS.MCP_CONNECTION).toBe(10000);
    expect(DEFAULT_TIMEOUTS.MCP_REQUEST).toBe(30000);
    expect(DEFAULT_TIMEOUTS.MCP_IDLE).toBe(300000);
    expect(DEFAULT_TIMEOUTS.MCP_HEALTH_CHECK).toBe(5000);

    expect(DEFAULT_TIMEOUTS.APPROVAL_GLOBAL).toBe(60);
    expect(DEFAULT_TIMEOUTS.APPROVAL_LOW_URGENCY).toBe(1440);
    expect(DEFAULT_TIMEOUTS.APPROVAL_NORMAL_URGENCY).toBe(60);
    expect(DEFAULT_TIMEOUTS.APPROVAL_HIGH_URGENCY).toBe(15);
    expect(DEFAULT_TIMEOUTS.APPROVAL_CRITICAL_URGENCY).toBe(5);

    expect(DEFAULT_TIMEOUTS.DEPENDENCY_INSTALL).toBe(300000);
    expect(DEFAULT_TIMEOUTS.POLICY_EVALUATION).toBe(5000);
  });

  it('should have immutable default timeout values', () => {
    expect(Object.isFrozen(DEFAULT_TIMEOUTS)).toBe(true);
  });
});

describe('Environment-specific Configurations', () => {
  describe('Production Configuration', () => {
    it('should have appropriate production timeout values', () => {
      expect(PRODUCTION_TIMEOUT_CONFIG.browser.pageLoadTimeout).toBe(45000);
      expect(PRODUCTION_TIMEOUT_CONFIG.browser.navigationTimeout).toBe(60000);
      expect(PRODUCTION_TIMEOUT_CONFIG.tools.executionTimeoutMs).toBe(120000);
      expect(PRODUCTION_TIMEOUT_CONFIG.mcp.connectionTimeoutMs).toBe(15000);
      expect(PRODUCTION_TIMEOUT_CONFIG.approval.globalApprovalTimeoutMinutes).toBe(120);
      expect(PRODUCTION_TIMEOUT_CONFIG.approval.autoApproveOnTimeout).toBe(false);
    });

    it('should have longer timeouts for production reliability', () => {
      expect(PRODUCTION_TIMEOUT_CONFIG.dependencies.installTimeoutMs).toBe(600000); // 10 minutes
      expect(PRODUCTION_TIMEOUT_CONFIG.mcp.idleTimeoutMs).toBe(600000); // 10 minutes
    });
  });

  describe('Development Configuration', () => {
    it('should have faster development timeout values', () => {
      expect(DEVELOPMENT_TIMEOUT_CONFIG.browser.pageLoadTimeout).toBe(15000);
      expect(DEVELOPMENT_TIMEOUT_CONFIG.browser.navigationTimeout).toBe(20000);
      expect(DEVELOPMENT_TIMEOUT_CONFIG.tools.executionTimeoutMs).toBe(30000);
      expect(DEVELOPMENT_TIMEOUT_CONFIG.mcp.connectionTimeoutMs).toBe(5000);
      expect(DEVELOPMENT_TIMEOUT_CONFIG.approval.globalApprovalTimeoutMinutes).toBe(30);
      expect(DEVELOPMENT_TIMEOUT_CONFIG.approval.autoApproveOnTimeout).toBe(true);
    });

    it('should have shorter timeouts for development speed', () => {
      expect(DEVELOPMENT_TIMEOUT_CONFIG.dependencies.installTimeoutMs).toBe(180000); // 3 minutes
      expect(DEVELOPMENT_TIMEOUT_CONFIG.mcp.idleTimeoutMs).toBe(120000); // 2 minutes
    });
  });
});

describe('TimeoutUtils Utility Functions', () => {
  describe('createTimeout', () => {
    it('should create timeout promise that rejects after specified time', async () => {
      const timeoutMs = 100;
      const timeoutPromise = TimeoutUtils.createTimeout(timeoutMs);

      const start = Date.now();
      await expect(timeoutPromise).rejects.toThrow(`Operation timed out after ${timeoutMs}ms`);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(timeoutMs - 10);
      expect(duration).toBeLessThan(timeoutMs + 50);
    });

    it('should create timeout promise with custom error message', async () => {
      const customMessage = 'Custom timeout error';
      const timeoutPromise = TimeoutUtils.createTimeout(50, customMessage);

      await expect(timeoutPromise).rejects.toThrow(customMessage);
    });
  });

  describe('withTimeout', () => {
    it('should resolve when operation completes before timeout', async () => {
      const operation = new Promise<string>(resolve => {
        setTimeout(() => resolve('completed'), 50);
      });

      const result = await TimeoutUtils.withTimeout(operation, 100);
      expect(result).toBe('completed');
    });

    it('should reject when operation takes longer than timeout', async () => {
      const operation = new Promise<string>(resolve => {
        setTimeout(() => resolve('too late'), 200);
      });

      await expect(TimeoutUtils.withTimeout(operation, 100)).rejects.toThrow('Operation timed out after 100ms');
    });

    it('should use custom timeout message', async () => {
      const operation = new Promise<string>(resolve => {
        setTimeout(() => resolve('too late'), 200);
      });

      const customMessage = 'Database query timeout';
      await expect(TimeoutUtils.withTimeout(operation, 100, customMessage)).rejects.toThrow(customMessage);
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
    it('should format small timeouts in milliseconds', () => {
      expect(TimeoutUtils.formatTimeout(500)).toBe('500ms');
      expect(TimeoutUtils.formatTimeout(999)).toBe('999ms');
    });

    it('should format medium timeouts in seconds', () => {
      expect(TimeoutUtils.formatTimeout(1000)).toBe('1s');
      expect(TimeoutUtils.formatTimeout(5000)).toBe('5s');
      expect(TimeoutUtils.formatTimeout(30000)).toBe('30s');
      expect(TimeoutUtils.formatTimeout(59999)).toBe('60s');
    });

    it('should format large timeouts in minutes', () => {
      expect(TimeoutUtils.formatTimeout(60000)).toBe('1m');
      expect(TimeoutUtils.formatTimeout(300000)).toBe('5m');
      expect(TimeoutUtils.formatTimeout(3600000)).toBe('60m');
    });
  });
});

describe('Timeout Patterns', () => {
  describe('PromiseRaceTimeoutPattern', () => {
    it('should resolve when operation completes within timeout', async () => {
      const operation = Promise.resolve('success');
      const result = await PromiseRaceTimeoutPattern.withTimeout(operation, 1000);

      expect(result).toBe('success');
    });

    it('should reject when operation exceeds timeout', async () => {
      const operation = new Promise<string>(resolve => {
        setTimeout(() => resolve('too late'), 200);
      });

      await expect(PromiseRaceTimeoutPattern.withTimeout(operation, 100))
        .rejects.toThrow('Operation timed out after 100ms');
    });

    it('should use custom error message when timeout occurs', async () => {
      const operation = new Promise<string>(resolve => {
        setTimeout(() => resolve('too late'), 200);
      });

      const customMessage = 'Database connection failed';
      await expect(PromiseRaceTimeoutPattern.withTimeout(operation, 100, customMessage))
        .rejects.toThrow(customMessage);
    });
  });

  describe('SetTimeoutWithCleanupPattern', () => {
    it('should setup and clear timeout correctly', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback = vi.fn();

      pattern.setupTimeout(callback, 100);
      pattern.clearTimeout();

      // Wait a bit longer than the timeout to ensure it doesn't fire
      setTimeout(() => {
        expect(callback).not.toHaveBeenCalled();
      }, 150);
    });

    it('should execute callback when timeout fires', (done) => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const callback = vi.fn(() => {
        expect(callback).toHaveBeenCalledTimes(1);
        done();
      });

      pattern.setupTimeout(callback, 50);
    });

    it('should replace previous timeout when setting new one', () => {
      const pattern = new SetTimeoutWithCleanupPattern();
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      pattern.setupTimeout(firstCallback, 100);
      pattern.setupTimeout(secondCallback, 50);

      setTimeout(() => {
        expect(firstCallback).not.toHaveBeenCalled();
      }, 150);
    });
  });

  describe('ExponentialBackoffPattern', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 100,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry with exponential backoff and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 10,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw last error after max attempts', async () => {
      const finalError = new Error('final failure');
      const operation = vi.fn().mockRejectedValue(finalError);

      await expect(ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 2,
        baseDelayMs: 10,
        backoffMultiplier: 2,
      })).rejects.toThrow('final failure');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should respect maximum delay cap', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await ExponentialBackoffPattern.withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 100,
        backoffMultiplier: 10,
        maxDelayMs: 50, // Cap at 50ms
      });
      const duration = Date.now() - startTime;

      // Should not take more than about 100ms total (50ms + 50ms delays + execution time)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('PollingWaitPattern', () => {
    it('should resolve when condition becomes true', async () => {
      let conditionMet = false;
      setTimeout(() => { conditionMet = true; }, 50);

      await expect(PollingWaitPattern.waitForCondition(
        () => conditionMet,
        {
          timeoutMs: 200,
          intervalMs: 10,
        }
      )).resolves.toBeUndefined();
    });

    it('should timeout when condition never becomes true', async () => {
      await expect(PollingWaitPattern.waitForCondition(
        () => false,
        {
          timeoutMs: 100,
          intervalMs: 10,
        }
      )).rejects.toThrow('Condition not met within 100ms');
    });

    it('should use custom timeout error message', async () => {
      const customError = 'Service not ready in time';

      await expect(PollingWaitPattern.waitForCondition(
        () => false,
        {
          timeoutMs: 50,
          intervalMs: 10,
          timeoutError: customError,
        }
      )).rejects.toThrow(customError);
    });

    it('should handle async condition functions', async () => {
      let conditionMet = false;
      setTimeout(() => { conditionMet = true; }, 30);

      await expect(PollingWaitPattern.waitForCondition(
        async () => {
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 5));
          return conditionMet;
        },
        {
          timeoutMs: 100,
          intervalMs: 10,
        }
      )).resolves.toBeUndefined();
    });
  });
});

describe('TimeoutDebugUtils', () => {
  beforeEach(() => {
    // Clear any existing timeouts
    TimeoutDebugUtils['activeTimeouts'].clear();
  });

  describe('timeout registration', () => {
    it('should register and track active timeout', () => {
      TimeoutDebugUtils.registerTimeout('test-1', 5000, 'Test operation');

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('test-1');
      expect(active[0].operation).toBe('Test operation');
      expect(active[0].timeoutMs).toBe(5000);
    });

    it('should unregister timeout', () => {
      TimeoutDebugUtils.registerTimeout('test-1', 5000, 'Test operation');
      TimeoutDebugUtils.unregisterTimeout('test-1');

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active).toHaveLength(0);
    });

    it('should track multiple timeouts', () => {
      TimeoutDebugUtils.registerTimeout('test-1', 5000, 'Operation 1');
      TimeoutDebugUtils.registerTimeout('test-2', 3000, 'Operation 2');

      const active = TimeoutDebugUtils.getActiveTimeouts();
      expect(active).toHaveLength(2);

      const operations = active.map(t => t.operation).sort();
      expect(operations).toEqual(['Operation 1', 'Operation 2']);
    });
  });

  describe('timeout tracking', () => {
    it('should calculate elapsed and remaining time correctly', () => {
      const startTime = Date.now();
      TimeoutDebugUtils.registerTimeout('test-1', 1000, 'Test operation');

      // Wait a small amount
      setTimeout(() => {
        const active = TimeoutDebugUtils.getActiveTimeouts();
        const timeout = active[0];

        expect(timeout.elapsedMs).toBeGreaterThan(0);
        expect(timeout.remainingMs).toBeLessThan(1000);
        expect(timeout.elapsedMs + timeout.remainingMs).toBeCloseTo(1000, -2);
      }, 100);
    });

    it('should handle expired timeouts', () => {
      // Register a timeout that would have expired
      TimeoutDebugUtils.registerTimeout('expired', 100, 'Expired operation');

      setTimeout(() => {
        const active = TimeoutDebugUtils.getActiveTimeouts();
        const timeout = active[0];

        expect(timeout.remainingMs).toBe(0);
        expect(timeout.elapsedMs).toBeGreaterThan(100);
      }, 150);
    });
  });

  describe('logTimeoutStats', () => {
    it('should log timeout statistics without errors', () => {
      // Mock console.log
      const originalLog = console.log;
      const logSpy = vi.fn();
      console.log = logSpy;

      try {
        TimeoutDebugUtils.registerTimeout('test-1', 5000, 'Test operation 1');
        TimeoutDebugUtils.registerTimeout('test-2', 3000, 'Test operation 2');

        TimeoutDebugUtils.logTimeoutStats();

        expect(logSpy).toHaveBeenCalledWith('Active timeouts: 2');
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test-1: Test operation 1'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test-2: Test operation 2'));
      } finally {
        console.log = originalLog;
      }
    });

    it('should log empty state when no timeouts', () => {
      const originalLog = console.log;
      const logSpy = vi.fn();
      console.log = logSpy;

      try {
        TimeoutDebugUtils.logTimeoutStats();
        expect(logSpy).toHaveBeenCalledWith('Active timeouts: 0');
      } finally {
        console.log = originalLog;
      }
    });
  });
});

describe('Timeout Configuration Validation', () => {
  it('should validate reasonable timeout ranges', () => {
    // Browser timeouts should be reasonable for web operations
    expect(DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD).toBeGreaterThan(5000);
    expect(DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD).toBeLessThan(120000);

    // Tool execution timeouts should allow for complex operations
    expect(DEFAULT_TIMEOUTS.TOOL_EXECUTION).toBeGreaterThan(30000);
    expect(DEFAULT_TIMEOUTS.TOOL_EXECUTION).toBeLessThan(300000);

    // Approval timeouts should be in reasonable ranges (in minutes)
    expect(DEFAULT_TIMEOUTS.APPROVAL_CRITICAL_URGENCY).toBeGreaterThan(1);
    expect(DEFAULT_TIMEOUTS.APPROVAL_LOW_URGENCY).toBeLessThan(2880); // 48 hours max
  });

  it('should have consistent timeout hierarchy', () => {
    // Critical approvals should be faster than high priority
    expect(DEFAULT_TIMEOUTS.APPROVAL_CRITICAL_URGENCY).toBeLessThan(DEFAULT_TIMEOUTS.APPROVAL_HIGH_URGENCY);

    // High priority should be faster than normal
    expect(DEFAULT_TIMEOUTS.APPROVAL_HIGH_URGENCY).toBeLessThan(DEFAULT_TIMEOUTS.APPROVAL_NORMAL_URGENCY);

    // Normal should be faster than low priority
    expect(DEFAULT_TIMEOUTS.APPROVAL_NORMAL_URGENCY).toBeLessThan(DEFAULT_TIMEOUTS.APPROVAL_LOW_URGENCY);
  });

  it('should have production timeouts longer than development timeouts', () => {
    // Production should be more conservative
    expect(PRODUCTION_TIMEOUT_CONFIG.browser.pageLoadTimeout).toBeGreaterThan(DEVELOPMENT_TIMEOUT_CONFIG.browser.pageLoadTimeout);
    expect(PRODUCTION_TIMEOUT_CONFIG.tools.executionTimeoutMs).toBeGreaterThan(DEVELOPMENT_TIMEOUT_CONFIG.tools.executionTimeoutMs);
    expect(PRODUCTION_TIMEOUT_CONFIG.dependencies.installTimeoutMs).toBeGreaterThan(DEVELOPMENT_TIMEOUT_CONFIG.dependencies.installTimeoutMs);
  });
});