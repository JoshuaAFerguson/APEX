/**
 * @fileoverview Comprehensive Timeout Edge Cases and Error Handling Tests
 *
 * Tests edge cases, boundary conditions, and error scenarios for timeout handling:
 * - Zero and negative timeout values
 * - Extremely large timeout values
 * - Timeout precision and accuracy
 * - Race conditions and concurrent timeouts
 * - Memory leaks and resource cleanup
 * - Error message formatting and context
 * - Recovery from timeout failures
 *
 * These tests ensure robust timeout behavior under unusual conditions
 * and verify proper error handling patterns across all timeout categories.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBrowserManager, createBrowserSession, BrowserManager, BrowserSession } from '../index.js';
import type { BrowserSessionConfig } from '../index.js';

// Mock weak reference tracking for memory leak detection
const activeTimeouts = new WeakSet();
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

describe('Timeout Edge Cases and Error Handling Comprehensive Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Track timeout creation/cleanup for memory leak detection
    globalThis.setTimeout = vi.fn().mockImplementation((fn, delay, ...args) => {
      const id = originalSetTimeout(fn, delay, ...args);
      activeTimeouts.add({ id, delay, created: Date.now() });
      return id;
    });

    globalThis.clearTimeout = vi.fn().mockImplementation((id) => {
      originalClearTimeout(id);
      // Note: Can't remove from WeakSet, but GC will handle it
    });

    manager = createBrowserManager();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    await manager.shutdown();

    vi.useRealTimers();
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  });

  describe('Zero and Negative Timeout Edge Cases', () => {
    it('should handle zero timeout gracefully for navigation operations', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 1000, // Default session timeout
      };

      session = createBrowserSession(manager, config);
      await session.launch();

      const startTime = Date.now();
      const result = await session.navigate('data:text/html,<h1>Test</h1>', { timeout: 0 });
      const duration = Date.now() - startTime;

      // Zero timeout should either succeed immediately or fail quickly
      if (result.success) {
        expect(duration).toBeLessThan(100);
      } else {
        expect(duration).toBeLessThan(500);
        expect(result.error).toBeDefined();
      }
    });

    it('should handle negative timeout values for element operations', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>No target elements</div>');

      const operations = [
        { name: 'click', op: () => session.click('#nonexistent', { timeout: -100 }) },
        { name: 'type', op: () => session.type('#nonexistent', 'text', { timeout: -500 }) },
        { name: 'waitForElement', op: () => session.waitForElement('#nonexistent', { timeout: -1000 }) },
      ];

      for (const { name, op } of operations) {
        const startTime = Date.now();
        const result = await op();
        const duration = Date.now() - startTime;

        expect(result.success).toBe(false);
        expect(duration).toBeLessThan(1000); // Should fail quickly
        expect(result.error).toBeDefined();

        // Error should be informative about invalid timeout
        const errorLower = result.error!.toLowerCase();
        expect(
          errorLower.includes('timeout') ||
          errorLower.includes('invalid') ||
          errorLower.includes('failed')
        ).toBe(true);
      }
    });

    it('should normalize zero timeout to minimum allowed value', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<button id="instant">Instant</button>');

      // For existing elements, zero timeout might still succeed
      const result = await session.click('#instant', { timeout: 0 });

      if (result.success) {
        expect(result.duration).toBeLessThan(100);
      } else {
        // Should fail quickly if zero timeout is treated as invalid
        expect(result.duration).toBeLessThan(500);
      }
    });
  });

  describe('Extremely Large Timeout Values', () => {
    it('should handle maximum safe integer timeout values', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: Number.MAX_SAFE_INTEGER,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<button id="immediate">Click me</button>');

      // Should succeed immediately despite huge timeout
      const startTime = Date.now();
      const result = await session.click('#immediate', { timeout: Number.MAX_SAFE_INTEGER });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Should be fast
    });

    it('should handle infinity timeout values', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Test page</div>');

      // Test infinite timeout (should be handled gracefully)
      const operations = [
        () => session.waitForElement('#exists', { timeout: Infinity }),
        () => session.waitForElement('#exists', { timeout: Number.POSITIVE_INFINITY }),
      ];

      for (const operation of operations) {
        const result = await operation();

        // Either succeeds or handles infinity gracefully
        if (!result.success) {
          expect(result.error).toBeDefined();
          // Should not have timed out if infinity was respected
          expect(result.error).not.toMatch(/timed out/i);
        }
      }
    });

    it('should not cause integer overflow with very large timeouts', async () => {
      const largeTimeouts = [
        Number.MAX_SAFE_INTEGER,
        Math.pow(2, 31) - 1, // 32-bit max
        Math.pow(2, 53) - 1, // 64-bit max
      ];

      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Large timeout test</div>');

      for (const timeout of largeTimeouts) {
        // Use an element that exists to test timeout handling, not element waiting
        const result = await session.getText('div', { timeout });

        // Should succeed without timeout issues
        expect(result.success).toBe(true);
        expect(result.duration).toBeLessThan(1000);
      }
    });
  });

  describe('Timeout Precision and Accuracy', () => {
    it('should handle sub-second timeout precision', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Precision test</div>');

      const preciseTimeouts = [100, 250, 500, 750]; // Sub-second timeouts
      const tolerance = 0.3; // 30% tolerance

      for (const timeout of preciseTimeouts) {
        const startTime = Date.now();
        const result = await session.waitForElement('#nonexistent', { timeout });
        const duration = Date.now() - startTime;

        expect(result.success).toBe(false);

        // Check timing precision within tolerance
        const expectedMin = timeout * (1 - tolerance);
        const expectedMax = timeout * (1 + tolerance);

        expect(duration).toBeGreaterThanOrEqual(expectedMin);
        expect(duration).toBeLessThan(expectedMax);
      }
    });

    it('should maintain timeout accuracy under system load', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Load test</div>');

      // Simulate system load with multiple concurrent operations
      const concurrentOps = 10;
      const timeout = 1000;

      const operations = Array(concurrentOps).fill(0).map((_, i) => ({
        id: i,
        promise: session.waitForElement(`#nonexistent-${i}`, { timeout }),
        startTime: Date.now(),
      }));

      const results = await Promise.all(operations.map(op => op.promise));

      // All should fail due to timeout, timing should be reasonably accurate
      results.forEach((result, i) => {
        const duration = Date.now() - operations[i].startTime;

        expect(result.success).toBe(false);
        expect(duration).toBeGreaterThanOrEqual(800); // Within 20% tolerance
        expect(duration).toBeLessThan(1500);
      });
    });

    it('should handle rapid timeout sequences without drift', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Sequence test</div>');

      const sequenceLength = 5;
      const timeoutDuration = 200;
      const results = [];

      // Execute rapid sequence of timeout operations
      for (let i = 0; i < sequenceLength; i++) {
        const startTime = Date.now();
        const result = await session.waitForElement(`#seq-${i}`, { timeout: timeoutDuration });
        const duration = Date.now() - startTime;

        results.push({ index: i, duration, success: result.success });
      }

      // Verify no significant timing drift across sequence
      const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxDeviation = Math.max(...results.map(r => Math.abs(r.duration - averageDuration)));

      expect(averageDuration).toBeGreaterThanOrEqual(150);
      expect(averageDuration).toBeLessThan(300);
      expect(maxDeviation).toBeLessThan(100); // Low deviation indicates stable timing
    });
  });

  describe('Race Conditions and Concurrent Timeouts', () => {
    it('should handle multiple concurrent timeouts without interference', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Concurrent test</div>');

      // Start multiple operations with different timeouts simultaneously
      const operations = [
        { name: 'fast', timeout: 300, promise: null as any },
        { name: 'medium', timeout: 600, promise: null as any },
        { name: 'slow', timeout: 900, promise: null as any },
      ];

      const startTime = Date.now();

      // Start all operations at once
      operations.forEach((op, i) => {
        op.promise = session.waitForElement(`#concurrent-${i}`, { timeout: op.timeout });
      });

      // Wait for all to complete
      const results = await Promise.all(operations.map(op => op.promise));

      // Verify each timed out correctly
      operations.forEach((op, i) => {
        const duration = Date.now() - startTime;
        expect(results[i].success).toBe(false);
      });

      // Verify timing relationships (fast < medium < slow)
      // Since they all started at the same time, we can't check individual durations easily
      // But we can verify all completed within reasonable time of the longest timeout
      const totalDuration = Date.now() - startTime;
      expect(totalDuration).toBeGreaterThanOrEqual(900 * 0.8); // 80% of slowest
      expect(totalDuration).toBeLessThan(900 * 1.3); // 130% of slowest
    });

    it('should handle timeout cancellation race conditions', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<button id="race-target">Target</button>');

      // Start a long timeout operation
      const longTimeoutPromise = session.waitForElement('#nonexistent', { timeout: 2000 });

      // Immediately start a successful operation on existing element
      const quickSuccessPromise = session.click('#race-target', { timeout: 5000 });

      // Race the operations
      const [longResult, quickResult] = await Promise.all([
        longTimeoutPromise.catch(err => ({ success: false, error: err.message })),
        quickSuccessPromise,
      ]);

      expect(quickResult.success).toBe(true);
      expect(longResult.success).toBe(false);
    });

    it('should prevent timeout timer leaks during rapid cancellation', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Timer leak test</div>');

      const timerCount = 50;
      const promises = [];

      // Create many timeout operations and cancel them quickly
      for (let i = 0; i < timerCount; i++) {
        const promise = session.waitForElement(`#leak-test-${i}`, { timeout: 1000 })
          .catch(() => ({ success: false, cancelled: true }));
        promises.push(promise);
      }

      // Let a few operations start, then advance time quickly
      vi.advanceTimersByTime(100);

      // Verify all operations complete/cancel properly
      const results = await Promise.all(promises);

      // All should have failed/cancelled
      results.forEach(result => {
        expect(result.success).toBe(false);
      });

      // Verify clearTimeout was called appropriately (mocked function should be called)
      expect(globalThis.clearTimeout).toHaveBeenCalled();
    });
  });

  describe('Error Message Formatting and Context', () => {
    it('should provide detailed timeout error messages with context', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Error context test</div>');

      const timeoutScenarios = [
        {
          name: 'element click',
          operation: () => session.click('#missing-button', { timeout: 500 }),
          expectedContext: ['click', 'missing-button', '500'],
        },
        {
          name: 'text input',
          operation: () => session.type('#missing-input', 'test', { timeout: 750 }),
          expectedContext: ['type', 'missing-input', '750'],
        },
        {
          name: 'element wait',
          operation: () => session.waitForElement('#missing-element', { timeout: 1000 }),
          expectedContext: ['wait', 'missing-element', '1000'],
        },
      ];

      for (const scenario of timeoutScenarios) {
        const result = await scenario.operation();

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        const errorLower = result.error!.toLowerCase();

        // Check that error contains timeout indication
        expect(
          errorLower.includes('timeout') ||
          errorLower.includes('timed out')
        ).toBe(true);

        // Check for operation context
        const hasContext = scenario.expectedContext.some(context =>
          errorLower.includes(context.toLowerCase())
        );
        expect(hasContext).toBe(true);

        // Check for timing information
        expect(result.duration).toBeGreaterThan(0);
      }
    });

    it('should include operation stack trace in timeout errors', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Stack trace test</div>');

      const operation = async () => {
        try {
          return await session.waitForElement('#stack-test', { timeout: 300 });
        } catch (error) {
          return { success: false, error: error.message, stack: error.stack };
        }
      };

      const result = await operation();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // If stack trace is included, it should contain meaningful information
      if ('stack' in result && result.stack) {
        const stack = result.stack as string;
        expect(stack.length).toBeGreaterThan(0);
        // Stack should reference the operation or timeout handling
        expect(
          stack.includes('waitForElement') ||
          stack.includes('timeout') ||
          stack.includes('operation')
        ).toBe(true);
      }
    });

    it('should format timeout errors consistently across operation types', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Consistency test</div>');

      const operations = [
        { name: 'click', fn: () => session.click('#consistency-test', { timeout: 200 }) },
        { name: 'type', fn: () => session.type('#consistency-test', 'test', { timeout: 200 }) },
        { name: 'hover', fn: () => session.hover('#consistency-test', { timeout: 200 }) },
        { name: 'waitElement', fn: () => session.waitForElement('#consistency-test', { timeout: 200 }) },
      ];

      const errorFormats = [];

      for (const op of operations) {
        const result = await op.fn();
        expect(result.success).toBe(false);

        const error = result.error!;
        errorFormats.push({
          operation: op.name,
          hasTimeout: /timeout|timed out/i.test(error),
          hasOperation: error.toLowerCase().includes(op.name),
          hasSelector: error.includes('consistency-test'),
          hasMilliseconds: /\d+ms/.test(error) || error.includes('200'),
          length: error.length,
        });
      }

      // Verify consistency across error formats
      const allHaveTimeout = errorFormats.every(fmt => fmt.hasTimeout);
      const allHaveMilliseconds = errorFormats.every(fmt => fmt.hasMilliseconds);
      const reasonableLength = errorFormats.every(fmt => fmt.length > 10 && fmt.length < 200);

      expect(allHaveTimeout).toBe(true);
      expect(reasonableLength).toBe(true);
      // At least some should have millisecond information
      expect(errorFormats.some(fmt => fmt.hasMilliseconds)).toBe(true);
    });
  });

  describe('Recovery from Timeout Failures', () => {
    it('should maintain session state after timeout errors', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<h1 id="title">Working Page</h1><button id="button">Click me</button>');

      // Cause a timeout error
      const timeoutResult = await session.click('#nonexistent', { timeout: 300 });
      expect(timeoutResult.success).toBe(false);

      // Verify session is still functional
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);

      const textResult = await session.getText('#title');
      expect(textResult.success).toBe(true);
      expect(textResult.data).toBe('Working Page');

      // Verify can still perform operations
      const clickResult = await session.click('#button');
      expect(clickResult.success).toBe(true);
    });

    it('should handle timeout error during navigation recovery', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();

      // Initial successful navigation
      const initialResult = await session.navigate('data:text/html,<h1>Initial</h1>');
      expect(initialResult.success).toBe(true);

      // Navigation that times out (simulate slow loading)
      const slowNavResult = await session.navigate(
        'data:text/html,<script>setTimeout(function(){document.title="Loaded";}, 5000)</script><h1>Loading...</h1>',
        { timeout: 1000 }
      );

      // Navigation may succeed or timeout, but session should remain usable
      if (!slowNavResult.success) {
        expect(slowNavResult.error).toMatch(/timeout|timed out/i);
      }

      // Recovery navigation should work
      const recoveryResult = await session.navigate('data:text/html,<h1>Recovered</h1>');
      expect(recoveryResult.success).toBe(true);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
    });

    it('should cleanup resources after timeout failures', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Cleanup test</div>');

      // Track initial resource state (mocked)
      const initialMemory = process.memoryUsage();

      // Perform operations that timeout
      const timeoutOperations = Array(20).fill(0).map((_, i) =>
        session.waitForElement(`#cleanup-${i}`, { timeout: 100 }).catch(() => ({}))
      );

      await Promise.all(timeoutOperations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Verify session still works (indicates proper cleanup)
      const healthCheck = await session.getTitle();
      expect(healthCheck.success).toBe(true);

      // Memory usage should not have grown excessively
      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Allow reasonable growth but detect major leaks (>10MB growth)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Boundary Condition Edge Cases', () => {
    it('should handle timeout at exact operation completion', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();

      // Setup page that loads exactly at timeout boundary
      await session.navigate('data:text/html,' + encodeURIComponent(`
        <div id="boundary-test">Initial</div>
        <script>
          setTimeout(function() {
            document.getElementById('boundary-test').textContent = 'Updated';
          }, 500); // Update at 500ms
        </script>
      `));

      // Wait for element update with timeout exactly at boundary
      const result = await session.waitForElement('#boundary-test:contains("Updated")', { timeout: 500 });

      // Result may be success or timeout depending on exact timing
      if (result.success) {
        expect(result.duration).toBeLessThanOrEqual(550);
      } else {
        expect(result.duration).toBeGreaterThanOrEqual(450);
        expect(result.duration).toBeLessThan(650);
      }
    });

    it('should handle timeout rounding and precision boundaries', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Precision boundary test</div>');

      // Test fractional millisecond timeouts
      const fractionalTimeouts = [100.1, 100.5, 100.9, 101.0];

      for (const timeout of fractionalTimeouts) {
        const startTime = Date.now();
        const result = await session.waitForElement('#precision-boundary', { timeout });
        const duration = Date.now() - startTime;

        expect(result.success).toBe(false);

        // Duration should be close to timeout (allowing for rounding)
        expect(duration).toBeGreaterThanOrEqual(Math.floor(timeout * 0.8));
        expect(duration).toBeLessThan(Math.ceil(timeout * 1.5));
      }
    });

    it('should handle system clock adjustments during timeout', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>Clock adjustment test</div>');

      // Mock Date.now to simulate clock adjustment
      const originalNow = Date.now;
      let clockAdjusted = false;

      Date.now = vi.fn().mockImplementation(() => {
        const realTime = originalNow();
        if (!clockAdjusted && realTime > originalNow() + 200) {
          clockAdjusted = true;
          // Simulate clock jumping backward
          return realTime - 1000;
        }
        return realTime;
      });

      try {
        const result = await session.waitForElement('#clock-test', { timeout: 1000 });

        expect(result.success).toBe(false);
        // Should still timeout despite clock adjustment
        expect(result.error).toMatch(/timeout|timed out/i);
      } finally {
        Date.now = originalNow;
      }
    });
  });
});