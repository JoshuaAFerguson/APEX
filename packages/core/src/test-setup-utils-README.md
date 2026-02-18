# Test Setup Utilities

This module provides reusable beforeEach/afterEach helper functions for common testing patterns in the APEX project.

## Overview

The `test-setup-utils.ts` module contains utility functions that automatically set up and tear down test environments using Vitest's `beforeEach` and `afterEach` hooks. This promotes consistency and reduces boilerplate in test files.

## Quick Start

### Basic Mock Cleanup

```typescript
import { createMockCleanup } from '@apex/core/test-setup-utils';

describe('My Component', () => {
  createMockCleanup(); // Automatically clears/resets mocks between tests

  it('should work with clean mocks', () => {
    const mockFn = vi.fn().mockReturnValue('test');
    expect(mockFn()).toBe('test');
    // Mock is automatically cleaned up after test
  });
});
```

### Timer Management

```typescript
import { createTimerCleanup, advanceTimersAndRun } from '@apex/core/test-setup-utils';

describe('Timer-dependent Code', () => {
  createTimerCleanup(); // Automatically manages fake/real timers

  it('should handle auto-save functionality', async () => {
    const autoSaver = new SessionAutoSaver(mockStore, { intervalMs: 1000 });
    await autoSaver.start();

    await advanceTimersAndRun(1000); // Fast-forward 1 second

    expect(mockStore.updateSession).toHaveBeenCalled();
  });
});
```

### File System Mocking

```typescript
import { createFileSystemMock, createMockCleanup } from '@apex/core/test-setup-utils';

describe('File Operations', () => {
  const mockFs = createFileSystemMock();
  createMockCleanup();

  it('should read session files', async () => {
    const sessionData = { id: 'test', name: 'Test Session' };
    mockFs.readFile.mockResolvedValue(JSON.stringify(sessionData));

    const result = await sessionStore.getSession('test');
    expect(result).toEqual(sessionData);
  });
});
```

### Complete Test Environment

```typescript
import { createCompleteTestSetup } from '@apex/core/test-setup-utils';

describe('Integration Test', () => {
  const { mockFs, mockCompression } = createCompleteTestSetup();

  it('should handle complex operations', async () => {
    // File system and compression mocks are automatically set up
    mockFs.readFile.mockResolvedValue(JSON.stringify({ data: 'test' }));
    mockCompression.gzip.mockResolvedValue(Buffer.from('compressed'));

    // Fast-forward time if needed
    vi.advanceTimersByTime(5000);

    // Test your operations
  });
});
```

## Available Utilities

### Core Setup Functions

- **`createMockCleanup(options?)`** - Sets up automatic mock clearing/resetting
- **`createTimerCleanup(options?)`** - Manages fake/real timers
- **`createFileSystemMock()`** - Provides comprehensive fs mocking
- **`createCompressionMock()`** - Sets up zlib compression mocking
- **`createCompleteTestSetup(options?)`** - Combines all setup utilities

### Mock Object Factories

- **`createMockSession(overrides?)`** - Creates mock session objects
- **`createMockMessage(overrides?)`** - Creates mock message objects
- **`createMockStore(projectPath?)`** - Creates mock store with all methods

### Helper Functions

- **`advanceTimersAndRun(ms)`** - Advances timers and runs async operations
- **`withTestTimeout(testFn, timeout?)`** - Wraps tests with timeout protection
- **`expectRejection(promise, errorMessage)`** - Asserts promise rejection
- **`createResourceCleanup()`** - Manual resource cleanup management

## Patterns and Best Practices

### 1. Test Isolation

Always use `createMockCleanup()` to ensure tests don't interfere with each other:

```typescript
describe('Component Tests', () => {
  createMockCleanup(); // Essential for test isolation

  // Your tests here
});
```

### 2. Timer Testing

Use `createTimerCleanup()` for any code that uses timers, intervals, or timeouts:

