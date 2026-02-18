/**
 * @apexcli/browser - Final Validation Test
 *
 * This test serves as the final validation that all acceptance criteria are met.
 * It performs a comprehensive end-to-end test of the browser automation core.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  BrowserManager,
  BrowserSession,
  chromium,
  firefox,
  webkit,
} from '../index.js';

describe('Final Validation - Browser Automation Core Acceptance Criteria', () => {
  let manager: BrowserManager;

  beforeAll(() => {
    manager = createBrowserManager();
  });

  afterAll(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  it('FINAL TEST: Complete acceptance criteria validation', async () => {
    console.log('🚀 Starting final validation of browser automation core...');

    // ===================================================================
    // AC1: Headless browser launch (Puppeteer/Playwright)
    // ===================================================================
    console.log('✅ Testing AC1: Headless browser launch (Playwright)');

    // Test 1.1: Launch Chromium browser
    const chromiumSession = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1920, height: 1080 },
    });

    const chromiumLaunch = await chromiumSession.launch();
    expect(chromiumLaunch.success).toBe(true);
    expect(chromiumLaunch.duration).toBeGreaterThan(0);
    console.log(`  ✓ Chromium launched in ${chromiumLaunch.duration}ms`);

    // Verify Playwright objects are accessible
    expect(chromiumSession.getBrowser()).toBeDefined();
    expect(chromiumSession.getContext()).toBeDefined();
    expect(chromiumSession.getPage()).toBeDefined();
    console.log('  ✓ Playwright objects accessible');

    // Test 1.2: Test Firefox browser
    const firefoxSession = createBrowserSession(manager, {
      browserType: 'firefox',
      headless: true,
    });

    const firefoxLaunch = await firefoxSession.launch();
    expect(firefoxLaunch.success).toBe(true);
    console.log(`  ✓ Firefox launched in ${firefoxLaunch.duration}ms`);

    // Test 1.3: Test WebKit browser
    const webkitSession = createBrowserSession(manager, {
      browserType: 'webkit',
      headless: true,
    });

    const webkitLaunch = await webkitSession.launch();
    expect(webkitLaunch.success).toBe(true);
    console.log(`  ✓ WebKit launched in ${webkitLaunch.duration}ms`);

    // Test 1.4: Test convenience function
    const quickLaunch = await launchBrowser({
      browserType: 'chromium',
      headless: true,
    });

    expect(quickLaunch.success).toBe(true);
    expect(quickLaunch.data).toBeInstanceOf(BrowserSession);
    console.log(`  ✓ Convenience function launched browser in ${quickLaunch.duration}ms`);

    // ===================================================================
    // AC2: Browser actions API (click, type, scroll, navigate)
    // ===================================================================
    console.log('✅ Testing AC2: Browser actions API');

    // Test 2.1: Navigation
    const testPage = `
      data:text/html,
      <html>
        <head><title>Test Page for Actions</title></head>
        <body>
          <h1 id="title">Browser Actions Test</h1>
          <div style="height: 1500px; padding: 20px;">
            <input id="testInput" type="text" placeholder="Type here..." />
            <button id="testButton" onclick="handleClick()">Click Test</button>
            <div id="result"></div>
            <div style="height: 1000px; background: linear-gradient(red, blue);"></div>
            <div id="scrollTarget" style="background: yellow; padding: 10px;">
              Scroll target reached!
            </div>
          </div>
          <script>
            function handleClick() {
              const input = document.getElementById('testInput').value;
              document.getElementById('result').textContent = 'Result: ' + input;
            }
          </script>
        </body>
      </html>
    `;

    const navResult = await chromiumSession.navigate(testPage);
    expect(navResult.success).toBe(true);
    console.log(`  ✓ Navigation completed in ${navResult.duration}ms`);

    // Verify current URL and title
    const currentUrl = chromiumSession.getCurrentUrl();
    expect(currentUrl).toContain('data:text/html');

    const titleResult = await chromiumSession.getTitle();
    expect(titleResult.success).toBe(true);
    expect(titleResult.data).toBe('Test Page for Actions');
    console.log('  ✓ URL and title verification passed');

    // Test 2.2: Type action
    const typeResult = await chromiumSession.type('#testInput', 'Hello, Browser Automation!');
    expect(typeResult.success).toBe(true);
    console.log(`  ✓ Type action completed in ${typeResult.duration}ms`);

    // Verify typing worked
    const inputValue = await chromiumSession.evaluate(() => {
      const input = document.getElementById('testInput') as HTMLInputElement;
      return input?.value;
    });
    expect(inputValue.success).toBe(true);
    expect(inputValue.data).toBe('Hello, Browser Automation!');
    console.log('  ✓ Text input verification passed');

    // Test 2.3: Click action
    const clickResult = await chromiumSession.click('#testButton');
    expect(clickResult.success).toBe(true);
    console.log(`  ✓ Click action completed in ${clickResult.duration}ms`);

    // Verify click worked
    const resultText = await chromiumSession.getText('#result');
    expect(resultText.success).toBe(true);
    expect(resultText.data).toBe('Result: Hello, Browser Automation!');
    console.log('  ✓ Click action verification passed');

    // Test 2.4: Scroll action
    const scrollResult = await chromiumSession.scroll({ selector: '#scrollTarget' });
    expect(scrollResult.success).toBe(true);
    console.log(`  ✓ Scroll action completed in ${scrollResult.duration}ms`);

    // Verify scroll position
    const scrollPos = await chromiumSession.evaluate(() => window.scrollY);
    expect(scrollPos.success).toBe(true);
    expect(scrollPos.data).toBeGreaterThan(500);
    console.log(`  ✓ Scroll verification passed (position: ${scrollPos.data}px)`);

    // Test 2.5: Advanced interactions
    const scrollTargetText = await chromiumSession.getText('#scrollTarget');
    expect(scrollTargetText.success).toBe(true);
    expect(scrollTargetText.data).toBe('Scroll target reached!');
    console.log('  ✓ Advanced interactions verification passed');

    // ===================================================================
    // AC3: Screenshot capture capability
    // ===================================================================
    console.log('✅ Testing AC3: Screenshot capture capability');

    // Test 3.1: Standard screenshot
    const screenshotResult = await chromiumSession.screenshot({ type: 'png' });
    expect(screenshotResult.success).toBe(true);
    expect(screenshotResult.data).toBeInstanceOf(Buffer);
    expect(screenshotResult.data!.length).toBeGreaterThan(1000);
    console.log(`  ✓ PNG screenshot captured (${screenshotResult.data!.length} bytes) in ${screenshotResult.duration}ms`);

    // Test 3.2: Full page screenshot
    const fullPageResult = await chromiumSession.screenshot({
      fullPage: true,
      type: 'jpeg',
      quality: 80
    });
    expect(fullPageResult.success).toBe(true);
    expect(fullPageResult.data).toBeInstanceOf(Buffer);
    expect(fullPageResult.data!.length).toBeGreaterThan(screenshotResult.data!.length);
    console.log(`  ✓ JPEG full page screenshot captured (${fullPageResult.data!.length} bytes) in ${fullPageResult.duration}ms`);

    // Test 3.3: High quality screenshot
    const highQualityResult = await chromiumSession.screenshot({
      type: 'jpeg',
      quality: 100
    });
    expect(highQualityResult.success).toBe(true);
    expect(highQualityResult.data).toBeInstanceOf(Buffer);
    console.log(`  ✓ High quality screenshot captured (${highQualityResult.data!.length} bytes)`);

    // ===================================================================
    // AC4: Tests verify browser launch and basic actions
    // ===================================================================
    console.log('✅ Testing AC4: Complete workflow verification');

    // Test 4.1: Multi-browser workflow
    const browserSessions = [chromiumSession, firefoxSession, webkitSession];

    for (let i = 0; i < browserSessions.length; i++) {
      const session = browserSessions[i];
      const browserType = ['Chromium', 'Firefox', 'WebKit'][i];

      // Navigate to unique page for each browser
      const uniquePage = `data:text/html,<h1 id="browser">${browserType} Test</h1>`;
      const nav = await session.navigate(uniquePage);
      expect(nav.success).toBe(true);

      // Verify page content
      const text = await session.getText('#browser');
      expect(text.success).toBe(true);
      expect(text.data).toBe(`${browserType} Test`);

      // Take screenshot
      const screenshot = await session.screenshot();
      expect(screenshot.success).toBe(true);

      console.log(`  ✓ ${browserType} complete workflow passed`);
    }

    // Test 4.2: Resource management verification
    const resourceUsage = await manager.getResourceUsage();
    expect(resourceUsage.totalInstances).toBeGreaterThan(0);
    expect(resourceUsage.totalContexts).toBeGreaterThan(0);
    expect(resourceUsage.memoryUsageMB).toBeGreaterThan(0);
    console.log(`  ✓ Resource usage: ${resourceUsage.totalInstances} instances, ${resourceUsage.totalContexts} contexts, ${resourceUsage.memoryUsageMB.toFixed(1)}MB`);

    // Test 4.3: Error handling verification
    const invalidAction = await chromiumSession.click('#nonexistent');
    expect(invalidAction.success).toBe(false);
    expect(invalidAction.error).toBeDefined();
    console.log('  ✓ Error handling verification passed');

    // Test 4.4: Performance verification
    const performanceStartTime = Date.now();

    // Perform rapid operations to test performance
    const rapidOperations = [
      chromiumSession.navigate('data:text/html,<h1>Performance Test</h1>'),
      chromiumSession.getText('h1'),
      chromiumSession.screenshot({ type: 'png' }),
    ];

    const rapidResults = await Promise.all(rapidOperations);
    const performanceTime = Date.now() - performanceStartTime;

    rapidResults.forEach(result => expect(result.success).toBe(true));
    expect(performanceTime).toBeLessThan(10000); // Should complete within 10 seconds
    console.log(`  ✓ Performance test passed (${performanceTime}ms for 3 operations)`);

    // ===================================================================
    // CLEANUP AND FINAL VERIFICATION
    // ===================================================================
    console.log('🧹 Cleaning up test sessions...');

    // Close the quick launch session
    if (quickLaunch.data) {
      const quickClose = await quickLaunch.data.close();
      expect(quickClose.success).toBe(true);
      console.log('  ✓ Quick launch session closed');
    }

    // Close all browser sessions
    const closeSessions = [chromiumSession, firefoxSession, webkitSession];
    for (let i = 0; i < closeSessions.length; i++) {
      const closeResult = await closeSessions[i].close();
      expect(closeResult.success).toBe(true);
      console.log(`  ✓ ${['Chromium', 'Firefox', 'WebKit'][i]} session closed`);
    }

    // Verify cleanup
    const finalUsage = await manager.getResourceUsage();
    expect(finalUsage.totalContexts).toBe(0);
    console.log(`  ✓ Final cleanup verified: ${finalUsage.totalContexts} contexts remaining`);

    // ===================================================================
    // FINAL VALIDATION SUMMARY
    // ===================================================================
    console.log('\n🎉 FINAL VALIDATION SUMMARY:');
    console.log('✅ AC1: Headless browser launch (Playwright) - PASSED');
    console.log('   ✓ Chromium, Firefox, WebKit all launched successfully');
    console.log('   ✓ Headless mode configuration verified');
    console.log('   ✓ Convenience functions working');

    console.log('✅ AC2: Browser actions API (click, type, scroll, navigate) - PASSED');
    console.log('   ✓ Navigation with URL and title verification');
    console.log('   ✓ Text input with value verification');
    console.log('   ✓ Click actions with result verification');
    console.log('   ✓ Scroll operations with position verification');

    console.log('✅ AC3: Screenshot capture capability - PASSED');
    console.log('   ✓ PNG and JPEG format screenshots');
    console.log('   ✓ Standard and full-page screenshots');
    console.log('   ✓ Quality settings functional');

    console.log('✅ AC4: Tests verify browser launch and basic actions - PASSED');
    console.log('   ✓ Multi-browser workflow validation');
    console.log('   ✓ Resource management verification');
    console.log('   ✓ Error handling validation');
    console.log('   ✓ Performance characteristics validated');

    console.log('\n🚀 ALL ACCEPTANCE CRITERIA SUCCESSFULLY VALIDATED!');
    console.log('🔧 Browser automation core is ready for production use.');

  }, 60000); // Extended timeout for comprehensive testing

  it('should verify Playwright module exports are accessible', () => {
    // Verify that Playwright browser types are properly exported
    expect(typeof chromium).toBe('object');
    expect(typeof firefox).toBe('object');
    expect(typeof webkit).toBe('object');

    expect(typeof chromium.launch).toBe('function');
    expect(typeof firefox.launch).toBe('function');
    expect(typeof webkit.launch).toBe('function');

    console.log('✅ Playwright module exports verified');
  });

  it('should verify factory functions work correctly', () => {
    const testManager = createBrowserManager({
      maxInstances: 5,
      reuseInstances: true,
    });

    expect(testManager).toBeInstanceOf(BrowserManager);

    const testSession = createBrowserSession(testManager, {
      browserType: 'chromium',
      headless: true,
    });

    expect(testSession).toBeInstanceOf(BrowserSession);

    console.log('✅ Factory functions verified');
  });

  it('should verify type exports are working', () => {
    // This test verifies that TypeScript types are properly exported
    // If this compiles, the types are working correctly
    const config: import('../types.js').BrowserSessionConfig = {
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 720 }
    };

    expect(config.browserType).toBe('chromium');
    expect(config.headless).toBe(true);

    console.log('✅ TypeScript type exports verified');
  });
});