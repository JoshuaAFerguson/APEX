/**
 * @apexcli/browser - Tester Agent Validation
 *
 * This test file serves as the comprehensive validation created by the tester agent
 * to ensure all acceptance criteria are thoroughly tested and verified.
 */

import { describe, it, expect } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  BrowserManager,
  BrowserSession,
  chromium,
  firefox,
  webkit,
  defaultBrowserConfig,
  defaultManagerConfig,
  defaultCaptureConfig,
} from '../index.js';

describe('Tester Agent - Comprehensive Validation', () => {
  describe('Package Exports and API Surface', () => {
    it('should export all required classes and functions', () => {
      // Verify main classes are exported
      expect(BrowserManager).toBeDefined();
      expect(BrowserSession).toBeDefined();

      // Verify factory functions are exported
      expect(createBrowserManager).toBeInstanceOf(Function);
      expect(createBrowserSession).toBeInstanceOf(Function);
      expect(launchBrowser).toBeInstanceOf(Function);

      // Verify Playwright exports
      expect(chromium).toBeDefined();
      expect(firefox).toBeDefined();
      expect(webkit).toBeDefined();

      // Verify configuration defaults
      expect(defaultBrowserConfig).toBeDefined();
      expect(defaultManagerConfig).toBeDefined();
      expect(defaultCaptureConfig).toBeDefined();
    });

    it('should verify type safety and interface compliance', () => {
      // Test factory function types
      const manager = createBrowserManager();
      expect(manager).toBeInstanceOf(BrowserManager);

      const session = createBrowserSession(manager);
      expect(session).toBeInstanceOf(BrowserSession);
    });
  });

  describe('Acceptance Criteria Complete Validation', () => {
    it('should satisfy all documented acceptance criteria', async () => {
      // AC1: Headless browser launch (Playwright) ✓
      const manager = createBrowserManager();
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true
      });

      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);
      expect(launchResult.duration).toBeGreaterThan(0);

      // AC2: Browser actions API (click, type, scroll, navigate) ✓
      const testHtml = `
        <html>
          <body>
            <input id="test-input" type="text" />
            <button id="test-button" onclick="document.getElementById('output').textContent = document.getElementById('test-input').value">Click</button>
            <div id="output"></div>
            <div style="height: 1000px; background: red;"></div>
            <div id="scroll-target">Scroll Target</div>
          </body>
        </html>
      `;

      // Navigate
      const navResult = await session.navigate(`data:text/html,${encodeURIComponent(testHtml)}`);
      expect(navResult.success).toBe(true);

      // Type
      const typeResult = await session.type('#test-input', 'Test Data');
      expect(typeResult.success).toBe(true);

      // Click
      const clickResult = await session.click('#test-button');
      expect(clickResult.success).toBe(true);

      // Verify interaction worked
      const outputText = await session.getText('#output');
      expect(outputText.success).toBe(true);
      expect(outputText.data).toBe('Test Data');

      // Scroll
      const scrollResult = await session.scroll({ selector: '#scroll-target' });
      expect(scrollResult.success).toBe(true);

      // AC3: Screenshot capture capability ✓
      const screenshotResult = await session.screenshot();
      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.data).toBeInstanceOf(Buffer);
      expect(screenshotResult.data!.length).toBeGreaterThan(0);

      // Full page screenshot
      const fullPageResult = await session.screenshot({ fullPage: true });
      expect(fullPageResult.success).toBe(true);
      expect(fullPageResult.data!.length).toBeGreaterThan(screenshotResult.data!.length);

      // AC4: Tests verify browser launch and basic actions ✓
      // (This entire test suite serves as this verification)

      // Cleanup
      await session.close();
      await manager.shutdown();
    }, 15000);

    it('should verify multi-browser support works correctly', async () => {
      const browserTypes = ['chromium', 'firefox', 'webkit'] as const;
      const manager = createBrowserManager();
      const sessions: BrowserSession[] = [];

      try {
        // Test all browser types can launch
        for (const browserType of browserTypes) {
          const session = createBrowserSession(manager, {
            browserType,
            headless: true
          });

          const result = await session.launch();
          expect(result.success).toBe(true);
          sessions.push(session);

          // Verify each can perform basic operations
          await session.navigate('data:text/html,<h1>Test</h1>');
          const screenshot = await session.screenshot();
          expect(screenshot.success).toBe(true);
        }

        // Verify resource tracking works across browsers
        const usage = await manager.getResourceUsage();
        expect(usage.totalInstances).toBe(browserTypes.length);
        expect(usage.totalContexts).toBe(browserTypes.length);

      } finally {
        // Clean up all sessions
        await Promise.all(sessions.map(s => s.close()));
        await manager.shutdown();
      }
    }, 30000);

    it('should verify error handling and resilience', async () => {
      const manager = createBrowserManager();
      const session = createBrowserSession(manager);

      // Test operations before launch fail gracefully
      const prelaunchOps = await Promise.all([
        session.navigate('https://example.com'),
        session.click('button'),
        session.screenshot()
      ]);

      prelaunchOps.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      // Launch and test recovery
      await session.launch();
      await session.navigate('data:text/html,<h1>Test</h1>');

      // Test invalid operations fail gracefully
      const invalidOps = await Promise.all([
        session.click('#nonexistent'),
        session.getText('#missing'),
        session.type('#notfound', 'text')
      ]);

      invalidOps.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.duration).toBeGreaterThan(0);
      });

      // Verify browser is still functional after errors
      const validOp = await session.navigate('data:text/html,<h1>Still Works</h1>');
      expect(validOp.success).toBe(true);

      await session.close();
      await manager.shutdown();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle concurrent operations efficiently', async () => {
      const manager = createBrowserManager();
      const session = createBrowserSession(manager);
      await session.launch();
      await session.navigate('data:text/html,<h1>Concurrent Test</h1>');

      const startTime = Date.now();

      // Run multiple operations concurrently
      const operations = await Promise.all([
        session.getText('h1'),
        session.screenshot(),
        session.evaluate(() => document.title),
        session.getCurrentUrl(),
        session.getTitle()
      ]);

      const duration = Date.now() - startTime;

      // All operations should succeed
      operations.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(5000);

      await session.close();
      await manager.shutdown();
    });

    it('should properly manage memory and resources', async () => {
      const manager = createBrowserManager();
      const initialUsage = await manager.getResourceUsage();

      const session = createBrowserSession(manager);
      await session.launch();

      const activeUsage = await manager.getResourceUsage();
      expect(activeUsage.totalInstances).toBeGreaterThan(initialUsage.totalInstances);
      expect(activeUsage.totalContexts).toBeGreaterThan(initialUsage.totalContexts);
      expect(activeUsage.memoryUsageMB).toBeGreaterThan(0);

      await session.close();

      const finalUsage = await manager.getResourceUsage();
      expect(finalUsage.totalContexts).toBe(0);

      await manager.shutdown();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle edge case configurations', async () => {
      const manager = createBrowserManager();

      // Test minimal viewport
      const session1 = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 100, height: 100 }
      });

      const result1 = await session1.launch();
      expect(result1.success).toBe(true);

      // Test screenshot with minimal viewport
      await session1.navigate('data:text/html,<div>Small</div>');
      const screenshot1 = await session1.screenshot();
      expect(screenshot1.success).toBe(true);

      await session1.close();

      // Test large viewport
      const session2 = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 3840, height: 2160 }
      });

      const result2 = await session2.launch();
      expect(result2.success).toBe(true);

      await session2.navigate('data:text/html,<div>Large</div>');
      const screenshot2 = await session2.screenshot();
      expect(screenshot2.success).toBe(true);

      await session2.close();
      await manager.shutdown();
    });

    it('should handle rapid session cycling', async () => {
      const manager = createBrowserManager();
      let successCount = 0;

      // Rapidly create and destroy sessions
      const promises = Array.from({ length: 5 }, async () => {
        const session = createBrowserSession(manager);
        try {
          const result = await session.launch();
          if (result.success) {
            await session.navigate('data:text/html,<h1>Quick Test</h1>');
            await session.screenshot();
            successCount++;
          }
        } finally {
          await session.close();
        }
      });

      await Promise.all(promises);

      // Most should succeed
      expect(successCount).toBeGreaterThan(3);

      await manager.shutdown();
    });
  });

  describe('Utility Functions Integration', () => {
    it('should verify launchBrowser utility function works end-to-end', async () => {
      const result = await launchBrowser({
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(BrowserSession);
      expect(result.duration).toBeGreaterThan(0);

      if (result.data) {
        // Test the session works
        await result.data.navigate('data:text/html,<h1>Utility Test</h1>');
        const screenshot = await result.data.screenshot();
        expect(screenshot.success).toBe(true);

        await result.data.close();
      }
    });
  });

  describe('Console and Error Capture Validation', () => {
    it('should verify console capture functionality', async () => {
      const manager = createBrowserManager();
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true
      }, {
        captureConsole: true,
        captureErrors: true
      });

      await session.launch();

      // Navigate to page with console output
      const html = `
        <script>
          console.log('Test log');
          console.warn('Test warning');
          console.error('Test error');
        </script>
        <h1>Console Test</h1>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const messages = session.getCapturedConsoleMessages();
      expect(messages.length).toBeGreaterThanOrEqual(3);

      const logTypes = messages.map(m => m.type);
      expect(logTypes).toContain('log');
      expect(logTypes).toContain('warn');
      expect(logTypes).toContain('error');

      await session.close();
      await manager.shutdown();
    });
  });
});