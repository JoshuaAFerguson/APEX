# ADR-001: Mock Server for Controlled Navigation Scenarios

**Status**: Proposed
**Date**: 2025-02-07
**Author**: Architect Agent

## Context

The browser testing infrastructure in `@apexcli/browser` currently uses static HTML fixture files served via `file://` protocol for navigation testing. While this approach works for basic scenarios, it has limitations:

1. **No HTTP-specific behaviors**: Cannot test HTTP redirects, status codes (404, 500), or response headers
2. **No dynamic responses**: Static files cannot simulate slow responses, conditional content, or server errors
3. **No network simulation**: Cannot test timeouts, connection errors, or retry behaviors
4. **Limited URL patterns**: File URLs don't match real-world HTTP URL behaviors

A lightweight mock server is needed to enable controlled navigation testing with realistic HTTP scenarios.

## Current State Analysis

### Existing Infrastructure

1. **Static HTML Fixtures** (`packages/browser/src/__tests__/fixtures/`):
   - `test-page.html`, `page2.html`, `page3.html` - Basic navigation test pages
   - Used via `file://` protocol for navigation tests
   - Include JavaScript test helpers exposed via `window.testHelpers`

2. **Browser Package Dependencies** (`packages/browser/package.json`):
   - Playwright ^1.47.0 (browser automation)
   - No HTTP server dependency currently

3. **API Package** (`packages/api/`):
   - Already uses Fastify for HTTP server
   - Establishes Fastify as the preferred HTTP framework in APEX

4. **Existing Test Patterns**:
   - Vitest with `beforeEach`/`afterEach` lifecycle hooks
   - Browser session management via `BrowserManager`
   - Test utilities in `test-utils/` directory

5. **Test Page Generators** (`packages/browser/src/test-utils/test-pages.ts`):
   - `TestPages.simple()`, `TestPages.tall()`, `TestPages.complex()` etc.
   - Generate HTML content programmatically

## Decision

### Solution: Fastify-based Mock Server with Test Lifecycle Integration

Implement a lightweight mock server using Fastify that:
1. Starts/stops programmatically via test lifecycle hooks
2. Serves configurable navigation scenarios (redirects, errors, delays)
3. Integrates with existing test patterns and fixture system
4. Provides predictable, deterministic URLs for testing

### Why Fastify

- **Consistency**: Already used in `@apex/api` package
- **Performance**: Fast startup/shutdown for test lifecycle
- **Simplicity**: Minimal configuration for test scenarios
- **Type Safety**: Excellent TypeScript support

## Technical Design

### 1. Package Structure

```
packages/browser/
├── src/
│   ├── test-server/
│   │   ├── index.ts              # Main exports
│   │   ├── mock-server.ts        # MockNavigationServer class
│   │   ├── scenarios.ts          # Scenario definitions
│   │   ├── page-templates.ts     # HTML page generators
│   │   └── types.ts              # Type definitions
│   └── __tests__/
│       ├── test-server/
│       │   └── mock-server.test.ts
│       └── navigation-scenarios.integration.test.ts
```

### 2. Core Interface Design

```typescript
// types.ts
export interface MockServerConfig {
  port?: number;              // Default: 0 (dynamic port)
  host?: string;              // Default: '127.0.0.1'
}

export interface NavigationScenario {
  id: string;
  path: string;
  handler: NavigationHandler;
}

export type NavigationHandler =
  | StaticPageHandler
  | RedirectHandler
  | ErrorHandler
  | DelayedHandler
  | CustomHandler;

export interface StaticPageHandler {
  type: 'static';
  content: string;
  contentType?: string;
  headers?: Record<string, string>;
}

export interface RedirectHandler {
  type: 'redirect';
  statusCode: 301 | 302 | 303 | 307 | 308;
  location: string;
}

export interface ErrorHandler {
  type: 'error';
  statusCode: 400 | 401 | 403 | 404 | 500 | 502 | 503;
  message?: string;
}

export interface DelayedHandler {
  type: 'delayed';
  delayMs: number;
  handler: StaticPageHandler | ErrorHandler;
}

export interface CustomHandler {
  type: 'custom';
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export interface MockServerState {
  isRunning: boolean;
  port: number | null;
  baseUrl: string | null;
  requestLog: RequestLogEntry[];
}

export interface RequestLogEntry {
  timestamp: Date;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
}
```

### 3. MockNavigationServer Class

