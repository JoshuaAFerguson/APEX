# Test Setup & Teardown Usage Guide

This guide provides comprehensive examples of how to use the APEX test setup and teardown utilities to create consistent, clean, and maintainable tests across all packages.

## Quick Start

The `createTestSuite()` function provides a standardized way to set up and tear down test environments:

```typescript
import { createTestSuite } from '@apex/core/test-fixtures';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MyFeature', () => {
  const suite = createTestSuite();

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);

  it('should work properly', () => {
    // Your test here - environment is automatically set up and cleaned
  });
});
```

## Package-Specific Patterns

### CLI Package Tests

For CLI component tests that need mocks and state isolation:

```typescript
import { createTestSuite, setTestData, getTestData } from '@apex/core/test-fixtures';

describe('SessionStore', () => {
  const suite = createTestSuite({
    setupMocks: true,
    mockConfig: {
      mockFs: true,
      mockData: {
        fileSystemData: {
          '/test/project/.apex/sessions/session1.json': '{"id": "session1"}',
        },
        envVars: {
          'APEX_PROJECT_PATH': '/test/project',
        }
      }
    },
    customSetup: async () => {
      setTestData('sessionStore', new SessionStore('/test/project'));
    }
  });

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);

  it('should load sessions from filesystem', async () => {
    const store = getTestData('sessionStore');
    const sessions = await store.loadSessions();
    expect(sessions).toHaveLength(1);
  });
});
```

### Orchestrator Package Tests

For orchestrator tests that need database and agent mocking:

```typescript
import { createTestSuite, addCleanupTask } from '@apex/core/test-fixtures';

describe('ApexOrchestrator', () => {
  const suite = createTestSuite({
    setupMocks: true,
    timeout: 60000,
    mockConfig: {
      customMocks: {
        claudeAgent: vi.fn(),
        taskStore: vi.fn(),
      },
      mockData: {
        envVars: {
          'ANTHROPIC_API_KEY': 'test-key',
        }
      }
    },
    customSetup: async () => {
      // Initialize test database
      const testDb = await initializeTestDatabase();
      addCleanupTask(() => testDb.close());
    }
  });

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);

  it('should execute task workflow', async () => {
    // Test orchestrator functionality
  });
});
```

### Core Package Tests

For core utility and type validation tests:

```typescript
import { createTestSuite } from '@apex/core/test-fixtures';

describe('Config Validation', () => {
  const suite = createTestSuite({
    cleanupAfterEach: true,
    setupMocks: false, // Pure logic tests don't need mocks
  });

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);

  it('should validate configuration schemas', () => {
    // Pure validation logic tests
  });
});
```

### API Package Tests

For API endpoint and WebSocket tests:

```typescript
import { createTestSuite, createMockFunction } from '@apex/core/test-fixtures';

describe('API Endpoints', () => {
  const suite = createTestSuite({
    setupMocks: true,
    mockConfig: {
      mockNetwork: true,
      customMocks: {
        orchestrator: createMockFunction('orchestrator'),
      },
      mockData: {
        apiResponses: {
          '/api/tasks': { tasks: [] },
          '/api/status': { status: 'healthy' },
        }
      }
    }
  });

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);

  it('should handle task creation requests', async () => {
    // API endpoint tests
  });
});
```

## Advanced Patterns

### Custom Cleanup Tasks

Register cleanup tasks that run during teardown:

```typescript
import { addCleanupTask, createTempDir } from '@apex/core/test-fixtures';

it('should handle file operations', async () => {
  const tempDir = await createTempDir();
  const resource = await openExpensiveResource();

  addCleanupTask(async () => {
    await resource.close();
    // tempDir cleanup is automatic
  });

  // Test with temporary files and resources
});
```

### Timer-based Tests

For tests involving timers and delays:

