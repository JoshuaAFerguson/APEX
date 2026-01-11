/**
 * @apexcli/browser - Navigation Acceptance Criteria Test
 *
 * This test specifically validates the browser navigation acceptance criteria:
 * "Navigation API with goto(url), reload(), goBack(), goForward(), waitForNavigation() methods.
 * Handles timeouts and navigation errors gracefully."
 *
 * Created by the tester agent to ensure complete validation of the specific requirements.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '../index.js';

describe('Browser Navigation Acceptance Criteria Validation', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = createBrowserManager();
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 10000,
    });
    await session.launch();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('AC: Navigation API Methods', () => {
    it('should provide goto(url) method that navigates successfully', async () => {
      const testUrl = 'data:text/html,<h1>Test Navigation</h1><title>Navigation Test</title>';

      // Test goto method exists and works
      const result = await session.goto(testUrl);

      expect(result.success).toBe(true);
      expect(result.data).toContain('data:text/html');
      expect(result.duration).toBeGreaterThan(0);
      expect(session.getCurrentUrl()).toContain('data:text/html');

      // Verify page content was loaded
      const title = await session.getTitle();
      expect(title.data).toBe('Navigation Test');
    });

    it('should provide reload() method that reloads current page', async () => {
      // Navigate to a page first
      await session.goto('data:text/html,<h1>Reload Test</h1><span id="time"></span><script>document.getElementById("time").textContent = Date.now();</script>');

      const initialUrl = session.getCurrentUrl();
      const initialTime = await session.getText('#time');

      // Wait a moment to ensure timestamp will be different
      await new Promise(resolve => setTimeout(resolve, 10));

      // Test reload method
      const result = await session.reload();

      expect(result.success).toBe(true);
      expect(result.data).toBe(initialUrl);
      expect(result.duration).toBeGreaterThan(0);
      expect(session.getCurrentUrl()).toBe(initialUrl);

      // Verify page was actually reloaded (timestamp should be different)
      const newTime = await session.getText('#time');
      expect(newTime.data).not.toBe(initialTime.data);
    });

    it('should provide goBack() method that navigates backward in history', async () => {
      // Create navigation history
      await session.goto('data:text/html,<h1>Page 1</h1><title>Page 1</title>');
      const page1Url = session.getCurrentUrl();

      await session.goto('data:text/html,<h1>Page 2</h1><title>Page 2</title>');
      const page2Url = session.getCurrentUrl();

      // Verify we're on page 2
      const title2 = await session.getTitle();
      expect(title2.data).toBe('Page 2');

      // Test goBack method
      const result = await session.goBack();

      expect(result.success).toBe(true);
      expect(result.data).toBe(page1Url);
      expect(result.duration).toBeGreaterThan(0);

      // Verify we're back on page 1
      const title1 = await session.getTitle();
      expect(title1.data).toBe('Page 1');
      expect(session.getCurrentUrl()).toBe(page1Url);
    });

    it('should provide goForward() method that navigates forward in history', async () => {
      // Create navigation history
      await session.goto('data:text/html,<h1>Page A</h1><title>Page A</title>');
      await session.goto('data:text/html,<h1>Page B</h1><title>Page B</title>');
      const pageBUrl = session.getCurrentUrl();

      // Go back
      await session.goBack();

      // Verify we're on page A
      const titleA = await session.getTitle();
      expect(titleA.data).toBe('Page A');

      // Test goForward method
      const result = await session.goForward();

      expect(result.success).toBe(true);
      expect(result.data).toBe(pageBUrl);
      expect(result.duration).toBeGreaterThan(0);

      // Verify we're back on page B
      const titleB = await session.getTitle();
      expect(titleB.data).toBe('Page B');
      expect(session.getCurrentUrl()).toBe(pageBUrl);
    });

    it('should provide waitForNavigation() method that waits for navigation to complete', async () => {
      await session.goto('data:text/html,<h1>Initial Page</h1>');

      // Start programmatic navigation after a delay
      const navigationPromise = session.evaluate(() => {
        setTimeout(() => {
          window.location.href = 'data:text/html,<h1>Target Page</h1><title>Target</title>';
        }, 100);
      });

      // Test waitForNavigation method
      const waitPromise = session.waitForNavigation({
        timeout: 5000,
        waitUntil: 'load'
      });

      await navigationPromise;
      const result = await waitPromise;

      expect(result.success).toBe(true);
      expect(result.data).toContain('data:text/html');
      expect(result.duration).toBeGreaterThan(0);

      // Verify navigation completed
      const title = await session.getTitle();
      expect(title.data).toBe('Target');
    });

    it('should handle goBack() when no previous page exists', async () => {
      // Start with a fresh session, navigate to one page
      await session.goto('data:text/html,<h1>Only Page</h1>');

      // Try to go back when there's no history
      const result = await session.goBack();

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle goForward() when no forward page exists', async () => {
      await session.goto('data:text/html,<h1>Current Page</h1>');

      // Try to go forward when there's no forward history
      const result = await session.goForward();

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('AC: Graceful Timeout and Error Handling', () => {
    it('should handle goto() timeouts gracefully', async () => {
      // Test with very short timeout to trigger timeout
      const result = await session.goto('data:text/html,<h1>Timeout Test</h1>', {
        timeout: 1 // 1ms timeout should timeout immediately
      });

      // Should handle timeout gracefully without crashing
      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    it('should handle reload() timeouts gracefully', async () => {
      await session.goto('data:text/html,<h1>Reload Timeout Test</h1>');

      const result = await session.reload({
        timeout: 1 // 1ms timeout
      });

      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);

      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle goBack() timeouts gracefully', async () => {
      await session.goto('data:text/html,<h1>Page 1</h1>');
      await session.goto('data:text/html,<h1>Page 2</h1>');

      const result = await session.goBack({
        timeout: 1 // 1ms timeout
      });

      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle goForward() timeouts gracefully', async () => {
      await session.goto('data:text/html,<h1>Page 1</h1>');
      await session.goto('data:text/html,<h1>Page 2</h1>');
      await session.goBack();

      const result = await session.goForward({
        timeout: 1 // 1ms timeout
      });

      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle waitForNavigation() timeouts gracefully', async () => {
      await session.goto('data:text/html,<h1>No Navigation</h1>');

      // Wait for navigation that won't happen
      const result = await session.waitForNavigation({
        timeout: 100 // Short timeout
      });

      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(50);

      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle invalid URLs gracefully in goto()', async () => {
      const invalidUrls = [
        '', // Empty URL
        'invalid-protocol://test',
        'file:///nonexistent-file.html',
      ];

      for (const url of invalidUrls) {
        const result = await session.goto(url);

        // Should not crash, handle gracefully
        expect(typeof result.success).toBe('boolean');
        expect(result.duration).toBeGreaterThan(0);

        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
        }
      }
    });

    it('should maintain session state after navigation errors', async () => {
      // Navigate to a valid page first
      await session.goto('data:text/html,<h1>Valid Page</h1>');
      const validUrl = session.getCurrentUrl();

      // Try to navigate to invalid URL
      const invalidResult = await session.goto('invalid-url://test');

      // Session should still be functional
      const recoveryResult = await session.goto('data:text/html,<h1>Recovery Page</h1>');
      expect(recoveryResult.success).toBe(true);

      // Should be able to perform other actions
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
    });

    it('should provide meaningful error messages for navigation failures', async () => {
      // Test navigation without launching browser
      const freshSession = createBrowserSession(manager);

      const result = await freshSession.goto('data:text/html,<h1>Test</h1>');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Browser not launched');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle rapid navigation requests gracefully', async () => {
      const urls = [
        'data:text/html,<h1>Rapid 1</h1>',
        'data:text/html,<h1>Rapid 2</h1>',
        'data:text/html,<h1>Rapid 3</h1>',
        'data:text/html,<h1>Rapid 4</h1>',
        'data:text/html,<h1>Rapid 5</h1>',
      ];

      // Fire rapid navigation requests
      const promises = urls.map(url => session.goto(url));
      const results = await Promise.allSettled(promises);

      // At least one should succeed, none should crash
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && r.value.success
      ).length;

      expect(successCount).toBeGreaterThan(0);

      // Session should still be functional
      const finalResult = await session.goto('data:text/html,<h1>Final</h1>');
      expect(finalResult.success).toBe(true);
    });
  });

  describe('AC: Navigation Method Options and Configuration', () => {
    it('should support different waitUntil options for goto()', async () => {
      const url = 'data:text/html,<h1>WaitUntil Test</h1>';
      const waitUntilOptions = ['load', 'domcontentloaded', 'networkidle'] as const;

      for (const waitUntil of waitUntilOptions) {
        const result = await session.goto(url, {
          waitUntil,
          timeout: 5000
        });

        expect(result.success).toBe(true);
        expect(result.data).toContain('data:text/html');
      }
    });

    it('should support different waitUntil options for reload()', async () => {
      await session.goto('data:text/html,<h1>Reload Options Test</h1>');

      const waitUntilOptions = ['load', 'domcontentloaded'] as const;

      for (const waitUntil of waitUntilOptions) {
        const result = await session.reload({
          waitUntil,
          timeout: 5000
        });

        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThan(0);
      }
    });

    it('should support navigation options for goBack()', async () => {
      await session.goto('data:text/html,<h1>Page 1</h1>');
      await session.goto('data:text/html,<h1>Page 2</h1>');

      const result = await session.goBack({
        waitUntil: 'domcontentloaded',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should support navigation options for goForward()', async () => {
      await session.goto('data:text/html,<h1>Page 1</h1>');
      await session.goto('data:text/html,<h1>Page 2</h1>');
      await session.goBack();

      const result = await session.goForward({
        waitUntil: 'load',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should support URL pattern matching in waitForNavigation()', async () => {
      await session.goto('data:text/html,<h1>Start</h1>');

      // Wait for specific URL pattern
      const waitResult = await session.waitForNavigation({
        url: 'data:*',
        timeout: 2000,
        waitUntil: 'domcontentloaded',
      });

      expect(waitResult.success).toBe(true);
      expect(waitResult.data).toContain('data:text/html');
    });
  });

  describe('AC: Performance and Reliability', () => {
    it('should complete navigation operations within reasonable time limits', async () => {
      const maxReasonableTime = 5000; // 5 seconds

      const operations = [
        () => session.goto('data:text/html,<h1>Performance Test 1</h1>'),
        () => session.reload(),
        () => session.goto('data:text/html,<h1>Performance Test 2</h1>'),
        () => session.goBack(),
        () => session.goForward(),
        () => session.waitForNavigation({ timeout: 1000 }),
      ];

      for (const operation of operations) {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(maxReasonableTime);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.duration).toBeLessThanOrEqual(duration);
      }
    });

    it('should maintain consistent response format across all navigation methods', async () => {
      await session.goto('data:text/html,<h1>Page 1</h1>');
      await session.goto('data:text/html,<h1>Page 2</h1>');

      const methods = [
        () => session.goto('data:text/html,<h1>Goto Test</h1>'),
        () => session.reload(),
        () => session.goBack(),
        () => session.goForward(),
        () => session.waitForNavigation({ timeout: 1000 }),
      ];

      for (const method of methods) {
        const result = await method();

        // All methods should return consistent response format
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThan(0);

        if (!result.success) {
          expect(result).toHaveProperty('error');
          expect(typeof result.error).toBe('string');
        }
      }
    });

    it('should handle concurrent navigation operations without interference', async () => {
      await session.goto('data:text/html,<h1>Base Page</h1>');

      const operation1 = session.goto('data:text/html,<h1>Page A</h1>');
      const operation2 = session.reload();

      const [result1, result2] = await Promise.allSettled([operation1, operation2]);

      // At least one should complete successfully
      const hasSuccess = [result1, result2].some(r =>
        r.status === 'fulfilled' && r.value.success
      );

      expect(hasSuccess).toBe(true);
    });
  });
});