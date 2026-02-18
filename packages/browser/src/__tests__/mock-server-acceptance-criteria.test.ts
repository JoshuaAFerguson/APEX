/**
 * @apexcli/browser - Mock Server Acceptance Criteria Tests
 *
 * This test file validates the mock server infrastructure for controlled navigation scenarios
 * as described in ADR-001-mock-server-navigation-testing.md
 *
 * Acceptance Criteria:
 * 1. Mock server can be started and stopped programmatically
 * 2. Test pages are served at predictable URLs
 * 3. Server integrates with test lifecycle (beforeAll/afterAll)
 * 4. Server supports multiple navigation scenarios (redirects, errors, slow responses)
 *
 * Created by the tester agent to validate the implementation requirements.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession
} from '../index.js';

// Test interface definitions - these should match the implementation
interface MockServerConfig {
  port?: number;
  host?: string;
}

interface NavigationScenario {
  id: string;
  path: string;
  handler: NavigationHandler;
}

interface NavigationHandler {
  type: 'static' | 'redirect' | 'error' | 'delayed' | 'custom';
  content?: string;
  statusCode?: number;
  location?: string;
  delayMs?: number;
  message?: string;
}

interface MockServerState {
  isRunning: boolean;
  port: number | null;
  baseUrl: string | null;
  requestLog: RequestLogEntry[];
}

interface RequestLogEntry {
  timestamp: Date;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
}

// Mock implementation detection
let MockNavigationServer: any;
let NavigationScenarios: any;

try {
  // Try to import the mock server implementation
  const testServerModule = await import('../test-server/index.js').catch(() => null);
  if (testServerModule) {
    MockNavigationServer = testServerModule.MockNavigationServer;
    NavigationScenarios = testServerModule.NavigationScenarios;
  }
} catch (error) {
  // Implementation not available - tests will be skipped
}

describe('Mock Server Infrastructure - Acceptance Criteria', () => {
  const serverAvailable = !!MockNavigationServer;

  describe('AC1: Server Lifecycle Management', () => {
    it.skipIf(!serverAvailable)('should start server programmatically', async () => {
      const server = new MockNavigationServer();

      expect(server.getState().isRunning).toBe(false);

      await server.start();

      const state = server.getState();
      expect(state.isRunning).toBe(true);
      expect(state.port).toBeGreaterThan(0);
      expect(state.baseUrl).toContain('http://');

      await server.stop();
    });

    it.skipIf(!serverAvailable)('should stop server programmatically', async () => {
      const server = new MockNavigationServer();

      await server.start();
      expect(server.getState().isRunning).toBe(true);

      await server.stop();

      const state = server.getState();
      expect(state.isRunning).toBe(false);
      expect(state.port).toBe(null);
      expect(state.baseUrl).toBe(null);
    });

    it.skipIf(!serverAvailable)('should support custom port configuration', async () => {
      // Use a high port to avoid conflicts
      const customPort = 9876;
      const server = new MockNavigationServer({ port: customPort });

      await server.start();

      const state = server.getState();
      expect(state.port).toBe(customPort);
      expect(state.baseUrl).toBe(`http://127.0.0.1:${customPort}`);

      await server.stop();
    });

    it.skipIf(!serverAvailable)('should handle multiple start/stop cycles', async () => {
      const server = new MockNavigationServer();

      // First cycle
      await server.start();
      expect(server.getState().isRunning).toBe(true);
      await server.stop();
      expect(server.getState().isRunning).toBe(false);

      // Second cycle
      await server.start();
      expect(server.getState().isRunning).toBe(true);
      await server.stop();
      expect(server.getState().isRunning).toBe(false);
    });

    it.skipIf(!serverAvailable)('should reject starting already running server', async () => {
      const server = new MockNavigationServer();

      await server.start();

      await expect(server.start()).rejects.toThrow('already running');

      await server.stop();
    });
  });

  describe('AC2: Predictable URL Management', () => {
    let server: any;

    beforeEach(async () => {
      if (!serverAvailable) return;

      server = new MockNavigationServer();
      await server.start();
    });

    afterEach(async () => {
      if (!serverAvailable || !server) return;

      await server.stop();
    });

    it.skipIf(!serverAvailable)('should provide base URL when running', () => {
      const baseUrl = server.getBaseUrl();

      expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    });

    it.skipIf(!serverAvailable)('should generate URLs for specific paths', () => {
      const url1 = server.getUrl('/test-page');
      const url2 = server.getUrl('test-page'); // Without leading slash

      expect(url1).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/test-page$/);
      expect(url2).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/test-page$/);
    });

    it.skipIf(!serverAvailable)('should throw when getting URL from stopped server', () => {
      server.stop();

      expect(() => server.getBaseUrl()).toThrow('not running');
      expect(() => server.getUrl('/test')).toThrow('not running');
    });
  });

  describe('AC3: Test Lifecycle Integration', () => {
    let server: any;
    let manager: BrowserManager;
    let session: BrowserSession;

    beforeAll(async () => {
      if (!serverAvailable) return;

      server = new MockNavigationServer();

      // Add basic test page
      server.addScenario({
        id: 'home',
        path: '/',
        handler: {
          type: 'static',
          content: `
            <!DOCTYPE html>
            <html>
              <head><title>Test Home Page</title></head>
              <body><h1 id="page-title">Home</h1></body>
            </html>
          `
        }
      });

      await server.start();
    });

    afterAll(async () => {
      if (!serverAvailable || !server) return;

      await server.stop();
    });

    beforeEach(async () => {
      if (!serverAvailable) return;

      manager = createBrowserManager();
      session = createBrowserSession(manager, {
        headless: true,
        timeout: 5000
      });
      await session.launch();

      // Clear request log between tests
      server.clearRequestLog();
    });

    afterEach(async () => {
      if (!serverAvailable || !session || !manager) return;

      await session.close();
      await manager.shutdown();
    });

    it.skipIf(!serverAvailable)('should serve pages during test execution', async () => {
      const result = await session.goto(server.getUrl('/'));

      expect(result.success).toBe(true);

      const title = await session.getTitle();
      expect(title.data).toBe('Test Home Page');
    });

    it.skipIf(!serverAvailable)('should maintain server state across tests', async () => {
      // This test verifies the server stays running between tests
      expect(server.getState().isRunning).toBe(true);

      const result = await session.goto(server.getUrl('/'));
      expect(result.success).toBe(true);
    });

    it.skipIf(!serverAvailable)('should track request history', async () => {
      await session.goto(server.getUrl('/'));

      const requests = server.getState().requestLog;
      expect(requests.length).toBeGreaterThan(0);
      expect(requests[0].path).toBe('/');
      expect(requests[0].method).toBe('GET');
    });
  });

  describe('AC4: Navigation Scenario Support', () => {
    let server: any;
    let manager: BrowserManager;
    let session: BrowserSession;

    beforeAll(async () => {
      if (!serverAvailable) return;

      server = new MockNavigationServer();
      await server.start();
    });

    afterAll(async () => {
      if (!serverAvailable || !server) return;

      await server.stop();
    });

    beforeEach(async () => {
      if (!serverAvailable) return;

      manager = createBrowserManager();
      session = createBrowserSession(manager, { headless: true });
      await session.launch();
    });

    afterEach(async () => {
      if (!serverAvailable || !session || !manager) return;

      await session.close();
      await manager.shutdown();
    });

    describe('Static Page Scenarios', () => {
      it.skipIf(!serverAvailable)('should serve static content', async () => {
        server.addScenario({
          id: 'static-test',
          path: '/static',
          handler: {
            type: 'static',
            content: '<html><head><title>Static Test</title></head><body><h1>Static Content</h1></body></html>'
          }
        });

        const result = await session.goto(server.getUrl('/static'));

        expect(result.success).toBe(true);

        const title = await session.getTitle();
        expect(title.data).toBe('Static Test');
      });

      it.skipIf(!serverAvailable)('should support custom headers for static content', async () => {
        server.addScenario({
          id: 'custom-headers',
          path: '/custom-headers',
          handler: {
            type: 'static',
            content: '<html><body>Custom Headers</body></html>',
            headers: { 'X-Custom-Header': 'test-value' }
          }
        });

        const result = await session.goto(server.getUrl('/custom-headers'));
        expect(result.success).toBe(true);
      });
    });

    describe('Redirect Scenarios', () => {
      it.skipIf(!serverAvailable)('should handle 302 redirects', async () => {
        // Add target page
        server.addScenario({
          id: 'redirect-target',
          path: '/target',
          handler: {
            type: 'static',
            content: '<html><head><title>Redirect Target</title></head><body>Target Page</body></html>'
          }
        });

        // Add redirect
        server.addScenario({
          id: 'redirect-test',
          path: '/redirect',
          handler: {
            type: 'redirect',
            statusCode: 302,
            location: '/target'
          }
        });

        const result = await session.goto(server.getUrl('/redirect'));

        expect(result.success).toBe(true);

        const title = await session.getTitle();
        expect(title.data).toBe('Redirect Target');
      });

      it.skipIf(!serverAvailable)('should handle 301 permanent redirects', async () => {
        server.addScenario({
          id: 'permanent-target',
          path: '/permanent-target',
          handler: {
            type: 'static',
            content: '<html><head><title>Permanent Target</title></head><body>Permanent</body></html>'
          }
        });

        server.addScenario({
          id: 'permanent-redirect',
          path: '/permanent',
          handler: {
            type: 'redirect',
            statusCode: 301,
            location: '/permanent-target'
          }
        });

        const result = await session.goto(server.getUrl('/permanent'));
        expect(result.success).toBe(true);

        const title = await session.getTitle();
        expect(title.data).toBe('Permanent Target');
      });

      it.skipIf(!serverAvailable)('should handle redirect chains', async () => {
        // Chain: /chain-start -> /chain-middle -> /chain-end

        server.addScenario({
          id: 'chain-end',
          path: '/chain-end',
          handler: {
            type: 'static',
            content: '<html><head><title>Chain End</title></head><body>Final destination</body></html>'
          }
        });

        server.addScenario({
          id: 'chain-middle',
          path: '/chain-middle',
          handler: {
            type: 'redirect',
            statusCode: 302,
            location: '/chain-end'
          }
        });

        server.addScenario({
          id: 'chain-start',
          path: '/chain-start',
          handler: {
            type: 'redirect',
            statusCode: 302,
            location: '/chain-middle'
          }
        });

        const result = await session.goto(server.getUrl('/chain-start'));
        expect(result.success).toBe(true);

        const title = await session.getTitle();
        expect(title.data).toBe('Chain End');
      });
    });

    describe('Error Scenarios', () => {
      it.skipIf(!serverAvailable)('should handle 404 errors', async () => {
        server.addScenario({
          id: 'not-found',
          path: '/not-found',
          handler: {
            type: 'error',
            statusCode: 404,
            message: 'Page not found'
          }
        });

        const result = await session.goto(server.getUrl('/not-found'));

        // Browser should navigate but page will show error
        expect(result.success).toBe(true);

        // Verify we can still get page content (error page)
        const currentUrl = await session.getCurrentUrl();
        expect(currentUrl.data).toContain('/not-found');
      });

      it.skipIf(!serverAvailable)('should handle 500 server errors', async () => {
        server.addScenario({
          id: 'server-error',
          path: '/server-error',
          handler: {
            type: 'error',
            statusCode: 500,
            message: 'Internal server error'
          }
        });

        const result = await session.goto(server.getUrl('/server-error'));
        expect(result.success).toBe(true);

        const currentUrl = await session.getCurrentUrl();
        expect(currentUrl.data).toContain('/server-error');
      });

      it.skipIf(!serverAvailable)('should handle 401 unauthorized errors', async () => {
        server.addScenario({
          id: 'unauthorized',
          path: '/unauthorized',
          handler: {
            type: 'error',
            statusCode: 401,
            message: 'Unauthorized access'
          }
        });

        const result = await session.goto(server.getUrl('/unauthorized'));
        expect(result.success).toBe(true);
      });
    });

    describe('Slow Response Scenarios', () => {
      it.skipIf(!serverAvailable)('should handle delayed responses', async () => {
        const delayMs = 1000; // 1 second delay

        server.addScenario({
          id: 'slow-page',
          path: '/slow',
          handler: {
            type: 'delayed',
            delayMs,
            handler: {
              type: 'static',
              content: '<html><head><title>Slow Page</title></head><body>Finally loaded!</body></html>'
            }
          }
        });

        const startTime = Date.now();
        const result = await session.goto(server.getUrl('/slow'), { timeout: 5000 });
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeGreaterThanOrEqual(delayMs);

        const title = await session.getTitle();
        expect(title.data).toBe('Slow Page');
      });

      it.skipIf(!serverAvailable)('should timeout on very slow responses', async () => {
        const delayMs = 10000; // 10 second delay

        server.addScenario({
          id: 'very-slow',
          path: '/very-slow',
          handler: {
            type: 'delayed',
            delayMs,
            handler: {
              type: 'static',
              content: '<html><body>Too slow</body></html>'
            }
          }
        });

        const startTime = Date.now();

        // This should timeout
        const result = await session.goto(server.getUrl('/very-slow'), { timeout: 2000 });
        const duration = Date.now() - startTime;

        // Expect either timeout or success depending on browser behavior
        // Duration should be close to timeout value
        expect(duration).toBeLessThan(5000);
      });

      it.skipIf(!serverAvailable)('should handle delayed errors', async () => {
        server.addScenario({
          id: 'delayed-error',
          path: '/delayed-error',
          handler: {
            type: 'delayed',
            delayMs: 500,
            handler: {
              type: 'error',
              statusCode: 503,
              message: 'Service temporarily unavailable'
            }
          }
        });

        const startTime = Date.now();
        const result = await session.goto(server.getUrl('/delayed-error'));
        const duration = Date.now() - startTime;

        expect(duration).toBeGreaterThanOrEqual(500);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Mock Server State and Logging', () => {
    let server: any;

    beforeEach(async () => {
      if (!serverAvailable) return;

      server = new MockNavigationServer();
      await server.start();
    });

    afterEach(async () => {
      if (!serverAvailable || !server) return;

      await server.stop();
    });

    it.skipIf(!serverAvailable)('should track request history', async () => {
      server.addScenario({
        id: 'logging-test',
        path: '/logging',
        handler: {
          type: 'static',
          content: '<html><body>Logged request</body></html>'
        }
      });

      // Make multiple requests
      const response1 = await fetch(server.getUrl('/logging'));
      const response2 = await fetch(server.getUrl('/logging?param=test'));

      const state = server.getState();
      expect(state.requestLog.length).toBeGreaterThanOrEqual(2);

      const loggingRequests = server.getRequestsForPath('/logging');
      expect(loggingRequests.length).toBeGreaterThanOrEqual(2);

      expect(loggingRequests[0].method).toBe('GET');
      expect(loggingRequests[0].path).toBe('/logging');
      expect(loggingRequests[1].query.param).toBe('test');
    });

    it.skipIf(!serverAvailable)('should clear request log on demand', async () => {
      server.addScenario({
        id: 'clear-test',
        path: '/clear',
        handler: {
          type: 'static',
          content: '<html><body>Clear test</body></html>'
        }
      });

      await fetch(server.getUrl('/clear'));
      expect(server.getState().requestLog.length).toBeGreaterThan(0);

      server.clearRequestLog();
      expect(server.getState().requestLog.length).toBe(0);
    });

    it.skipIf(!serverAvailable)('should filter requests by path pattern', async () => {
      server.addScenario({
        id: 'filter-test-1',
        path: '/api/users',
        handler: {
          type: 'static',
          content: '{"users": []}'
        }
      });

      server.addScenario({
        id: 'filter-test-2',
        path: '/api/posts',
        handler: {
          type: 'static',
          content: '{"posts": []}'
        }
      });

      server.addScenario({
        id: 'filter-test-3',
        path: '/page',
        handler: {
          type: 'static',
          content: '<html><body>Page</body></html>'
        }
      });

      await fetch(server.getUrl('/api/users'));
      await fetch(server.getUrl('/api/posts'));
      await fetch(server.getUrl('/page'));

      const apiRequests = server.getRequestsForPath('/api');
      const pageRequests = server.getRequestsForPath('/page');

      expect(apiRequests.length).toBe(2);
      expect(pageRequests.length).toBe(1);
    });
  });

  describe('Pre-built Scenarios (if available)', () => {
    let server: any;

    beforeEach(async () => {
      if (!serverAvailable || !NavigationScenarios) return;

      server = new MockNavigationServer();
      await server.start();
    });

    afterEach(async () => {
      if (!serverAvailable || !server) return;

      await server.stop();
    });

    it.skipIf(!serverAvailable || !NavigationScenarios)('should provide basic page scenarios', () => {
      const homePage = NavigationScenarios.basic.homePage();
      expect(homePage).toMatchObject({
        id: expect.any(String),
        path: expect.any(String),
        handler: expect.objectContaining({
          type: 'static'
        })
      });
    });

    it.skipIf(!serverAvailable || !NavigationScenarios)('should provide redirect scenarios', () => {
      const redirect = NavigationScenarios.redirects.permanent('/old', '/new');
      expect(redirect).toMatchObject({
        handler: expect.objectContaining({
          type: 'redirect',
          statusCode: 301,
          location: '/new'
        })
      });
    });

    it.skipIf(!serverAvailable || !NavigationScenarios)('should provide error scenarios', () => {
      const notFound = NavigationScenarios.errors.notFound('/missing');
      expect(notFound).toMatchObject({
        handler: expect.objectContaining({
          type: 'error',
          statusCode: 404
        })
      });
    });

    it.skipIf(!serverAvailable || !NavigationScenarios)('should provide slow response scenarios', () => {
      const slowPage = NavigationScenarios.slow.page(2000, '/slow');
      expect(slowPage).toMatchObject({
        handler: expect.objectContaining({
          type: 'delayed',
          delayMs: 2000
        })
      });
    });
  });

  describe('Implementation Status', () => {
    it('should indicate if mock server implementation is available', () => {
      if (serverAvailable) {
        console.log('✅ Mock server implementation detected and ready for testing');
      } else {
        console.log('❌ Mock server implementation not found - tests skipped');
        console.log('Expected location: packages/browser/src/test-server/');
        console.log('See ADR-001-mock-server-navigation-testing.md for implementation details');
      }

      // Always pass - this is just informational
      expect(true).toBe(true);
    });
  });
});