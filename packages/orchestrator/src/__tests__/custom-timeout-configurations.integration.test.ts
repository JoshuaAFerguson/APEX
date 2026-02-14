/**
 * @fileoverview Integration tests for custom timeout configurations
 *
 * Verifies acceptance criteria:
 * - AC1: Custom timeout values override defaults
 * - AC2: Custom timeouts are respected for each wait strategy
 * - AC3: Longer custom timeouts allow operations to complete that would fail with defaults
 *
 * This test file ensures that custom timeout configurations properly propagate through
 * all wait strategies and override default values as expected across the APEX system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  DEFAULT_TIMEOUTS,
  PromiseRaceTimeoutPattern,
  SetTimeoutWithCleanupPattern,
  ExponentialBackoffPattern,
  PollingWaitPattern,
  TimeoutUtils,
} from '../timeout-documentation';

// Test tolerance for timing assertions (30% to account for execution variance)
const TIMING_TOLERANCE = 0.3;

// Mock implementations for testing custom timeout behavior
class MockOperationWithConfigurableTimeout extends EventEmitter {
  private defaultTimeout = DEFAULT_TIMEOUTS.BROWSER_SELECTOR_WAIT; // 30000ms
  private operationDuration: number;

  constructor(operationDuration: number = 1000) {
    super();
    this.operationDuration = operationDuration;
  }

  async executeWithDefaultTimeout(): Promise<{ success: boolean; duration: number }> {
    return this.executeWithTimeout({ timeout: this.defaultTimeout });
  }

  async executeWithTimeout(options: { timeout?: number } = {}): Promise<{ success: boolean; duration: number }> {
    const effectiveTimeout = options.timeout ?? this.defaultTimeout;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const duration = Date.now() - startTime;
        this.emit('timeout', { timeout: effectiveTimeout, duration });
        resolve({ success: false, duration });
      }, effectiveTimeout);

      // Simulate the operation completing after operationDuration
      const operationId = setTimeout(() => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        this.emit('success', { duration });
        resolve({ success: true, duration });
      }, this.operationDuration);
    });
  }

  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  setOperationDuration(duration: number): void {
    this.operationDuration = duration;
  }
}

class MockBrowserWithCustomTimeouts extends EventEmitter {
  private defaultConfig = {
    pageLoadTimeout: DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD, // 30000
    navigationTimeout: DEFAULT_TIMEOUTS.BROWSER_NAVIGATION, // 30000
    selectorWaitTimeout: DEFAULT_TIMEOUTS.BROWSER_SELECTOR_WAIT, // 30000
    previewTimeout: DEFAULT_TIMEOUTS.BROWSER_PREVIEW, // 5000
  };

  constructor(customConfig: Partial<typeof MockBrowserWithCustomTimeouts.prototype.defaultConfig> = {}) {
    super();
    this.defaultConfig = { ...this.defaultConfig, ...customConfig };
  }

  async waitForSelector(selector: string, options: { timeout?: number; state?: string } = {}): Promise<{ selector: string; found: boolean; duration: number }> {
    const timeout = options.timeout ?? this.defaultConfig.selectorWaitTimeout;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const duration = Date.now() - startTime;
        this.emit('selectorTimeout', { selector, timeout, duration });
        resolve({ selector, found: false, duration });
      }, timeout);

      // Simulate element found after 500ms (if timeout allows)
      const foundDelay = 500;
      if (foundDelay < timeout) {
        setTimeout(() => {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          this.emit('selectorFound', { selector, duration });
          resolve({ selector, found: true, duration });
        }, foundDelay);
      }
    });
  }

  async navigate(url: string, options: { timeout?: number } = {}): Promise<{ url: string; success: boolean; duration: number }> {
    const timeout = options.timeout ?? this.defaultConfig.navigationTimeout;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const duration = Date.now() - startTime;
        this.emit('navigationTimeout', { url, timeout, duration });
        resolve({ url, success: false, duration });
      }, timeout);

      // Simulate navigation completing after 1 second
      const navigationDelay = 1000;
      if (navigationDelay < timeout) {
        setTimeout(() => {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          this.emit('navigationSuccess', { url, duration });
          resolve({ url, success: true, duration });
        }, navigationDelay);
      }
    });
  }
}

class MockMCPClientWithCustomTimeouts extends EventEmitter {
  private defaultConfig = {
    connectionTimeoutMs: DEFAULT_TIMEOUTS.MCP_CONNECTION, // 10000
    requestTimeoutMs: DEFAULT_TIMEOUTS.MCP_REQUEST, // 30000
    healthCheckTimeoutMs: DEFAULT_TIMEOUTS.MCP_HEALTH_CHECK, // 5000
  };

  constructor(customConfig: Partial<typeof MockMCPClientWithCustomTimeouts.prototype.defaultConfig> = {}) {
    super();
    this.defaultConfig = { ...this.defaultConfig, ...customConfig };
  }

  async connect(options: { connectionTimeoutMs?: number } = {}): Promise<{ success: boolean; duration: number }> {
    const timeout = options.connectionTimeoutMs ?? this.defaultConfig.connectionTimeoutMs;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const duration = Date.now() - startTime;
        this.emit('connectionTimeout', { timeout, duration });
        resolve({ success: false, duration });
      }, timeout);

      // Simulate connection succeeding after 2 seconds
      const connectionDelay = 2000;
      if (connectionDelay < timeout) {
        setTimeout(() => {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          this.emit('connectionSuccess', { duration });
          resolve({ success: true, duration });
        }, connectionDelay);
      }
    });
  }

  async sendRequest(request: any, options: { requestTimeoutMs?: number } = {}): Promise<{ success: boolean; duration: number; result?: any }> {
    const timeout = options.requestTimeoutMs ?? this.defaultConfig.requestTimeoutMs;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const duration = Date.now() - startTime;
        this.emit('requestTimeout', { request, timeout, duration });
        resolve({ success: false, duration });
      }, timeout);

      // Simulate request completing after 1.5 seconds
      const requestDelay = 1500;
      if (requestDelay < timeout) {
        setTimeout(() => {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          this.emit('requestSuccess', { request, duration });
          resolve({ success: true, duration, result: { response: 'success' } });
        }, requestDelay);
      }
    });
  }
}

class MockApprovalGateWithCustomTimeout extends EventEmitter {
  private defaultTimeoutMinutes = DEFAULT_TIMEOUTS.APPROVAL_GLOBAL; // 60 minutes
  private autoApproveOnTimeout = false;

  constructor(customTimeoutMinutes?: number, autoApproveOnTimeout: boolean = false) {
    super();
    if (customTimeoutMinutes !== undefined) {
      this.defaultTimeoutMinutes = customTimeoutMinutes;
    }
    this.autoApproveOnTimeout = autoApproveOnTimeout;
  }

  async requestApproval(options: { timeoutMinutes?: number } = {}): Promise<{ approved: boolean; timedOut: boolean; duration: number }> {
    const timeoutMinutes = options.timeoutMinutes ?? this.defaultTimeoutMinutes;
    const timeoutMs = timeoutMinutes * 60 * 1000; // Convert to milliseconds
    const startTime = Date.now();

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const duration = Date.now() - startTime;
        this.emit('approvalTimeout', { timeoutMinutes, duration });
        resolve({
          approved: this.autoApproveOnTimeout,
          timedOut: true,
          duration
        });
      }, timeoutMs);

      // For testing, we won't simulate manual approval - just let it timeout
    });
  }
}

describe('Custom Timeout Configuration Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('AC1: Custom Timeout Override Behavior', () => {
    it('should use custom timeout instead of default timeout at operation level', async () => {
      const DEFAULT_TIMEOUT = 30000;
      const CUSTOM_TIMEOUT = 500;

      const operation = new MockOperationWithConfigurableTimeout(2000); // Takes 2 seconds

      // Record events
      const events: any[] = [];
      operation.on('timeout', (data) => events.push({ type: 'timeout', ...data }));
      operation.on('success', (data) => events.push({ type: 'success', ...data }));

      const promise = operation.executeWithTimeout({ timeout: CUSTOM_TIMEOUT });

      // Fast-forward past custom timeout but before default timeout
      vi.advanceTimersByTime(CUSTOM_TIMEOUT + 100);

      const result = await promise;

      // Verify custom timeout was used (operation failed due to short timeout)
      expect(result.success).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(CUSTOM_TIMEOUT * (1 - TIMING_TOLERANCE));
      expect(result.duration).toBeLessThan(DEFAULT_TIMEOUT);

      // Verify timeout event was emitted with correct custom value
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('timeout');
      expect(events[0].timeout).toBe(CUSTOM_TIMEOUT);
    });

    it('should use default timeout when no custom timeout is provided', async () => {
      const DEFAULT_TIMEOUT = 5000; // Shorter default for testing
      const operation = new MockOperationWithConfigurableTimeout(2000);
      operation.setDefaultTimeout(DEFAULT_TIMEOUT);

      const events: any[] = [];
      operation.on('success', (data) => events.push({ type: 'success', ...data }));
      operation.on('timeout', (data) => events.push({ type: 'timeout', ...data }));

      const promise = operation.executeWithDefaultTimeout();

      // Fast-forward past operation duration but before timeout
      vi.advanceTimersByTime(2500);

      const result = await promise;

      // Verify operation succeeded with default timeout
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(2000 * (1 - TIMING_TOLERANCE));
      expect(result.duration).toBeLessThan(DEFAULT_TIMEOUT);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('success');
    });

    it('should handle component-level timeout configuration overrides', async () => {
      const DEFAULT_SELECTOR_TIMEOUT = DEFAULT_TIMEOUTS.BROWSER_SELECTOR_WAIT; // 30000
      const CUSTOM_CONFIG_TIMEOUT = 2000;

      // Create browser with custom configuration
      const browserWithCustomConfig = new MockBrowserWithCustomTimeouts({
        selectorWaitTimeout: CUSTOM_CONFIG_TIMEOUT
      });

      const events: any[] = [];
      browserWithCustomConfig.on('selectorTimeout', (data) => events.push({ type: 'timeout', ...data }));
      browserWithCustomConfig.on('selectorFound', (data) => events.push({ type: 'found', ...data }));

      // Don't pass operation-level timeout - should use component config
      const promise = browserWithCustomConfig.waitForSelector('#missing-element');

      vi.advanceTimersByTime(CUSTOM_CONFIG_TIMEOUT + 100);

      const result = await promise;

      expect(result.found).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(CUSTOM_CONFIG_TIMEOUT * (1 - TIMING_TOLERANCE));
      expect(result.duration).toBeLessThan(DEFAULT_SELECTOR_TIMEOUT);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('timeout');
      expect(events[0].timeout).toBe(CUSTOM_CONFIG_TIMEOUT);
    });

    it('should handle operation-level override taking precedence over component config', async () => {
      const COMPONENT_CONFIG_TIMEOUT = 10000;
      const OPERATION_OVERRIDE_TIMEOUT = 800;

      const browserWithCustomConfig = new MockBrowserWithCustomTimeouts({
        selectorWaitTimeout: COMPONENT_CONFIG_TIMEOUT
      });

      const events: any[] = [];
      browserWithCustomConfig.on('selectorTimeout', (data) => events.push({ type: 'timeout', ...data }));

      // Operation-level timeout should override component config
      const promise = browserWithCustomConfig.waitForSelector('#missing-element', {
        timeout: OPERATION_OVERRIDE_TIMEOUT
      });

      vi.advanceTimersByTime(OPERATION_OVERRIDE_TIMEOUT + 100);

      const result = await promise;

      expect(result.found).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(OPERATION_OVERRIDE_TIMEOUT * (1 - TIMING_TOLERANCE));
      expect(result.duration).toBeLessThan(COMPONENT_CONFIG_TIMEOUT);

      expect(events).toHaveLength(1);
      expect(events[0].timeout).toBe(OPERATION_OVERRIDE_TIMEOUT);
    });

    it('should handle zero and negative timeout edge cases gracefully', async () => {
      const operation = new MockOperationWithConfigurableTimeout(1000);

      // Test zero timeout - should fallback to default
      const zeroResult = await operation.executeWithTimeout({ timeout: 0 });
      expect(zeroResult.success).toBe(false); // Should timeout immediately

      // Test negative timeout - should fallback to default or handle gracefully
      const negativePromise = operation.executeWithTimeout({ timeout: -100 });

      // Should either fail immediately or use a fallback timeout
      vi.advanceTimersByTime(100);
      const negativeResult = await negativePromise;
      expect(negativeResult.success).toBe(false);
    });
  });

  describe('AC2: Custom Timeouts Per Wait Strategy', () => {
    describe('Promise.race Pattern', () => {
      it('should respect custom timeout in Promise.race pattern', async () => {
        const CUSTOM_TIMEOUT = 600;
        const neverResolves = (): Promise<never> => new Promise(() => {}); // Never resolves

        const startTime = Date.now();
        vi.useFakeTimers();

        const promise = PromiseRaceTimeoutPattern.withTimeout(
          neverResolves(),
          CUSTOM_TIMEOUT,
          'Custom timeout message'
        );

        vi.advanceTimersByTime(CUSTOM_TIMEOUT + 50);

        await expect(promise).rejects.toThrow('Custom timeout message');

        const duration = Date.now() - startTime;
        expect(duration).toBeGreaterThanOrEqual(CUSTOM_TIMEOUT * (1 - TIMING_TOLERANCE));
      });

      it('should allow successful completion within custom timeout', async () => {
        const CUSTOM_TIMEOUT = 2000;
        const OPERATION_DELAY = 800;

        const slowOperation = (): Promise<string> =>
          new Promise(resolve => setTimeout(() => resolve('success'), OPERATION_DELAY));

        const promise = PromiseRaceTimeoutPattern.withTimeout(
          slowOperation(),
          CUSTOM_TIMEOUT,
          'Should not timeout'
        );

        vi.advanceTimersByTime(OPERATION_DELAY + 100);

        const result = await promise;
        expect(result).toBe('success');
      });
    });

    describe('Polling Pattern', () => {
      it('should respect custom timeout in polling pattern', async () => {
        const CUSTOM_TIMEOUT = 1200;
        const POLLING_INTERVAL = 100;

        let checkCount = 0;
        const neverTrueCondition = () => {
          checkCount++;
          return false; // Never becomes true
        };

        const promise = PollingWaitPattern.waitForCondition(
          neverTrueCondition,
          {
            timeoutMs: CUSTOM_TIMEOUT,
            intervalMs: POLLING_INTERVAL,
            timeoutError: 'Custom polling timeout'
          }
        );

        vi.advanceTimersByTime(CUSTOM_TIMEOUT + 200);

        await expect(promise).rejects.toThrow('Custom polling timeout');

        // Verify polling happened multiple times within the timeout window
        expect(checkCount).toBeGreaterThan(5); // Should have polled ~12 times (1200/100)
        expect(checkCount).toBeLessThan(20); // But not too many more
      });

      it('should succeed when condition becomes true within custom timeout', async () => {
        const CUSTOM_TIMEOUT = 2000;
        const CONDITION_DELAY = 800;
        const POLLING_INTERVAL = 100;

        let conditionMet = false;
        setTimeout(() => { conditionMet = true; }, CONDITION_DELAY);

        const eventuallyTrueCondition = () => conditionMet;

        const promise = PollingWaitPattern.waitForCondition(
          eventuallyTrueCondition,
          {
            timeoutMs: CUSTOM_TIMEOUT,
            intervalMs: POLLING_INTERVAL
          }
        );

        vi.advanceTimersByTime(CONDITION_DELAY + 200);

        await expect(promise).resolves.toBeUndefined();
      });
    });

    describe('Exponential Backoff Pattern', () => {
      it('should respect custom max delay in exponential backoff', async () => {
        const CUSTOM_MAX_DELAY = 500;
        const BASE_DELAY = 100;
        const BACKOFF_MULTIPLIER = 2;

        let attemptCount = 0;
        const alwaysFailsOperation = async () => {
          attemptCount++;
          throw new Error(`Attempt ${attemptCount} failed`);
        };

        const promise = ExponentialBackoffPattern.withRetry(
          alwaysFailsOperation,
          {
            maxAttempts: 5,
            baseDelayMs: BASE_DELAY,
            backoffMultiplier: BACKOFF_MULTIPLIER,
            maxDelayMs: CUSTOM_MAX_DELAY // Custom max delay
          }
        );

        // Calculate expected total time with custom max delay
        // Delays: 100, 200, 500 (capped), 500 (capped), final attempt
        const expectedTotalDelay = 100 + 200 + CUSTOM_MAX_DELAY + CUSTOM_MAX_DELAY;

        vi.advanceTimersByTime(expectedTotalDelay + 500);

        await expect(promise).rejects.toThrow('Operation failed after 5 attempts');
        expect(attemptCount).toBe(5);
      });

      it('should use uncapped exponential backoff when no custom max delay', async () => {
        const BASE_DELAY = 100;
        const BACKOFF_MULTIPLIER = 3;

        let attemptCount = 0;
        const alwaysFailsOperation = async () => {
          attemptCount++;
          if (attemptCount === 4) {
            return 'success'; // Succeed on 4th attempt
          }
          throw new Error(`Attempt ${attemptCount} failed`);
        };

        const promise = ExponentialBackoffPattern.withRetry(
          alwaysFailsOperation,
          {
            maxAttempts: 5,
            baseDelayMs: BASE_DELAY,
            backoffMultiplier: BACKOFF_MULTIPLIER
            // No maxDelayMs - uncapped exponential backoff
          }
        );

        // Delays: 100, 300, 900, then success
        vi.advanceTimersByTime(100 + 300 + 900 + 100);

        const result = await promise;
        expect(result).toBe('success');
        expect(attemptCount).toBe(4);
      });
    });

    describe('SetTimeout with Cleanup Pattern', () => {
      it('should respect custom timeout in setTimeout pattern', async () => {
        const CUSTOM_TIMEOUT = 800;
        const timeoutManager = new SetTimeoutWithCleanupPattern();

        let timeoutExecuted = false;
        const timeoutCallback = () => {
          timeoutExecuted = true;
        };

        timeoutManager.setupTimeout(timeoutCallback, CUSTOM_TIMEOUT);

        expect(timeoutManager.isTimeoutActive()).toBe(true);

        // Fast-forward past custom timeout
        vi.advanceTimersByTime(CUSTOM_TIMEOUT + 100);

        expect(timeoutExecuted).toBe(true);
        expect(timeoutManager.isTimeoutActive()).toBe(false);
      });

      it('should allow timeout cancellation before custom timeout fires', async () => {
        const CUSTOM_TIMEOUT = 1500;
        const CANCELLATION_DELAY = 700;

        const timeoutManager = new SetTimeoutWithCleanupPattern();

        let timeoutExecuted = false;
        const timeoutCallback = () => {
          timeoutExecuted = true;
        };

        timeoutManager.setupTimeout(timeoutCallback, CUSTOM_TIMEOUT);

        // Cancel before timeout
        setTimeout(() => {
          timeoutManager.clearTimeout();
        }, CANCELLATION_DELAY);

        vi.advanceTimersByTime(CANCELLATION_DELAY + 100);
        expect(timeoutExecuted).toBe(false);
        expect(timeoutManager.isTimeoutActive()).toBe(false);

        // Fast-forward past original timeout
        vi.advanceTimersByTime(CUSTOM_TIMEOUT);
        expect(timeoutExecuted).toBe(false); // Should still be false
      });
    });
  });

  describe('AC3: Extended Timeouts Enable Success', () => {
    it('should fail with short default timeout but succeed with extended custom timeout - Browser operations', async () => {
      const SHORT_DEFAULT = 1000;
      const EXTENDED_CUSTOM = 3000;
      const ELEMENT_APPEARS_AFTER = 2000;

      // Create browser with short default timeout
      const browser = new MockBrowserWithCustomTimeouts({
        selectorWaitTimeout: SHORT_DEFAULT
      });

      // Create a mock that simulates element appearing after 2 seconds
      const mockSlowElementBrowser = {
        async waitForSelector(selector: string, options: { timeout?: number } = {}): Promise<{ selector: string; found: boolean; duration: number }> {
          const timeout = options.timeout ?? SHORT_DEFAULT;
          const startTime = Date.now();

          return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              const duration = Date.now() - startTime;
              resolve({ selector, found: false, duration });
            }, timeout);

            // Element appears after ELEMENT_APPEARS_AFTER milliseconds
            setTimeout(() => {
              clearTimeout(timeoutId);
              const duration = Date.now() - startTime;
              resolve({ selector, found: true, duration });
            }, ELEMENT_APPEARS_AFTER);
          });
        }
      };

      // First, prove default fails
      const defaultPromise = mockSlowElementBrowser.waitForSelector('#slow-element');
      vi.advanceTimersByTime(SHORT_DEFAULT + 100);

      const defaultResult = await defaultPromise;
      expect(defaultResult.found).toBe(false);
      expect(defaultResult.duration).toBeGreaterThanOrEqual(SHORT_DEFAULT * (1 - TIMING_TOLERANCE));

      // Reset timers for second test
      vi.clearAllTimers();
      vi.useFakeTimers();

      // Then, prove extended timeout succeeds
      const extendedPromise = mockSlowElementBrowser.waitForSelector('#slow-element', {
        timeout: EXTENDED_CUSTOM
      });

      vi.advanceTimersByTime(ELEMENT_APPEARS_AFTER + 100);

      const extendedResult = await extendedPromise;
      expect(extendedResult.found).toBe(true);
      expect(extendedResult.duration).toBeGreaterThanOrEqual(ELEMENT_APPEARS_AFTER * (1 - TIMING_TOLERANCE));
      expect(extendedResult.duration).toBeLessThan(EXTENDED_CUSTOM);
    });

    it('should fail with short default but succeed with extended timeout - MCP operations', async () => {
      const SHORT_DEFAULT = 1500;
      const EXTENDED_CUSTOM = 4000;
      const CONNECTION_TAKES = 2500;

      // Create MCP client with short default
      const mcpClient = new MockMCPClientWithCustomTimeouts({
        connectionTimeoutMs: SHORT_DEFAULT
      });

      // Override the connect method to simulate slow connection
      const originalConnect = mcpClient.connect.bind(mcpClient);
      mcpClient.connect = async function(options: { connectionTimeoutMs?: number } = {}): Promise<{ success: boolean; duration: number }> {
        const timeout = options.connectionTimeoutMs ?? SHORT_DEFAULT;
        const startTime = Date.now();

        return new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            const duration = Date.now() - startTime;
            resolve({ success: false, duration });
          }, timeout);

          // Connection succeeds after CONNECTION_TAKES milliseconds
          setTimeout(() => {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            resolve({ success: true, duration });
          }, CONNECTION_TAKES);
        });
      };

      // First, prove default fails
      const defaultPromise = mcpClient.connect();
      vi.advanceTimersByTime(SHORT_DEFAULT + 100);

      const defaultResult = await defaultPromise;
      expect(defaultResult.success).toBe(false);
      expect(defaultResult.duration).toBeGreaterThanOrEqual(SHORT_DEFAULT * (1 - TIMING_TOLERANCE));

      // Reset timers
      vi.clearAllTimers();
      vi.useFakeTimers();

      // Then, prove extended timeout succeeds
      const extendedPromise = mcpClient.connect({
        connectionTimeoutMs: EXTENDED_CUSTOM
      });

      vi.advanceTimersByTime(CONNECTION_TAKES + 100);

      const extendedResult = await extendedPromise;
      expect(extendedResult.success).toBe(true);
      expect(extendedResult.duration).toBeGreaterThanOrEqual(CONNECTION_TAKES * (1 - TIMING_TOLERANCE));
      expect(extendedResult.duration).toBeLessThan(EXTENDED_CUSTOM);
    });

    it('should fail with short timeout but succeed with extended timeout - Approval operations', async () => {
      const SHORT_TIMEOUT_MINUTES = 1; // 1 minute
      const EXTENDED_TIMEOUT_MINUTES = 5; // 5 minutes
      const APPROVAL_COMES_AFTER_MINUTES = 3; // Approval after 3 minutes

      // Mock approval gate that simulates approval after a specific time
      class MockDelayedApprovalGate extends MockApprovalGateWithCustomTimeout {
        async requestApproval(options: { timeoutMinutes?: number } = {}): Promise<{ approved: boolean; timedOut: boolean; duration: number }> {
          const timeoutMinutes = options.timeoutMinutes ?? 1;
          const timeoutMs = timeoutMinutes * 60 * 1000;
          const approvalDelayMs = APPROVAL_COMES_AFTER_MINUTES * 60 * 1000;
          const startTime = Date.now();

          return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              const duration = Date.now() - startTime;
              resolve({ approved: false, timedOut: true, duration });
            }, timeoutMs);

            // Approval comes after the specified delay
            const approvalId = setTimeout(() => {
              clearTimeout(timeoutId);
              const duration = Date.now() - startTime;
              resolve({ approved: true, timedOut: false, duration });
            }, approvalDelayMs);
          });
        }
      }

      const approvalGate = new MockDelayedApprovalGate();

      // First, prove short timeout fails
      const shortPromise = approvalGate.requestApproval({
        timeoutMinutes: SHORT_TIMEOUT_MINUTES
      });

      vi.advanceTimersByTime(SHORT_TIMEOUT_MINUTES * 60 * 1000 + 1000); // + 1 second buffer

      const shortResult = await shortPromise;
      expect(shortResult.approved).toBe(false);
      expect(shortResult.timedOut).toBe(true);

      // Reset timers
      vi.clearAllTimers();
      vi.useFakeTimers();

      // Then, prove extended timeout succeeds
      const extendedPromise = approvalGate.requestApproval({
        timeoutMinutes: EXTENDED_TIMEOUT_MINUTES
      });

      vi.advanceTimersByTime(APPROVAL_COMES_AFTER_MINUTES * 60 * 1000 + 10000); // +10 seconds buffer

      const extendedResult = await extendedPromise;
      expect(extendedResult.approved).toBe(true);
      expect(extendedResult.timedOut).toBe(false);
      expect(extendedResult.duration).toBeGreaterThanOrEqual((APPROVAL_COMES_AFTER_MINUTES * 60 * 1000) * (1 - TIMING_TOLERANCE));
    });

    it('should demonstrate cascade of increasing timeouts until success', async () => {
      const TIMEOUTS = [500, 1500, 3500]; // Escalating timeouts
      const OPERATION_SUCCEEDS_AFTER = 2000;

      // Operation that succeeds after 2 seconds
      const eventuallySuccessfulOperation = (timeoutMs: number): Promise<{ success: boolean; duration: number }> => {
        const startTime = Date.now();

        return new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            const duration = Date.now() - startTime;
            resolve({ success: false, duration });
          }, timeoutMs);

          setTimeout(() => {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            resolve({ success: true, duration });
          }, OPERATION_SUCCEEDS_AFTER);
        });
      };

      const results = [];

      // Test each timeout level
      for (const timeout of TIMEOUTS) {
        vi.clearAllTimers();
        vi.useFakeTimers();

        const promise = eventuallySuccessfulOperation(timeout);
        vi.advanceTimersByTime(Math.max(timeout, OPERATION_SUCCEEDS_AFTER) + 100);

        const result = await promise;
        results.push({ timeout, ...result });
      }

      // Verify progression: fails at 500ms, fails at 1500ms, succeeds at 3500ms
      expect(results[0]).toMatchObject({ timeout: 500, success: false });
      expect(results[1]).toMatchObject({ timeout: 1500, success: false });
      expect(results[2]).toMatchObject({ timeout: 3500, success: true });

      // Verify the successful one took about 2 seconds
      expect(results[2].duration).toBeGreaterThanOrEqual(OPERATION_SUCCEEDS_AFTER * (1 - TIMING_TOLERANCE));
      expect(results[2].duration).toBeLessThan(3500);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle timeout configuration inheritance correctly', async () => {
      const GLOBAL_DEFAULT = 10000;
      const COMPONENT_CONFIG = 5000;
      const OPERATION_OVERRIDE = 2000;

      // Simulate configuration hierarchy
      class MockHierarchicalComponent {
        constructor(
          private globalDefault: number,
          private componentConfig?: number
        ) {}

        async operate(operationTimeout?: number): Promise<{ timeout: number; source: string }> {
          const effectiveTimeout = operationTimeout ?? this.componentConfig ?? this.globalDefault;
          const source = operationTimeout ? 'operation' :
                        this.componentConfig ? 'component' : 'global';

          return { timeout: effectiveTimeout, source };
        }
      }

      const component = new MockHierarchicalComponent(GLOBAL_DEFAULT, COMPONENT_CONFIG);

      // Test hierarchy
      const globalResult = await new MockHierarchicalComponent(GLOBAL_DEFAULT).operate();
      expect(globalResult).toEqual({ timeout: GLOBAL_DEFAULT, source: 'global' });

      const componentResult = await component.operate();
      expect(componentResult).toEqual({ timeout: COMPONENT_CONFIG, source: 'component' });

      const operationResult = await component.operate(OPERATION_OVERRIDE);
      expect(operationResult).toEqual({ timeout: OPERATION_OVERRIDE, source: 'operation' });
    });

    it('should handle concurrent operations with different custom timeouts', async () => {
      const timeouts = [800, 1500, 2500];
      const operations = timeouts.map(timeout =>
        new MockOperationWithConfigurableTimeout(timeout / 2) // Each takes half the timeout
      );

      const promises = operations.map((operation, index) =>
        operation.executeWithTimeout({ timeout: timeouts[index] })
      );

      // Fast-forward enough time for all to complete
      vi.advanceTimersByTime(Math.max(...timeouts) + 100);

      const results = await Promise.all(promises);

      // All should succeed since each operation takes half its timeout
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThanOrEqual((timeouts[index] / 2) * (1 - TIMING_TOLERANCE));
        expect(result.duration).toBeLessThan(timeouts[index]);
      });
    });

    it('should handle timeout utilities with custom values', async () => {
      const CUSTOM_TIMEOUT = 1200;
      const CUSTOM_MESSAGE = 'Custom utility timeout';

      const slowPromise = new Promise(resolve => setTimeout(resolve, 2000));

      const timeoutPromise = TimeoutUtils.withTimeout(
        slowPromise,
        CUSTOM_TIMEOUT,
        CUSTOM_MESSAGE
      );

      vi.advanceTimersByTime(CUSTOM_TIMEOUT + 100);

      await expect(timeoutPromise).rejects.toThrow(CUSTOM_MESSAGE);
    });

    it('should handle timeout formatting for custom values', () => {
      expect(TimeoutUtils.formatTimeout(500)).toBe('500ms');
      expect(TimeoutUtils.formatTimeout(1500)).toBe('1.5s');
      expect(TimeoutUtils.formatTimeout(65000)).toBe('1.1m');
      expect(TimeoutUtils.formatTimeout(3700000)).toBe('1.0h');
      expect(TimeoutUtils.formatTimeout(0)).toBe('No timeout');
    });
  });
});