```typescript
// mock-server.ts
import Fastify, { FastifyInstance } from 'fastify';
import { MockServerConfig, NavigationScenario, MockServerState, RequestLogEntry } from './types.js';

export class MockNavigationServer {
  private server: FastifyInstance | null = null;
  private scenarios: Map<string, NavigationScenario> = new Map();
  private requestLog: RequestLogEntry[] = [];
  private port: number | null = null;
  private config: MockServerConfig;

  constructor(config: MockServerConfig = {}) {
    this.config = {
      port: config.port ?? 0,
      host: config.host ?? '127.0.0.1',
    };
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Server is already running');
    }

    this.server = Fastify({ logger: false });

    // Request logging middleware
    this.server.addHook('onRequest', async (request) => {
      this.requestLog.push({
        timestamp: new Date(),
        method: request.method,
        path: request.url,
        headers: request.headers as Record<string, string>,
        query: request.query as Record<string, string>,
      });
    });

    // Register scenario routes
    for (const scenario of this.scenarios.values()) {
      this.registerScenarioRoute(scenario);
    }

    // Default 404 handler
    this.server.setNotFoundHandler(async (request, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        path: request.url,
      });
    });

    await this.server.listen({
      port: this.config.port!,
      host: this.config.host
    });

    const address = this.server.server.address();
    this.port = typeof address === 'object' ? address?.port ?? null : null;
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
      this.port = null;
    }
    this.requestLog = [];
  }

  /**
   * Get the base URL of the running server
   */
  getBaseUrl(): string {
    if (!this.port) {
      throw new Error('Server is not running');
    }
    return `http://${this.config.host}:${this.port}`;
  }

  /**
   * Get URL for a specific scenario path
   */
  getUrl(path: string): string {
    return `${this.getBaseUrl()}${path.startsWith('/') ? path : '/' + path}`;
  }

  /**
   * Register a navigation scenario
   */
  addScenario(scenario: NavigationScenario): void {
    this.scenarios.set(scenario.id, scenario);

    // If server is running, register route dynamically
    if (this.server) {
      this.registerScenarioRoute(scenario);
    }
  }

  /**
   * Remove a navigation scenario
   */
  removeScenario(id: string): void {
    this.scenarios.delete(id);
  }

  /**
   * Get the current server state
   */
  getState(): MockServerState {
    return {
      isRunning: !!this.server,
      port: this.port,
      baseUrl: this.port ? this.getBaseUrl() : null,
      requestLog: [...this.requestLog],
    };
  }

  /**
   * Clear the request log
   */
  clearRequestLog(): void {
    this.requestLog = [];
  }

  /**
   * Get requests matching a path pattern
   */
  getRequestsForPath(pathPattern: string | RegExp): RequestLogEntry[] {
    return this.requestLog.filter(entry => {
      if (typeof pathPattern === 'string') {
        return entry.path === pathPattern || entry.path.startsWith(pathPattern);
      }
      return pathPattern.test(entry.path);
    });
  }

  private registerScenarioRoute(scenario: NavigationScenario): void {
    if (!this.server) return;

    this.server.get(scenario.path, async (request, reply) => {
      const handler = scenario.handler;

      switch (handler.type) {
        case 'static':
          reply
            .headers(handler.headers ?? {})
            .type(handler.contentType ?? 'text/html')
            .send(handler.content);
          break;

        case 'redirect':
          reply.redirect(handler.statusCode, handler.location);
          break;

        case 'error':
          reply.status(handler.statusCode).send({
            error: handler.message ?? `Error ${handler.statusCode}`,
          });
          break;

        case 'delayed':
          await new Promise(resolve => setTimeout(resolve, handler.delayMs));
          // Recursively handle the nested handler
          if (handler.handler.type === 'static') {
            reply
              .headers(handler.handler.headers ?? {})
              .type(handler.handler.contentType ?? 'text/html')
              .send(handler.handler.content);
          } else if (handler.handler.type === 'error') {
            reply.status(handler.handler.statusCode).send({
              error: handler.handler.message ?? `Error ${handler.handler.statusCode}`,
            });
          }
          break;

        case 'custom':
          await handler.handler(request, reply);
          break;
      }
    });
  }
}
```

### 4. Pre-built Scenarios

```typescript
// scenarios.ts
import { NavigationScenario } from './types.js';
import { PageTemplates } from './page-templates.js';

/**
 * Pre-built navigation scenarios for common test cases
 */
