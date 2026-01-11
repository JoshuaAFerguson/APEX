/**
 * @apexcli/browser - Comprehensive Navigation API Tests
 *
 * Tests specifically focused on the browser navigation actions acceptance criteria:
 * - Navigation API with goto(url), reload(), goBack(), goForward(), waitForNavigation() methods
 * - Handles timeouts and navigation errors gracefully
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '../index.js';

describe('Navigation API - Comprehensive Testing', () => {
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

  describe('goto(url) method - AC Requirement', () => {
    it('should navigate to valid URLs successfully', async () => {
      const testUrls = [
        'data:text/html,<h1>Test Page 1</h1>',
        'data:text/html,<h1>Test Page 2</h1><title>Page 2</title>',
        'data:text/html,<!DOCTYPE html><html><body><p>Valid HTML</p></body></html>',
      ];

      for (const url of testUrls) {
        const result = await session.goto(url);

        expect(result.success).toBe(true);
        expect(result.data).toContain('data:text/html');
        expect(result.duration).toBeGreaterThan(0);
        expect(session.getCurrentUrl()).toContain('data:text/html');
      }
    });

    it('should handle navigation with different options', async () => {
      const url = 'data:text/html,<h1>Navigation Options Test</h1>';

      // Test with different waitUntil options
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

    it('should handle navigation timeout gracefully', async () => {
      // Use a very short timeout to force a timeout scenario
      const result = await session.goto('data:text/html,<h1>Timeout Test</h1>', {
        timeout: 1, // 1ms timeout - should timeout immediately
      });

      // This may succeed or fail depending on timing, but should not crash
      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    it('should preserve navigation state correctly', async () => {
      await session.goto('data:text/html,<h1>First Page</h1>');
      const firstUrl = session.getCurrentUrl();

      await session.goto('data:text/html,<h1>Second Page</h1>');
      const secondUrl = session.getCurrentUrl();

      expect(firstUrl).not.toBe(secondUrl);
      expect(secondUrl).toContain('data:text/html');
    });
  });

  describe('reload() method - AC Requirement', () => {
    it('should reload page successfully', async () => {
      const url = 'data:text/html,<h1>Reload Test</h1><script>window.reloadCount = (window.reloadCount || 0) + 1;</script>';

      await session.goto(url);
      const initialUrl = session.getCurrentUrl();

      const reloadResult = await session.reload();

      expect(reloadResult.success).toBe(true);
      expect(reloadResult.data).toBe(initialUrl);
      expect(reloadResult.duration).toBeGreaterThan(0);
      expect(session.getCurrentUrl()).toBe(initialUrl);
    });

    it('should reload with different wait options', async () => {
      const url = 'data:text/html,<h1>Reload Options Test</h1>';
      await session.goto(url);

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

    it('should handle reload timeout gracefully', async () => {
      await session.goto('data:text/html,<h1>Reload Timeout Test</h1>');

      const result = await session.reload({
        timeout: 1, // 1ms timeout
      });

      // Should handle timeout gracefully
      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should maintain session state after reload', async () => {
      await session.goto('data:text/html,<h1>State Test</h1>');
      const originalUrl = session.getCurrentUrl();

      await session.reload();

      expect(session.getCurrentUrl()).toBe(originalUrl);

      // Verify page is still accessible
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
    });
  });

  describe('goBack() method - AC Requirement', () => {
    it('should navigate back through history successfully', async () => {
      // Create navigation history
      await session.goto('data:text/html,<h1>Page 1</h1><title>Page1</title>');
      await session.goto('data:text/html,<h1>Page 2</h1><title>Page2</title>');
      await session.goto('data:text/html,<h1>Page 3</h1><title>Page3</title>');

      // Go back one step
      const backResult1 = await session.goBack();
      expect(backResult1.success).toBe(true);
      expect(backResult1.data).toContain('data:text/html');

      const title1 = await session.getTitle();
      expect(title1.data).toBe('Page2');

      // Go back another step
      const backResult2 = await session.goBack();
      expect(backResult2.success).toBe(true);

      const title2 = await session.getTitle();
      expect(title2.data).toBe('Page1');
    });

    it('should return null when no previous page exists', async () => {
      await session.goto('data:text/html,<h1>Only Page</h1>');

      const result = await session.goBack();

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle goBack with different wait options', async () => {
      await session.goto('data:text/html,<h1>Page 1</h1>');
      await session.goto('data:text/html,<h1>Page 2</h1>');

      const result = await session.goBack({
        waitUntil: 'domcontentloaded',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle goBack timeout gracefully', async () => {
      await session.goto('data:text/html,<h1>Page 1</h1>');
      await session.goto('data:text/html,<h1>Page 2</h1>');

      const result = await session.goBack({
        timeout: 1, // 1ms timeout
      });

      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('goForward() method - AC Requirement', () => {
    it('should navigate forward through history successfully', async () => {
      // Create history and go back
      await session.goto('data:text/html,<h1>Page 1</h1><title>Page1</title>');
      await session.goto('data:text/html,<h1>Page 2</h1><title>Page2</title>');
      await session.goto('data:text/html,<h1>Page 3</h1><title>Page3</title>');

      // Go back twice
      await session.goBack();
      await session.goBack();

      // Now go forward
      const forwardResult1 = await session.goForward();
      expect(forwardResult1.success).toBe(true);
      expect(forwardResult1.data).toContain('data:text/html');

      const title1 = await session.getTitle();
      expect(title1.data).toBe('Page2');

      // Go forward again
      const forwardResult2 = await session.goForward();
      expect(forwardResult2.success).toBe(true);

      const title2 = await session.getTitle();
      expect(title2.data).toBe('Page3');
    });

    it('should return null when no forward page exists', async () => {
      await session.goto('data:text/html,<h1>Current Page</h1>');

      const result = await session.goForward();

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle goForward with different wait options', async () => {
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

    it('should handle goForward timeout gracefully', async () => {
      await session.goto('data:text/html,<h1>Page 1</h1>');
      await session.goto('data:text/html,<h1>Page 2</h1>');
      await session.goBack();

      const result = await session.goForward({
        timeout: 1, // 1ms timeout
      });

      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('waitForNavigation() method - AC Requirement', () => {
    it('should wait for programmatic navigation', async () => {
      await session.goto('data:text/html,<h1>Initial Page</h1>');

      // Start programmatic navigation
      const navigationPromise = session.evaluate(() => {
        setTimeout(() => {
          window.location.href = 'data:text/html,<h1>Target Page</h1><title>TargetPage</title>';
        }, 100);
      });

      // Wait for navigation
      const waitPromise = session.waitForNavigation({
        timeout: 5000,
        waitUntil: 'load',
      });

      await navigationPromise;
      const result = await waitPromise;

      expect(result.success).toBe(true);
      expect(result.data).toContain('data:text/html');
      expect(result.duration).toBeGreaterThan(0);

      const title = await session.getTitle();
      expect(title.data).toBe('TargetPage');
    });

    it('should wait for navigation with URL pattern matching', async () => {
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

    it('should handle waitForNavigation timeout gracefully', async () => {
      await session.goto('data:text/html,<h1>No Navigation</h1>');

      // Wait for navigation that won't happen
      const result = await session.waitForNavigation({
        timeout: 100, // Short timeout
      });

      // Should timeout gracefully
      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(50); // At least some time passed
    });

    it('should work with different waitUntil options', async () => {
      const waitUntilOptions = ['load', 'domcontentloaded'] as const;

      for (const waitUntil of waitUntilOptions) {
        await session.goto('data:text/html,<h1>Test</h1>');

        const result = await session.waitForNavigation({
          waitUntil,
          timeout: 2000,
        });

        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThan(0);
      }
    });
  });

  describe('Navigation Error Handling - AC Requirement', () => {
    it('should handle invalid URLs gracefully', async () => {
      const invalidUrls = [
        '', // Empty URL
        'invalid-protocol://test',
        'javascript:alert("xss")', // Potentially dangerous URL
        'file:///nonexistent-file.html',
      ];

      for (const url of invalidUrls) {
        const result = await session.goto(url);

        // Should not crash, either succeed or fail gracefully
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
      await session.goto('invalid-url://test');

      // Session should still be functional
      const result = await session.goto('data:text/html,<h1>Recovery Page</h1>');
      expect(result.success).toBe(true);

      // Should be able to perform other actions
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
    });

    it('should handle rapid navigation requests', async () => {
      const urls = [
        'data:text/html,<h1>Page 1</h1>',
        'data:text/html,<h1>Page 2</h1>',
        'data:text/html,<h1>Page 3</h1>',
        'data:text/html,<h1>Page 4</h1>',
        'data:text/html,<h1>Page 5</h1>',
      ];

      // Fire rapid navigation requests
      const promises = urls.map(url => session.goto(url));
      const results = await Promise.allSettled(promises);

      // At least one should succeed, none should crash
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && r.value.success
      ).length;

      expect(successCount).toBeGreaterThan(0);

      // Session should still be functional after rapid requests
      const finalResult = await session.goto('data:text/html,<h1>Final</h1>');
      expect(finalResult.success).toBe(true);
    });

    it('should provide meaningful error messages', async () => {
      // Test navigation without launching browser
      const newSession = createBrowserSession(manager);

      const result = await newSession.goto('data:text/html,<h1>Test</h1>');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser not launched');
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('Navigation Performance - AC Requirement', () => {
    it('should complete navigation actions within reasonable time', async () => {
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

    it('should handle concurrent navigation operations', async () => {
      // Test that multiple navigation operations don't interfere
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

  describe('Integration with Browser Session - AC Requirement', () => {
    it('should work correctly with other session methods', async () => {
      // Test integration with other browser session features
      await session.goto('data:text/html,<input id="test" value="initial" /><button onclick="document.getElementById(\'test\').value=\'clicked\'">Click</button>');

      // Test navigation + DOM interaction
      const inputValue1 = await session.getText('#test');
      expect(inputValue1.data).toBe('initial');

      await session.click('button');

      // Reload and verify state reset
      await session.reload();
      const inputValue2 = await session.evaluate(() =>
        (document.getElementById('test') as HTMLInputElement).value
      );
      expect(inputValue2.data).toBe('initial');

      // Navigate to new page
      await session.goto('data:text/html,<h1>New Page</h1><title>NewTitle</title>');

      const title = await session.getTitle();
      expect(title.data).toBe('NewTitle');

      // Go back
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);

      // Verify we can still interact with elements
      const stillWorks = await session.getText('#test');
      expect(stillWorks.success).toBe(true);
    });

    it('should preserve navigation context across session methods', async () => {
      await session.goto('data:text/html,<h1>Context Test</h1>');
      const url1 = session.getCurrentUrl();

      // Take screenshot
      const screenshot = await session.screenshot();
      expect(screenshot.success).toBe(true);

      // URL should remain the same
      const url2 = session.getCurrentUrl();
      expect(url2).toBe(url1);

      // Navigate and verify context change
      await session.goto('data:text/html,<h1>New Context</h1>');
      const url3 = session.getCurrentUrl();
      expect(url3).not.toBe(url1);
    });
  });
});