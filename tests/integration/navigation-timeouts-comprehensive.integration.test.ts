/**
 * @fileoverview Navigation Timeouts Comprehensive Integration Tests
 *
 * This test suite validates navigation timeout behavior across the APEX browser automation system:
 * - Basic navigation timeout behavior and proper error throwing
 * - Custom timeout configurations and parameter handling
 * - Slow page load scenarios with varying timeout conditions
 * - Graceful timeout error handling and recovery
 * - Integration with different browser types and conditions
 * - Performance characteristics under timeout stress
 *
 * Acceptance Criteria:
 * ✅ Tests pass for timeout scenarios including proper error throwing on timeout
 * ✅ Custom timeout configurations are properly validated
 * ✅ Graceful timeout handling with meaningful error messages
 * ✅ Recovery from timeout failures maintains browser session integrity
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { createBrowserManager, createBrowserSession, type BrowserManager, type BrowserSession } from '../../packages/browser/src/index.js';

describe('Navigation Timeouts - Comprehensive Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let mockServer: Server;
  let baseUrl: string;
  let serverPort: number;
  let manager: BrowserManager;
  let session: BrowserSession;

  // Create mock server that can simulate slow loading and timeouts
  function createTimeoutServer(): Promise<{ server: Server; port: number }> {
    return new Promise((resolve) => {
      const server = createServer((req, res) => {
        const url = req.url || '/';
        const searchParams = new URLSearchParams(url.split('?')[1] || '');
        const delay = parseInt(searchParams.get('delay') || '0');
        const shouldHang = searchParams.get('hang') === 'true';
        const shouldError = searchParams.get('error') === 'true';

        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (shouldHang) {
          // Never respond - simulate hanging connection
          return;
        }

        if (shouldError) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Server Error');
          return;
        }

        // Simulate slow loading
        setTimeout(() => {
          switch (url.split('?')[0]) {
            case '/':
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>Navigation Timeout Test Page</title>
                  </head>
                  <body>
                    <h1 id="title">Test Page Loaded</h1>
                    <p id="load-time">Loaded with ${delay}ms delay</p>
                    <nav>
                      <a href="/page1?delay=100" id="fast-link">Fast Page</a>
                      <a href="/page2?delay=2000" id="slow-link">Slow Page</a>
                      <a href="/page3?hang=true" id="hanging-link">Hanging Page</a>
                      <a href="/page4?error=true" id="error-link">Error Page</a>
                    </nav>
                    <button onclick="setTimeout(() => window.location.href='/delayed', 1000)" id="delayed-nav">
                      Navigate After 1s
                    </button>
                  </body>
                </html>
              `);
              break;

            case '/page1':
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <head><title>Fast Page</title></head>
                  <body>
                    <h1 id="content">Fast Loading Page</h1>
                    <p>This page loaded quickly</p>
                  </body>
                </html>
              `);
              break;

            case '/page2':
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <head><title>Slow Page</title></head>
                  <body>
                    <h1 id="content">Slow Loading Page</h1>
                    <p>This page took ${delay}ms to load</p>
                  </body>
                </html>
              `);
              break;

            case '/delayed':
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <head><title>Delayed Navigation</title></head>
                  <body>
                    <h1 id="content">Delayed Navigation Page</h1>
                    <p>Navigation completed after JavaScript delay</p>
                  </body>
                </html>
              `);
              break;

            default:
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not Found');
          }
        }, delay);
      });

      server.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        resolve({ server, port });
      });
    });
  }

  beforeAll(async () => {
    // Setup test server
    const serverInfo = await createTimeoutServer();
    mockServer = serverInfo.server;
    serverPort = serverInfo.port;
    baseUrl = `http://localhost:${serverPort}`;

    // Setup browser
    browser = await chromium.launch({
      headless: true,
      // Enable more debugging in test environment
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });

    // Setup browser manager
    manager = createBrowserManager();
  });

  afterAll(async () => {
    await browser?.close();
    await manager?.shutdown();
    mockServer?.close();
  });

  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();

    // Create browser session for APEX-specific tests
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 5000, // Default 5 second timeout
    });
    await session.launch();
  });

  afterEach(async () => {
    await context?.close();
    await session?.close();
  });

  describe('Basic Navigation Timeout Behavior', () => {
    it('should timeout when navigation exceeds configured timeout', async () => {
      const timeout = 1000; // 1 second timeout
      const startTime = Date.now();

      // Navigate to page that will take longer than timeout
      const result = await session.navigate(`${baseUrl}/page2?delay=2000`, {
        timeout
      });

      const duration = Date.now() - startTime;

      // Should fail due to timeout
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Should timeout within reasonable margin (1000ms ± 500ms)
      expect(duration).toBeGreaterThan(800);
      expect(duration).toBeLessThan(1500);

      // Error should mention timeout
      expect(result.error).toMatch(/timeout|timed out/i);
    });

    it('should succeed when navigation completes before timeout', async () => {
      const timeout = 2000; // 2 second timeout
      const startTime = Date.now();

      // Navigate to page that loads quickly
      const result = await session.navigate(`${baseUrl}/page1?delay=100`, {
        timeout
      });

      const duration = Date.now() - startTime;

      // Should succeed
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Should complete quickly
      expect(duration).toBeLessThan(1000);

      // Verify page loaded correctly
      const titleResult = await session.getText('h1#content');
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Fast Loading Page');
    });

    it('should handle immediate timeout (zero timeout)', async () => {
      const timeout = 0; // Immediate timeout
      const startTime = Date.now();

      const result = await session.navigate(`${baseUrl}/?delay=100`, {
        timeout
      });

      const duration = Date.now() - startTime;

      // Should fail immediately or very quickly
      expect(result.success).toBe(false);
      expect(duration).toBeLessThan(200);

      // Error should indicate timeout
      expect(result.error).toMatch(/timeout|invalid|failed/i);
    });

    it('should handle very large timeout values gracefully', async () => {
      const timeout = Number.MAX_SAFE_INTEGER; // Very large timeout
      const startTime = Date.now();

      // Navigate to fast-loading page
      const result = await session.navigate(`${baseUrl}/page1?delay=100`, {
        timeout
      });

      const duration = Date.now() - startTime;

      // Should succeed quickly despite large timeout
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Custom Timeout Configuration Tests', () => {
    it('should respect custom timeout values for different operations', async () => {
      const timeoutConfigs = [
        { timeout: 500, expected: 'timeout' },
        { timeout: 1500, expected: 'success' },
        { timeout: 3000, expected: 'success' },
      ];

      for (const config of timeoutConfigs) {
        const startTime = Date.now();

        // Use delay of 1000ms - should timeout for 500ms, succeed for others
        const result = await session.navigate(`${baseUrl}/page1?delay=1000`, {
          timeout: config.timeout
        });

        const duration = Date.now() - startTime;

        if (config.expected === 'timeout') {
          expect(result.success).toBe(false);
          expect(duration).toBeLessThan(800); // Should timeout before 1000ms delay
          expect(result.error).toMatch(/timeout/i);
        } else {
          expect(result.success).toBe(true);
          expect(duration).toBeGreaterThan(800); // Should wait for delay
          expect(duration).toBeLessThan(2000);
        }
      }
    });

    it('should handle fractional timeout values correctly', async () => {
      const fractionalTimeouts = [100.5, 250.25, 500.75];

      for (const timeout of fractionalTimeouts) {
        const startTime = Date.now();

        const result = await session.navigate(`${baseUrl}/?delay=${Math.floor(timeout) + 100}`, {
          timeout
        });

        const duration = Date.now() - startTime;

        // Should timeout before delay completes
        expect(result.success).toBe(false);
        expect(duration).toBeLessThan(timeout + 200);
        expect(result.error).toMatch(/timeout/i);
      }
    });

    it('should handle concurrent navigations with different timeouts', async () => {
      // Create multiple sessions for concurrent testing
      const sessions = await Promise.all([
        createBrowserSession(manager, { browserType: 'chromium', headless: true, timeout: 1000 }),
        createBrowserSession(manager, { browserType: 'chromium', headless: true, timeout: 2000 }),
        createBrowserSession(manager, { browserType: 'chromium', headless: true, timeout: 3000 }),
      ]);

      await Promise.all(sessions.map(s => s.launch()));

      try {
        const startTime = Date.now();
        const results = await Promise.allSettled([
          sessions[0].navigate(`${baseUrl}/page2?delay=1500`, { timeout: 1000 }), // Should timeout
          sessions[1].navigate(`${baseUrl}/page2?delay=1500`, { timeout: 2000 }), // Should succeed
          sessions[2].navigate(`${baseUrl}/page1?delay=100`, { timeout: 3000 }),   // Should succeed fast
        ]);

        // First navigation should timeout
        expect(results[0].status).toBe('fulfilled');
        expect((results[0] as PromiseFulfilledResult<any>).value.success).toBe(false);

        // Second navigation should succeed
        expect(results[1].status).toBe('fulfilled');
        expect((results[1] as PromiseFulfilledResult<any>).value.success).toBe(true);

        // Third navigation should succeed quickly
        expect(results[2].status).toBe('fulfilled');
        expect((results[2] as PromiseFulfilledResult<any>).value.success).toBe(true);
      } finally {
        await Promise.all(sessions.map(s => s.close()));
      }
    });
  });

  describe('Slow Page Load Scenario Tests', () => {
    it('should handle progressively slower page loads with appropriate timeouts', async () => {
      const scenarios = [
        { delay: 500, timeout: 1000, shouldSucceed: true },
        { delay: 1500, timeout: 1000, shouldSucceed: false },
        { delay: 2000, timeout: 1500, shouldSucceed: false },
        { delay: 1000, timeout: 2000, shouldSucceed: true },
      ];

      for (const scenario of scenarios) {
        const startTime = Date.now();
        const result = await session.navigate(`${baseUrl}/page2?delay=${scenario.delay}`, {
          timeout: scenario.timeout
        });
        const duration = Date.now() - startTime;

        if (scenario.shouldSucceed) {
          expect(result.success).toBe(true);
          expect(duration).toBeGreaterThanOrEqual(scenario.delay * 0.8); // Account for timing variations
        } else {
          expect(result.success).toBe(false);
          expect(duration).toBeLessThan(scenario.timeout + 300); // Should timeout before delay
          expect(result.error).toMatch(/timeout/i);
        }
      }
    });

    it('should handle network hanging scenarios', async () => {
      const timeout = 1000;
      const startTime = Date.now();

      // Navigate to page that hangs (never responds)
      const result = await session.navigate(`${baseUrl}/page3?hang=true`, {
        timeout
      });

      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(duration).toBeGreaterThan(800);
      expect(duration).toBeLessThan(1500);
    });

    it('should handle large resource loading timeouts', async () => {
      // Create page with large resources that may timeout
      await page.goto(`data:text/html,${encodeURIComponent(`
        <html>
          <head>
            <title>Large Resource Test</title>
          </head>
          <body>
            <h1>Testing Large Resource Loading</h1>
            <img src="${baseUrl}/large-image.jpg?delay=3000" alt="Large image">
            <script src="${baseUrl}/large-script.js?delay=2000"></script>
            <link rel="stylesheet" href="${baseUrl}/large-style.css?delay=1500">
          </body>
        </html>
      `)}`);

      const timeout = 1000;
      const startTime = Date.now();

      // Navigate using session to test timeout behavior
      const result = await session.navigate(page.url(), { timeout });
      const duration = Date.now() - startTime;

      // May succeed or timeout depending on resource loading
      if (!result.success) {
        expect(duration).toBeLessThan(timeout + 500);
        expect(result.error).toMatch(/timeout|failed/i);
      }
    });

    it('should handle JavaScript-delayed navigation timeouts', async () => {
      // First navigate to base page
      await session.navigate(baseUrl);

      const timeout = 800;
      const startTime = Date.now();

      // Click button that triggers delayed navigation (1000ms delay)
      const clickResult = await session.click('#delayed-nav');
      expect(clickResult.success).toBe(true);

      // Wait for navigation with shorter timeout than JS delay
      const waitResult = await session.waitForNavigation({ timeout });
      const duration = Date.now() - startTime;

      // Should timeout because JS delay (1000ms) > timeout (800ms)
      expect(waitResult.success).toBe(false);
      expect(duration).toBeGreaterThan(600);
      expect(duration).toBeLessThan(1200);
      expect(waitResult.error).toMatch(/timeout/i);
    });
  });

  describe('Timeout Error Handling and Recovery', () => {
    it('should provide meaningful error messages for timeout failures', async () => {
      const scenarios = [
        {
          url: `${baseUrl}/page2?delay=2000`,
          timeout: 500,
          expectedErrorContent: ['timeout', '500']
        },
        {
          url: `${baseUrl}/page3?hang=true`,
          timeout: 1000,
          expectedErrorContent: ['timeout', 'timed out', '1000']
        }
      ];

      for (const scenario of scenarios) {
        const result = await session.navigate(scenario.url, { timeout: scenario.timeout });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        const errorLower = result.error!.toLowerCase();

        // Check for expected error content
        const hasExpectedContent = scenario.expectedErrorContent.some(content =>
          errorLower.includes(content.toLowerCase())
        );
        expect(hasExpectedContent).toBe(true);

        // Error should include timing information
        expect(result.duration).toBeGreaterThan(0);
        expect(typeof result.duration).toBe('number');
      }
    });

    it('should maintain browser session integrity after timeout errors', async () => {
      // Cause a timeout error
      const timeoutResult = await session.navigate(`${baseUrl}/page2?delay=2000`, {
        timeout: 500
      });
      expect(timeoutResult.success).toBe(false);

      // Browser session should still be functional
      const recoveryResult = await session.navigate(`${baseUrl}/page1?delay=100`);
      expect(recoveryResult.success).toBe(true);

      // Should be able to interact with page after recovery
      const titleResult = await session.getText('h1#content');
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Fast Loading Page');

      // Should be able to navigate again
      const secondNavResult = await session.navigate(baseUrl);
      expect(secondNavResult.success).toBe(true);
    });

    it('should handle timeout errors during element interactions after navigation timeout', async () => {
      // Navigate successfully first
      await session.navigate(`${baseUrl}/page1?delay=100`);

      // Try to interact with non-existent element with short timeout
      const interactionResult = await session.click('#non-existent-element', {
        timeout: 200
      });

      expect(interactionResult.success).toBe(false);
      expect(interactionResult.error).toMatch(/timeout|not found|failed/i);

      // Session should still work for valid interactions
      const validResult = await session.getText('h1#content');
      expect(validResult.success).toBe(true);
    });

    it('should handle rapid sequential timeout scenarios', async () => {
      const timeoutDuration = 300;
      const results = [];

      // Perform multiple rapid timeout operations
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const result = await session.navigate(`${baseUrl}/page2?delay=1000`, {
          timeout: timeoutDuration
        });
        const duration = Date.now() - startTime;

        results.push({ result, duration });
      }

      // All should timeout
      results.forEach(({ result, duration }) => {
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/timeout/i);
        expect(duration).toBeLessThan(timeoutDuration + 200);
      });

      // Session should still be functional after rapid timeouts
      const recoveryResult = await session.navigate(`${baseUrl}/page1?delay=100`);
      expect(recoveryResult.success).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle timeout precision under load', async () => {
      const timeout = 500;
      const tolerance = 0.3; // 30% tolerance for timing

      // Run multiple concurrent timeout tests
      const promises = Array(10).fill(0).map(async (_, i) => {
        const startTime = Date.now();
        const result = await session.navigate(`${baseUrl}/page2?delay=1000`, { timeout });
        const duration = Date.now() - startTime;

        return { result, duration, index: i };
      });

      const results = await Promise.all(promises);

      // All should timeout within tolerance
      results.forEach(({ result, duration, index }) => {
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/timeout/i);

        const expectedMin = timeout * (1 - tolerance);
        const expectedMax = timeout * (1 + tolerance);

        expect(duration).toBeGreaterThanOrEqual(expectedMin);
        expect(duration).toBeLessThan(expectedMax + 100); // Small additional buffer
      });
    });

    it('should handle memory cleanup after many timeout operations', async () => {
      const iterations = 20;
      const initialMemory = process.memoryUsage();

      // Perform many timeout operations
      for (let i = 0; i < iterations; i++) {
        const result = await session.navigate(`${baseUrl}/page2?delay=1000`, {
          timeout: 200
        });
        expect(result.success).toBe(false);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be reasonable (< 5MB for timeout operations)
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);

      // Session should still work
      const healthCheck = await session.navigate(`${baseUrl}/page1?delay=100`);
      expect(healthCheck.success).toBe(true);
    });

    it('should handle edge case timeout values', async () => {
      const edgeCases = [
        { timeout: 1, expected: 'timeout' },      // Very small timeout
        { timeout: -1, expected: 'error' },       // Negative timeout
        { timeout: 0.5, expected: 'timeout' },    // Fractional timeout
        { timeout: Infinity, expected: 'skip' },  // Infinite timeout (skip test)
        { timeout: NaN, expected: 'error' },      // Invalid timeout
      ];

      for (const testCase of edgeCases) {
        if (testCase.expected === 'skip') continue;

        const startTime = Date.now();
        const result = await session.navigate(`${baseUrl}/page1?delay=100`, {
          timeout: testCase.timeout
        });
        const duration = Date.now() - startTime;

        if (testCase.expected === 'timeout') {
          expect(result.success).toBe(false);
          expect(result.error).toMatch(/timeout|invalid/i);
          expect(duration).toBeLessThan(500);
        } else if (testCase.expected === 'error') {
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
        }
      }
    });
  });

  describe('Cross-Browser Timeout Consistency', () => {
    it('should handle timeouts consistently across browser configurations', async () => {
      const browserConfigs = [
        { browserType: 'chromium' as const, headless: true },
        { browserType: 'chromium' as const, headless: false },
      ];

      const timeout = 800;
      const results = [];

      for (const config of browserConfigs) {
        const testSession = createBrowserSession(manager, {
          ...config,
          timeout: 5000,
        });

        await testSession.launch();

        try {
          const startTime = Date.now();
          const result = await testSession.navigate(`${baseUrl}/page2?delay=1500`, { timeout });
          const duration = Date.now() - startTime;

          results.push({ config, result, duration });
        } finally {
          await testSession.close();
        }
      }

      // All configurations should timeout consistently
      results.forEach(({ config, result, duration }) => {
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/timeout/i);
        expect(duration).toBeGreaterThan(600);
        expect(duration).toBeLessThan(1200);
      });
    });
  });
});