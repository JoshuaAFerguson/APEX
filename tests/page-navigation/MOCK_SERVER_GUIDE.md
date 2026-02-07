# Mock Server for Navigation Testing

This guide covers the enhanced mock server implementation for controlled navigation scenarios in APEX browser automation testing.

## Overview

The mock server provides a lightweight, programmatically controlled HTTP server that serves predictable content for testing navigation flows. It supports various scenarios including redirects, errors, slow responses, and custom content types.

## Features

### ✅ Core Requirements Met

- **Programmatic start/stop**: Full lifecycle control via API
- **Predictable URLs**: All test pages served at known endpoints
- **Test lifecycle integration**: Seamless beforeAll/afterAll integration
- **Multiple navigation scenarios**: Comprehensive error, redirect, and performance scenarios

### 🚀 Enhanced Capabilities

- **Scenario-based configuration**: Define custom navigation scenarios
- **Performance testing**: Configurable response delays
- **Error simulation**: Multiple HTTP error codes and conditions
- **Content type support**: HTML, JSON, and custom responses
- **Detailed logging**: Optional verbose output for debugging
- **Memory safety**: Proper cleanup and resource management

## Quick Start

### Basic Usage

```typescript
import { MockNavigationServer } from './mock-server';

// Create and start a server
const server = new MockNavigationServer({
  port: 0, // Random available port
  verbose: true
});

await server.start();

console.log(`Server running at: ${server.baseUrl}`);

// Use in tests
await page.goto(`${server.baseUrl}/page1`);

// Stop when done
await server.stop();
```

### Test Lifecycle Integration

```typescript
import { MockServerLifecycle } from './mock-server';

describe('Navigation Tests', () => {
  let mockServer: MockNavigationServer;

  beforeAll(async () => {
    mockServer = await MockServerLifecycle.startForTest('my-tests');
  });

  afterAll(async () => {
    await MockServerLifecycle.stopForTest('my-tests');
  });

  it('should navigate successfully', async () => {
    await page.goto(`${mockServer.baseUrl}/page1`);
    // ... test logic
  });
});
```

## Available Endpoints

### Standard Pages

| Endpoint | Description | Features |
|----------|-------------|----------|
| `/` | Home page | Navigation menu, scenario links |
| `/page1` | Test page 1 | Navigation controls, next page link |
| `/page2` | Test page 2 | Navigation controls, next page link |
| `/page3` | Test page 3 | Navigation controls, back to home |

### Error Scenarios

| Endpoint | Status | Description |
|----------|--------|-------------|
| `/error` | 500 | Internal server error |
| `/404` | 404 | Not found page |
| `/forbidden` | 403 | Access denied |
| `/nonexistent` | 404 | Dynamic 404 for any undefined path |

### Redirect Scenarios

| Endpoint | Type | Target | Description |
|----------|------|--------|-------------|
| `/redirect?to=/page1` | 302 | Dynamic | Redirect to query parameter |
| `/redirect-temp` | 302 | `/page1` | Temporary redirect |
| `/redirect-permanent` | 301 | `/page1` | Permanent redirect |

### Performance Testing

| Endpoint | Delay | Description |
|----------|-------|-------------|
| `/slow` | 2 seconds | Slow loading page |
| `/very-slow` | 4 seconds | Very slow loading page |

### Special Content

| Endpoint | Content-Type | Description |
|----------|--------------|-------------|
| `/api/data` | `application/json` | JSON API response |
| `/empty` | `text/html` | Empty response body |

## Configuration Options

```typescript
interface MockServerOptions {
  /** Port to bind the server to (0 = random available port) */
  port?: number;
  /** Host to bind the server to */
  host?: string;
  /** Base delay for slow responses (ms) */
  baseDelay?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom route handlers */
  customRoutes?: Record<string, RouteHandler>;
}
```

## Custom Scenarios

### Adding Custom Routes

```typescript
const server = new MockNavigationServer({
  customRoutes: {
    '/custom': (req, res, server) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Custom Route</h1>');
    },
    '/api/custom': (req, res, server) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ custom: true }));
    }
  }
});
```

### Adding Navigation Scenarios

```typescript
// Add a custom scenario
server.addScenario({
  name: 'custom-error',
  path: '/custom-error',
  statusCode: 418,
  contentType: 'text/html',
  body: '<h1>418 I\\'m a teapot</h1>',
  delay: 1000
});

// Add a custom redirect
server.addScenario({
  name: 'custom-redirect',
  path: '/goto-home',
  statusCode: 302,
  redirectTo: '/'
});
```