```typescript
import { createTestSuite, advanceTimers, flushTimers } from '@apex/core/test-fixtures';

describe('Timer Operations', () => {
  const suite = createTestSuite({
    useFakeTimers: true, // Enables fake timers automatically
  });

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);

  it('should handle delayed operations', async () => {
    const callback = vi.fn();
    setTimeout(callback, 5000);

    expect(callback).not.toHaveBeenCalled();
    await advanceTimers(5000);
    expect(callback).toHaveBeenCalled();
  });

  it('should flush all pending timers', async () => {
    const callback = vi.fn();
    setTimeout(callback, 1000);
    setTimeout(callback, 2000);

    await flushTimers(); // Runs all pending timers
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
```

### State Management Between Tests

Use test data helpers for sharing state:

```typescript
import { setTestData, getTestData } from '@apex/core/test-fixtures';

describe('Stateful Operations', () => {
  // ... suite setup

  it('should store user session', () => {
    const session = { userId: '123', token: 'abc' };
    setTestData('userSession', session);

    // Session is available for the test duration
    expect(getTestData('userSession')).toEqual(session);
  });

  it('should start with clean state', () => {
    // Each test gets fresh state automatically
    expect(getTestData('userSession')).toBeUndefined();
  });
});
```

### Error Resilient Tests

Handle cleanup failures gracefully:

```typescript
const suite = createTestSuite({
  customTeardown: async () => {
    // Custom teardown that might fail
    await riskyCleanupOperation();
  }
});
// Failed teardown operations are logged but don't break the test run
```

## Browser Testing Patterns

### Error Page Testing

For testing error states and error page behavior:

```typescript
import {
  ErrorPageFixture,
  createErrorFixtureHooks,
  withErrorFixture,
  ERROR_SCENARIOS
} from '@apex/core/test-fixtures';

// Method 1: Manual fixture management
describe('Error Page Behavior', () => {
  let fixture: ErrorPageFixture;

  beforeEach(() => {
    fixture = new ErrorPageFixture();
  });

  afterEach(async () => {
    if (fixture.isSetup()) {
      await fixture.teardown();
    }
  });

  it('should handle 404 errors correctly', async () => {
    await fixture.simulateError('404-not-found');

    const browserState = fixture.getBrowserState();
    expect(browserState.hasError).toBe(true);
    expect(browserState.title).toContain('404');

    const validation = await fixture.validate();
    expect(validation.valid).toBe(true);
  });
});

// Method 2: Using fixture hooks
describe('Error Scenarios', () => {
  const { setup, teardown } = createErrorFixtureHooks('500-internal-error', {
    expectedUrl: 'https://myapp.com/error',
    expectedTitle: 'Server Error'
  });

  let fixture: ErrorPageFixture;

  beforeEach(async () => {
    fixture = await setup();
  });

  afterEach(teardown);

  it('should clear authentication on server errors', () => {
    const browserState = fixture.getBrowserState();
    expect(browserState.isAuthenticated).toBe(false);
  });
});

// Method 3: Higher-order function (most concise)
describe('Network Error Handling', () => {
  it('should handle network timeouts', withErrorFixture('network-timeout', async (fixture) => {
    const browserState = fixture.getBrowserState();
    expect(browserState.hasError).toBe(true);
    expect(browserState.consoleMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('timeout')
        })
      ])
    );
  }));

  // Test multiple scenarios
  it.each(['404-not-found', '500-internal-error', 'network-timeout'])(
    'should handle %s correctly',
    withErrorFixture(async (fixture, scenario) => {
      expect(fixture.state.config.scenario).toBe(scenario);

      const validation = await fixture.validate();
      expect(validation.valid).toBe(true);
    })
  );
});
```

### Custom Error Scenarios

Create custom error configurations:

```typescript
it('should handle custom API validation errors', async () => {
  const fixture = new ErrorPageFixture();

  try {
    await fixture.setup({
      name: 'API Validation Error',
      description: 'Test custom validation error handling',
      scenario: '422-validation-error' as any, // Custom scenario
      statusCode: 422,
      statusText: 'Unprocessable Entity',
      category: 'client',
      expectedTitle: 'Validation Error',
      mockResponse: {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors: [
            { field: 'email', message: 'Invalid email format' },
            { field: 'password', message: 'Password too short' }
          ]
        }),
        delay: 100
      }
    });

    const browserState = fixture.getBrowserState();
    expect(browserState.hasError).toBe(true);

    // Test mock fetch functionality
    const mockFetch = fixture.state.activeMocks.get('fetch');
    const response = await mockFetch('https://api.example.com/users');
    expect(response.status).toBe(422);

  } finally {
    await fixture.teardown();
  }
});
```

