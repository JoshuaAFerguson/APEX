/**
 * @apexcli/browser - Comprehensive Redirect Handling Integration Tests
 *
 * Tests comprehensive redirect handling including:
 * - HTTP redirects (301, 302, 307, 308)
 * - JavaScript redirects (location.href, location.replace)
 * - Meta refresh redirects
 * - Redirect chains with proper final URL verification
 * - Redirect loop detection and timeout handling
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { createBrowserSession, BrowserSession } from '../index.js';
import http from 'http';
import { AddressInfo } from 'net';

describe('Redirect Handling Integration Tests', () => {
  let session: BrowserSession;
  let testServer: http.Server;
  let serverBaseUrl: string;
  let serverPort: number;

  // Test server implementation for HTTP redirects
  const createTestServer = (): Promise<{ server: http.Server; port: number; baseUrl: string }> => {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://localhost`);
        const path = url.pathname;
        const queryParams = url.searchParams;

        console.log(`Test server: ${req.method} ${path}`);

        // Handle different redirect scenarios
        switch (path) {
          // HTTP 301 Permanent Redirect
          case '/redirect-301':
            res.writeHead(301, { 'Location': '/final-destination' });
            res.end();
            break;

          // HTTP 302 Found (Temporary Redirect)
          case '/redirect-302':
            res.writeHead(302, { 'Location': '/final-destination' });
            res.end();
            break;

          // HTTP 307 Temporary Redirect (Method Preserved)
          case '/redirect-307':
            res.writeHead(307, { 'Location': '/final-destination' });
            res.end();
            break;

          // HTTP 308 Permanent Redirect (Method Preserved)
          case '/redirect-308':
            res.writeHead(308, { 'Location': '/final-destination' });
            res.end();
            break;

          // Final destination page
          case '/final-destination':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Final Destination</title></head>
                <body>
                  <h1>Redirect Success</h1>
                  <div id="status">reached-final-destination</div>
                  <div id="url">${req.url}</div>
                </body>
              </html>
            `);
            break;

          // JavaScript redirect test pages
          case '/js-redirect-href':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>JS Redirect Href</title></head>
                <body>
                  <h1>Redirecting via location.href...</h1>
                  <script>
                    setTimeout(() => {
                      window.location.href = '/final-destination';
                    }, 100);
                  </script>
                </body>
              </html>
            `);
            break;

          case '/js-redirect-replace':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>JS Redirect Replace</title></head>
                <body>
                  <h1>Redirecting via location.replace...</h1>
                  <script>
                    setTimeout(() => {
                      window.location.replace('/final-destination');
                    }, 100);
                  </script>
                </body>
              </html>
            `);
            break;

          // Meta refresh redirect test pages
          case '/meta-refresh-immediate':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head>
                  <title>Meta Refresh Immediate</title>
                  <meta http-equiv="refresh" content="0; url=/final-destination">
                </head>
                <body>
                  <h1>Redirecting via meta refresh (immediate)...</h1>
                </body>
              </html>
            `);
            break;

          case '/meta-refresh-delayed':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head>
                  <title>Meta Refresh Delayed</title>
                  <meta http-equiv="refresh" content="1; url=/final-destination">
                </head>
                <body>
                  <h1>Redirecting via meta refresh (1 second delay)...</h1>
                </body>
              </html>
            `);
            break;

          // Redirect chain test pages
          case '/chain-start':
            res.writeHead(302, { 'Location': '/chain-middle' });
            res.end();
            break;

          case '/chain-middle':
            res.writeHead(302, { 'Location': '/chain-end' });
            res.end();
            break;

          case '/chain-end':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Chain End</title></head>
                <body>
                  <h1>Redirect Chain Complete</h1>
                  <div id="chain-status">chain-completed</div>
                </body>
              </html>
            `);
            break;

          // Mixed redirect chain (HTTP + JS)
          case '/mixed-chain-start':
            res.writeHead(302, { 'Location': '/mixed-chain-js' });
            res.end();
            break;

          case '/mixed-chain-js':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Mixed Chain JS</title></head>
                <body>
                  <h1>JS Part of Mixed Chain</h1>
                  <script>
                    setTimeout(() => {
                      window.location.href = '/final-destination';
                    }, 100);
                  </script>
                </body>
              </html>
            `);
            break;

          // Redirect loop test (for timeout testing)
          case '/loop-a':
            res.writeHead(302, { 'Location': '/loop-b' });
            res.end();
            break;

          case '/loop-b':
            res.writeHead(302, { 'Location': '/loop-a' });
            res.end();
            break;

          // Test page with custom query parameters
          case '/redirect-with-query':
            const targetQuery = queryParams.get('target') || '/final-destination';
            res.writeHead(302, { 'Location': `${targetQuery}?redirected=true` });
            res.end();
            break;

          // Default 404 response
          default:
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Not Found</title></head>
                <body><h1>404 - Page Not Found</h1><p>Path: ${path}</p></body>
              </html>
            `);
        }
      });

      server.listen(0, () => {
        const address = server.address() as AddressInfo;
        const port = address.port;
        const baseUrl = `http://localhost:${port}`;
        resolve({ server, port, baseUrl });
      });

      server.on('error', reject);
    });
  };

  beforeAll(async () => {
    // Start test server
    const serverInfo = await createTestServer();
    testServer = serverInfo.server;
    serverPort = serverInfo.port;
    serverBaseUrl = serverInfo.baseUrl;
    console.log(`Test server started on ${serverBaseUrl}`);
  });

  afterAll(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => {
        testServer.close(() => resolve());
      });
      console.log('Test server stopped');
    }
  });

  beforeEach(async () => {
    session = createBrowserSession({
      headless: true,
      timeout: 10000,
    });
    await session.launch();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
  });

  describe('HTTP Redirect Status Codes', () => {
    it('should handle HTTP 301 Permanent Redirect correctly', async () => {
      const result = await session.navigate(`${serverBaseUrl}/redirect-301`);

      expect(result.success).toBe(true);
      expect(result.data).toBe(`${serverBaseUrl}/final-destination`);

      // Verify we reached the final destination
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Final Destination');

      const statusElement = await session.getText('#status');
      expect(statusElement.success).toBe(true);
      expect(statusElement.data).toBe('reached-final-destination');
    }, 15000);

    it('should handle HTTP 302 Found (Temporary) Redirect correctly', async () => {
      const result = await session.navigate(`${serverBaseUrl}/redirect-302`);

      expect(result.success).toBe(true);
      expect(result.data).toBe(`${serverBaseUrl}/final-destination`);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Final Destination');
    }, 15000);

    it('should handle HTTP 307 Temporary Redirect correctly', async () => {
      const result = await session.navigate(`${serverBaseUrl}/redirect-307`);

      expect(result.success).toBe(true);
      expect(result.data).toBe(`${serverBaseUrl}/final-destination`);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Final Destination');
    }, 15000);

    it('should handle HTTP 308 Permanent Redirect correctly', async () => {
      const result = await session.navigate(`${serverBaseUrl}/redirect-308`);

      expect(result.success).toBe(true);
      expect(result.data).toBe(`${serverBaseUrl}/final-destination`);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Final Destination');
    }, 15000);
  });

  describe('JavaScript Redirects', () => {
    it('should handle location.href redirects', async () => {
      const result = await session.navigate(`${serverBaseUrl}/js-redirect-href`);
      expect(result.success).toBe(true);

      // Wait for JavaScript redirect to complete
      await session.waitForNavigation({ timeout: 5000 });

      const currentUrl = session.getCurrentUrl();
      expect(currentUrl).toBe(`${serverBaseUrl}/final-destination`);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Final Destination');
    }, 15000);

    it('should handle location.replace redirects', async () => {
      const result = await session.navigate(`${serverBaseUrl}/js-redirect-replace`);
      expect(result.success).toBe(true);

      // Wait for JavaScript redirect to complete
      await session.waitForNavigation({ timeout: 5000 });

      const currentUrl = session.getCurrentUrl();
      expect(currentUrl).toBe(`${serverBaseUrl}/final-destination`);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Final Destination');
    }, 15000);
  });

  describe('Meta Refresh Redirects', () => {
    it('should handle immediate meta refresh redirects', async () => {
      const result = await session.navigate(`${serverBaseUrl}/meta-refresh-immediate`);
      expect(result.success).toBe(true);

      // Wait for meta refresh redirect to complete
      await session.waitForNavigation({ timeout: 5000 });

      const currentUrl = session.getCurrentUrl();
      expect(currentUrl).toBe(`${serverBaseUrl}/final-destination`);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Final Destination');
    }, 15000);

    it('should handle delayed meta refresh redirects', async () => {
      const result = await session.navigate(`${serverBaseUrl}/meta-refresh-delayed`);
      expect(result.success).toBe(true);

      // Wait for meta refresh redirect to complete (1 second delay + buffer)
      await session.waitForNavigation({ timeout: 5000 });

      const currentUrl = session.getCurrentUrl();
      expect(currentUrl).toBe(`${serverBaseUrl}/final-destination`);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Final Destination');
    }, 15000);
  });

  describe('Redirect Chains', () => {
    it('should handle HTTP redirect chains correctly', async () => {
      const result = await session.navigate(`${serverBaseUrl}/chain-start`);

      expect(result.success).toBe(true);
      // Should follow the chain: /chain-start -> /chain-middle -> /chain-end
      expect(result.data).toBe(`${serverBaseUrl}/chain-end`);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Chain End');

      const chainStatus = await session.getText('#chain-status');
      expect(chainStatus.success).toBe(true);
      expect(chainStatus.data).toBe('chain-completed');
    }, 15000);

    it('should handle mixed redirect chains (HTTP + JavaScript)', async () => {
      const result = await session.navigate(`${serverBaseUrl}/mixed-chain-start`);
      expect(result.success).toBe(true);

      // Wait for JavaScript part of the chain to complete
      await session.waitForNavigation({ timeout: 5000 });

      const currentUrl = session.getCurrentUrl();
      expect(currentUrl).toBe(`${serverBaseUrl}/final-destination`);

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Final Destination');
    }, 15000);

    it('should track final URL correctly through redirect chains', async () => {
      const initialUrl = `${serverBaseUrl}/chain-start`;
      const result = await session.navigate(initialUrl);

      expect(result.success).toBe(true);
      expect(result.data).not.toBe(initialUrl); // Should be different from initial URL
      expect(result.data).toBe(`${serverBaseUrl}/chain-end`); // Should be final destination
    }, 15000);
  });

  describe('Redirect Edge Cases and Error Handling', () => {
    it('should handle redirects with query parameters', async () => {
      const result = await session.navigate(`${serverBaseUrl}/redirect-with-query?target=/final-destination`);

      expect(result.success).toBe(true);
      expect(result.data).toContain(`${serverBaseUrl}/final-destination`);
      expect(result.data).toContain('redirected=true');

      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);
      expect(titleResult.data).toBe('Final Destination');
    }, 15000);

    it('should detect and handle redirect loops with timeout', async () => {
      const result = await session.navigate(`${serverBaseUrl}/loop-a`, { timeout: 3000 });

      // Should fail due to timeout from infinite redirect loop
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('timeout');
    }, 15000);

    it('should handle invalid redirect targets gracefully', async () => {
      const result = await session.navigate(`${serverBaseUrl}/redirect-with-query?target=invalid://url`);

      // Should either fail gracefully or navigate to a valid fallback
      if (!result.success) {
        expect(result.error).toBeTruthy();
      } else {
        // If it succeeds, verify we're on a valid page
        const currentUrl = session.getCurrentUrl();
        expect(currentUrl).toBeTruthy();
      }
    }, 15000);
  });

  describe('Final URL Verification', () => {
    it('should provide accurate final URL after HTTP redirects', async () => {
      const tests = [
        { path: '/redirect-301', expected: '/final-destination' },
        { path: '/redirect-302', expected: '/final-destination' },
        { path: '/redirect-307', expected: '/final-destination' },
        { path: '/redirect-308', expected: '/final-destination' },
      ];

      for (const test of tests) {
        const result = await session.navigate(`${serverBaseUrl}${test.path}`);
        expect(result.success).toBe(true);
        expect(result.data).toBe(`${serverBaseUrl}${test.expected}`);
      }
    }, 30000);

    it('should provide accurate final URL after JavaScript redirects', async () => {
      // Test JavaScript redirect final URL
      const result = await session.navigate(`${serverBaseUrl}/js-redirect-href`);
      expect(result.success).toBe(true);

      await session.waitForNavigation({ timeout: 5000 });

      const finalUrl = session.getCurrentUrl();
      expect(finalUrl).toBe(`${serverBaseUrl}/final-destination`);
    }, 15000);

    it('should track redirect history and final destination', async () => {
      // Start with a chain and verify we can track the final URL
      const initialUrl = `${serverBaseUrl}/chain-start`;
      const result = await session.navigate(initialUrl);

      expect(result.success).toBe(true);

      // Get current URL to verify final destination
      const currentUrlResult = session.getCurrentUrl();
      expect(currentUrlResult).toBe(`${serverBaseUrl}/chain-end`);

      // Verify the navigate result also returns the final URL
      expect(result.data).toBe(currentUrlResult);
    }, 15000);
  });
});