export const NavigationScenarios = {
  /**
   * Basic navigation scenarios
   */
  basic: {
    homePage: (): NavigationScenario => ({
      id: 'home',
      path: '/',
      handler: {
        type: 'static',
        content: PageTemplates.navigation({
          title: 'Home Page',
          pageNumber: 1
        }),
      },
    }),

    page2: (): NavigationScenario => ({
      id: 'page2',
      path: '/page2',
      handler: {
        type: 'static',
        content: PageTemplates.navigation({
          title: 'Page 2',
          pageNumber: 2
        }),
      },
    }),

    page3: (): NavigationScenario => ({
      id: 'page3',
      path: '/page3',
      handler: {
        type: 'static',
        content: PageTemplates.navigation({
          title: 'Page 3',
          pageNumber: 3
        }),
      },
    }),
  },

  /**
   * Redirect scenarios
   */
  redirects: {
    permanent: (from: string, to: string): NavigationScenario => ({
      id: `redirect-301-${from}`,
      path: from,
      handler: {
        type: 'redirect',
        statusCode: 301,
        location: to,
      },
    }),

    temporary: (from: string, to: string): NavigationScenario => ({
      id: `redirect-302-${from}`,
      path: from,
      handler: {
        type: 'redirect',
        statusCode: 302,
        location: to,
      },
    }),

    chain: (): NavigationScenario[] => [
      {
        id: 'redirect-chain-1',
        path: '/chain-start',
        handler: {
          type: 'redirect',
          statusCode: 302,
          location: '/chain-middle',
        },
      },
      {
        id: 'redirect-chain-2',
        path: '/chain-middle',
        handler: {
          type: 'redirect',
          statusCode: 302,
          location: '/chain-end',
        },
      },
      {
        id: 'redirect-chain-3',
        path: '/chain-end',
        handler: {
          type: 'static',
          content: PageTemplates.simple('Redirect Chain End'),
        },
      },
    ],
  },

  /**
   * Error scenarios
   */
  errors: {
    notFound: (path: string = '/not-found'): NavigationScenario => ({
      id: 'error-404',
      path,
      handler: {
        type: 'error',
        statusCode: 404,
        message: 'Page not found',
      },
    }),

    serverError: (path: string = '/server-error'): NavigationScenario => ({
      id: 'error-500',
      path,
      handler: {
        type: 'error',
        statusCode: 500,
        message: 'Internal server error',
      },
    }),

    unauthorized: (path: string = '/unauthorized'): NavigationScenario => ({
      id: 'error-401',
      path,
      handler: {
        type: 'error',
        statusCode: 401,
        message: 'Unauthorized',
      },
    }),

    forbidden: (path: string = '/forbidden'): NavigationScenario => ({
      id: 'error-403',
      path,
      handler: {
        type: 'error',
        statusCode: 403,
        message: 'Forbidden',
      },
    }),

    serviceUnavailable: (path: string = '/unavailable'): NavigationScenario => ({
      id: 'error-503',
      path,
      handler: {
        type: 'error',
        statusCode: 503,
        message: 'Service unavailable',
      },
    }),
  },

  /**
   * Slow response scenarios
   */
  slow: {
    page: (delayMs: number, path: string = '/slow'): NavigationScenario => ({
      id: `slow-${delayMs}`,
      path,
      handler: {
        type: 'delayed',
        delayMs,
        handler: {
          type: 'static',
          content: PageTemplates.simple(`Slow Page (${delayMs}ms delay)`),
        },
      },
    }),

    verySlowPage: (): NavigationScenario => ({
      id: 'very-slow',
      path: '/very-slow',
      handler: {
        type: 'delayed',
        delayMs: 5000,
        handler: {
          type: 'static',
          content: PageTemplates.simple('Very Slow Page'),
        },
      },
    }),
  },

  /**
   * Special content scenarios
   */
  content: {
    largeContent: (): NavigationScenario => ({
      id: 'large-content',
      path: '/large',
      handler: {
        type: 'static',
        content: PageTemplates.heavyContent(1000),
      },
    }),

    dynamic: (): NavigationScenario => ({
      id: 'dynamic',
      path: '/dynamic',
      handler: {
        type: 'custom',
        handler: async (request, reply) => {
          const timestamp = new Date().toISOString();
          const content = PageTemplates.dynamic({ timestamp });
          reply.type('text/html').send(content);
        },
      },
    }),
  },
};
```

### 5. Page Templates

```typescript
// page-templates.ts

