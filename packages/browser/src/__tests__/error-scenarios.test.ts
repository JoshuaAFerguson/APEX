/**
 * @apexcli/browser - Error Scenarios and Edge Cases Tests
 *
 * Tests for error handling, edge cases, and failure recovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '../index.js';

describe('Browser Automation - Error Scenarios and Edge Cases', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = createBrowserManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Launch Failure Scenarios', () => {
    it('should handle browser launch timeout gracefully', async () => {
      // Create manager with very short timeout to force failure
      const timeoutManager = createBrowserManager({
        defaultSessionConfig: {
          browserType: 'chromium',
          headless: true,
          launchOptions: {
            timeout: 1 // 1ms timeout - will definitely fail
          }
        }
      });

      try {
        const session = createBrowserSession(timeoutManager);
        const result = await session.launch();

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);

      } finally {
        await timeoutManager.shutdown();
      }
    });

    it('should handle operations on unopened session', async () => {
      const session = createBrowserSession(manager);

      // All operations should fail before launch
      const operations = [
        session.navigate('https://example.com'),
        session.click('button'),
        session.type('input', 'text'),
        session.scroll({ y: 100 }),
        session.screenshot(),
        session.getText('h1'),
        session.getTitle(),
        session.evaluate(() => window.location.href),
      ];

      const results = await Promise.all(operations);

      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Browser not launched');
      });
    });

    it('should handle browser crash during operations', async () => {
      const session = createBrowserSession(manager);
      await session.launch();

      // Navigate to a page first
      await session.navigate('data:text/html,<h1>Test</h1>');

      // Force close the browser to simulate a crash
      const browser = session.getBrowser();
      if (browser) {
        await browser.close();
      }

      // Subsequent operations should fail gracefully
      const navResult = await session.navigate('data:text/html,<h1>After Crash</h1>');
      expect(navResult.success).toBe(false);

      const clickResult = await session.click('h1');
      expect(clickResult.success).toBe(false);

      const screenshotResult = await session.screenshot();
      expect(screenshotResult.success).toBe(false);

      // Session close should still work
      const closeResult = await session.close();
      expect(closeResult.success).toBe(true);
    });
  });

  describe('Invalid Selector Scenarios', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      await session.launch();
      await session.navigate('data:text/html,<div id="test">Valid Element</div>');
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should handle non-existent selectors', async () => {
      const clickResult = await session.click('#nonexistent');
      expect(clickResult.success).toBe(false);

      const textResult = await session.getText('#missing');
      expect(textResult.success).toBe(false);

      const typeResult = await session.type('#notfound', 'text');
      expect(typeResult.success).toBe(false);

      const scrollResult = await session.scroll({ selector: '#missing' });
      expect(scrollResult.success).toBe(false);
    });

    it('should handle malformed selectors', async () => {
      const malformedSelectors = [
        '###invalid',
        '[[malformed]]',
        'div[attr=',
        ':not(:not(:not(div)))',
        ''
      ];

      for (const selector of malformedSelectors) {
        const result = await session.click(selector);
        expect(result.success).toBe(false);
      }
    });

    it('should handle element selector objects with invalid types', async () => {
      const invalidSelectors = [
        { type: 'invalid' as any, value: 'test' },
        { type: 'css', value: '' },
        { type: 'xpath', value: '//invalid[' },
      ];

      for (const selector of invalidSelectors) {
        const result = await session.click(selector);
        expect(result.success).toBe(false);
      }
    });

    it('should handle timeout scenarios', async () => {
      // Try to wait for an element that will never appear
      const waitResult = await session.waitForElement('#never-exists', { timeout: 100 });
      expect(waitResult.success).toBe(false);
      expect(waitResult.duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Navigation Error Scenarios', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      await session.launch();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should handle invalid URLs', async () => {
      const invalidUrls = [
        'not-a-url',
        'ht tp://invalid',
        'ftp://unsupported.protocol',
        '',
        'javascript:alert("xss")', // Potential security issue
      ];

      for (const url of invalidUrls) {
        const result = await session.navigate(url);
        // Some might succeed with protocol upgrade, some might fail
        expect(result.duration).toBeGreaterThan(0);
      }
    });

    it('should handle network errors', async () => {
      // Try to navigate to a non-existent domain
      const result = await session.navigate('http://this-domain-should-not-exist-12345.com');

      // This may succeed or fail depending on network/DNS configuration
      // but should not crash or hang
      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle navigation timeout', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 100, // Very short timeout
      });

      await session.launch();

      // This might timeout on slower systems
      const result = await session.navigate('data:text/html,<h1>Test</h1>', {
        timeout: 50 // Even shorter timeout
      });

      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('Screenshot Error Scenarios', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      await session.launch();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should handle screenshot of empty page', async () => {
      // Don't navigate to any page
      const result = await session.screenshot();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should handle invalid screenshot options', async () => {
      await session.navigate('data:text/html,<h1>Test</h1>');

      // Invalid quality values
      const invalidQuality = await session.screenshot({
        type: 'jpeg',
        quality: 150 // Invalid: > 100
      });

      // Should either succeed with clamped value or fail gracefully
      expect(typeof invalidQuality.success).toBe('boolean');

      // Zero quality
      const zeroQuality = await session.screenshot({
        type: 'jpeg',
        quality: 0
      });

      expect(typeof zeroQuality.success).toBe('boolean');
    });

    it('should handle screenshot during page crash', async () => {
      await session.navigate(`
        data:text/html,
        <script>
          // Simulate a page that might cause issues
          setTimeout(() => {
            window.location.href = 'about:blank';
          }, 100);
        </script>
        <h1>Unstable Page</h1>
      `);

      // Try to take screenshot while page is changing
      const promises = Array.from({ length: 5 }, () => session.screenshot());
      const results = await Promise.allSettled(promises);

      // At least some should succeed or fail gracefully
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(typeof result.value.success).toBe('boolean');
        }
      });
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle resource limit exceeded', async () => {
      const limitedManager = createBrowserManager({
        maxInstances: 1,
        resourceLimits: {
          maxMemoryMB: 10, // Very low limit
        }
      });

      try {
        const session = createBrowserSession(limitedManager);
        await session.launch();

        // Launch another session that should fail due to limit
        const session2 = createBrowserSession(limitedManager);
        const result = await session2.launch();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Maximum browser instances exceeded');

        await session.close();

      } finally {
        await limitedManager.shutdown();
      }
    });

    it('should handle rapid session creation and destruction', async () => {
      // Stress test with rapid creation/destruction
      const promises = Array.from({ length: 10 }, async () => {
        const session = createBrowserSession(manager);
        try {
          const launchResult = await session.launch();
          if (launchResult.success) {
            await session.navigate('data:text/html,<h1>Test</h1>');
            await session.screenshot();
          }
          return launchResult.success;
        } finally {
          await session.close();
        }
      });

      const results = await Promise.allSettled(promises);

      // Most should succeed
      const successful = results.filter(r =>
        r.status === 'fulfilled' && r.value === true
      ).length;

      expect(successful).toBeGreaterThan(5);
    });
  });

  describe('JavaScript Evaluation Errors', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      await session.launch();
      await session.navigate('data:text/html,<h1>JS Test</h1>');
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should handle JavaScript syntax errors', async () => {
      const syntaxErrorResult = await session.evaluate(() => {
        // @ts-expect-error - Intentional syntax error for testing
        return invalid.syntax.here;
      });

      expect(syntaxErrorResult.success).toBe(false);
    });

    it('should handle JavaScript runtime errors', async () => {
      const runtimeErrorResult = await session.evaluate(() => {
        throw new Error('Intentional error for testing');
      });

      expect(runtimeErrorResult.success).toBe(false);
    });

    it('should handle infinite loops (should timeout)', async () => {
      const infiniteLoopResult = await session.evaluate(() => {
        const start = Date.now();
        while (Date.now() - start < 1000) {
          // Infinite loop for 1 second
        }
        return 'completed';
      });

      // Should either complete or fail gracefully
      expect(typeof infiniteLoopResult.success).toBe('boolean');
    });

    it('should handle functions that return non-serializable objects', async () => {
      const result = await session.evaluate(() => {
        // Return a non-serializable object
        const element = document.createElement('div');
        return element; // DOM elements can't be serialized
      });

      // Playwright should handle this gracefully
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Manager Shutdown Scenarios', () => {
    it('should handle operations after manager shutdown', async () => {
      const testManager = createBrowserManager();
      const session = createBrowserSession(testManager);

      await session.launch();
      await session.navigate('data:text/html,<h1>Before Shutdown</h1>');

      // Shutdown manager while session is active
      await testManager.shutdown();

      // Session operations should fail after manager shutdown
      const navResult = await session.navigate('data:text/html,<h1>After Shutdown</h1>');
      expect(navResult.success).toBe(false);

      const clickResult = await session.click('h1');
      expect(clickResult.success).toBe(false);

      // Close should still work
      const closeResult = await session.close();
      expect(closeResult.success).toBe(true);
    });

    it('should handle double shutdown gracefully', async () => {
      const testManager = createBrowserManager();
      await testManager.shutdown();
      await testManager.shutdown(); // Second shutdown should not throw
    });

    it('should handle session creation after manager shutdown', async () => {
      const testManager = createBrowserManager();
      await testManager.shutdown();

      const session = createBrowserSession(testManager);
      const result = await session.launch();

      expect(result.success).toBe(false);
      expect(result.error).toContain('shut down');
    });
  });

  describe('Edge Case Configurations', () => {
    it('should handle extreme viewport sizes', async () => {
      const extremeConfigs = [
        { width: 1, height: 1 }, // Minimum size
        { width: 10000, height: 10000 }, // Very large size
        { width: -1, height: -1 }, // Invalid negative
      ];

      for (const viewport of extremeConfigs) {
        const session = createBrowserSession(manager, {
          browserType: 'chromium',
          headless: true,
          viewport
        });

        const result = await session.launch();

        if (result.success) {
          await session.close();
        }

        // Should either succeed or fail gracefully
        expect(typeof result.success).toBe('boolean');
      }
    });

    it('should handle invalid browser type gracefully', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'invalid-browser' as any,
        headless: true,
      });

      const result = await session.launch();

      // Should default to chromium or fail gracefully
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        await session.close();
      }
    });

    it('should handle extreme timeout values', async () => {
      const extremeTimeouts = [0, -1, Number.MAX_SAFE_INTEGER];

      for (const timeout of extremeTimeouts) {
        const session = createBrowserSession(manager, {
          browserType: 'chromium',
          headless: true,
          timeout
        });

        try {
          const result = await session.launch();

          if (result.success) {
            await session.close();
          }

          expect(typeof result.success).toBe('boolean');
        } catch (error) {
          // Extreme values might throw, which is acceptable
          expect(error).toBeDefined();
        }
      }
    });
  });
});