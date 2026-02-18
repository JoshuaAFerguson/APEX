/**
 * @fileoverview Sample Integration Test Demonstrating Complete Setup
 *
 * This comprehensive sample test demonstrates the complete test infrastructure setup
 * including:
 * - Browser automation with Playwright
 * - Mock server integration for realistic testing
 * - Navigation scenarios and user interactions
 * - Test utilities and assertion helpers
 * - Fixture usage for common scenarios
 * - Error handling and performance measurement
 * - Screenshot capture and console monitoring
 *
 * This test serves as both a validation of the infrastructure and a reference
 * implementation for other integration tests.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import {
  createBrowser,
  createBrowserContext,
  createPage,
  captureScreenshot,
  waitForNetworkIdle,
} from './setup';
import {
  createTestPage,
  runNavigationScenario,
  runInteractionScenario,
  monitorConsoleMessages,
  NAVIGATION_SCENARIOS,
  INTERACTION_SCENARIOS,
} from './fixtures/common-scenarios';
import {
  takeScreenshot,
  waitForElement,
  safeClick,
  safeFill,
  captureConsoleMessages,
  capturePageErrors,
  measurePerformance,
  setupAlertHandler,
  setupMockServer,
  createTempDir,
  cleanupTempDir,
} from './utils/test-helpers';
import {
  mockServerFactory,
  MOCK_FILESYSTEM_SERVER,
  MOCK_MEMORY_SERVER,
  MOCK_HTTP_SERVER,
} from '../test-utils/mock-server-factory';

describe('Sample Integration Test - Complete Infrastructure Demonstration', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;
  let mockServers: Array<any> = [];

  // Setup before all tests
  beforeAll(async () => {
    console.log('🚀 Setting up sample integration test infrastructure...');

    // Create temporary directory for test artifacts
    tempDir = await createTempDir();
    console.log(`📁 Created temp directory: ${tempDir}`);

    // Initialize mock servers for testing
    const filesystemServer = mockServerFactory.createFileSystemServer();
    const memoryServer = mockServerFactory.createMemoryServer();
    const httpServer = mockServerFactory.createRealisticServer(MOCK_HTTP_SERVER);

    mockServers = [filesystemServer, memoryServer, httpServer];

    // Start mock servers
    for (const server of mockServers) {
      await server.start();
      console.log(`✅ Started mock server: ${server.entry.name}`);
    }
  });

  // Cleanup after all tests
  afterAll(async () => {
    console.log('🧹 Cleaning up sample integration test infrastructure...');

    // Stop mock servers
    for (const server of mockServers) {
      try {
        await server.stop();
        console.log(`🛑 Stopped mock server: ${server.entry.name}`);
      } catch (error) {
        console.warn(`⚠️ Failed to stop server ${server.entry.name}:`, error);
      }
    }

    // Cleanup browser resources
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();

    // Cleanup temp directory
    await cleanupTempDir(tempDir);
    console.log('✨ Cleanup completed');
  });

  // Setup before each test
  beforeEach(async () => {
    // Create fresh browser instance for each test
    browser = await createBrowser({
      browserType: 'chromium',
      headless: true,
    });
    context = await createBrowserContext(browser);
    page = await createPage(context);

    // Setup alert handler to avoid blocking
    await setupAlertHandler(page, 'accept');

    console.log('🔄 Fresh browser instance created for test');
  });

  // Cleanup after each test
  afterEach(async () => {
    if (page) {
      // Capture screenshot on test failure for debugging
      try {
        await takeScreenshot(page, `test-cleanup-${Date.now()}`, tempDir);
      } catch (error) {
        console.warn('⚠️ Failed to capture cleanup screenshot:', error);
      }
      await page.close();
    }
    if (context) await context.close();
    if (browser) await browser.close();
  });

  describe('🌐 Browser Automation Infrastructure', () => {
    it('should successfully launch browser and create page', async () => {
      // Verify browser is running
      expect(browser.isConnected()).toBe(true);
      expect(page).toBeDefined();

      // Test basic navigation
      await createTestPage(page);
      const title = await page.title();
      expect(title).toBe('APEX Browser Test Page');

      console.log('✅ Browser automation infrastructure verified');
    });

    it('should handle multiple browser contexts', async () => {
      // Create additional context to test isolation
      const secondContext = await createBrowserContext(browser);
      const secondPage = await createPage(secondContext);

      try {
        await createTestPage(page);
        await secondPage.setContent('<html><title>Second Context</title><body><h1>Isolated</h1></body></html>');

        // Verify contexts are isolated
        const firstTitle = await page.title();
        const secondTitle = await secondPage.title();

        expect(firstTitle).toBe('APEX Browser Test Page');
        expect(secondTitle).toBe('Second Context');

        console.log('✅ Browser context isolation verified');
      } finally {
        await secondPage.close();
        await secondContext.close();
      }
    });
  });

  describe('🔧 Test Utilities Demonstration', () => {
    beforeEach(async () => {
      await createTestPage(page);
    });

    it('should demonstrate safe element interactions', async () => {
      // Test safe click with retry logic
      await safeClick(page, 'button.button');

      // Test safe form filling
      await safeFill(page, 'input[name="username"]', 'testuser');
      await safeFill(page, 'input[name="email"]', 'test@example.com');

      // Verify values were set
      const username = await page.inputValue('input[name="username"]');
      const email = await page.inputValue('input[name="email"]');

      expect(username).toBe('testuser');
      expect(email).toBe('test@example.com');

      console.log('✅ Safe element interactions demonstrated');
    });

    it('should demonstrate element waiting conditions', async () => {
      // Wait for elements with specific conditions
      const submitButton = await waitForElement(page, 'button[type="submit"]', {
        visible: true,
        enabled: true,
        timeout: 10000,
      });

      const usernameInput = await waitForElement(page, 'input[name="username"]', {
        visible: true,
        stable: true,
      });

      expect(submitButton).toBeDefined();
      expect(usernameInput).toBeDefined();

      console.log('✅ Element waiting conditions demonstrated');
    });

    it('should capture and analyze console messages', async () => {
      const messages = await captureConsoleMessages(page, async () => {
        // Trigger actions that generate console messages
        await safeClick(page, '#consoleBtn');
        await page.waitForTimeout(1000);
      });

      // Verify different message types were captured
      expect(messages.length).toBeGreaterThan(0);

      const logMessages = messages.filter(m => m.type === 'log');
      const warnMessages = messages.filter(m => m.type === 'warning');
      const errorMessages = messages.filter(m => m.type === 'error');

      expect(logMessages.length).toBeGreaterThan(0);
      expect(warnMessages.length).toBeGreaterThan(0);
      expect(errorMessages.length).toBeGreaterThan(0);

      console.log(`✅ Console messages captured: ${messages.length} total`);
    });

    it('should measure performance metrics', async () => {
      const performance = await measurePerformance(page, async () => {
        await page.reload();
        await waitForNetworkIdle(page);
      });

      expect(performance.duration).toBeGreaterThan(0);
      expect(performance.duration).toBeLessThan(10000); // Should complete within 10s

      if (performance.metrics) {
        console.log('📊 Performance metrics:', performance.metrics);
      }

      console.log(`✅ Performance measured: ${performance.duration}ms`);
    });
  });

  describe('🎭 Mock Server Integration', () => {
    it('should integrate with filesystem mock server', async () => {
      const filesystemServer = mockServers[0]; // filesystem server

      // Test mock server interaction
      const tools = await filesystemServer.listTools();
      expect(tools.length).toBeGreaterThan(0);

      // Test tool execution
      const readResult = await filesystemServer.callTool('file-read', {
        path: '/test/sample.txt'
      });

      expect(readResult.isError).toBe(false);
      expect(readResult.content).toBeDefined();

      console.log('✅ Filesystem mock server integration verified');
    });

    it('should setup mock HTTP responses', async () => {
      // Setup mock routes for testing
      await setupMockServer(page, {
        '**/api/users': {
          status: 200,
          body: [
            { id: 1, name: 'Test User 1' },
            { id: 2, name: 'Test User 2' }
          ]
        },
        '**/api/error': {
          status: 500,
          body: { error: 'Internal Server Error' }
        }
      });

      // Navigate to page that makes API calls
      await page.setContent(`
        <html>
          <body>
            <button id="loadUsers" onclick="loadUsers()">Load Users</button>
            <div id="output"></div>
            <script>
              async function loadUsers() {
                try {
                  const response = await fetch('/api/users');
                  const users = await response.json();
                  document.getElementById('output').textContent =
                    'Loaded ' + users.length + ' users';
                } catch (error) {
                  document.getElementById('output').textContent = 'Error: ' + error.message;
                }
              }
            </script>
          </body>
        </html>
      `);

      // Trigger mock API call
      await safeClick(page, '#loadUsers');
      await page.waitForTimeout(1000);

      const output = await page.textContent('#output');
      expect(output).toContain('Loaded 2 users');

      console.log('✅ Mock HTTP responses integration verified');
    });
  });

  describe('🎯 Navigation Scenarios', () => {
    it('should run predefined navigation scenarios', async () => {
      for (const scenario of NAVIGATION_SCENARIOS) {
        console.log(`🧪 Running navigation scenario: ${scenario.name}`);

        try {
          await runNavigationScenario(page, scenario);
          console.log(`✅ Scenario passed: ${scenario.name}`);
        } catch (error) {
          console.error(`❌ Scenario failed: ${scenario.name}`, error);
          throw error;
        }
      }
    });

    it('should handle complex page navigation with state persistence', async () => {
      await createTestPage(page);

      // Fill form data
      await safeFill(page, 'input[name="username"]', 'persistent-user');
      await safeFill(page, 'input[name="email"]', 'user@example.com');

      // Navigate away and back
      await page.goto('data:text/html,<html><title>Away</title></html>');
      await page.goBack();
      await waitForNetworkIdle(page);

      // Verify form data is cleared (as expected for back navigation)
      const username = await page.inputValue('input[name="username"]');
      expect(username).toBe(''); // Form should be cleared on navigation

      console.log('✅ Complex navigation with state handling verified');
    });
  });

  describe('🎪 Fixture Usage Demonstration', () => {
    beforeEach(async () => {
      await createTestPage(page);
    });

    it('should use form interaction fixtures', async () => {
      // Use predefined interaction scenarios
      const formScenario = INTERACTION_SCENARIOS.find(s => s.name === 'Form input and submission');

      if (formScenario) {
        await runInteractionScenario(page, formScenario);
        console.log('✅ Form interaction fixture executed successfully');
      }
    });

    it('should demonstrate error handling fixtures', async () => {
      const errors = await capturePageErrors(page, async () => {
        // Click button that generates error
        await safeClick(page, '#errorBtn');
        await page.waitForTimeout(1000);
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Intentional test error');

      console.log(`✅ Error handling demonstrated: ${errors.length} errors captured`);
    });

    it('should use screenshot capture fixtures', async () => {
      // Capture initial state
      const initialScreenshot = await takeScreenshot(page, 'initial-state', tempDir);
      expect(initialScreenshot).toContain('.png');

      // Make changes to page
      await safeClick(page, '#showHideBtn');
      await page.waitForTimeout(500);

      // Capture changed state
      const changedScreenshot = await takeScreenshot(page, 'changed-state', tempDir);
      expect(changedScreenshot).toContain('.png');

      // Verify different filenames
      expect(initialScreenshot).not.toBe(changedScreenshot);

      console.log('✅ Screenshot capture fixtures demonstrated');
    });
  });

  describe('🔍 Advanced Testing Scenarios', () => {
    beforeEach(async () => {
      await createTestPage(page);
    });

    it('should handle dynamic content loading', async () => {
      // Test dynamic content addition
      await safeFill(page, '#dynamicInput', 'Dynamic test content');
      await safeClick(page, '#addContentBtn');

      // Wait for content to be added
      await page.waitForFunction(
        () => document.getElementById('dynamicOutput')?.children.length > 0,
        { timeout: 5000 }
      );

      const output = await page.textContent('#dynamicOutput');
      expect(output).toContain('Dynamic test content');

      console.log('✅ Dynamic content loading verified');
    });

    it('should simulate network conditions', async () => {
      // Test slow network response simulation
      await safeClick(page, '#slowBtn');

      const startTime = Date.now();

      // Wait for slow request to complete
      await page.waitForFunction(
        () => document.getElementById('networkOutput')?.textContent?.includes('completed'),
        { timeout: 10000 }
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(2500); // Should take at least 3 seconds

      console.log(`✅ Slow network simulation verified: ${duration}ms`);
    });

    it('should handle browser permissions and security', async () => {
      // Test console access (should work)
      const consoleMessages = await captureConsoleMessages(page, async () => {
        await page.evaluate(() => {
          console.log('Permission test: console access');
        });
      });

      expect(consoleMessages.length).toBeGreaterThan(0);

      // Test local storage access (should work in browser context)
      await page.evaluate(() => {
        localStorage.setItem('test-key', 'test-value');
      });

      const storedValue = await page.evaluate(() => {
        return localStorage.getItem('test-key');
      });

      expect(storedValue).toBe('test-value');

      console.log('✅ Browser permissions and security verified');
    });
  });

  describe('📊 Infrastructure Validation', () => {
    it('should validate all mock servers are operational', async () => {
      for (const server of mockServers) {
        expect(server.isRunning()).toBe(true);

        const stats = server.getStats();
        expect(stats.isRunning).toBe(true);
        expect(stats.uptime).toBeGreaterThan(0);

        console.log(`✅ Mock server ${server.entry.name} is operational`);
      }
    });

    it('should validate browser capabilities', async () => {
      // Test JavaScript execution
      const jsResult = await page.evaluate(() => {
        return {
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          cookies: document.cookie.length,
          localStorage: typeof localStorage !== 'undefined',
          console: typeof console !== 'undefined'
        };
      });

      expect(jsResult.userAgent).toContain('HeadlessChrome');
      expect(jsResult.viewport.width).toBeGreaterThan(0);
      expect(jsResult.viewport.height).toBeGreaterThan(0);
      expect(jsResult.localStorage).toBe(true);
      expect(jsResult.console).toBe(true);

      console.log('✅ Browser capabilities validated:', jsResult);
    });

    it('should validate test infrastructure performance', async () => {
      const startTime = Date.now();

      // Perform typical test operations
      await createTestPage(page);
      await safeClick(page, 'button.button');
      await safeFill(page, 'input[name="username"]', 'perf-test');
      await takeScreenshot(page, 'performance-test', tempDir);

      const totalTime = Date.now() - startTime;

      // Should complete typical operations within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds max

      console.log(`✅ Test infrastructure performance validated: ${totalTime}ms`);
    });
  });

  describe('📝 Documentation Examples', () => {
    it('should provide a complete usage example', async () => {
      console.log(`
🎓 COMPLETE INTEGRATION TEST USAGE EXAMPLE:

This test demonstrates how to:

1. 🚀 Setup browser automation with Playwright
   - Create browser instances with custom configuration
   - Handle multiple contexts for test isolation
   - Manage browser lifecycle (startup/shutdown)

2. 🔧 Use test utilities effectively
   - Safe element interactions with retry logic
   - Element waiting with custom conditions
   - Console message and error capture
   - Performance measurement utilities

3. 🎭 Integrate mock servers for realistic testing
   - Mock filesystem, memory, and HTTP servers
   - Custom response configuration
   - Server lifecycle management
   - Request/response recording

4. 🎯 Execute navigation scenarios
   - Predefined navigation patterns
   - Custom interaction sequences
   - State persistence verification
   - Error condition handling

5. 🎪 Leverage test fixtures
   - Form interaction patterns
   - Screenshot capture workflows
   - Error injection scenarios
   - Dynamic content testing

6. 📊 Validate infrastructure health
   - Mock server monitoring
   - Browser capability checks
   - Performance benchmarking
   - Resource cleanup verification

🔗 Key files to examine:
   - setup.ts: Browser automation setup
   - fixtures/common-scenarios.ts: Reusable test scenarios
   - utils/test-helpers.ts: Utility functions
   - mock-server-factory.ts: Mock server creation

📖 To extend this test:
   1. Add new scenarios to NAVIGATION_SCENARIOS
   2. Create custom mock servers with specific behavior
   3. Implement domain-specific test fixtures
   4. Add performance benchmarks for your use cases
   5. Create visual regression test patterns
      `);

      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });
  });
});