# APEX Test Utilities

This directory contains shared test utilities, configurations, and helpers for the APEX monorepo.

## Structure

```
test-utils/
├── index.ts              # Central export of all test utilities
└── README.md            # This file

Root level:
├── test-setup.ts         # Shared test environment setup
├── vitest.shared.config.ts # Shared Vitest configurations
├── vitest.config.ts      # Main configuration using shared base
├── vitest.unit.config.ts # Unit test specific configuration
└── vitest.e2e.config.ts  # E2E test specific configuration
```

## Quick Start

### 1. Package Test Setup

For packages that need their own test setup, create a setup file:

```typescript
// packages/[package]/src/__tests__/setup.ts
import { setupGlobalTestEnvironment } from '../../../../test-setup.js';

// Setup appropriate environment for this package
setupGlobalTestEnvironment({
  setupConsole: true,
  setupMocks: true,
  setupTimeouts: true,
  setupAsync: true,
});
```

### 2. Using Shared Vitest Configuration

For packages that need custom vitest config:

```typescript
// packages/[package]/vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import { createSharedConfig } from '../../vitest.shared.config.js';

export default mergeConfig(
  createSharedConfig('node'), // or 'jsdom' for UI components
  defineConfig({
    test: {
      setupFiles: ['../../test-setup.ts'],
      // package-specific overrides
    },
  })
);
```

### 3. Importing Test Utilities

```typescript
// In your test files
import {
  // Setup utilities
  createMockCleanup,
  createTimerCleanup,
  createFileSystemMock,

  // Test helpers
  factories,
  assertions,
  mocks,

  // APEX-specific helpers
  apexTestHelpers,
  TEST_CONSTANTS,
} from '../../test-utils';
```

## Available Utilities

### Core Test Utilities (from @apexcli/core)

#### Mock Management
- `createMockCleanup()` - Automatic mock cleanup between tests
- `createTimerCleanup()` - Automatic timer management
- `createFileSystemMock()` - Mock file system operations
- `createCompressionMock()` - Mock compression operations
- `createCompleteTestSetup()` - All-in-one test environment

#### Platform Utilities
- `isWindows()`, `isUnix()`, `isMacOS()`, `isLinux()` - Platform detection
- `skipOnWindows()`, `skipOnUnix()`, `skipOnMacOS()` - Conditional test skipping

#### Test Helpers
- `createMockSession()` - Create mock session objects
- `createMockMessage()` - Create mock message objects
- `createMockStore()` - Create mock store with all methods
- `advanceTimersAndRun()` - Advance timers and run promises
- `withTestTimeout()` - Wrap tests with timeout protection
- `expectRejection()` - Assert promise rejection with specific error
- `createResourceCleanup()` - Manual resource cleanup management

### Shared Test Environment (from test-setup.ts)

#### Global Setup
```typescript
setupGlobalTestEnvironment({
  setupConsole: true,    // Mock console methods
  setupMocks: true,      // Setup common mocks
  setupTimeouts: true,   // Setup timeout helpers
  setupAsync: true,      // Setup async utilities
  globalTimeout: 5000,   // Default test timeout
});
```

#### Global Utilities (available after setup)
- `flushPromises()` - Wait for all microtasks
- `nextTick()` - Wait for next tick
- `sleep(ms)` - Sleep for specified milliseconds
- `waitFor(condition, options)` - Wait for condition to be true
- `withTimeout(promise, timeout)` - Add timeout to promise

#### Factories
```typescript
factories.createTestId('prefix') // -> 'prefix-timestamp-random'
factories.createTestDate(offset) // -> consistent test date
factories.createTestPath('a', 'b') // -> '/test/project/a/b'
```

#### Assertions
```typescript
assertions.assertDefined(value)
assertions.assertLength(array, length)
assertions.assertRejectsWithError(promise, ErrorClass, message)
assertions.assertHasProperties(obj, ['prop1', 'prop2'])
```

#### Mocks
```typescript
const fn = mocks.createTypedMock<(x: string) => number>()
const partial = mocks.createPartialMock<SomeInterface>({ prop: 'value' })
const MockedClass = mocks.mockClass(SomeClass, { method: vi.fn() })
```

### APEX-Specific Helpers

#### Configuration Mocks
```typescript
const config = apexTestHelpers.createMockApexConfig({
  autonomy: { maxCost: 20.0 }
});
```

#### Task Mocks
```typescript
const task = apexTestHelpers.createMockTask({
  name: 'Custom Task',
  status: 'running'
});
```

#### Workflow Mocks
```typescript
const execution = apexTestHelpers.createMockWorkflowExecution({
  currentStage: 'implementation'
});
```

## Configuration Types

### Shared Config Functions

1. `createSharedConfig(environment, options)` - Base configuration
2. `createUnitTestConfig(options)` - Unit test optimized config
3. `createIntegrationTestConfig(options)` - Integration test config
4. `createE2ETestConfig(options)` - E2E test config
5. `createBrowserTestConfig(environment, options)` - Browser test config

### Environment Options
- `'node'` - Node.js environment (default)
- `'jsdom'` - Browser DOM environment
- `'happy-dom'` - Alternative browser DOM environment

## Best Practices

### 1. Test Organization

```typescript
describe('MyComponent', () => {
  // Use appropriate cleanup
  createMockCleanup();
  createTimerCleanup();

  // Setup mocks
  const mockFs = createFileSystemMock();

  describe('when configured properly', () => {
    beforeEach(() => {
      // Test-specific setup
      mockFs.readFile.mockResolvedValue('test data');
    });

    it('should work correctly', async () => {
      // Test implementation
    });
  });
});
```

### 2. Environment-Specific Tests

```typescript
// Unit tests - fast, isolated
describe('Unit: UserService', () => {
  const { mockFs } = createCompleteTestSetup();

  it('should parse user data', () => {
    mockFs.readFile.mockResolvedValue('{"name":"test"}');
    // Test with mocks
  });
});

// Integration tests - real dependencies
describe('Integration: UserService', () => {
  it('should read real config file', async () => {
    // Test with real file system
  });
});
```

### 3. Cross-Platform Testing

```typescript
describe('File Operations', () => {
  it('should work on Unix systems', () => {
    skipOnWindows();
    // Unix-specific test
  });

  it('should work on Windows', () => {
    skipOnUnix();
    // Windows-specific test
  });
});
```

### 4. Async Testing

```typescript
describe('Async Operations', () => {
  createTimerCleanup();

  it('should handle timeouts', async () => {
    const slowOperation = new SlowOperation();

    // Fast-forward time
    vi.advanceTimersByTime(5000);
    await vi.runAllTimersAsync();

    expect(slowOperation.isComplete).toBe(true);
  });

  it('should wait for conditions', async () => {
    await waitFor(() => someCondition(), { timeout: 1000 });
  });
});
```

## Running Tests

```bash
# All tests
npm test

# Unit tests only (fast)
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode
npm run test:unit:watch
npm run test:e2e:watch

# Coverage
npm run test:coverage
```

## Contributing

When adding new test utilities:

1. Add them to the appropriate package (core for general utilities)
2. Export from `test-utils/index.ts`
3. Document in this README
4. Add TypeScript types
5. Include JSDoc comments with examples
6. Write tests for the utilities themselves