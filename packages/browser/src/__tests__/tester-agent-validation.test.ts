/**
 * @apexcli/browser - Tester Agent Validation Test
 *
 * Final validation test created by the tester agent to demonstrate
 * comprehensive browser automation testing capabilities.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  BrowserManager,
  BrowserSession,
  captureScreenshot,
  type BrowserSessionConfig,
  type CaptureConfig,
} from '../index.js';

describe('Tester Agent - Final Validation Tests', () => {
  let manager: BrowserManager;

  beforeAll(async () => {
    manager = createBrowserManager({
      maxInstances: 3,
      reuseInstances: true,
      resourceLimits: {
        maxMemoryMB: 1500,
      }
    });
  });

  afterAll(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  it('should validate complete browser automation workflow', async () => {
    console.log('🚀 Starting comprehensive validation test...');

    // PHASE 1: Multi-Browser Launch
    const browserTypes = ['chromium', 'firefox', 'webkit'] as const;
    const sessions: BrowserSession[] = [];

    for (const browserType of browserTypes) {
      const session = createBrowserSession(manager, {
        browserType,
        headless: true,
        viewport: { width: 1280, height: 720 },
      }, {
        captureConsole: true,
        captureJavaScriptErrors: true,
        capturePageErrors: true,
      });

      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);
      expect(launchResult.duration).toBeLessThan(10000);

      sessions.push(session);
      console.log(`✅ ${browserType} launched successfully`);
    }

    // PHASE 2: Navigation Testing
    const testPage = 'data:text/html,<h1>Test Page</h1><button id="test-btn">Click Me</button>';

    for (const session of sessions) {
      const navResult = await session.navigate(testPage);
      expect(navResult.success).toBe(true);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
    }

    console.log('✅ Navigation testing completed');

    // PHASE 3: Element Interaction
    const [primarySession] = sessions;

    const clickResult = await primarySession.click('#test-btn');
    expect(clickResult.success).toBe(true);

    const textResult = await primarySession.getText('h1');
    expect(textResult.success).toBe(true);
    expect(textResult.data).toBe('Test Page');

    console.log('✅ Element interaction testing completed');

    // PHASE 4: Screenshot Testing
    for (const session of sessions) {
      const screenshotResult = await session.screenshot();
      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.data).toBeInstanceOf(Buffer);
      expect(screenshotResult.data!.length).toBeGreaterThan(1000);

      const fullPageResult = await session.screenshot({ fullPage: true });
      expect(fullPageResult.success).toBe(true);
    }

    console.log('✅ Screenshot testing completed');

    // PHASE 5: Console and Error Capture Testing
    const consoleTestPage = `data:text/html,
      <script>
        console.log('Test log message');
        console.warn('Test warning');
        console.error('Test error');
      </script>
      <h1>Console Test</h1>`;

    await primarySession.navigate(consoleTestPage);
    await new Promise(resolve => setTimeout(resolve, 500));

    const consoleMessages = primarySession.getCapturedConsoleMessages();
    expect(consoleMessages.length).toBeGreaterThan(0);

    console.log(`✅ Console capture: ${consoleMessages.length} messages`);

    // PHASE 6: Performance Validation
    const resourceUsage = await manager.getResourceUsage();
    expect(resourceUsage.totalInstances).toBeGreaterThanOrEqual(sessions.length);
    expect(resourceUsage.totalContexts).toBe(sessions.length);
    expect(resourceUsage.memoryUsageMB).toBeLessThan(1500);

    console.log(`✅ Performance: ${resourceUsage.memoryUsageMB}MB memory`);

    // PHASE 7: Cleanup
    for (const session of sessions) {
      const closeResult = await session.close();
      expect(closeResult.success).toBe(true);
    }

    const finalUsage = await manager.getResourceUsage();
    expect(finalUsage.totalContexts).toBe(0);

    console.log('✅ All tests completed successfully');

  }, 60000);

  it('should validate utility functions and factory methods', async () => {
    // Test factory functions
    const customManager = createBrowserManager({
      maxInstances: 1,
      reuseInstances: false,
    });

    expect(customManager).toBeInstanceOf(BrowserManager);

    const session = createBrowserSession(customManager, {
      browserType: 'chromium',
      headless: true,
    });

    expect(session).toBeInstanceOf(BrowserSession);

    // Test launch utility
    const quickLaunch = await launchBrowser({
      browserType: 'chromium',
      headless: true,
    });

    expect(quickLaunch.success).toBe(true);
    expect(quickLaunch.data).toBeInstanceOf(BrowserSession);

    // Cleanup
    if (quickLaunch.data) {
      await quickLaunch.data.close();
    }
    await customManager.shutdown();
  });

  it('should validate error handling scenarios', async () => {
    const session = createBrowserSession(manager);

    // Test operations before launch (should fail)
    const navBeforeLaunch = await session.navigate('https://example.com');
    expect(navBeforeLaunch.success).toBe(false);

    // Launch session
    await session.launch();

    // Test invalid URL navigation
    const invalidNav = await session.navigate('invalid-url');
    expect(invalidNav.success).toBe(false);

    // Test non-existent element
    await session.navigate('data:text/html,<h1>Test</h1>');
    const invalidClick = await session.click('#non-existent');
    expect(invalidClick.success).toBe(false);

    // Cleanup
    await session.close();
  });
});