# APEX Test Utilities

A comprehensive test utilities library for the APEX project, providing common helpers for async testing, assertion helpers, test context management, and cleanup utilities.

## Overview

The APEX test utilities are designed to make writing tests easier, more consistent, and more reliable across the APEX codebase. They provide:

- **Async Utilities**: Helpers for testing asynchronous operations
- **Assertion Helpers**: Enhanced assertion functions beyond basic `expect()`
- **Test Context Management**: Setup and teardown of test environments
- **Cleanup Utilities**: Automatic cleanup of resources and side effects

## Installation

The test utilities are part of the APEX monorepo and can be imported from the central location:

```typescript
import {
  // Async utilities
  wait, waitFor, createDeferred, retry,
  // Assertion helpers
  expectToThrow, expectObjectShape, expectArrayToContain,
  // Context management
  createTestEnvironment, setupTest, runWithCleanup,
  // Test fixtures and utilities
  testFixtures, testUtils
} from '../../tests/test-utils';
```

## Quick Start

### Basic Test Setup

```typescript
import { describe, it, expect } from 'vitest';
import { setupTest, expectObjectShape } from '../../tests/test-utils';

describe('My Feature', () => {
  it('should work correctly', async () => {
    const { context, cleanup } = await setupTest();

    // Your test code here
    const result = { success: true, data: 'test' };

    expectObjectShape(result, {
      success: true,
      data: expect.any(String)
    });

    await cleanup.cleanup();
  });
});
```

### Advanced Test Setup with Automatic Cleanup

```typescript
import { runWithCleanup, createTestEnvironment } from '../../tests/test-utils';

describe('Advanced Feature Tests', () => {
  it('should handle complex scenarios', async () => {
    await runWithCleanup(async (env) => {
      // Test runs with automatic cleanup
      const tempFile = await env.cleanup.fileSystem.createTempFile(
        'config.json',
        JSON.stringify({ test: true })
      );

      // Use event tracking
      const tracker = new EventTracker();
      tracker.record('test-started', { file: tempFile });

      // Your test assertions here
      expect(tracker.hasEvent('test-started')).toBe(true);

      // Cleanup happens automatically
    });
  });
});
```

## API Reference

### Async Utilities

#### `wait(ms: number): Promise<void>`
Waits for the specified number of milliseconds.

```typescript
await wait(100); // Wait 100ms
```

#### `waitFor(condition, options): Promise<void>`
Waits for a condition to become true within a timeout.

```typescript
let isReady = false;
setTimeout(() => { isReady = true; }, 50);

await waitFor(() => isReady, { timeout: 100 });
```

#### `createDeferred<T>(): { promise, resolve, reject }`
Creates an externally controllable promise.

```typescript
const { promise, resolve } = createDeferred<string>();
setTimeout(() => resolve('done'), 100);
const result = await promise; // 'done'
```

#### `retry<T>(fn, options): Promise<T>`
Retries a function until it succeeds or max attempts reached.

```typescript
const result = await retry(async () => {
  if (Math.random() < 0.7) throw new Error('Random failure');
  return 'success';
}, { maxAttempts: 5, delay: 100 });
```

#### `sequence<T>(functions): Promise<T[]>`
Executes async functions in sequence.

```typescript
const results = await sequence([
  async () => 'first',
  async () => 'second'
]);
// ['first', 'second']
```

#### `parallel<T>(functions, timeout?): Promise<T[]>`
Executes async functions in parallel with optional timeout.

```typescript
const results = await parallel([
  async () => { await wait(50); return 'fast'; },
  async () => { await wait(100); return 'slow'; }
], 200);
// ['fast', 'slow']
```

### Assertion Helpers

#### `expectToThrow(fn, expectedMessage?): Promise<Error>`
Asserts that a function throws an error.

```typescript
const error = await expectToThrow(
  () => { throw new Error('Test error'); },
  'Test error'
);
expect(error.message).toBe('Test error');
```

#### `expectObjectShape<T>(actual, expected): void`
Asserts that an object has the expected shape.

```typescript
const user = { id: 1, name: 'John', email: 'john@example.com' };
expectObjectShape(user, {
  id: expect.any(Number),
  name: 'John'
}); // Passes if object has at least these properties
```

#### `expectArrayToContain<T>(array, matcher, count?): void`
Asserts that an array contains elements matching a condition.

