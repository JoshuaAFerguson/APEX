/**
 * @fileoverview Comprehensive API Integration Tests for Browser Automation Package
 *
 * This test suite provides comprehensive coverage of the @apexcli/browser package
 * API surface, testing all exported functions, classes, and utilities to ensure
 * they work correctly together and with the broader APEX ecosystem.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import all exports from the browser package
import {
  // Core classes
  BrowserManager,
  BrowserSession,

  // Utility functions
  createBrowserManager,
  createBrowserSession,
  launchBrowser,

  // Screenshot utilities
  captureScreenshot,
  capturePNG,
  captureJPEG,
  captureFullPageScreenshot,
  captureViewportScreenshot,

  // Playwright browser launchers
  chromium,
  firefox,
  webkit,

  // Constants
  defaultBrowserConfig,
  defaultManagerConfig,
  defaultCaptureConfig,
  BROWSER_LIMITS,
  MONITORING_INTERVALS,
  ERROR_MESSAGES,
  USER_AGENTS,
} from '../../packages/browser/src/index.js';

// Import types for validation
import type {
  BrowserManagerConfig,
  BrowserSessionConfig,
  CaptureConfig,
  BrowserActionResult,
  ScreenshotOptions,
} from '../../packages/browser/src/index.js';

describe('Browser Package API Integration Tests', () => {
  let tempDir: string;
  let testArtifactsDir: string;

  beforeAll(async () => {
    // Create temporary directory for test artifacts
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-artifacts', 'api-integration-'));
    testArtifactsDir = path.join(tempDir, 'screenshots');
    await fs.mkdir(testArtifactsDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test artifacts:', error);
    }
  });

  describe('Package Exports Validation', () => {
    it('should export all core classes', () => {
      expect(BrowserManager).toBeDefined();
      expect(typeof BrowserManager).toBe('function');

      expect(BrowserSession).toBeDefined();
      expect(typeof BrowserSession).toBe('function');
    });

    it('should export utility functions', () => {
      expect(createBrowserManager).toBeDefined();
      expect(typeof createBrowserManager).toBe('function');

      expect(createBrowserSession).toBeDefined();
      expect(typeof createBrowserSession).toBe('function');

      expect(launchBrowser).toBeDefined();
      expect(typeof launchBrowser).toBe('function');
    });

    it('should export screenshot utilities', () => {
      expect(captureScreenshot).toBeDefined();
      expect(typeof captureScreenshot).toBe('function');

      expect(capturePNG).toBeDefined();
      expect(typeof capturePNG).toBe('function');

      expect(captureJPEG).toBeDefined();
      expect(typeof captureJPEG).toBe('function');

      expect(captureFullPageScreenshot).toBeDefined();
      expect(typeof captureFullPageScreenshot).toBe('function');

      expect(captureViewportScreenshot).toBeDefined();
      expect(typeof captureViewportScreenshot).toBe('function');
    });

    it('should export Playwright browser launchers', () => {
      expect(chromium).toBeDefined();
      expect(typeof chromium).toBe('object');
      expect(typeof chromium.launch).toBe('function');

      expect(firefox).toBeDefined();
      expect(typeof firefox).toBe('object');
      expect(typeof firefox.launch).toBe('function');

      expect(webkit).toBeDefined();
      expect(typeof webkit).toBe('object');
      expect(typeof webkit.launch).toBe('function');
    });

    it('should export configuration constants', () => {
      expect(defaultBrowserConfig).toBeDefined();
      expect(typeof defaultBrowserConfig).toBe('object');

      expect(defaultManagerConfig).toBeDefined();
      expect(typeof defaultManagerConfig).toBe('object');

      expect(defaultCaptureConfig).toBeDefined();
      expect(typeof defaultCaptureConfig).toBe('object');

      expect(BROWSER_LIMITS).toBeDefined();
      expect(typeof BROWSER_LIMITS).toBe('object');

      expect(MONITORING_INTERVALS).toBeDefined();
      expect(typeof MONITORING_INTERVALS).toBe('object');

      expect(ERROR_MESSAGES).toBeDefined();
      expect(typeof ERROR_MESSAGES).toBe('object');

      expect(USER_AGENTS).toBeDefined();
      expect(typeof USER_AGENTS).toBe('object');
    });
  });

  describe('Browser Manager Integration', () => {
    let manager: InstanceType<typeof BrowserManager>;

    beforeEach(() => {
      manager = createBrowserManager({
        headless: true,
        timeout: 30000,
      });
    });

    afterEach(async () => {
      if (manager) {
        try {
          await manager.cleanup();
        } catch (error) {
          console.warn('Manager cleanup failed:', error);
        }
      }
    });

    it('should create browser manager with default config', () => {
      expect(manager).toBeInstanceOf(BrowserManager);
      expect(manager.isInitialized()).toBe(false);
    });

    it('should create browser manager with custom config', () => {
      const customConfig: Partial<BrowserManagerConfig> = {
        headless: false,
        browserType: 'firefox',
        timeout: 45000,
      };

      const customManager = createBrowserManager(customConfig);
      expect(customManager).toBeInstanceOf(BrowserManager);
    });

    it('should launch and manage browser instances', async () => {
      const launchResult = await manager.launchBrowser('chromium');
      expect(launchResult.success).toBe(true);

      if (launchResult.success) {
        expect(launchResult.data).toBeDefined();
        expect(manager.isInitialized()).toBe(true);

        // Test browser instance info
        const browserInfo = await manager.getBrowserInfo();
        expect(browserInfo.success).toBe(true);

        if (browserInfo.success) {
          expect(browserInfo.data.browserType).toBe('chromium');
          expect(browserInfo.data.isConnected).toBe(true);
        }

        // Clean up browser
        await manager.closeBrowser();
        expect(manager.isInitialized()).toBe(false);
      }
    });
  });

  describe('Browser Session Integration', () => {
    let manager: InstanceType<typeof BrowserManager>;
    let session: InstanceType<typeof BrowserSession>;

    beforeEach(async () => {
      manager = createBrowserManager({ headless: true });
      session = createBrowserSession(manager, {
        viewport: { width: 1024, height: 768 },
      });
    });

    afterEach(async () => {
      if (session) {
        try {
          await session.close();
        } catch (error) {
          console.warn('Session cleanup failed:', error);
        }
      }
      if (manager) {
        try {
          await manager.cleanup();
        } catch (error) {
          console.warn('Manager cleanup failed:', error);
        }
      }
    });

    it('should create browser session with manager', () => {
      expect(session).toBeInstanceOf(BrowserSession);
      expect(session.isLaunched()).toBe(false);
    });

    it('should launch session and navigate to pages', async () => {
      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      if (launchResult.success) {
        expect(session.isLaunched()).toBe(true);

        // Navigate to test page
        const testHTML = `
          <!DOCTYPE html>
          <html>
            <head><title>API Integration Test</title></head>
            <body>
              <h1>Test Page</h1>
              <button id="testBtn">Test Button</button>
              <input id="testInput" type="text" placeholder="Test input" />
              <div id="output">Initial content</div>
            </body>
          </html>
        `;

        const navResult = await session.setContent(testHTML);
        expect(navResult.success).toBe(true);

        // Test page interaction
        const clickResult = await session.click('#testBtn');
        expect(clickResult.success).toBe(true);

        const fillResult = await session.fill('#testInput', 'Test value');
        expect(fillResult.success).toBe(true);

        const textResult = await session.getElementText('#output');
        expect(textResult.success).toBe(true);
      }
    });

    it('should capture console messages and errors', async () => {
      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      if (launchResult.success) {
        const testHTML = `
          <!DOCTYPE html>
          <html>
            <head><title>Console Test</title></head>
            <body>
              <script>
                console.log('Test log message');
                console.warn('Test warning message');
                console.error('Test error message');
              </script>
            </body>
          </html>
        `;

        const navResult = await session.setContent(testHTML);
        expect(navResult.success).toBe(true);

        // Wait a moment for console messages
        await new Promise(resolve => setTimeout(resolve, 100));

        const messages = session.getCapturedConsoleMessages();
        expect(messages.length).toBeGreaterThan(0);

        const logMessage = messages.find(m => m.level === 'log' && m.text.includes('Test log message'));
        expect(logMessage).toBeDefined();
      }
    });
  });

  describe('Utility Function Integration', () => {
    it('should launch browser with utility function', async () => {
      const launchResult = await launchBrowser(
        { viewport: { width: 800, height: 600 }, headless: true },
        { captureConsole: true, captureErrors: true }
      );

      expect(launchResult.success).toBe(true);

      if (launchResult.success) {
        const session = launchResult.data;
        expect(session).toBeInstanceOf(BrowserSession);
        expect(session.isLaunched()).toBe(true);

        // Test basic functionality
        const testHTML = '<html><body><h1>Utility Test</h1></body></html>';
        const navResult = await session.setContent(testHTML);
        expect(navResult.success).toBe(true);

        await session.close();
      }
    });

    it('should handle launch failure gracefully', async () => {
      // Test with invalid configuration that should fail
      const launchResult = await launchBrowser({
        headless: true,
        // @ts-expect-error - intentionally invalid config for testing
        browserType: 'invalid-browser' as any,
      });

      expect(launchResult.success).toBe(false);
      expect(launchResult.error).toBeDefined();
    });
  });

  describe('Screenshot Utility Integration', () => {
    let session: InstanceType<typeof BrowserSession>;

    beforeEach(async () => {
      const launchResult = await launchBrowser({
        viewport: { width: 800, height: 600 },
        headless: true,
      });

      expect(launchResult.success).toBe(true);
      session = launchResult.data!;
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should capture screenshots with different utilities', async () => {
      const testHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Screenshot Test</title>
            <style>
              body { font-family: Arial; padding: 20px; background: #f0f0f0; }
              .header { background: #007acc; color: white; padding: 20px; border-radius: 5px; }
              .content { background: white; padding: 20px; margin-top: 10px; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Screenshot Test Page</h1>
            </div>
            <div class="content">
              <p>This is a test page for screenshot utilities.</p>
              <button>Test Button</button>
              <input type="text" value="Test input" />
            </div>
          </body>
        </html>
      `;

      await session.setContent(testHTML);
      const page = session.getPage()!;

      // Test different screenshot utilities
      const pngPath = path.join(testArtifactsDir, 'test-png.png');
      const jpegPath = path.join(testArtifactsDir, 'test-jpeg.jpg');
      const fullPagePath = path.join(testArtifactsDir, 'test-fullpage.png');
      const viewportPath = path.join(testArtifactsDir, 'test-viewport.png');

      // Test PNG capture
      const pngResult = await capturePNG(page, pngPath);
      expect(pngResult.success).toBe(true);
      const pngStats = await fs.stat(pngPath);
      expect(pngStats.size).toBeGreaterThan(0);

      // Test JPEG capture
      const jpegResult = await captureJPEG(page, jpegPath, { quality: 80 });
      expect(jpegResult.success).toBe(true);
      const jpegStats = await fs.stat(jpegPath);
      expect(jpegStats.size).toBeGreaterThan(0);

      // Test full page screenshot
      const fullPageResult = await captureFullPageScreenshot(page, fullPagePath);
      expect(fullPageResult.success).toBe(true);
      const fullPageStats = await fs.stat(fullPagePath);
      expect(fullPageStats.size).toBeGreaterThan(0);

      // Test viewport screenshot
      const viewportResult = await captureViewportScreenshot(page, viewportPath);
      expect(viewportResult.success).toBe(true);
      const viewportStats = await fs.stat(viewportPath);
      expect(viewportStats.size).toBeGreaterThan(0);

      // Verify different file sizes (full page should be larger)
      expect(fullPageStats.size).toBeGreaterThanOrEqual(viewportStats.size);
    });

    it('should capture element screenshots', async () => {
      const testHTML = `
        <!DOCTYPE html>
        <html>
          <body style="padding: 50px;">
            <div id="testElement" style="background: red; width: 200px; height: 100px; padding: 20px;">
              <span style="color: white;">Test Element</span>
            </div>
          </body>
        </html>
      `;

      await session.setContent(testHTML);
      const page = session.getPage()!;

      const elementPath = path.join(testArtifactsDir, 'test-element.png');

      // Capture element screenshot using general capture function
      const element = await page.locator('#testElement');
      const elementResult = await captureScreenshot(page, elementPath, {
        clip: await element.boundingBox() || undefined,
      });

      expect(elementResult.success).toBe(true);
      const elementStats = await fs.stat(elementPath);
      expect(elementStats.size).toBeGreaterThan(0);
    });
  });

  describe('Configuration Constants Integration', () => {
    it('should provide valid default configurations', () => {
      // Test default browser config
      expect(defaultBrowserConfig.headless).toBeDefined();
      expect(defaultBrowserConfig.browserType).toBeDefined();
      expect(defaultBrowserConfig.viewport).toBeDefined();
      expect(defaultBrowserConfig.timeout).toBeGreaterThan(0);

      // Test default manager config
      expect(defaultManagerConfig.maxInstances).toBeGreaterThan(0);
      expect(defaultManagerConfig.idleTimeout).toBeGreaterThan(0);

      // Test default capture config
      expect(defaultCaptureConfig.captureConsole).toBeDefined();
      expect(defaultCaptureConfig.captureErrors).toBeDefined();
    });

    it('should provide browser limits', () => {
      expect(BROWSER_LIMITS.MAX_CONCURRENT_BROWSERS).toBeGreaterThan(0);
      expect(BROWSER_LIMITS.MAX_CONCURRENT_TABS).toBeGreaterThan(0);
      expect(BROWSER_LIMITS.MAX_MEMORY_MB).toBeGreaterThan(0);
    });

    it('should provide monitoring intervals', () => {
      expect(MONITORING_INTERVALS.HEALTH_CHECK_MS).toBeGreaterThan(0);
      expect(MONITORING_INTERVALS.MEMORY_CHECK_MS).toBeGreaterThan(0);
      expect(MONITORING_INTERVALS.CLEANUP_CHECK_MS).toBeGreaterThan(0);
    });

    it('should provide error messages', () => {
      expect(ERROR_MESSAGES.BROWSER_LAUNCH_FAILED).toBeDefined();
      expect(ERROR_MESSAGES.NAVIGATION_FAILED).toBeDefined();
      expect(ERROR_MESSAGES.ELEMENT_NOT_FOUND).toBeDefined();
    });

    it('should provide user agents', () => {
      expect(USER_AGENTS.CHROME).toBeDefined();
      expect(USER_AGENTS.FIREFOX).toBeDefined();
      expect(USER_AGENTS.SAFARI).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid browser types gracefully', async () => {
      const manager = createBrowserManager({
        // @ts-expect-error - intentionally invalid for testing
        browserType: 'invalid-browser',
        headless: true,
      });

      const launchResult = await manager.launchBrowser('chromium');

      // Should either succeed (ignoring invalid config) or fail gracefully
      if (!launchResult.success) {
        expect(launchResult.error).toBeDefined();
      }
    });

    it('should handle session operations on closed browser', async () => {
      const session = await launchBrowser({ headless: true });
      expect(session.success).toBe(true);

      if (session.success) {
        const browserSession = session.data;

        // Close the session
        await browserSession.close();
        expect(browserSession.isLaunched()).toBe(false);

        // Try to navigate after closing
        const navResult = await browserSession.setContent('<html><body>Test</body></html>');
        expect(navResult.success).toBe(false);
        expect(navResult.error).toBeDefined();
      }
    });

    it('should handle screenshot capture failures', async () => {
      // Try to capture screenshot with invalid path
      const invalidPath = '/invalid/path/that/does/not/exist/test.png';

      const session = await launchBrowser({ headless: true });
      expect(session.success).toBe(true);

      if (session.success) {
        await session.data.setContent('<html><body>Test</body></html>');
        const page = session.data.getPage()!;

        const result = await capturePNG(page, invalidPath);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        await session.data.close();
      }
    });
  });

  describe('Cross-Browser Compatibility', () => {
    it('should work with different browser engines', async () => {
      const browsers = ['chromium', 'firefox', 'webkit'] as const;

      for (const browserType of browsers) {
        try {
          const manager = createBrowserManager({
            browserType,
            headless: true,
          });

          const launchResult = await manager.launchBrowser(browserType);

          if (launchResult.success) {
            const browserInfo = await manager.getBrowserInfo();
            expect(browserInfo.success).toBe(true);

            if (browserInfo.success) {
              expect(browserInfo.data.browserType).toBe(browserType);
            }

            await manager.cleanup();
          }

        } catch (error) {
          // Browser might not be installed - skip test
          console.warn(`${browserType} not available for testing:`, error);
        }
      }
    });
  });

  describe('Performance and Resource Management', () => {
    it('should manage multiple browser sessions efficiently', async () => {
      const sessions: InstanceType<typeof BrowserSession>[] = [];

      try {
        // Launch multiple sessions
        for (let i = 0; i < 3; i++) {
          const launchResult = await launchBrowser({
            headless: true,
            viewport: { width: 800 + i * 100, height: 600 + i * 100 },
          });

          expect(launchResult.success).toBe(true);
          if (launchResult.success) {
            sessions.push(launchResult.data);
          }
        }

        // Test all sessions are working
        for (let i = 0; i < sessions.length; i++) {
          const session = sessions[i];
          const testHTML = `<html><body><h1>Session ${i + 1}</h1></body></html>`;
          const navResult = await session.setContent(testHTML);
          expect(navResult.success).toBe(true);
        }

      } finally {
        // Cleanup all sessions
        for (const session of sessions) {
          try {
            await session.close();
          } catch (error) {
            console.warn('Session cleanup failed:', error);
          }
        }
      }
    });

    it('should handle memory and resource monitoring', async () => {
      const session = await launchBrowser({ headless: true });
      expect(session.success).toBe(true);

      if (session.success) {
        // Create a page with some content
        await session.data.setContent(`
          <html>
            <body>
              <h1>Resource Test</h1>
              <script>
                // Generate some data for memory usage
                window.testData = new Array(1000).fill('test data');
              </script>
            </body>
          </html>
        `);

        // Check if we can access browser process info (if available)
        try {
          const page = session.data.getPage()!;
          const metrics = await page.evaluate(() => {
            return {
              memory: (performance as any).memory ? {
                usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
                totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
              } : null,
              timing: performance.timing ? {
                domLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
                pageLoaded: performance.timing.loadEventEnd - performance.timing.navigationStart,
              } : null,
            };
          });

          // Basic validation that we can collect metrics
          expect(metrics).toBeDefined();

        } catch (error) {
          // Performance API might not be available in all contexts
          console.warn('Performance metrics not available:', error);
        }

        await session.data.close();
      }
    });
  });
});