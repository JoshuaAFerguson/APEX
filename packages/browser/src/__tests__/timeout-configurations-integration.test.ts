/**
 * @file packages/browser/src/__tests__/timeout-configurations-integration.test.ts
 *
 * Integration tests for timeout configurations across all wait strategies
 *
 * Tests timeout behavior, error handling, and custom timeout values for:
 * - Navigation operations (navigate, reload, goBack, goForward, waitForNavigation)
 * - Element interaction operations (click, type, hover, focus)
 * - Element waiting operations (waitForElement, waitForSelector)
 * - Screenshot operations (captureElement)
 * - Default timeout fallbacks and custom timeouts
 * - Zero/negative timeout edge cases
 * - Timeout error message clarity
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowserManager, createBrowserSession } from '../index.js';
import type {
  BrowserManager,
  BrowserSession,
  BrowserSessionConfig,
  BrowserActionResult
} from '../types.js';

describe('Timeout Configurations Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = createBrowserManager();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    await manager.shutdown();
  });

  describe('Default Timeout Behavior', () => {
    it('should use default timeout when none specified', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 5000, // 5 second default
      };

      session = createBrowserSession(manager, config);
      await session.launch();

      // Test default timeout on a non-existent element (should fail after 5 seconds)
      const startTime = Date.now();
      const result = await session.waitForElement('#nonexistent-element');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/timeout|timed out/i);
      expect(duration).toBeGreaterThanOrEqual(4800); // Allow some timing variance
      expect(duration).toBeLessThan(7000); // Should not exceed timeout significantly
    });

    it('should apply session timeout to navigation operations', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 2000, // 2 second timeout
      };

      session = createBrowserSession(manager, config);
      await session.launch();

      // Try to navigate to a slow-loading page without explicit timeout
      const startTime = Date.now();
      const result = await session.navigate('data:text/html,<script>setTimeout(function(){document.title="Loaded";}, 10000)</script><h1>Loading...</h1>');
      const duration = Date.now() - startTime;

      // Should either succeed quickly or timeout after session timeout
      if (!result.success) {
        expect(result.error).toMatch(/timeout|timed out/i);
        expect(duration).toBeGreaterThanOrEqual(1800);
        expect(duration).toBeLessThan(4000);
      }
    });

    it('should apply session timeout to element interactions', async () => {
      const config: BrowserSessionConfig = {
        browserType: 'chromium',
        headless: true,
        timeout: 1500, // 1.5 second timeout
      };

      session = createBrowserSession(manager, config);
      await session.launch();
      await session.navigate('data:text/html,<div>No interactive elements</div>');

      const operations = [
        () => session.click('#nonexistent'),
        () => session.type('#nonexistent', 'text'),
        () => session.hover('#nonexistent'),
        () => session.focus('#nonexistent'),
      ];

      for (const operation of operations) {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(duration).toBeGreaterThanOrEqual(1300); // Allow timing variance
        expect(duration).toBeLessThan(3000);
      }
    });
  });

  describe('Custom Timeout Overrides', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 10000, // Default 10 seconds
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Test page</div>');
    });

    it('should respect custom timeout in navigation operations', async () => {
      const customTimeout = 800; // Short custom timeout

      const navigationTests = [
        {
          name: 'navigate',
          operation: () => session.navigate('data:text/html,<script>while(true){}</script>', { timeout: customTimeout })
        },
        {
          name: 'reload',
          operation: () => session.reload({ timeout: customTimeout })
        },
        {
          name: 'waitForNavigation',
          operation: () => session.waitForNavigation({ timeout: customTimeout })
        }
      ];

      for (const test of navigationTests) {
        const startTime = Date.now();
        const result = await test.operation();
        const duration = Date.now() - startTime;

        if (!result.success) {
          expect(result.error).toMatch(/timeout|timed out/i);
          expect(duration).toBeGreaterThanOrEqual(600);
          expect(duration).toBeLessThan(2000);
        }
      }
    });

    it('should respect custom timeout in element interactions', async () => {
      const customTimeout = 600; // Very short custom timeout

      const elementTests = [
        {
          name: 'click',
          operation: () => session.click('#nonexistent', { timeout: customTimeout })
        },
        {
          name: 'type',
          operation: () => session.type('#nonexistent', 'text', { timeout: customTimeout })
        },
        {
          name: 'hover',
          operation: () => session.hover('#nonexistent', { timeout: customTimeout })
        },
        {
          name: 'focus',
          operation: () => session.focus('#nonexistent', { timeout: customTimeout })
        }
      ];

      for (const test of elementTests) {
        const startTime = Date.now();
        const result = await test.operation();
        const duration = Date.now() - startTime;

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/timeout|timed out/i);
        expect(duration).toBeGreaterThanOrEqual(400);
        expect(duration).toBeLessThan(1500);
      }
    });

    it('should respect custom timeout in wait operations', async () => {
      const customTimeout = 500;

      const waitTests = [
        {
          name: 'waitForElement',
          operation: () => session.waitForElement('#never-exists', { timeout: customTimeout })
        }
      ];

      for (const test of waitTests) {
        const startTime = Date.now();
        const result = await test.operation();
        const duration = Date.now() - startTime;

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/timeout|timed out/i);
        expect(duration).toBeGreaterThanOrEqual(300);
        expect(duration).toBeLessThan(1200);
      }
    });

    it('should respect custom timeout in screenshot operations', async () => {
      const customTimeout = 700;

      const startTime = Date.now();
      const result = await session.captureElement('#nonexistent', { timeout: customTimeout });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(duration).toBeGreaterThanOrEqual(500);
      expect(duration).toBeLessThan(1500);
    });
  });

  describe('Timeout Error Handling', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 1000, // 1 second timeout
      });
      await session.launch();
    });

    it('should provide descriptive timeout error messages', async () => {
      await session.navigate('data:text/html,<div>Test page with no target elements</div>');

      const operations = [
        {
          name: 'click timeout',
          operation: () => session.click('#missing-button', { timeout: 500 })
        },
        {
          name: 'waitForElement timeout',
          operation: () => session.waitForElement('#missing-element', { timeout: 500 })
        },
        {
          name: 'navigation timeout',
          operation: () => session.waitForNavigation({ timeout: 300 })
        }
      ];

      for (const { name, operation } of operations) {
        const result = await operation();

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);

        // Error message should be descriptive
        const errorLower = result.error!.toLowerCase();
        expect(
          errorLower.includes('timeout') ||
          errorLower.includes('timed out') ||
          errorLower.includes('timedout')
        ).toBe(true);
      }
    });

    it('should maintain session state after timeout errors', async () => {
      await session.navigate('data:text/html,<h1 id="title">Working Page</h1>');

      // Cause a timeout error
      const timeoutResult = await session.click('#nonexistent', { timeout: 300 });
      expect(timeoutResult.success).toBe(false);

      // Session should still be functional
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);

      const textResult = await session.getText('#title');
      expect(textResult.success).toBe(true);
      expect(textResult.data).toBe('Working Page');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      });
      await session.launch();
    });

    it('should handle zero timeout gracefully', async () => {
      await session.navigate('data:text/html,<div>Zero timeout test</div>');

      const result = await session.click('#nonexistent', { timeout: 0 });

      // Zero timeout should either fail immediately or use a minimal timeout
      expect(result.success).toBe(false);
      expect(result.duration).toBeLessThan(1000); // Should fail quickly
    });

    it('should handle negative timeout gracefully', async () => {
      await session.navigate('data:text/html,<div>Negative timeout test</div>');

      const result = await session.waitForElement('#nonexistent', { timeout: -100 });

      // Negative timeout should either fail immediately or be treated as zero/minimal
      expect(result.success).toBe(false);
      expect(result.duration).toBeLessThan(1000);
    });

    it('should handle very large timeout values', async () => {
      await session.navigate('data:text/html,<button id="immediate">Click me</button>');

      // Use extremely large timeout - should succeed immediately for existing elements
      const result = await session.click('#immediate', { timeout: Number.MAX_SAFE_INTEGER });

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(2000); // Should complete quickly despite large timeout
    });
  });

  describe('Timeout Behavior Across Wait Strategies', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 3000,
      });
      await session.launch();
    });

    it('should respect timeouts across different waitUntil strategies', async () => {
      const waitUntilOptions = ['load', 'domcontentloaded', 'networkidle'] as const;
      const shortTimeout = 800;

      for (const waitUntil of waitUntilOptions) {
        const startTime = Date.now();

        // Try to navigate to a page that loads slowly
        const result = await session.navigate(
          'data:text/html,<script>setTimeout(function(){document.title="Loaded after delay";}, 5000)</script><h1>Loading...</h1>',
          { timeout: shortTimeout, waitUntil }
        );

        const duration = Date.now() - startTime;

        // Either succeeds quickly or times out within expected range
        if (!result.success) {
          expect(result.error).toMatch(/timeout|timed out/i);
          expect(duration).toBeGreaterThanOrEqual(600);
          expect(duration).toBeLessThan(2000);
        } else {
          // If it succeeded, it should have been quick
          expect(duration).toBeLessThan(2000);
        }
      }
    });

    it('should handle timeouts consistently across element states', async () => {
      await session.navigate('data:text/html,' + encodeURIComponent(`
        <div id="hidden-element" style="display: none;">Hidden</div>
        <div id="visible-element">Visible</div>
        <script>
          setTimeout(function() {
            document.getElementById('hidden-element').style.display = 'block';
          }, 2000);
        </script>
      `));

      const states = ['visible', 'hidden', 'attached', 'detached'] as const;
      const customTimeout = 1000;

      for (const state of states) {
        const startTime = Date.now();
        const result = await session.waitForElement('#hidden-element', {
          timeout: customTimeout,
          state
        });
        const duration = Date.now() - startTime;

        // Test that timeout is respected regardless of element state
        if (!result.success) {
          expect(duration).toBeGreaterThanOrEqual(800);
          expect(duration).toBeLessThan(2000);
        }
      }
    });
  });

  describe('Timeout Configuration Inheritance', () => {
    it('should inherit timeout from session config when method timeout not specified', async () => {
      const sessionTimeout = 2000;
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: sessionTimeout,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Inheritance test</div>');

      // Method called without explicit timeout should use session timeout
      const startTime = Date.now();
      const result = await session.click('#nonexistent'); // No timeout specified
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(duration).toBeGreaterThanOrEqual(1700); // Close to session timeout
      expect(duration).toBeLessThan(3500);
    });

    it('should override session timeout when method timeout is specified', async () => {
      const sessionTimeout = 5000;
      const methodTimeout = 800;

      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: sessionTimeout,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Override test</div>');

      // Method timeout should override session timeout
      const startTime = Date.now();
      const result = await session.hover('#nonexistent', { timeout: methodTimeout });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(duration).toBeGreaterThanOrEqual(600); // Close to method timeout
      expect(duration).toBeLessThan(2000); // Much less than session timeout
    });
  });

  describe('Timeout Accuracy and Performance', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 10000,
      });
      await session.launch();
    });

    it('should timeout with reasonable accuracy', async () => {
      await session.navigate('data:text/html,<div>Accuracy test</div>');

      const timeouts = [500, 1000, 1500, 2000];
      const tolerance = 0.3; // 30% tolerance for timing variance

      for (const timeout of timeouts) {
        const startTime = Date.now();
        const result = await session.waitForElement('#nonexistent', { timeout });
        const duration = Date.now() - startTime;

        expect(result.success).toBe(false);

        // Check timeout accuracy within tolerance
        const expectedMin = timeout * (1 - tolerance);
        const expectedMax = timeout * (1 + tolerance);

        expect(duration).toBeGreaterThanOrEqual(expectedMin);
        expect(duration).toBeLessThan(expectedMax);
      }
    });

    it('should not significantly exceed timeout duration', async () => {
      await session.navigate('data:text/html,<div>Performance test</div>');

      const timeout = 1000;
      const maxOverrun = 500; // Maximum acceptable overrun

      const operations = [
        () => session.click('#nonexistent', { timeout }),
        () => session.type('#nonexistent', 'test', { timeout }),
        () => session.waitForElement('#nonexistent', { timeout }),
      ];

      for (const operation of operations) {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        expect(result.success).toBe(false);
        expect(duration).toBeLessThan(timeout + maxOverrun);
      }
    });
  });

  describe('Concurrent Operations with Different Timeouts', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Concurrent test</div>');
    });

    it('should handle concurrent operations with different timeouts correctly', async () => {
      const operations = [
        { name: 'fast', operation: session.click('#nonexistent1', { timeout: 500 }) },
        { name: 'medium', operation: session.click('#nonexistent2', { timeout: 1000 }) },
        { name: 'slow', operation: session.click('#nonexistent3', { timeout: 1500 }) }
      ];

      const startTime = Date.now();
      const results = await Promise.all(operations.map(op => op.operation));
      const endTime = Date.now();

      // All should fail due to nonexistent elements
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/timeout|timed out/i);
      });

      // Total time should be close to the longest timeout
      const totalDuration = endTime - startTime;
      expect(totalDuration).toBeGreaterThanOrEqual(1200); // Close to longest timeout
      expect(totalDuration).toBeLessThan(3000); // But not excessive
    });
  });
});