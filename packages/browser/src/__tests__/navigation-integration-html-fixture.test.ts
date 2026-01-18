/**
 * @apexcli/browser - Navigation Integration Tests with HTML Fixture
 *
 * Integration tests for navigation actions using local HTML fixture files.
 * Tests verify: navigating to URLs, page load waiting, URL verification after navigation,
 * and navigation error handling. Uses local test HTML fixtures and validates all functionality.
 *
 * Created by the developer agent to fulfill implementation stage requirements.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '../index.js';

// Get the current file's directory and construct fixture paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, 'fixtures');

describe('Navigation Integration Tests with HTML Fixture', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  // Fixture file paths
  const testPagePath = join(fixturesDir, 'test-page.html');
  const page2Path = join(fixturesDir, 'page2.html');
  const page3Path = join(fixturesDir, 'page3.html');
  const invalidPagePath = join(fixturesDir, 'nonexistent-page.html');

  // Convert paths to file:// URLs
  const testPageUrl = `file://${testPagePath}`;
  const page2Url = `file://${page2Path}`;
  const page3Url = `file://${page3Path}`;
  const invalidPageUrl = `file://${invalidPagePath}`;

  beforeEach(async () => {
    manager = createBrowserManager();
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 15000,
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

  describe('Navigation to URLs', () => {
    it('should navigate to HTML fixture file successfully', async () => {
      const result = await session.goto(testPageUrl);

      expect(result.success).toBe(true);
      expect(result.data).toContain('file://');
      expect(result.duration).toBeGreaterThan(0);
      expect(session.getCurrentUrl()).toContain('test-page.html');

      // Verify page content loaded correctly
      const title = await session.getTitle();
      expect(title.success).toBe(true);
      expect(title.data).toBe('Navigation Test Page');

      // Verify page elements are present
      const heading = await session.getText('#page-title');
      expect(heading.success).toBe(true);
      expect(heading.data).toBe('Navigation Test Page');
    });

    it('should navigate to multiple fixture pages in sequence', async () => {
      // Navigate to first page
      const result1 = await session.goto(testPageUrl);
      expect(result1.success).toBe(true);

      let title = await session.getTitle();
      expect(title.data).toBe('Navigation Test Page');

      // Navigate to second page
      const result2 = await session.goto(page2Url);
      expect(result2.success).toBe(true);

      title = await session.getTitle();
      expect(title.data).toBe('Navigation Test Page 2');

      // Navigate to third page
      const result3 = await session.goto(page3Url);
      expect(result3.success).toBe(true);

      title = await session.getTitle();
      expect(title.data).toBe('Navigation Test Page 3');

      // Verify URL changes correctly
      expect(session.getCurrentUrl()).toContain('page3.html');
    });

    it('should preserve navigation state between pages', async () => {
      await session.goto(testPageUrl);

      // Get page instance ID from first page
      const instance1 = await session.evaluate(() => (window as any).testHelpers.getPageInstance());
      expect(instance1.success).toBe(true);
      expect(typeof instance1.data).toBe('string');

      await session.goto(page2Url);

      // Get page instance ID from second page - should be different
      const instance2 = await session.evaluate(() => (window as any).testHelpers.getPageInstance());
      expect(instance2.success).toBe(true);
      expect(instance2.data).not.toBe(instance1.data);

      // Verify we can still access page-specific functions
      const pageNumber = await session.evaluate(() => (window as any).testHelpers.getPageNumber());
      expect(pageNumber.success).toBe(true);
      expect(pageNumber.data).toBe(2);
    });
  });

  describe('Page Load Waiting', () => {
    it('should wait for page load to complete', async () => {
      const startTime = Date.now();
      const result = await session.goto(testPageUrl, {
        waitUntil: 'load',
        timeout: 10000
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);

      // Verify page is fully loaded by checking for dynamic content
      const loadTime = await session.evaluate(() =>
        document.getElementById('load-time')?.textContent
      );
      expect(loadTime.success).toBe(true);
      expect(loadTime.data).toBeTruthy();

      // Verify timestamp is reasonable (loaded after test started)
      const loadTimestamp = new Date(loadTime.data as string);
      expect(loadTimestamp.getTime()).toBeGreaterThan(startTime - 1000); // Allow for clock skew
    });

    it('should wait for DOM content loaded', async () => {
      const result = await session.goto(testPageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      expect(result.success).toBe(true);

      // Verify DOM elements are available
      const statusElement = await session.getText('#load-status');
      expect(statusElement.success).toBe(true);
      expect(statusElement.data).toBe('Loaded');
    });

    it('should handle different waitUntil options correctly', async () => {
      const waitUntilOptions = ['load', 'domcontentloaded', 'networkidle'] as const;

      for (const waitUntil of waitUntilOptions) {
        const result = await session.goto(testPageUrl, {
          waitUntil,
          timeout: 10000
        });

        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThan(0);
        expect(session.getCurrentUrl()).toContain('test-page.html');
      }
    });

    it('should wait for navigation to complete using waitForNavigation', async () => {
      await session.goto(testPageUrl);

      // Start programmatic navigation
      const navigationPromise = session.evaluate(() => {
        setTimeout(() => {
          window.location.href = 'page2.html';
        }, 200);
      });

      // Wait for navigation to complete
      const waitResult = await session.waitForNavigation({
        timeout: 10000,
        waitUntil: 'load'
      });

      await navigationPromise;

      expect(waitResult.success).toBe(true);
      expect(waitResult.duration).toBeGreaterThan(0);

      // Verify we're on the new page
      const title = await session.getTitle();
      expect(title.data).toBe('Navigation Test Page 2');
    });
  });

  describe('URL Verification after Navigation', () => {
    it('should correctly update current URL after navigation', async () => {
      // Start with no page loaded
      expect(session.getCurrentUrl()).toBe('about:blank');

      // Navigate to test page
      await session.goto(testPageUrl);
      expect(session.getCurrentUrl()).toContain('test-page.html');

      // Navigate to page 2
      await session.goto(page2Url);
      expect(session.getCurrentUrl()).toContain('page2.html');

      // Navigate to page 3
      await session.goto(page3Url);
      expect(session.getCurrentUrl()).toContain('page3.html');
    });

    it('should maintain URL consistency across operations', async () => {
      await session.goto(testPageUrl);
      const initialUrl = session.getCurrentUrl();

      // Take a screenshot - should not change URL
      await session.screenshot();
      expect(session.getCurrentUrl()).toBe(initialUrl);

      // Get page title - should not change URL
      await session.getTitle();
      expect(session.getCurrentUrl()).toBe(initialUrl);

      // Interact with elements - should not change URL
      const heading = await session.getText('#page-title');
      expect(heading.success).toBe(true);
      expect(session.getCurrentUrl()).toBe(initialUrl);
    });

    it('should update URL correctly during reload', async () => {
      await session.goto(testPageUrl);
      const originalUrl = session.getCurrentUrl();

      const reloadResult = await session.reload();
      expect(reloadResult.success).toBe(true);

      // URL should remain the same after reload
      expect(session.getCurrentUrl()).toBe(originalUrl);
      expect(session.getCurrentUrl()).toContain('test-page.html');
    });

    it('should track URL changes during back/forward navigation', async () => {
      // Create navigation history
      await session.goto(testPageUrl);
      const url1 = session.getCurrentUrl();

      await session.goto(page2Url);
      const url2 = session.getCurrentUrl();

      await session.goto(page3Url);
      const url3 = session.getCurrentUrl();

      // Go back
      await session.goBack();
      expect(session.getCurrentUrl()).toBe(url2);
      expect(session.getCurrentUrl()).toContain('page2.html');

      // Go back again
      await session.goBack();
      expect(session.getCurrentUrl()).toBe(url1);
      expect(session.getCurrentUrl()).toContain('test-page.html');

      // Go forward
      await session.goForward();
      expect(session.getCurrentUrl()).toBe(url2);
      expect(session.getCurrentUrl()).toContain('page2.html');
    });
  });

  describe('Navigation Error Handling', () => {
    it('should handle non-existent file URLs gracefully', async () => {
      const result = await session.goto(invalidPageUrl);

      // Should handle the error without crashing
      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        // Common error patterns for file not found
        expect(result.error).toMatch(/(404|not found|No such file|ERR_FILE_NOT_FOUND)/i);
      }
    });

    it('should handle invalid file:// URLs', async () => {
      const invalidUrls = [
        'file:///invalid/path/to/nowhere.html',
        'file:///etc/passwd', // Attempt to access system file
        'file://malformed-url-structure',
      ];

      for (const url of invalidUrls) {
        const result = await session.goto(url);

        // Should not crash, should handle gracefully
        expect(typeof result.success).toBe('boolean');
        expect(result.duration).toBeGreaterThan(0);

        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
        }
      }
    });

    it('should handle timeout errors gracefully', async () => {
      const result = await session.goto(testPageUrl, {
        timeout: 1 // Very short timeout to force failure
      });

      // Should handle timeout without crashing
      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error).toMatch(/(timeout|timed out)/i);
      }
    });

    it('should maintain session stability after navigation errors', async () => {
      // Navigate to valid page first
      await session.goto(testPageUrl);
      const validTitle = await session.getTitle();
      expect(validTitle.success).toBe(true);

      // Attempt navigation to invalid URL
      await session.goto(invalidPageUrl);

      // Session should still be functional - navigate to another valid page
      const recoveryResult = await session.goto(page2Url);
      expect(recoveryResult.success).toBe(true);

      // Verify we can still interact with the page
      const newTitle = await session.getTitle();
      expect(newTitle.success).toBe(true);
      expect(newTitle.data).toBe('Navigation Test Page 2');
    });

    it('should handle rapid navigation requests without corruption', async () => {
      const urls = [testPageUrl, page2Url, page3Url, testPageUrl, page2Url];

      // Fire rapid navigation requests
      const promises = urls.map(url => session.goto(url));
      const results = await Promise.allSettled(promises);

      // At least some should succeed, none should crash the session
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && r.value.success
      ).length;

      expect(successCount).toBeGreaterThan(0);

      // Session should still be functional
      const finalResult = await session.goto(testPageUrl);
      expect(finalResult.success).toBe(true);

      const finalTitle = await session.getTitle();
      expect(finalTitle.success).toBe(true);
    });
  });

  describe('Navigation Performance and Reliability', () => {
    it('should complete navigation within reasonable time limits', async () => {
      const maxReasonableTime = 10000; // 10 seconds for file:// URLs

      const operations = [
        () => session.goto(testPageUrl),
        () => session.goto(page2Url),
        () => session.reload(),
        () => session.goBack(),
        () => session.goForward(),
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

    it('should handle navigation with complex page content', async () => {
      await session.goto(testPageUrl);

      // Verify all page elements loaded correctly
      const elements = [
        { selector: '#page-title', expected: 'Navigation Test Page' },
        { selector: '#load-status', expected: 'Loaded' },
        { selector: '#load-time', expected: (text: string) => text.length > 0 }
      ];

      for (const { selector, expected } of elements) {
        const element = await session.getText(selector);
        expect(element.success).toBe(true);

        if (typeof expected === 'string') {
          expect(element.data).toBe(expected);
        } else {
          expect(expected(element.data as string)).toBe(true);
        }
      }

      // Verify JavaScript executed correctly
      const pageInstance = await session.evaluate(() => (window as any).testHelpers?.getPageInstance());
      expect(pageInstance.success).toBe(true);
      expect(typeof pageInstance.data).toBe('string');
      expect((pageInstance.data as string).length).toBe(9); // Random string length
    });

    it('should maintain consistent navigation behavior across page reloads', async () => {
      await session.goto(testPageUrl);

      // Get initial page state
      const initialTitle = await session.getTitle();
      const initialInstance = await session.evaluate(() => (window as any).testHelpers.getPageInstance());

      // Reload page
      await session.reload();

      // Verify title remains the same
      const reloadedTitle = await session.getTitle();
      expect(reloadedTitle.data).toBe(initialTitle.data);

      // Verify new page instance (page was actually reloaded)
      const reloadedInstance = await session.evaluate(() => (window as any).testHelpers.getPageInstance());
      expect(reloadedInstance.success).toBe(true);
      expect(reloadedInstance.data).not.toBe(initialInstance.data);

      // Verify all functionality still works
      const loadTime = await session.evaluate(() => (window as any).testHelpers.getLoadTime());
      expect(loadTime.success).toBe(true);
      expect(typeof loadTime.data).toBe('string');
    });
  });

  describe('Integration with Browser Session Methods', () => {
    it('should work correctly with DOM interaction methods', async () => {
      await session.goto(testPageUrl);

      // Test clicking buttons
      const reloadButton = await session.getText('button');
      expect(reloadButton.success).toBe(true);

      // Test element visibility and interaction
      const buttons = await session.evaluate(() =>
        Array.from(document.querySelectorAll('button')).length
      );
      expect(buttons.success).toBe(true);
      expect(buttons.data).toBeGreaterThan(0);
    });

    it('should preserve context across navigation and screenshots', async () => {
      await session.goto(testPageUrl);

      // Take screenshot
      const screenshot1 = await session.screenshot();
      expect(screenshot1.success).toBe(true);

      // Navigate to another page
      await session.goto(page2Url);

      // Take another screenshot
      const screenshot2 = await session.screenshot();
      expect(screenshot2.success).toBe(true);

      // Screenshots should be different (different pages)
      expect(screenshot1.data).not.toBe(screenshot2.data);

      // Verify we're on the correct page
      const title = await session.getTitle();
      expect(title.data).toBe('Navigation Test Page 2');
    });

    it('should handle JavaScript evaluation across navigation', async () => {
      await session.goto(testPageUrl);

      // Execute JavaScript on first page
      const result1 = await session.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        pageNumber: (window as any).testHelpers.getPageNumber?.() || 1
      }));

      expect(result1.success).toBe(true);
      expect((result1.data as any).title).toBe('Navigation Test Page');

      // Navigate to second page
      await session.goto(page2Url);

      // Execute JavaScript on second page
      const result2 = await session.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        pageNumber: (window as any).testHelpers.getPageNumber?.() || 0
      }));

      expect(result2.success).toBe(true);
      expect((result2.data as any).title).toBe('Navigation Test Page 2');
      expect((result2.data as any).pageNumber).toBe(2);
    });
  });
});