```typescript
const numbers = [1, 2, 3, 4, 5];
expectArrayToContain(numbers, n => n > 3, 2); // Should find 2 numbers > 3
```

#### `expectToBeWithinRange(value, min, max, inclusive?): void`
Asserts that a number is within a range.

```typescript
expectToBeWithinRange(50, 0, 100); // Passes
expectToBeWithinRange(150, 0, 100); // Fails
```

#### `expectDatesToBeClose(actual, expected, toleranceMs?): void`
Asserts that two dates are approximately equal.

```typescript
const now = new Date();
const close = new Date(now.getTime() + 100);
expectDatesToBeClose(now, close, 200); // Within 200ms tolerance
```

### Test Context Management

#### `createTestContext(contextId?): Promise<TestContext>`
Creates a basic test context with temporary directory and cleanup functions.

```typescript
const context = await createTestContext();
// Use context.tempDir, context.data, etc.
await cleanupTestContext(context);
```

#### `createExtendedTestContext(contextId?): Promise<ExtendedTestContext>`
Creates an extended test context with mock management.

```typescript
const context = await createExtendedTestContext();
const spy = context.mocks.spyOn(console, 'log');
// ... test code ...
await cleanupTestContext(context); // Auto-restores mocks
```

#### `createTestEnvironment(options?): Promise<TestEnvironment>`
Creates a complete test environment with all utilities.

```typescript
const env = await createTestEnvironment({
  contextId: 'my-test',
  withDatabase: true,
  withMocks: true
});

// Access: env.context, env.cleanup, env.tempDir, env.mocks
// If withDatabase: env.dbPath
await env.cleanup.cleanup();
```

#### `runWithCleanup<T>(testFn, options?): Promise<T>`
Runs a test function with automatic cleanup.

```typescript
const result = await runWithCleanup(async (env) => {
  // Test code with access to env
  return 'test result';
}, { withDatabase: true });
// Automatic cleanup happens even if test throws
```

### Cleanup Utilities

#### `CleanupRegistry`
Manages cleanup operations in LIFO order.

```typescript
const cleanup = new CleanupRegistry();
cleanup.add(() => console.log('Cleanup action'));
await cleanup.cleanup(); // Executes all registered cleanup
```

#### `FileSystemCleanup`
Manages file and directory cleanup.

```typescript
const fs = new FileSystemCleanup();
const tempDir = await fs.createTempDir('test');
const tempFile = await fs.createTempFile('data.json', '{}');
await fs.cleanup(); // Removes all tracked files/dirs
```

#### `CleanupManager`
Comprehensive cleanup manager combining all cleanup types.

```typescript
const cleanup = createCleanupManager();

// Use specialized cleanups
cleanup.fileSystem.track('/path/to/temp/file');
cleanup.environment.setEnv('TEST_VAR', 'value');
cleanup.mocks.trackSpy(spy, 'console.log spy');

// Clean up everything
await cleanup.cleanup();
```

### Event Tracking

#### `EventTracker`
Tracks events for testing event-driven systems.

```typescript
const tracker = new EventTracker();
tracker.record('user-login', { userId: 123 });
tracker.record('data-loaded', { count: 50 });

expect(tracker.hasEvent('user-login')).toBe(true);
expect(tracker.getEventsByType('data-loaded')).toHaveLength(1);

// Wait for events
await tracker.waitForEvent('processing-complete', 5000);
```

### Test Utilities

#### `testFixtures`
Pre-built test data for common APEX objects.

```typescript
const task = { ...testFixtures.sampleTask };
const config = testFixtures.sampleConfig;
const agent = testFixtures.sampleAgent;
const workflow = testFixtures.sampleWorkflow;
```

#### `testUtils`
Common utility functions.

```typescript
const id = testUtils.generateTestId(); // 'test_1234567890_abc123'
const path = testUtils.mockPath('a', 'b', 'c'); // 'a/b/c'
const date = testUtils.testDate(1000); // Date 1 second from now
```

## Testing Patterns

### Testing Async Operations

```typescript
it('should handle async operations', async () => {
  await runWithCleanup(async (env) => {
    const timer = new TestTimer();
    timer.start();

    // Test async operation
    const result = await retry(async () => {
      await wait(10);
      return 'completed';
    });

    const elapsed = timer.stop();

    expect(result).toBe('completed');
    expect(elapsed).toBeGreaterThanOrEqual(10);
  });
});
```

### Testing Error Conditions