### Browser State Testing

Test complex browser state scenarios:

```typescript
import { browserFixtures, browserHelpers } from '@apex/core/test-fixtures';

describe('Browser State Management', () => {
  it('should create logged-in user state', () => {
    const state = browserFixtures.loggedInPage({
      url: 'https://myapp.com/dashboard',
      localStorage: { theme: 'dark' }
    });

    expect(state.isAuthenticated).toBe(true);
    expect(state.url).toBe('https://myapp.com/dashboard');
    expect(state.localStorage.theme).toBe('dark');
  });

  it('should simulate user logout', () => {
    let state = browserFixtures.loggedInPage();
    expect(state.isAuthenticated).toBe(true);

    state = browserHelpers.simulateLogout(state);
    expect(state.isAuthenticated).toBe(false);
    expect(state.localStorage['auth-token']).toBeUndefined();
  });

  it('should add console messages', () => {
    let state = browserFixtures.cleanState();

    state = browserHelpers.addConsoleMessage(state, 'error', 'Test error message');

    expect(state.consoleMessages).toEqual([
      expect.objectContaining({
        type: 'error',
        message: 'Test error message'
      })
    ]);
  });
});
```

## Migration from Manual Patterns

### Before (Manual Pattern)

```typescript
describe('MyFeature', () => {
  let mockStore: any;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStore = vi.fn();
    vi.mock('fs/promises', () => ({ readFile: vi.fn() }));
    tempDir = await fs.mkdtemp('/tmp/test-');
  });

  afterEach(async () => {
    vi.resetAllMocks();
    vi.unmock('fs/promises');
    await fs.rm(tempDir, { recursive: true });
  });
});
```

### After (Using Test Utilities)

```typescript
describe('MyFeature', () => {
  const suite = createTestSuite({
    setupMocks: true,
    mockConfig: {
      mockFs: true,
      customMocks: { store: vi.fn() }
    },
    customSetup: async () => {
      await createTempDir(); // Automatic cleanup
    }
  });

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);
});
```

## Best Practices

1. **Always use `createTestSuite()`** for consistent test environments
2. **Enable cleanup** with `cleanupAfterEach: true` (default)
3. **Use `addCleanupTask()`** for custom resource cleanup
4. **Use `setTestData()`** for sharing data within a test
5. **Enable mocks only when needed** to keep tests fast
6. **Use fake timers** for time-dependent tests
7. **Register cleanup tasks** for any resources that need manual cleanup

## Common Configurations

### Lightweight (Pure Logic Tests)
```typescript
const suite = createTestSuite({
  setupMocks: false,
  cleanupAfterEach: true,
});
```

### Standard (Most Tests)
```typescript
const suite = createTestSuite({
  setupMocks: true,
  mockConfig: { mockFs: true },
});
```

### Heavy Integration Tests
```typescript
const suite = createTestSuite({
  setupMocks: true,
  timeout: 60000,
  mockConfig: {
    mockFs: true,
    mockNetwork: true,
    mockTimers: false, // Keep real timers for integration
  },
  customSetup: async () => {
    // Initialize test databases, services, etc.
  }
});
```

## Troubleshooting

### Tests hanging or not cleaning up properly
- Ensure `afterEach(suite.afterEach)` is called
- Check that all async cleanup tasks are properly awaited
- Use `addCleanupTask()` for manual resource cleanup

### Mock conflicts between tests
- Enable `cleanupAfterEach: true` (default)
- Avoid global mock modifications outside the test suite

### Memory leaks in test environment
- Use `getTestEnvironment()` to inspect active mocks and cleanup tasks
- Ensure all registered cleanup tasks are lightweight

For more examples, see the comprehensive test suite in `__tests__/setup-teardown.test.ts`.