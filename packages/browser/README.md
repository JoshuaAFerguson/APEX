# @apexcli/browser

Browser automation capabilities for APEX using Playwright. This package provides browser automation tools for AI agents with comprehensive lifecycle management.

## Features

- **Browser Instance Management**: Centralized management of browser instances with pooling and reuse
- **Context Isolation**: Create isolated browser contexts for different automation tasks
- **Resource Monitoring**: Track memory usage and automatically cleanup idle instances
- **Console & Error Capture**: Real-time capture of browser console messages and JavaScript errors
- **Screenshot Support**: Capture full-page or element-specific screenshots
- **Element Interaction**: Click, type, scroll, and interact with page elements
- **Navigation Control**: Advanced navigation with wait strategies and timeout controls
- **Event Streaming**: Real-time events for browser and context lifecycle

## Quick Start

```typescript
import { createBrowserManager, createBrowserSession } from '@apexcli/browser';

// Create a browser manager
const manager = createBrowserManager({
  maxInstances: 5,
  reuseInstances: true
});

// Create and launch a browser session
const session = createBrowserSession(manager, {
  browserType: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 720 }
});

await session.launch();

// Navigate and interact with pages
await session.navigate('https://example.com');
await session.click('button#submit');
await session.type('#input', 'Hello World');

// Take screenshots
const screenshot = await session.screenshot({ fullPage: true });

// Clean up
await session.close();
await manager.shutdown();
```

## Core Classes

### BrowserManager

Manages browser instances and their lifecycle:

```typescript
import { BrowserManager } from '@apexcli/browser';

const manager = new BrowserManager({
  maxInstances: 3,
  instanceIdleTimeout: 300000, // 5 minutes
  reuseInstances: true,
  resourceLimits: {
    maxMemoryMB: 1024,
    maxCpuPercent: 80
  }
});

// Launch browser instance
const result = await manager.launchBrowser({ browserType: 'chromium' });

// Create isolated contexts
const context = await manager.createContext(result.data.id);

// Monitor resource usage
const usage = await manager.getResourceUsage();
console.log(`Active instances: ${usage.totalInstances}`);
```

### BrowserSession

High-level interface for browser automation:

```typescript
import { BrowserSession } from '@apexcli/browser';

const session = new BrowserSession(manager, {
  browserType: 'firefox',
  headless: false,
  userAgent: 'Custom Agent String'
});

await session.launch();

// Page navigation
await session.navigate('https://example.com', {
  waitUntil: 'networkidle',
  timeout: 30000
});

// Element interaction
await session.click({ type: 'testId', value: 'submit-button' });
await session.waitForElement('#result', { state: 'visible' });

// JavaScript evaluation
const result = await session.evaluate(() => {
  return document.title;
});

// Console monitoring
session.on('consoleMessage', (message) => {
  console.log(`Browser: ${message.text}`);
});
```

## Configuration Options

### Browser Session Config

```typescript
interface BrowserSessionConfig {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport?: { width: number; height: number };
  timeout?: number;
  userAgent?: string;
  ignoreHTTPSErrors?: boolean;
  launchOptions?: LaunchOptions;
  contextOptions?: BrowserContextOptions;
}
```

### Manager Config

```typescript
interface BrowserManagerConfig {
  maxInstances?: number;
  defaultSessionConfig?: Partial<BrowserSessionConfig>;
  instanceIdleTimeout?: number;
  reuseInstances?: boolean;
  resourceLimits?: {
    maxMemoryMB?: number;
    maxCpuPercent?: number;
  };
}
```

### Capture Config

```typescript
interface CaptureConfig {
  captureConsole: boolean;
  consoleLevels?: ConsoleLogLevel[];
  captureErrors: boolean;
  maxBufferSize?: number;
  includeStackTraces?: boolean;
}
```

## Element Selectors

Support for multiple selector types:

```typescript
// String selectors
await session.click('#button');
await session.click('[data-testid="submit"]');

// Typed selectors
await session.click({ type: 'css', value: '#button' });
await session.click({ type: 'xpath', value: '//button[text()="Submit"]' });
await session.click({ type: 'text', value: 'Click me' });
await session.click({ type: 'role', value: 'button' });
await session.click({ type: 'testId', value: 'submit-btn' });
```

## Error Handling

All browser operations return a standardized result format:

```typescript
interface BrowserActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
}

const result = await session.navigate('https://example.com');
if (result.success) {
  console.log(`Navigated to: ${result.data}`);
} else {
  console.error(`Navigation failed: ${result.error}`);
}
```

## Resource Management

The browser manager automatically:

- Limits concurrent browser instances
- Reuses instances when possible
- Monitors memory and CPU usage
- Cleans up idle instances
- Provides resource usage statistics

```typescript
// Get current resource usage
const usage = await manager.getResourceUsage();
console.log(`Memory: ${usage.memoryUsageMB}MB`);
console.log(`Active browsers: ${usage.activeBrowsers}`);

// Force cleanup of idle instances
const cleanedCount = await manager.cleanupIdleInstances();
console.log(`Cleaned up ${cleanedCount} idle instances`);

// Listen for resource limit events
manager.on('resourceLimitExceeded', (info) => {
  console.warn(`${info.type} limit exceeded: ${info.value}/${info.limit}`);
});
```

## Event Monitoring

Real-time events for monitoring and debugging:

```typescript
// Browser lifecycle events
manager.on('browserCreated', (info) => {
  console.log(`Browser created: ${info.id} (${info.type})`);
});

manager.on('contextCreated', (info) => {
  console.log(`Context created: ${info.id}`);
});

// Console and error capture
session.on('consoleMessage', (message) => {
  console.log(`[${message.type}] ${message.text}`);
});

session.on('javascriptError', (error) => {
  console.error(`JS Error: ${error.message}`);
});

session.on('pageError', (error) => {
  console.error(`Page Error: ${error.message}`);
});
```

## Testing

Run the test suite:

```bash
npm test
```

The package includes comprehensive tests for:
- Browser manager lifecycle
- Session management
- Element interaction
- Error handling
- Resource management
- Integration scenarios

## Dependencies

- **playwright**: Browser automation library
- **eventemitter3**: Event emitter for real-time events
- **@apexcli/core**: Core APEX types and utilities

## License

MIT - See LICENSE file for details