export const PageTemplates = {
  /**
   * Simple page with title
   */
  simple: (title: string): string => `
    <!DOCTYPE html>
    <html>
      <head><title>${title}</title></head>
      <body>
        <h1 id="page-title">${title}</h1>
        <script>
          window.pageInstance = Math.random().toString(36).substr(2, 9);
          window.testHelpers = {
            getPageInstance: () => window.pageInstance,
            getLoadTime: () => new Date().toISOString(),
          };
        </script>
      </body>
    </html>
  `,

  /**
   * Navigation test page (compatible with existing fixtures)
   */
  navigation: (options: {
    title: string;
    pageNumber: number;
    backgroundColor?: string;
  }): string => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${options.title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: ${options.backgroundColor ?? '#f0f0f0'};
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 8px;
        }
        .nav-buttons { margin: 20px 0; display: flex; gap: 10px; }
        button {
          padding: 10px 20px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .status {
          margin: 20px 0;
          padding: 15px;
          background: #e9ecef;
          border-radius: 4px;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 id="page-title">${options.title}</h1>
        <div class="status">
          <strong>Page Status:</strong><br>
          <span id="load-status">Loaded</span><br>
          <span id="timestamp">Loaded at: <span id="load-time"></span></span>
        </div>
        <div class="nav-buttons">
          <button onclick="location.href='/'">Home</button>
          <button onclick="location.href='/page2'">Page 2</button>
          <button onclick="location.href='/page3'">Page 3</button>
          <button onclick="location.reload()">Reload</button>
        </div>
      </div>
      <script>
        document.getElementById('load-time').textContent = new Date().toISOString();
        window.pageInstance = Math.random().toString(36).substr(2, 9);
        window.testHelpers = {
          getPageInstance: () => window.pageInstance,
          getLoadTime: () => document.getElementById('load-time').textContent,
          getPageNumber: () => ${options.pageNumber},
        };
      </script>
    </body>
    </html>
  `,

  /**
   * Page with heavy content for performance testing
   */
  heavyContent: (elementCount: number): string => {
    const elements = Array.from({ length: elementCount }, (_, i) =>
      `<div style="padding:10px;background:hsl(${i % 360}, 50%, 75%);">Element ${i + 1}</div>`
    ).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head><title>Heavy Content (${elementCount} elements)</title></head>
        <body>
          <h1 id="page-title">Heavy Content Test</h1>
          ${elements}
          <script>
            window.pageInstance = Math.random().toString(36).substr(2, 9);
            window.testHelpers = {
              getPageInstance: () => window.pageInstance,
              getElementCount: () => ${elementCount},
            };
          </script>
        </body>
      </html>
    `;
  },

  /**
   * Dynamic content page
   */
  dynamic: (options: { timestamp: string }): string => `
    <!DOCTYPE html>
    <html>
      <head><title>Dynamic Page</title></head>
      <body>
        <h1 id="page-title">Dynamic Content</h1>
        <p id="timestamp">Generated at: ${options.timestamp}</p>
        <script>
          window.pageInstance = Math.random().toString(36).substr(2, 9);
          window.testHelpers = {
            getPageInstance: () => window.pageInstance,
            getTimestamp: () => '${options.timestamp}',
          };
        </script>
      </body>
    </html>
  `,
};
```

### 6. Test Lifecycle Integration

```typescript
// Usage in tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MockNavigationServer, NavigationScenarios } from '../test-server/index.js';
import { createBrowserManager, createBrowserSession } from '../index.js';

describe('Navigation Scenarios with Mock Server', () => {
  let server: MockNavigationServer;
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeAll(async () => {
    // Create and configure server
    server = new MockNavigationServer();

    // Add basic scenarios
    server.addScenario(NavigationScenarios.basic.homePage());
    server.addScenario(NavigationScenarios.basic.page2());
    server.addScenario(NavigationScenarios.basic.page3());

    // Add redirect scenarios
    server.addScenario(NavigationScenarios.redirects.permanent('/old-page', '/page2'));

    // Add error scenarios
    server.addScenario(NavigationScenarios.errors.notFound());
    server.addScenario(NavigationScenarios.errors.serverError());

    // Add slow scenarios
    server.addScenario(NavigationScenarios.slow.page(2000, '/slow'));

    // Start server
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(async () => {
    manager = createBrowserManager();
    session = createBrowserSession(manager, { headless: true });
    await session.launch();
    server.clearRequestLog(); // Clear request log between tests
  });

  afterEach(async () => {
    await session.close();
    await manager.shutdown();
  });

  it('should navigate to pages via HTTP', async () => {
    const result = await session.goto(server.getUrl('/'));
    expect(result.success).toBe(true);

    const title = await session.getTitle();
    expect(title.data).toBe('Home Page');
  });

  it('should follow redirects', async () => {
    await session.goto(server.getUrl('/old-page'));

    const title = await session.getTitle();
    expect(title.data).toBe('Page 2');
  });

  it('should handle 404 errors', async () => {
    const result = await session.goto(server.getUrl('/not-found'));
    // Verify error handling
  });

  it('should handle slow responses', async () => {
    const startTime = Date.now();
    const result = await session.goto(server.getUrl('/slow'), { timeout: 5000 });
    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeGreaterThanOrEqual(2000);
  });

  it('should track request history', async () => {
    await session.goto(server.getUrl('/'));
    await session.goto(server.getUrl('/page2'));

    const requests = server.getState().requestLog;
    expect(requests.length).toBe(2);
    expect(requests[0].path).toBe('/');
    expect(requests[1].path).toBe('/page2');
  });
});
```

### 7. Package Dependencies Update

Add to `packages/browser/package.json`:

```json
{
  "dependencies": {
    "fastify": "^4.26.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0"
  }
}
```

### 8. Export from Package

Update `packages/browser/src/index.ts`:

```typescript
// Existing exports...
export * from './browser-manager.js';
export * from './types.js';

// Test server exports (for testing only)
export * from './test-server/index.js';
```

Also create `packages/browser/src/test-server/index.ts`:

```typescript
export { MockNavigationServer } from './mock-server.js';
export { NavigationScenarios } from './scenarios.js';
export { PageTemplates } from './page-templates.js';
export * from './types.js';
```

## Files to Create

| File | Purpose |
|------|---------|
| `packages/browser/src/test-server/types.ts` | Type definitions |
| `packages/browser/src/test-server/mock-server.ts` | MockNavigationServer class |
| `packages/browser/src/test-server/scenarios.ts` | Pre-built navigation scenarios |
| `packages/browser/src/test-server/page-templates.ts` | HTML page generators |
| `packages/browser/src/test-server/index.ts` | Module exports |
| `packages/browser/src/__tests__/test-server/mock-server.test.ts` | Unit tests |
| `packages/browser/src/__tests__/navigation-scenarios.integration.test.ts` | Integration tests |
| `packages/browser/docs/adr/ADR-001-mock-server-navigation-testing.md` | This ADR |

## Files to Modify

| File | Change |
|------|--------|
| `packages/browser/package.json` | Add fastify dependency |
| `packages/browser/src/index.ts` | Export test-server module |

## Alternatives Considered

### 1. Use Express.js Instead of Fastify
- **Rejected**: Fastify is already used in `@apex/api`, maintaining consistency
- Fastify has faster startup/shutdown times, better for test lifecycle

### 2. Use Playwright's Built-in Route Mocking
- **Rejected**: Route mocking intercepts at browser level, not network level
- Cannot test actual HTTP behaviors (redirects, timeouts at network layer)
- Useful for API mocking, but not for navigation testing

### 3. Extend Static Fixtures with Pre-configured HTML
- **Rejected**: Cannot simulate dynamic behaviors
- File protocol cannot test HTTP-specific features

### 4. Use an External Mock Server (MSW, Nock)
- **Rejected**: Adds complexity for test coordination
- Fastify provides more control for navigation-specific scenarios

### 5. Use Playwright Test Server (@playwright/test)
- **Rejected**: Tightly coupled to Playwright test runner
- Project uses Vitest, need framework-agnostic solution

## Consequences

### Positive
- Full control over HTTP navigation scenarios
- Realistic testing of redirects, errors, and delays
- Request logging for verification
- Programmatic lifecycle management
- Consistent with existing APEX patterns (Fastify)
- Type-safe scenario definitions

### Negative
- Additional dependency (fastify) in browser package
- Slightly more complex test setup vs static files
- Port management in CI environments
- Increased test startup time (negligible with dynamic ports)

## Implementation Notes for Developer Stage

1. **Port Management**: Use port 0 for dynamic port allocation to avoid conflicts
2. **Cleanup**: Ensure `afterAll` always calls `server.stop()` to release resources
3. **Existing Tests**: Keep existing `file://` based tests for backwards compatibility
4. **Error Handling**: Handle server startup failures gracefully
5. **Type Safety**: Use strict types for all scenario definitions

## Acceptance Criteria Mapping

| Requirement | Implementation |
|-------------|----------------|
| Mock server can be started/stopped programmatically | `MockNavigationServer.start()` / `stop()` |
| Test pages served at predictable URLs | `server.getUrl(path)` method |
| Server integrates with test lifecycle | `beforeAll`/`afterAll` hooks |
| Supports redirect scenarios | `NavigationScenarios.redirects.*` |
| Supports error scenarios | `NavigationScenarios.errors.*` |
| Supports slow response scenarios | `NavigationScenarios.slow.*` |
| Request logging for verification | `server.getState().requestLog` |