```typescript
it('should handle errors properly', async () => {
  await runWithCleanup(async (env) => {
    await expectToThrow(async () => {
      await waitFor(() => false, { timeout: 50 });
    }, 'Condition not met within timeout');
  });
});
```

### Testing File Operations

```typescript
it('should handle file operations', async () => {
  await runWithCleanup(async (env) => {
    const configFile = await env.cleanup.fileSystem.createTempFile(
      'config.yaml',
      'version: 1.0'
    );

    // Test file operations
    expect(configFile).toMatch(/config\.yaml$/);
    // File automatically cleaned up
  });
});
```

### Testing Event-Driven Code

```typescript
it('should track events correctly', async () => {
  await runWithCleanup(async (env) => {
    const tracker = new EventTracker();

    // Simulate event-driven system
    emitter.on('data', (data) => {
      tracker.record('data-received', data);
    });

    emitter.emit('data', { value: 123 });

    expect(tracker.hasEvent('data-received')).toBe(true);
    expect(tracker.getLatestEvent('data-received').data).toEqual({ value: 123 });
  });
});
```

### Performance Testing

```typescript
it('should complete within time limits', async () => {
  await runWithCleanup(async (env) => {
    const timer = new TestTimer();

    timer.start();
    await myAsyncOperation();
    const elapsed = timer.stop();

    expectToBeWithinRange(elapsed, 100, 500); // Should take 100-500ms
  });
});
```

## Best Practices

### 1. Always Use Cleanup
```typescript
// Good - automatic cleanup
await runWithCleanup(async (env) => {
  // Test code
});

// Also good - manual cleanup
const env = await createTestEnvironment();
try {
  // Test code
} finally {
  await env.cleanup.cleanup();
}
```

### 2. Use Descriptive Test IDs
```typescript
const context = await createTestContext('user-authentication-test');
```

### 3. Test Error Paths
```typescript
// Test both success and failure cases
await expectToThrow(async () => {
  await processInvalidData();
}, 'Invalid data format');
```

### 4. Use Event Tracking for Complex Systems
```typescript
const tracker = new EventTracker();
// ... attach to your system
// ... trigger operations
expect(tracker.getEventsByType('error')).toHaveLength(0);
```

### 5. Combine Multiple Utilities
```typescript
await runWithCleanup(async (env) => {
  const timer = new TestTimer();
  const tracker = new EventTracker();

  timer.start();
  // ... complex test scenario ...
  const elapsed = timer.stop();

  expect(tracker.hasEvent('success')).toBe(true);
  expectToBeWithinRange(elapsed, 100, 1000);
});
```

## Integration with APEX Components

The test utilities are designed to work seamlessly with APEX components:

```typescript
import { Task, Config } from '../../packages/core/src/types';

it('should test APEX task lifecycle', async () => {
  await runWithCleanup(async (env) => {
    // Use APEX types with test fixtures
    const task: Task = { ...testFixtures.sampleTask };

    // Test task transitions
    const tracker = new EventTracker();
    tracker.record('task-created', { taskId: task.id });

    task.status = 'in_progress';
    tracker.record('task-started', { taskId: task.id });

    // Validate with assertion helpers
    expectObjectShape(task, {
      id: expect.any(String),
      status: 'in_progress',
      workflow: 'feature'
    });

    expect(tracker.hasEvent('task-created')).toBe(true);
    expect(tracker.hasEvent('task-started')).toBe(true);
  });
});
```

## Troubleshooting

### Common Issues

1. **Cleanup not working**: Ensure you're using `runWithCleanup` or manually calling `cleanup.cleanup()`
2. **Async tests hanging**: Check timeout values in `waitFor` and other async utilities
3. **File system errors**: Temporary files should be created through `FileSystemCleanup` for proper cleanup
4. **Mock restoration issues**: Use `MockManager` or `MockCleanup` to ensure proper restoration

### Debugging

```typescript
// Enable debug logging for cleanup
const cleanup = createCleanupManager();
cleanup.add(() => console.log('Custom cleanup executed'), 'Debug cleanup');
```

## Contributing

When adding new test utilities:

1. Follow the established patterns for async operations, assertions, context management, and cleanup
2. Add comprehensive tests for new utilities
3. Update this documentation
4. Ensure TypeScript types are properly exported
5. Consider backward compatibility

## Examples

See the `integration.test.ts` file for comprehensive examples of using these utilities with real APEX components.