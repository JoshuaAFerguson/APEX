# Browser Automation Mocks

Mock implementations of browser automation classes for testing and simulation without actually launching browsers.

## Overview

The browser mocks package provides:

- **MockBrowserSession**: Mock implementation of BrowserSession
- **MockBrowserManager**: Mock implementation of BrowserManager
- **MockScenarioBuilder**: Fluent API for configuring mock behaviors
- **Common Scenarios**: Pre-built configurations for common testing scenarios

## Features

- ✅ **Full API compatibility** with real browser automation classes
- ✅ **Configurable success/failure scenarios**
- ✅ **Realistic operation delays** or fast test execution
- ✅ **Event emission** for testing event handlers
- ✅ **Operation tracking** for test verification
- ✅ **TypeScript interfaces** with full type safety

## Quick Start

### Basic Usage

```typescript
import { createMockBrowserSession, launchMockBrowser } from '@apexcli/browser/mocks';

// Create a mock session
const session = createMockBrowserSession({
  mockConfig: {
    defaultSuccess: true,
    defaultDelay: 10, // Fast for testing
    useRealisticDelays: false,
  }
});

// Launch and use like a real browser session
await session.launch();
await session.navigate('https://example.com');
await session.clickElement('#button');
const screenshot = await session.captureScreenshot();

// Or use the convenience launcher
const result = await launchMockBrowser();
if (result.success) {
  const session = result.data;
  // Use session...
}
```

### Scenario Configuration

```typescript
import { createMockScenario } from '@apexcli/browser/mocks';

// Build complex scenarios
const scenario = createMockScenario()
  .forUrl('https://login.app.com')
    .loadTime(1000)
    .withTitle('Login Page')
  .and()
  .forElement('#username')
    .exists()
    .visible()
    .enabled()
  .and()
  .forElement('#submit')
    .exists()
    .visible()
    .enabled()
    .withText('Sign In')
  .and()
  .forOperation('login')
    .succeeds()
    .withDelay(500)
  .and()
  .build();

const session = createMockBrowserSession({}, scenario);
```

### Common Scenarios

```typescript
import { commonScenarios } from '@apexcli/browser/mocks';

// Fast success for most tests
const fastScenario = commonScenarios.fastSuccess();

// Network failure simulation
const networkErrorScenario = commonScenarios.navigationFailure('Network timeout');

// Slow network conditions
const slowScenario = commonScenarios.slowNetwork();

// Missing elements
const missingElementsScenario = commonScenarios.elementsNotFound(['#missing1', '.missing2']);

// Form interaction setup
const formScenario = commonScenarios.formInteraction('#contact-form');
```

## Mock Configuration

### MockBehaviorConfig

```typescript
interface MockBehaviorConfig {
  defaultSuccess: boolean;        // Whether operations succeed by default
  defaultDelay: number;          // Default delay in milliseconds
  failureRate?: number;          // Random failure rate (0-1)
  useRealisticDelays: boolean;   // Whether to use realistic timing
}
```

### MockScenarioConfig

Configure specific behaviors:

```typescript
interface MockScenarioConfig {
  operations?: {
    [operationName: string]: {
      success: boolean;
      delay?: number;
      error?: string;
      returnValue?: any;
    };
  };
  urlBehaviors?: {
    [url: string]: {
      loadTime?: number;
      shouldFail?: boolean;
      error?: string;
    };
  };
  elementBehaviors?: {
    [selector: string]: {
      exists?: boolean;
      visible?: boolean;
      enabled?: boolean;
      text?: string;
      value?: string;
    };
  };
}
```

## Testing Utilities

### Fast Test Session

```typescript
import { createMockSessionForTesting } from '@apexcli/browser/mocks';

const session = createMockSessionForTesting('my-test', {
  mockConfig: {
    defaultDelay: 1, // Very fast
    useRealisticDelays: false,
  }
});
```

### Unreliable Session

```typescript
import { createUnreliableMockSession } from '@apexcli/browser/mocks';

// 30% failure rate
const unreliableSession = createUnreliableMockSession(0.3);
```

### Operation Tracking

```typescript
await session.launch();
await session.navigate('https://example.com');
await session.clickElement('#button');

// Check operation history
const operations = session.getOperationHistory();
console.log(operations.map(op => op.name)); // ['launch', 'navigate', 'clickElement']

// Check timing and success
operations.forEach(op => {
  console.log(`${op.name}: ${op.success ? 'success' : 'failed'} (${op.endTime - op.startTime}ms)`);
});
```

## Event Handling

Mock classes emit the same events as real browser classes:

```typescript
session.on('navigation', (result) => {
  console.log(`Navigated to ${result.url} in ${result.loadTime}ms`);
});

session.on('elementInteraction', (selector, action, success) => {
  console.log(`${action} on ${selector}: ${success ? 'success' : 'failed'}`);
});

session.on('screenshot', (options, result) => {
  console.log(`Screenshot captured: ${result.format} ${result.width}x${result.height}`);
});

manager.on('browserCreated', (info) => {
  console.log(`Browser instance ${info.id} created`);
});
```

## Advanced Usage

### Custom Response Factory

```typescript
import type { MockResponseFactory } from '@apexcli/browser/mocks';

const customResponseFactory: MockResponseFactory = (operationName, args) => {
  if (operationName === 'navigate' && args[0].includes('error.com')) {
    return {
      success: false,
      error: 'Blocked domain',
      delay: 100
    };
  }
  return {
    success: true,
    delay: Math.random() * 100,
  };
};
```

### Page State Inspection

```typescript
await session.navigate('https://example.com');
await session.typeInElement('#input', 'test value');

const pageState = session.getPageState();
console.log('Current URL:', pageState.url);
console.log('Page title:', pageState.title);
console.log('Elements:', Array.from(pageState.elements.keys()));

const inputElement = pageState.elements.get('#input');
console.log('Input value:', inputElement?.value);
```

## TypeScript Support

All mock classes provide full TypeScript support with the same interfaces as real browser automation:

```typescript
import type {
  BrowserActionResult,
  MockBrowserSession,
  MockBehaviorConfig
} from '@apexcli/browser/mocks';

async function testWorkflow(session: MockBrowserSession): Promise<BrowserActionResult<void>> {
  const result = await session.navigate('https://example.com');
  if (!result.success) {
    return { success: false, error: result.error!, duration: result.duration };
  }

  return { success: true, duration: result.duration };
}
```