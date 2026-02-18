/**
 * @fileoverview waitForNavigation Integration Tests
 *
 * This test suite validates the waitForNavigation functionality by testing:
 * - Click-triggered navigation (link clicks, button clicks)
 * - Form-triggered navigation (GET/POST submissions)
 * - Programmatic navigation (JavaScript location changes, history API)
 * - URL pattern matching (string, RegExp, wildcard patterns)
 * - Wait states (load, domcontentloaded, networkidle, commit)
 * - Error handling and edge cases
 * - Page state verification after navigation
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

describe('waitForNavigation Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let mockServer: Server;
  let baseUrl: string;
  let serverPort: number;

  // Create mock server for HTTP-based navigation tests
  function createMockNavigationServer(): Promise<{ server: Server; port: number }> {
    return new Promise((resolve) => {
      const server = createServer((req, res) => {
        const url = req.url || '/';

        // CORS headers for cross-origin requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Handle preflight requests
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        // Route handling
        switch (url) {
          case '/':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Navigation Test Home</title></head>
                <body>
                  <h1>Home Page</h1>
                  <a id="nav-link" href="/target">Go to Target</a>
                  <button id="js-nav-btn" onclick="window.location.href='/target'">JS Navigate</button>
                  <form id="search-form" action="/search" method="GET">
                    <input id="search-input" name="q" value="test">
                    <button type="submit">Search</button>
                  </form>
                  <form id="post-form" action="/redirect-source" method="POST">
                    <input name="data" value="test">
                    <button type="submit">Post Form</button>
                  </form>
                </body>
              </html>
            `);
            break;

          case '/target':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Target Page</title></head>
                <body><h1>Welcome to Target</h1></body>
              </html>
            `);
            break;

          case '/link-test':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Link Test</title></head>
                <body>
                  <a id="basic-link" href="/target">Basic Link</a>
                  <a id="query-link" href="/search?q=linktest">Link with Query</a>
                  <a id="hash-link" href="/target#section1">Link with Hash</a>
                  <button id="onclick-btn" onclick="window.location='/target'">Button with onclick</button>
                </body>
              </html>
            `);
            break;

          case '/form-test':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Form Test</title></head>
                <body>
                  <form id="get-form" action="/search" method="GET">
                    <input name="q" value="formtest">
                    <button id="get-submit" type="submit">GET Submit</button>
                  </form>
                  <form id="post-form" action="/redirect-source" method="POST">
                    <input name="data" value="posttest">
                    <button id="post-submit" type="submit">POST Submit</button>
                  </form>
                </body>
              </html>
            `);
            break;

          case '/programmatic-test':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Programmatic Test</title></head>
                <body>
                  <button id="location-href-btn" onclick="window.location.href='/target'">location.href</button>
                  <button id="location-replace-btn" onclick="window.location.replace('/target')">location.replace</button>
                  <button id="pushstate-btn" onclick="history.pushState({}, '', '/target')">pushState</button>
                  <button id="delayed-nav-btn" onclick="setTimeout(() => window.location.href='/target', 100)">Delayed Nav</button>
                  <script>
                    function navigateAfterDelay() {
                      setTimeout(() => { window.location.href = '/target'; }, 100);
                    }
                  </script>
                </body>
              </html>
            `);
            break;

          case '/search':
            const urlObj = new URL(`http://localhost${url}`);
            const query = urlObj.searchParams.get('q') || 'none';
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Search Results</title></head>
                <body>
                  <h1>Search Results</h1>
                  <p>Query: ${query}</p>
                </body>
              </html>
            `);
            break;

          case '/redirect-source':
            res.writeHead(302, { 'Location': '/target' });
            res.end();
            break;

          case '/slow':
            setTimeout(() => {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <head><title>Slow Page</title></head>
                  <body>
                    <h1>Loaded after delay</h1>
                    <script>
                      // Simulate network activity
                      setTimeout(() => {
                        fetch('/api/data').catch(() => {});
                      }, 100);
                    </script>
                  </body>
                </html>
              `);
            }, 2000);
            break;

          case '/spa-app':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>SPA App</title></head>
                <body>
                  <div id="content">Loading...</div>
                  <a id="dashboard-link" href="/dashboard">Dashboard</a>
                  <script>
                    // Simulate SPA navigation
                    document.getElementById('dashboard-link').addEventListener('click', (e) => {
                      e.preventDefault();
                      history.pushState({}, '', '/dashboard');
                      setTimeout(() => {
                        document.getElementById('content').innerHTML = '<div id="dashboard-content">Dashboard loaded</div>';
                        document.title = 'Dashboard';
                      }, 200);
                    });
                  </script>
                </body>
              </html>
            `);
            break;

          case '/dashboard':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Dashboard</title></head>
                <body>
                  <div id="dashboard-content">Dashboard Content</div>
                </body>
              </html>
            `);
            break;

          default:
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Not Found</title></head>
                <body><h1>Page Not Found</h1></body>
              </html>
            `);
        }
      });

      server.listen(0, () => {
        const address = server.address() as AddressInfo;
        resolve({ server, port: address.port });
      });
    });
  }

  beforeAll(async () => {
    // Start mock server for HTTP-based tests
    const serverInfo = await createMockNavigationServer();
    mockServer = serverInfo.server;
    serverPort = serverInfo.port;
    baseUrl = `http://localhost:${serverPort}`;
  });

  afterAll(async () => {
    mockServer.close();
  });

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
    page.setDefaultTimeout(10000);
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  describe('Click-Triggered Navigation', () => {
    it('should wait for navigation triggered by link click', async () => {
      await page.goto(`${baseUrl}/link-test`);

      // Navigate using link click
      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#basic-link')
      ]);

      // Verify navigation completed correctly
      expect(page.url()).toContain('/target');
      expect(await page.title()).toBe('Target Page');
      expect(await page.textContent('h1')).toBe('Welcome to Target');
    });

    it('should wait for navigation triggered by button onclick', async () => {
      await page.goto(`${baseUrl}/link-test`);

      // Navigate using button with onclick handler
      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#onclick-btn')
      ]);

      // Verify navigation completed correctly
      expect(page.url()).toContain('/target');
      expect(await page.title()).toBe('Target Page');
    });

    it('should wait for navigation with query parameters', async () => {
      await page.goto(`${baseUrl}/link-test`);

      // Navigate using link with query parameters
      await Promise.all([
        page.waitForURL('**/search?q=*'),
        page.click('#query-link')
      ]);

      // Verify navigation completed with query params
      expect(page.url()).toContain('/search?q=linktest');
      expect(await page.title()).toBe('Search Results');
      expect(await page.textContent('p')).toContain('linktest');
    });

    it('should wait for navigation with hash fragments', async () => {
      await page.goto(`${baseUrl}/link-test`);

      // Navigate using link with hash fragment
      await Promise.all([
        page.waitForURL('**/target#section1'),
        page.click('#hash-link')
      ]);

      // Verify navigation completed with hash
      expect(page.url()).toContain('/target#section1');
      expect(await page.title()).toBe('Target Page');
    });
  });

  describe('Form-Triggered Navigation', () => {
    it('should wait for navigation triggered by GET form submission', async () => {
      await page.goto(`${baseUrl}/form-test`);

      // Submit GET form
      await Promise.all([
        page.waitForURL('**/search?q=*'),
        page.click('#get-submit')
      ]);

      // Verify GET form navigation
      expect(page.url()).toContain('/search?q=formtest');
      expect(await page.title()).toBe('Search Results');
      expect(await page.textContent('p')).toContain('formtest');
    });

    it('should wait for navigation triggered by POST form submission with redirect', async () => {
      await page.goto(`${baseUrl}/form-test`);

      // Submit POST form (will redirect to /target)
      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#post-submit')
      ]);

      // Verify POST form navigation with redirect
      expect(page.url()).toContain('/target');
      expect(await page.title()).toBe('Target Page');
    });

    it('should wait for navigation with form action URL', async () => {
      await page.goto(`${baseUrl}/`);

      // Fill and submit search form
      await page.fill('#search-input', 'customquery');
      await Promise.all([
        page.waitForURL('**/search?q=*'),
        page.click('button[type="submit"]')
      ]);

      // Verify form action navigation
      expect(page.url()).toContain('/search?q=customquery');
      expect(await page.textContent('p')).toContain('customquery');
    });

    it('should handle form submission with dynamic action', async () => {
      const testHtml = `
        <html>
          <body>
            <form id="dynamic-form" method="GET">
              <input name="q" value="dynamic">
              <button id="submit-btn" type="button" onclick="submitForm()">Submit</button>
            </form>
            <script>
              function submitForm() {
                document.getElementById('dynamic-form').action = '${baseUrl}/search';
                document.getElementById('dynamic-form').submit();
              }
            </script>
          </body>
        </html>
      `;
      await page.setContent(testHtml);

      await Promise.all([
        page.waitForURL('**/search?q=*'),
        page.click('#submit-btn')
      ]);

      expect(page.url()).toContain('/search?q=dynamic');
    });
  });

  describe('Programmatic Navigation', () => {
    it('should wait for navigation via window.location.href', async () => {
      await page.goto(`${baseUrl}/programmatic-test`);

      // Trigger navigation via location.href
      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#location-href-btn')
      ]);

      // Verify programmatic navigation
      expect(page.url()).toContain('/target');
      expect(await page.title()).toBe('Target Page');
    });

    it('should wait for navigation via window.location.replace', async () => {
      await page.goto(`${baseUrl}/programmatic-test`);

      // Trigger navigation via location.replace
      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#location-replace-btn')
      ]);

      // Verify replace navigation
      expect(page.url()).toContain('/target');
      expect(await page.title()).toBe('Target Page');
    });

    it('should wait for delayed programmatic navigation', async () => {
      await page.goto(`${baseUrl}/programmatic-test`);

      // Trigger delayed navigation
      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#delayed-nav-btn')
      ]);

      // Verify delayed navigation completed
      expect(page.url()).toContain('/target');
      expect(await page.title()).toBe('Target Page');
    });

    it('should handle navigation with data URLs', async () => {
      const startHtml = `
        <html>
          <head><title>Start Page</title></head>
          <body>
            <button id="data-nav-btn" onclick="window.location.href='data:text/html,<title>Data Target</title><h1>Data Page</h1>'">
              Navigate to Data URL
            </button>
          </body>
        </html>
      `;
      await page.setContent(startHtml);

      await Promise.all([
        page.waitForURL('data:text/html,*'),
        page.click('#data-nav-btn')
      ]);

      expect(await page.title()).toBe('Data Target');
      expect(await page.textContent('h1')).toBe('Data Page');
    });

    it('should handle JavaScript setTimeout navigation', async () => {
      const testHtml = `
        <html>
          <body>
            <button id="timeout-nav-btn" onclick="setTimeout(() => location.href = '${baseUrl}/target', 150)">
              Delayed Navigate
            </button>
          </body>
        </html>
      `;
      await page.setContent(testHtml);

      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#timeout-nav-btn')
      ]);

      expect(page.url()).toContain('/target');
      expect(await page.title()).toBe('Target Page');
    });
  });

  describe('URL Pattern Matching', () => {
    it('should match exact URL strings', async () => {
      await page.goto(`${baseUrl}/link-test`);

      await Promise.all([
        page.waitForURL(`${baseUrl}/target`),
        page.click('#basic-link')
      ]);

      expect(page.url()).toBe(`${baseUrl}/target`);
    });

    it('should match URL using glob patterns', async () => {
      await page.goto(`${baseUrl}/link-test`);

      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#basic-link')
      ]);

      expect(page.url()).toContain('/target');
    });

    it('should match URL using RegExp patterns', async () => {
      await page.goto(`${baseUrl}/link-test`);

      await Promise.all([
        page.waitForURL(/\/target$/),
        page.click('#basic-link')
      ]);

      expect(page.url()).toMatch(/\/target$/);
    });

    it('should match search URLs with query parameters using RegExp', async () => {
      await page.goto(`${baseUrl}/link-test`);

      await Promise.all([
        page.waitForURL(/\/search\?q=.+/),
        page.click('#query-link')
      ]);

      expect(page.url()).toMatch(/\/search\?q=linktest/);
    });

    it('should match any URL with wildcard pattern', async () => {
      await page.goto(`${baseUrl}/link-test`);

      await Promise.all([
        page.waitForURL('**/*'),
        page.click('#basic-link')
      ]);

      // Should match any URL change
      expect(page.url()).not.toBe(`${baseUrl}/link-test`);
    });
  });

  describe('Wait States', () => {
    it('should wait until load state by default', async () => {
      await page.goto(`${baseUrl}/link-test`);

      await Promise.all([
        page.waitForURL('**/target', { waitUntil: 'load' }),
        page.click('#basic-link')
      ]);

      // Page should be fully loaded
      expect(await page.title()).toBe('Target Page');
      expect(await page.textContent('h1')).toBe('Welcome to Target');
    });

    it('should wait until domcontentloaded state', async () => {
      await page.goto(`${baseUrl}/link-test`);

      await Promise.all([
        page.waitForURL('**/target', { waitUntil: 'domcontentloaded' }),
        page.click('#basic-link')
      ]);

      // DOM should be loaded
      expect(await page.title()).toBe('Target Page');
    });

    it('should wait until networkidle state for dynamic content', async () => {
      await page.goto(`${baseUrl}/`);

      await Promise.all([
        page.waitForURL('**/slow', { waitUntil: 'networkidle', timeout: 15000 }),
        page.evaluate(() => { window.location.href = '/slow'; })
      ]);

      // Network should be idle
      expect(await page.title()).toBe('Slow Page');
      expect(await page.textContent('h1')).toBe('Loaded after delay');
    });

    it('should wait until commit state for fastest response', async () => {
      await page.goto(`${baseUrl}/link-test`);

      await Promise.all([
        page.waitForURL('**/target', { waitUntil: 'commit' }),
        page.click('#basic-link')
      ]);

      // Response should be received (commit happened)
      expect(page.url()).toContain('/target');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle navigation timeout gracefully', async () => {
      const testHtml = '<div>Static page - no navigation</div>';
      await page.setContent(testHtml);

      // Attempt to wait for navigation that never happens
      const startTime = Date.now();

      await expect(
        page.waitForURL('**/never-exists', { timeout: 1000 })
      ).rejects.toThrow();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(900);
      expect(elapsed).toBeLessThan(2000);
    });

    it('should handle rapid navigation changes', async () => {
      await page.goto(`${baseUrl}/`);

      // Trigger multiple rapid navigations
      await page.evaluate(() => {
        window.location.href = '/target';
        // Immediate second navigation
        setTimeout(() => window.location.href = '/search?q=rapid', 10);
      });

      // Should settle on the final navigation
      await page.waitForURL('**/search?q=rapid');
      expect(page.url()).toContain('/search?q=rapid');
    });

    it('should handle navigation cancellation', async () => {
      await page.goto(`${baseUrl}/link-test`);

      // Start navigation then immediately navigate elsewhere
      const navigationPromise = page.waitForURL('**/target');
      page.click('#basic-link');

      // Immediately navigate to a different page
      setTimeout(() => page.goto(`${baseUrl}/search?q=cancel`), 50);

      // Should eventually resolve to one of the URLs
      await navigationPromise;
      expect(page.url()).toBeTruthy(); // Should have some valid URL
    });

    it('should handle navigation to non-existent pages', async () => {
      await page.goto(`${baseUrl}/`);

      await Promise.all([
        page.waitForURL('**/nonexistent'),
        page.evaluate(() => { window.location.href = '/nonexistent'; })
      ]);

      // Navigation succeeds but returns 404 content
      expect(page.url()).toContain('/nonexistent');
      expect(await page.textContent('h1')).toBe('Page Not Found');
    });

    it('should handle navigation with network errors', async () => {
      await page.goto(`${baseUrl}/`);

      // Try to navigate to invalid host (will fail)
      await expect(
        Promise.all([
          page.waitForURL('**/*', { timeout: 2000 }),
          page.evaluate(() => { window.location.href = 'http://invalid-host-12345/'; })
        ])
      ).rejects.toThrow();
    });

    it('should handle browser context closing during navigation', async () => {
      await page.goto(`${baseUrl}/link-test`);

      // Start navigation and immediately close context
      const navigationPromise = page.waitForURL('**/target');
      page.click('#basic-link');

      // Close context shortly after
      setTimeout(() => context.close(), 100);

      await expect(navigationPromise).rejects.toThrow();
    });
  });

  describe('Page State Verification', () => {
    it('should verify complete page state after navigation', async () => {
      await page.goto(`${baseUrl}/link-test`);

      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#basic-link')
      ]);

      // Comprehensive state verification
      expect(page.url()).toContain('/target');
      expect(await page.title()).toBe('Target Page');
      expect(await page.textContent('h1')).toBe('Welcome to Target');

      // Check navigation history
      const historyLength = await page.evaluate(() => history.length);
      expect(historyLength).toBeGreaterThan(1);

      // Verify page is interactive
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    });

    it('should verify URL changes are correct', async () => {
      const startUrl = `${baseUrl}/link-test`;
      await page.goto(startUrl);

      const originalUrl = page.url();
      expect(originalUrl).toBe(startUrl);

      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#basic-link')
      ]);

      const newUrl = page.url();
      expect(newUrl).not.toBe(originalUrl);
      expect(newUrl).toContain('/target');
    });

    it('should verify page title changes correctly', async () => {
      await page.goto(`${baseUrl}/link-test`);

      const originalTitle = await page.title();
      expect(originalTitle).toBe('Link Test');

      await Promise.all([
        page.waitForURL('**/search?q=*'),
        page.click('#query-link')
      ]);

      const newTitle = await page.title();
      expect(newTitle).not.toBe(originalTitle);
      expect(newTitle).toBe('Search Results');
    });

    it('should verify content changes after navigation', async () => {
      await page.goto(`${baseUrl}/link-test`);

      const originalH1 = await page.textContent('title');
      expect(originalH1).toBe('Link Test');

      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#basic-link')
      ]);

      const newH1 = await page.textContent('h1');
      expect(newH1).toBe('Welcome to Target');

      // Verify specific element exists
      const targetElement = await page.locator('h1').textContent();
      expect(targetElement).toBe('Welcome to Target');
    });

    it('should verify history state after navigation', async () => {
      await page.goto(`${baseUrl}/link-test`);

      const initialHistoryLength = await page.evaluate(() => history.length);

      // Navigate to another page
      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#basic-link')
      ]);

      const finalHistoryLength = await page.evaluate(() => history.length);
      expect(finalHistoryLength).toBeGreaterThan(initialHistoryLength);

      // Test back navigation capability
      const canGoBack = await page.evaluate(() => history.length > 1);
      expect(canGoBack).toBe(true);
    });

    it('should verify page load performance metrics', async () => {
      await page.goto(`${baseUrl}/link-test`);

      const startTime = Date.now();

      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#basic-link')
      ]);

      const loadTime = Date.now() - startTime;

      // Navigation should complete in reasonable time
      expect(loadTime).toBeGreaterThan(0);
      expect(loadTime).toBeLessThan(5000); // 5 second max

      // Verify page performance metrics are available
      const performanceMetrics = await page.evaluate(() => {
        return {
          loadEventEnd: performance.timing.loadEventEnd,
          navigationStart: performance.timing.navigationStart,
        };
      });

      expect(performanceMetrics.loadEventEnd).toBeGreaterThan(0);
      expect(performanceMetrics.navigationStart).toBeGreaterThan(0);
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle multi-step navigation workflow', async () => {
      // Start at home page
      await page.goto(`${baseUrl}/`);
      expect(await page.title()).toBe('Navigation Test Home');

      // Step 1: Navigate via link
      await Promise.all([
        page.waitForURL('**/target'),
        page.click('#nav-link')
      ]);
      expect(page.url()).toContain('/target');

      // Step 2: Go back to home
      await Promise.all([
        page.waitForURL(baseUrl + '/'),
        page.goBack()
      ]);
      expect(page.url()).toBe(`${baseUrl}/`);

      // Step 3: Navigate via form submission
      await page.fill('#search-input', 'workflow');
      await Promise.all([
        page.waitForURL('**/search?q=workflow'),
        page.click('button[type="submit"]')
      ]);
      expect(page.url()).toContain('/search?q=workflow');

      // Verify complete workflow state
      const historyLength = await page.evaluate(() => history.length);
      expect(historyLength).toBeGreaterThanOrEqual(3);
    });

    it('should handle navigation with concurrent operations', async () => {
      await page.goto(`${baseUrl}/link-test`);

      // Perform navigation while other async operations are running
      const concurrentPromises = [
        page.waitForURL('**/target'),
        page.click('#basic-link'),
        page.evaluate(() => {
          // Simulate other async operations
          return new Promise(resolve => {
            setTimeout(() => resolve('concurrent-operation'), 100);
          });
        })
      ];

      const results = await Promise.all(concurrentPromises);

      expect(page.url()).toContain('/target');
      expect(results[2]).toBe('concurrent-operation');
    });
  });
});