## Advanced Usage

### Lifecycle Management

```typescript
// Start multiple named servers
const server1 = await MockServerLifecycle.startForTest('test-suite-1');
const server2 = await MockServerLifecycle.startForTest('test-suite-2');

// Get existing server by name
const existingServer = MockServerLifecycle.getInstance('test-suite-1');

// Stop specific server
await MockServerLifecycle.stopForTest('test-suite-1');

// Stop all servers
await MockServerLifecycle.stopAll();

// List running servers
const runningServers = MockServerLifecycle.getInstanceNames();
```

### Dynamic Configuration

```typescript
// Start server
const server = new MockNavigationServer({ verbose: true });
await server.start();

// Add scenarios at runtime
server.addScenario({
  name: 'dynamic-page',
  path: '/dynamic',
  body: () => `<h1>Generated at ${new Date()}</h1>`
});

// Remove scenarios
server.removeScenario('/dynamic');

// List all scenarios
const scenarios = server.getScenarios();
```

## Integration with Existing Tests

The enhanced mock server is backward compatible with existing page navigation tests:

### Automatic Integration

The setup.ts file automatically detects and uses the enhanced mock server while maintaining fallback compatibility:

```typescript
// In setup.ts - automatic integration
beforeAll(async () => {
  try {
    // Try enhanced server first
    const enhancedMockServer = await MockServerLifecycle.startForTest('navigation-tests');
    globalThis.navigationTestContext.enhancedMockServer = enhancedMockServer;
    globalThis.navigationTestContext.mockServerPort = enhancedMockServer.port;
  } catch (error) {
    // Fallback to basic server
    const { server, port } = await createMockServer();
    globalThis.navigationTestContext.mockServer = server;
    globalThis.navigationTestContext.mockServerPort = port;
  }
});
```

### Accessing in Tests

```typescript
// Both approaches work
const baseUrl = `http://localhost:${globalThis.navigationTestContext.mockServerPort}`;

// Or access enhanced server directly (if available)
const enhancedServer = globalThis.navigationTestContext.enhancedMockServer;
if (enhancedServer) {
  console.log(`Enhanced server URL: ${enhancedServer.baseUrl}`);
  console.log(`Available scenarios: ${enhancedServer.getScenarios().length}`);
}
```

## Testing Examples

### Basic Navigation Test

```typescript
it('should handle basic navigation flow', async () => {
  const baseUrl = `http://localhost:${globalThis.navigationTestContext.mockServerPort}`;

  // Start at home
  await page.goto(`${baseUrl}/`);
  expect(await page.title()).toBe('Navigation Test Home');

  // Navigate to page 1
  await page.click('a[href="/page1"]');
  expect(await page.title()).toBe('Navigation Test - Page 1');

  // Navigate to page 2
  await page.click('a[href="/page2"]');
  expect(await page.title()).toBe('Navigation Test - Page 2');
});
```

### Error Handling Test

```typescript
it('should handle error responses', async () => {
  const baseUrl = `http://localhost:${globalThis.navigationTestContext.mockServerPort}`;

  // Test 500 error
  const response = await page.goto(`${baseUrl}/error`);
  expect(response?.status()).toBe(500);

  // Test 404 error
  const notFoundResponse = await page.goto(`${baseUrl}/nonexistent`);
  expect(notFoundResponse?.status()).toBe(404);
});
```

### Redirect Test

```typescript
it('should handle redirects correctly', async () => {
  const baseUrl = `http://localhost:${globalThis.navigationTestContext.mockServerPort}`;

  // Test dynamic redirect
  await page.goto(`${baseUrl}/redirect?to=/page2`);
  expect(page.url()).toBe(`${baseUrl}/page2`);

  // Test permanent redirect
  await page.goto(`${baseUrl}/redirect-permanent`);
  expect(page.url()).toBe(`${baseUrl}/page1`);
});
```

### Performance Test

```typescript
it('should handle slow responses', async () => {
  const baseUrl = `http://localhost:${globalThis.navigationTestContext.mockServerPort}`;

  const startTime = Date.now();
  await page.goto(`${baseUrl}/slow`, { timeout: 10000 });
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeGreaterThan(1500); // At least 2 second delay
  expect(await page.title()).toBe('Navigation Test - Slow Page');
});
```

## Troubleshooting

### Server Won't Start

```typescript
// Check if port is already in use
const server = new MockNavigationServer({ port: 3001, verbose: true });
try {
  await server.start();
} catch (error) {
  console.error('Server startup failed:', error.message);
  // Try with random port
  const fallbackServer = new MockNavigationServer({ port: 0 });
  await fallbackServer.start();
}
```

### Memory Leaks

```typescript
// Always clean up in test teardown
afterAll(async () => {
  await MockServerLifecycle.stopAll();
});