```typescript
describe('Auto-save Feature', () => {
  createTimerCleanup(); // Required for timer-dependent code

  it('should save after interval', async () => {
    // Set up your component
    await advanceTimersAndRun(5000); // Fast-forward time
    // Verify behavior
  });
});
```

### 3. File System Operations

Mock file system operations consistently:

```typescript
describe('Session Storage', () => {
  const mockFs = createFileSystemMock();
  createMockCleanup();

  it('should handle file errors', async () => {
    mockFs.readFile.mockRejectedValue(new Error('File not found'));

    const result = await sessionStore.getSession('missing');
    expect(result).toBeNull();
  });
});
```

### 4. Error Testing

Use `expectRejection` for consistent error testing:

```typescript
describe('Error Handling', () => {
  it('should reject invalid operations', async () => {
    await expectRejection(
      service.performInvalidOperation(),
      /Invalid operation/
    );
  });
});
```

### 5. Resource Management

Use `createResourceCleanup()` when tests create resources that need manual cleanup:

```typescript
describe('Database Tests', () => {
  const { addCleanup } = createResourceCleanup();

  it('should manage database connections', async () => {
    const connection = await connectToTestDB();
    addCleanup(() => connection.close());

    // Use connection - automatically cleaned up
  });
});
```

## Configuration Options

### Mock Cleanup Options

```typescript
createMockCleanup({
  clearMocks: true,  // Clear call history in beforeEach (default: true)
  resetMocks: true   // Reset implementations in afterEach (default: true)
});
```

### Timer Cleanup Options

```typescript
createTimerCleanup({
  useFakeTimers: true,  // Use fake timers in beforeEach (default: true)
  useRealTimers: true   // Restore real timers in afterEach (default: true)
});
```

### Complete Setup Options

```typescript
createCompleteTestSetup({
  mockCleanup: { clearMocks: false },
  timerCleanup: { useFakeTimers: false }
});
```

## Import Paths

The test setup utilities are available through multiple import paths:

```typescript
// Direct import from the module
import { createMockCleanup } from '@apex/core/test-setup-utils';

// Import from source (for development)
import { createMockCleanup } from '@apex/core/src/test-setup-utils';
```

## Examples

See `test-setup-utils.examples.test.ts` for comprehensive examples of all utilities in action.

## Migration from Manual Setup

### Before (Manual Setup)

```typescript
describe('Component', () => {
  let mockStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockStore = {
      createSession: vi.fn(),
      getSession: vi.fn(),
      // ... more mocks
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  // Tests...
});
```

### After (Using Utilities)

```typescript
describe('Component', () => {
  createMockCleanup();
  createTimerCleanup();
  const mockStore = createMockStore();

  // Tests...
});
```

## Benefits

1. **Consistency** - Standardized setup patterns across all tests
2. **Reduced Boilerplate** - Less repetitive beforeEach/afterEach code
3. **Better Isolation** - Automatic cleanup prevents test interference
4. **Type Safety** - Fully typed mock objects and functions
5. **Maintainability** - Centralized test setup logic
6. **Documentation** - Self-documenting test setup through function names

## Troubleshooting

### Mock Not Being Reset

Ensure you're using `createMockCleanup()` in your test suite:

```typescript
describe('My Tests', () => {
  createMockCleanup(); // Add this line

  // Your tests
});
```

### Timer Issues

Make sure to use `createTimerCleanup()` for timer-dependent code:

```typescript
describe('Timer Tests', () => {
  createTimerCleanup(); // Add this line

  // Use advanceTimersAndRun() instead of manual timer advancement
});
```

### Import Errors

Check that you're importing from the correct path and that the core package is built:

```typescript
// Correct import
import { createMockCleanup } from '@apex/core/test-setup-utils';

// Alternative import if above doesn't work
import { createMockCleanup } from '@apex/core/src/test-setup-utils';
```