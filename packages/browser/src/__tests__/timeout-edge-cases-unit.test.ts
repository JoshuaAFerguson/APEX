/**
 * @file packages/browser/src/__tests__/timeout-edge-cases-unit.test.ts
 *
 * Unit tests for timeout edge cases and boundary conditions
 *
 * Tests specific edge cases not covered in integration tests:
 * - Invalid timeout values (NaN, Infinity, undefined)
 * - Timeout inheritance between methods
 * - Timeout configuration validation
 * - Performance characteristics of timeout handling
 * - Memory leaks with timeout cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowserManager, createBrowserSession } from '../index.js';
import type {
  BrowserManager,
  BrowserSession,
  BrowserSessionConfig
} from '../types.js';

describe('Timeout Edge Cases Unit Tests', () => {
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

  describe('Invalid Timeout Values', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Test</div>');
    });

    it('should handle NaN timeout gracefully', async () => {
      const result = await session.click('#nonexistent', { timeout: NaN });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(10000); // Should fallback to session timeout
    });

    it('should handle Infinity timeout gracefully', async () => {
      // For Infinity, we should test this with an element that exists to avoid infinite wait
      await session.navigate('data:text/html,<button id="test-btn">Click me</button>');

      const result = await session.click('#test-btn', { timeout: Infinity });

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(2000); // Should complete quickly
    });

    it('should handle negative Infinity timeout gracefully', async () => {
      const result = await session.click('#nonexistent', { timeout: -Infinity });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.duration).toBeLessThan(1000); // Should fail quickly
    });

    it('should handle undefined timeout by using session default', async () => {
      const startTime = Date.now();
      const result = await session.click('#nonexistent', { timeout: undefined });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(duration).toBeGreaterThanOrEqual(4000); // Close to session timeout (5000)
      expect(duration).toBeLessThan(7000);
    });

    it('should handle null timeout by using session default', async () => {
      const startTime = Date.now();
      const result = await session.click('#nonexistent', { timeout: null as any });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(duration).toBeGreaterThanOrEqual(4000); // Close to session timeout
      expect(duration).toBeLessThan(7000);
    });
  });

  describe('Timeout Configuration Validation', () => {
    it('should handle session config with invalid timeout values', async () => {
      const configs = [
        { timeout: NaN },
        { timeout: -1 },
        { timeout: null as any },
        { timeout: undefined },
        { timeout: 'invalid' as any },
      ];

      for (const config of configs) {
        const invalidSession = createBrowserSession(manager, {
          browserType: 'chromium',
          headless: true,
          ...config,
        });

        // Session should still be created but use fallback timeout
        expect(invalidSession).toBeDefined();

        await invalidSession.close();
      }
    });

    it('should validate very small positive timeouts', async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 1, // Very small timeout
      });

      await session.launch();
      await session.navigate('data:text/html,<div>Test</div>');

      const result = await session.click('#nonexistent');

      expect(result.success).toBe(false);
      expect(result.duration).toBeLessThan(500); // Should fail very quickly
    });

    it('should validate extremely large timeouts', async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: Number.MAX_SAFE_INTEGER,
      });

      await session.launch();
      await session.navigate('data:text/html,<button id="instant">Click</button>');

      // Test with existing element - should succeed quickly despite large timeout
      const result = await session.click('#instant');

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(2000);
    });
  });

  describe('Timeout Inheritance and Precedence', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 3000, // Session timeout
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Inheritance test</div>');
    });

    it('should correctly apply method timeout over session timeout', async () => {
      const methodTimeout = 800;

      const startTime = Date.now();
      const result = await session.waitForElement('#nonexistent', { timeout: methodTimeout });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(duration).toBeGreaterThanOrEqual(600);
      expect(duration).toBeLessThan(1500); // Much less than session timeout
    });

    it('should use session timeout when method timeout is 0', async () => {
      const startTime = Date.now();
      const result = await session.waitForElement('#nonexistent', { timeout: 0 });
      const duration = Date.now() - startTime;

      // With timeout 0, should either fail immediately or use minimal timeout
      expect(result.success).toBe(false);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle nested timeout operations correctly', async () => {
      // Create a page that loads slowly
      await session.navigate('data:text/html,' + encodeURIComponent(`
        <script>
          setTimeout(() => {
            const btn = document.createElement('button');
            btn.id = 'delayed-button';
            btn.textContent = 'Delayed Button';
            document.body.appendChild(btn);
          }, 1000);
        </script>
        <div>Page loading...</div>
      `));

      // First wait for the element with a timeout that should succeed
      const waitResult = await session.waitForElement('#delayed-button', { timeout: 2000 });
      expect(waitResult.success).toBe(true);

      // Then click it with a different timeout
      const clickResult = await session.click('#delayed-button', { timeout: 500 });
      expect(clickResult.success).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 1000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Performance test</div>');
    });

    it('should not leak memory with many timeout operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Run many operations that will timeout
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          session.waitForElement(`#nonexistent-${i}`, { timeout: 100 })
        );
      }

      await Promise.all(promises);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDiff = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryDiff).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle rapid successive timeout operations efficiently', async () => {
      const operations = [];
      const startTime = Date.now();

      // Start multiple operations in rapid succession
      for (let i = 0; i < 10; i++) {
        operations.push(
          session.click(`#rapid-${i}`, { timeout: 200 })
        );
      }

      const results = await Promise.all(operations);
      const totalDuration = Date.now() - startTime;

      // All should fail
      results.forEach(result => {
        expect(result.success).toBe(false);
      });

      // Total time should be close to individual timeout, not sum of all
      expect(totalDuration).toBeLessThan(1000); // Much less than 10 * 200ms
    });

    it('should maintain accuracy across different timeout values', async () => {
      const timeouts = [100, 250, 500, 750, 1000];
      const tolerance = 0.4; // 40% tolerance for timing variance

      for (const timeout of timeouts) {
        const measurements = [];

        // Take multiple measurements for each timeout
        for (let i = 0; i < 3; i++) {
          const startTime = Date.now();
          await session.click(`#nonexistent-${timeout}-${i}`, { timeout });
          const duration = Date.now() - startTime;
          measurements.push(duration);
        }

        // Calculate average duration
        const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;

        // Check if average is within tolerance
        const expectedMin = timeout * (1 - tolerance);
        const expectedMax = timeout * (1 + tolerance);

        expect(avgDuration).toBeGreaterThanOrEqual(expectedMin);
        expect(avgDuration).toBeLessThan(expectedMax);
      }
    });
  });

  describe('Timeout Error Consistency', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 1000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Error test</div>');
    });

    it('should provide consistent error messages across different methods', async () => {
      const operations = [
        { name: 'click', op: () => session.click('#nonexistent', { timeout: 300 }) },
        { name: 'type', op: () => session.type('#nonexistent', 'text', { timeout: 300 }) },
        { name: 'hover', op: () => session.hover('#nonexistent', { timeout: 300 }) },
        { name: 'focus', op: () => session.focus('#nonexistent', { timeout: 300 }) },
        { name: 'waitForElement', op: () => session.waitForElement('#nonexistent', { timeout: 300 }) },
        { name: 'waitForSelector', op: () => session.waitForSelector('#nonexistent', { timeout: 300 }) },
        { name: 'captureElement', op: () => session.captureElement('#nonexistent', { timeout: 300 }) },
      ];

      for (const { name, op } of operations) {
        const result = await op();

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);

        // Error should mention timeout
        const errorLower = result.error!.toLowerCase();
        expect(
          errorLower.includes('timeout') ||
          errorLower.includes('timed out') ||
          errorLower.includes('timedout')
        ).toBe(true);
      }
    });

    it('should include duration information in timeout results', async () => {
      const result = await session.click('#nonexistent', { timeout: 500 });

      expect(result.success).toBe(false);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(300); // Close to timeout
      expect(result.duration).toBeLessThan(1000);
    });
  });

  describe('Browser State After Timeouts', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 2000,
      });
      await session.launch();
    });

    it('should maintain browser functionality after timeout errors', async () => {
      await session.navigate('data:text/html,<h1 id="title">Test Page</h1><button id="btn">Click</button>');

      // Cause several timeout errors
      await session.click('#nonexistent1', { timeout: 200 });
      await session.waitForElement('#nonexistent2', { timeout: 200 });
      await session.type('#nonexistent3', 'text', { timeout: 200 });

      // Browser should still be functional
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);

      const clickResult = await session.click('#btn');
      expect(clickResult.success).toBe(true);

      const textResult = await session.getText('#title');
      expect(textResult.success).toBe(true);
      expect(textResult.data).toBe('Test Page');
    });

    it('should handle timeout during navigation properly', async () => {
      // Try to navigate with very short timeout
      const navResult = await session.navigate('data:text/html,<script>while(true){}</script>', {
        timeout: 100
      });

      // Navigation might timeout
      if (!navResult.success) {
        expect(navResult.error).toMatch(/timeout|timed out/i);
      }

      // Session should still be recoverable
      const recoveryResult = await session.navigate('data:text/html,<div>Recovery page</div>');
      expect(recoveryResult.success).toBe(true);
    });
  });

  describe('Complex Timeout Scenarios', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 3000,
      });
      await session.launch();
    });

    it('should handle timeout during element state changes', async () => {
      await session.navigate('data:text/html,' + encodeURIComponent(`
        <button id="changing-btn" style="display: none;">Hidden Button</button>
        <script>
          // Show button after 2 seconds
          setTimeout(() => {
            document.getElementById('changing-btn').style.display = 'block';
          }, 2000);

          // Hide it again after 4 seconds
          setTimeout(() => {
            document.getElementById('changing-btn').style.display = 'none';
          }, 4000);
        </script>
      `));

      // Wait for element with timeout shorter than show delay
      const result1 = await session.waitForElement('#changing-btn', {
        timeout: 1000,
        state: 'visible'
      });
      expect(result1.success).toBe(false);

      // Wait for element with timeout longer than show delay
      const result2 = await session.waitForElement('#changing-btn', {
        timeout: 3000,
        state: 'visible'
      });
      expect(result2.success).toBe(true);
    });

    it('should handle mixed successful and timeout operations', async () => {
      await session.navigate('data:text/html,' + encodeURIComponent(`
        <div>
          <button id="immediate">Immediate</button>
          <div id="delayed" style="display: none;">Delayed</div>
          <script>
            setTimeout(() => {
              document.getElementById('delayed').style.display = 'block';
            }, 1000);
          </script>
        </div>
      `));

      const operations = [
        { name: 'immediate click', op: session.click('#immediate') }, // Should succeed
        { name: 'delayed wait short', op: session.waitForElement('#delayed', { timeout: 500 }) }, // Should timeout
        { name: 'delayed wait long', op: session.waitForElement('#delayed', { timeout: 1500 }) }, // Should succeed
        { name: 'nonexistent', op: session.click('#nonexistent', { timeout: 300 }) }, // Should timeout
      ];

      const results = await Promise.all(operations.map(op => op.op));

      expect(results[0].success).toBe(true); // immediate click
      expect(results[1].success).toBe(false); // delayed wait short
      expect(results[2].success).toBe(true); // delayed wait long
      expect(results[3].success).toBe(false); // nonexistent
    });
  });
});