// Or stop individual servers
afterEach(async () => {
  await server.stop();
});
```

### Custom Scenarios Not Working

```typescript
// Verify scenario was added
console.log('Available scenarios:', server.getScenarios());

// Check for path conflicts
server.addScenario({
  name: 'test',
  path: '/test',
  body: 'Test content'
});

// Verify with verbose logging
const server = new MockNavigationServer({ verbose: true });
```

## Browser Automation Integration

### With Playwright

```typescript
import { Browser, Page } from 'playwright';
import { createNavigationBrowser, createNavigationPage } from './setup';

describe('Navigation with Enhanced Mock Server', () => {
  let browser: Browser;
  let page: Page;
  let server: MockNavigationServer;

  beforeAll(async () => {
    browser = await createNavigationBrowser();
    server = await MockServerLifecycle.startForTest('playwright-tests', {
      verbose: false
    });
  });

  beforeEach(async () => {
    const context = await browser.newContext();
    page = await createNavigationPage(context);
  });

  afterEach(async () => {
    await page?.close();
  });

  afterAll(async () => {
    await browser?.close();
    await MockServerLifecycle.stopForTest('playwright-tests');
  });

  it('should work with Playwright', async () => {
    await page.goto(server.baseUrl);
    // Test logic here...
  });
});
```

### With Puppeteer

```typescript
import puppeteer from 'puppeteer';

describe('Navigation with Puppeteer', () => {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;
  let server: MockNavigationServer;

  beforeAll(async () => {
    browser = await puppeteer.launch();
    server = new MockNavigationServer();
    await server.start();
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page?.close();
  });

  afterAll(async () => {
    await browser?.close();
    await server?.stop();
  });

  it('should work with Puppeteer', async () => {
    await page.goto(server.baseUrl);
    // Test logic here...
  });
});
```

## Best Practices

### 1. Use Named Lifecycle Management

```typescript
// Good: Named servers for different test suites
await MockServerLifecycle.startForTest('navigation-suite');
await MockServerLifecycle.startForTest('integration-suite');

// Better: Each test file has its own server
await MockServerLifecycle.startForTest(`${__filename}-tests`);
```

### 2. Clean Resource Usage

```typescript
// Always clean up
afterAll(async () => {
  await MockServerLifecycle.stopAll();
});

// Use try/finally for critical cleanup
let server: MockNavigationServer | null = null;
try {
  server = await MockServerLifecycle.startForTest('critical-tests');
  // ... tests
} finally {
  if (server) {
    await MockServerLifecycle.stopForTest('critical-tests');
  }
}
```

### 3. Scenario Organization

```typescript
// Group related scenarios
const server = new MockNavigationServer();

// Add error scenarios
['400', '401', '403', '404', '500', '502'].forEach(code => {
  server.addScenario({
    name: `error-${code}`,
    path: `/error/${code}`,
    statusCode: parseInt(code),
    body: `<h1>${code} Error</h1>`
  });
});

// Add performance scenarios
[1000, 2000, 5000].forEach(delay => {
  server.addScenario({
    name: `slow-${delay}ms`,
    path: `/slow/${delay}`,
    delay: delay,
    body: () => `<h1>Delayed ${delay}ms</h1>`
  });
});
```

### 4. Test Isolation

```typescript
// Each test gets fresh server state
beforeEach(async () => {
  // Reset server to default scenarios
  const server = MockServerLifecycle.getInstance('test-suite');
  if (server) {
    // Clear custom scenarios
    const defaultScenarios = ['/','/ page1', '/page2', '/page3', '/error', '/slow'];
    server.getScenarios()
      .filter(s => !defaultScenarios.includes(s.path))
      .forEach(s => server.removeScenario(s.path));
  }
});
```

This enhanced mock server provides a robust foundation for testing navigation scenarios while maintaining backward compatibility with existing test infrastructure.