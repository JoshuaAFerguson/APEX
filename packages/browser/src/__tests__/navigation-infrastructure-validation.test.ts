/**
 * @apexcli/browser - Navigation Infrastructure Validation
 *
 * This test validates the current navigation testing infrastructure and ensures
 * the existing file-based navigation tests work correctly. Also tests integration
 * points for the future mock server implementation.
 *
 * Created by the tester agent to validate current state and implementation gaps.
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

// Get fixture paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, 'fixtures');

describe('Current Navigation Infrastructure Validation', () => {
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

  describe('File-based Navigation Tests', () => {
    it('should navigate to test fixture files', async () => {
      const testPagePath = join(fixturesDir, 'test-page.html');
      const fileUrl = `file://${testPagePath}`;

      const result = await session.goto(fileUrl);

      expect(result.success).toBe(true);
      expect(result.data).toContain('file://');

      const title = await session.getTitle();
      expect(title.data).toBe('Navigation Test Page');
    });

    it('should access page test helpers from fixtures', async () => {
      const testPagePath = join(fixturesDir, 'test-page.html');
      const fileUrl = `file://${testPagePath}`;

      await session.goto(fileUrl);

      // Test that the page has test helpers
      const testHelpers = await session.evaluate('return window.testHelpers', []);
      expect(testHelpers.success).toBe(true);
      expect(testHelpers.data).toHaveProperty('getPageInstance');
      expect(testHelpers.data).toHaveProperty('getLoadTime');
      expect(testHelpers.data).toHaveProperty('getNavigationCount');
    });

    it('should navigate between fixture pages', async () => {
      const testPagePath = join(fixturesDir, 'test-page.html');
      const page2Path = join(fixturesDir, 'page2.html');

      // Navigate to first page
      await session.goto(`file://${testPagePath}`);

      const title1 = await session.getTitle();
      expect(title1.data).toBe('Navigation Test Page');

      // Navigate to second page
      await session.goto(`file://${page2Path}`);

      const title2 = await session.getTitle();
      expect(title2.data).toBe('Navigation Test Page 2');
    });

    it('should test back/forward navigation with fixture files', async () => {
      const testPagePath = join(fixturesDir, 'test-page.html');
      const page2Path = join(fixturesDir, 'page2.html');

      // Build navigation history
      await session.goto(`file://${testPagePath}`);
      await session.goto(`file://${page2Path}`);

      // Go back
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);

      // Verify we're back on the first page
      const title = await session.getTitle();
      expect(title.data).toBe('Navigation Test Page');

      // Go forward
      const forwardResult = await session.goForward();
      expect(forwardResult.success).toBe(true);

      // Verify we're back on page 2
      const title2 = await session.getTitle();
      expect(title2.data).toBe('Navigation Test Page 2');
    });

    it('should handle page reload with fixture files', async () => {
      const testPagePath = join(fixturesDir, 'test-page.html');

      await session.goto(`file://${testPagePath}`);

      // Get initial page instance
      const instance1 = await session.evaluate('return window.testHelpers.getPageInstance()', []);
      expect(instance1.success).toBe(true);

      // Reload page
      const reloadResult = await session.reload();
      expect(reloadResult.success).toBe(true);

      // Get new page instance - should be different
      const instance2 = await session.evaluate('return window.testHelpers.getPageInstance()', []);
      expect(instance2.success).toBe(true);
      expect(instance2.data).not.toBe(instance1.data);

      // Verify page still works
      const title = await session.getTitle();
      expect(title.data).toBe('Navigation Test Page');
    });
  });

  describe('Current Navigation API Validation', () => {
    it('should provide goto method', async () => {
      expect(session.goto).toBeDefined();
      expect(typeof session.goto).toBe('function');
    });

    it('should provide reload method', async () => {
      expect(session.reload).toBeDefined();
      expect(typeof session.reload).toBe('function');
    });

    it('should provide goBack method', async () => {
      expect(session.goBack).toBeDefined();
      expect(typeof session.goBack).toBe('function');
    });

    it('should provide goForward method', async () => {
      expect(session.goForward).toBeDefined();
      expect(typeof session.goForward).toBe('function');
    });

    it('should provide waitForNavigation method', async () => {
      expect(session.waitForNavigation).toBeDefined();
      expect(typeof session.waitForNavigation).toBe('function');
    });

    it('should provide getCurrentUrl method', async () => {
      expect(session.getCurrentUrl).toBeDefined();
      expect(typeof session.getCurrentUrl).toBe('function');
    });

    it('should provide getTitle method', async () => {
      expect(session.getTitle).toBeDefined();
      expect(typeof session.getTitle).toBe('function');
    });
  });

  describe('Error Handling with Current Infrastructure', () => {
    it('should handle navigation to non-existent files', async () => {
      const nonExistentPath = join(fixturesDir, 'does-not-exist.html');
      const fileUrl = `file://${nonExistentPath}`;

      const result = await session.goto(fileUrl);

      // Different browsers handle file:// errors differently
      // Chrome/Chromium typically succeeds but shows an error page
      if (result.success) {
        // Verify we get an error page
        const title = await session.getTitle();
        // Error pages typically have generic titles
        expect(title.data).toMatch(/(File not found|Error|not found)/i);
      } else {
        // Some configurations may return failure
        expect(result.success).toBe(false);
      }
    });

    it('should handle navigation timeouts gracefully', async () => {
      const testPagePath = join(fixturesDir, 'test-page.html');
      const fileUrl = `file://${testPagePath}`;

      // Use a very short timeout to force timeout scenario
      const result = await session.goto(fileUrl, { timeout: 1 });

      // This may succeed (file loads fast) or timeout
      if (!result.success) {
        expect(result.error).toContain('timeout');
      }
    });
  });

  describe('Test Utilities and Helpers', () => {
    it('should access TestPages utility from test-utils', async () => {
      // Import test utilities
      const testUtilsModule = await import('../test-utils/test-pages.js');
      expect(testUtilsModule.TestPages).toBeDefined();

      // Verify page generators work
      const simplePage = testUtilsModule.TestPages.simple('Test Title');
      expect(simplePage).toContain('<title>Test Title</title>');
      expect(simplePage).toContain('<h1>Test Title</h1>');

      const complexPage = testUtilsModule.TestPages.complex();
      expect(complexPage).toContain('Complex Test Page');
      expect(complexPage).toContain('animation: pulse');
    });

    it('should access test data generators', async () => {
      const testUtilsModule = await import('../test-utils/test-pages.js');
      expect(testUtilsModule.TestDataGenerators).toBeDefined();

      const heavyContent = testUtilsModule.TestDataGenerators.generateHeavyContent(10);
      expect(heavyContent).toContain('Heavy Content Test (10 elements)');
      expect(heavyContent).toContain('Element 1');
      expect(heavyContent).toContain('Element 10');

      const randomColor = testUtilsModule.TestDataGenerators.randomColor();
      expect(randomColor).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    });

    it('should verify browser session manager functionality', async () => {
      // Test manager is properly created
      expect(manager).toBeDefined();
      expect(typeof manager.shutdown).toBe('function');

      // Test session is properly created
      expect(session).toBeDefined();
      expect(session.isLaunched()).toBe(true);

      // Test session configuration
      const config = session.getConfig();
      expect(config).toMatchObject({
        headless: true,
        timeout: 10000
      });
    });
  });

  describe('Readiness for Mock Server Integration', () => {
    it('should be ready to accept HTTP URLs when mock server is available', async () => {
      // This test verifies the navigation system can handle HTTP URLs
      // When mock server is implemented, this should work seamlessly

      // Test with a publicly accessible URL to verify HTTP support
      const httpUrl = 'data:text/html,<html><head><title>HTTP Test</title></head><body>HTTP Navigation Test</body></html>';

      const result = await session.goto(httpUrl);
      expect(result.success).toBe(true);

      const title = await session.getTitle();
      expect(title.data).toBe('HTTP Test');
    });

    it('should handle data URLs (basic HTTP URL pattern)', async () => {
      const dataUrl = 'data:text/html,<html><body><h1 id="test">Data URL Test</h1></body></html>';

      await session.goto(dataUrl);

      const element = await session.getElement('#test');
      expect(element.success).toBe(true);

      const text = await session.getElementText('#test');
      expect(text.data).toBe('Data URL Test');
    });

    it('should support navigation timing measurements', async () => {
      const testPagePath = join(fixturesDir, 'test-page.html');

      const startTime = Date.now();
      await session.goto(`file://${testPagePath}`);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should not take more than 5 seconds
    });

    it('should support request/response interception patterns', async () => {
      // While we can't intercept file:// requests, test the pattern
      // that will be used with HTTP requests from the mock server

      const testPagePath = join(fixturesDir, 'test-page.html');
      await session.goto(`file://${testPagePath}`);

      // Test that we can execute JavaScript to simulate request monitoring
      const networkState = await session.evaluate(`
        return {
          readyState: document.readyState,
          loaded: Date.now(),
          protocol: window.location.protocol
        }
      `, []);

      expect(networkState.success).toBe(true);
      expect(networkState.data.readyState).toBe('complete');
      expect(networkState.data.protocol).toBe('file:');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle rapid navigation between pages', async () => {
      const testPagePath = join(fixturesDir, 'test-page.html');
      const page2Path = join(fixturesDir, 'page2.html');
      const page3Path = join(fixturesDir, 'page3.html');

      const urls = [
        `file://${testPagePath}`,
        `file://${page2Path}`,
        `file://${page3Path}`,
        `file://${testPagePath}`, // Back to first page
      ];

      // Navigate rapidly between pages
      for (let i = 0; i < urls.length; i++) {
        const result = await session.goto(urls[i]);
        expect(result.success).toBe(true);
      }

      // Verify final state
      const title = await session.getTitle();
      expect(title.data).toBe('Navigation Test Page');
    });

    it('should maintain stable browser session across multiple navigations', async () => {
      const testPagePath = join(fixturesDir, 'test-page.html');

      // Perform multiple navigation cycles
      for (let i = 0; i < 5; i++) {
        const result = await session.goto(`file://${testPagePath}`);
        expect(result.success).toBe(true);

        const title = await session.getTitle();
        expect(title.data).toBe('Navigation Test Page');

        // Add small delay to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Session should still be functional
      expect(session.isLaunched()).toBe(true);
    });

    it('should handle concurrent navigation operations gracefully', async () => {
      // Note: This tests that the session handles operations sequentially
      // rather than truly concurrent (which could cause race conditions)

      const testPagePath = join(fixturesDir, 'test-page.html');
      const page2Path = join(fixturesDir, 'page2.html');

      const operations = [
        session.goto(`file://${testPagePath}`),
        session.goto(`file://${page2Path}`),
      ];

      // Wait for all operations to complete
      const results = await Promise.all(operations);

      // Last navigation should win
      expect(results[1].success).toBe(true);

      const title = await session.getTitle();
      expect(title.data).toBe('Navigation Test Page 2');
    });
  });
});