# ADR-060: Test Isolation Patterns Architecture

## Status
**Accepted** - February 2026

## Context

APEX's test suite has grown significantly, with tests spread across multiple packages (`core`, `orchestrator`, `cli`, `api`, `browser`, `web-ui`). As the codebase has evolved, we've encountered several test isolation challenges:

1. **Shared state pollution** - Tests occasionally leak state through global variables, singleton instances, or improperly cleaned file system artifacts
2. **Non-deterministic test ordering** - Tests that pass individually may fail when run in different orders due to implicit dependencies
3. **Parallel test interference** - When running tests concurrently, resource contention and identifier collisions occur
4. **Inconsistent cleanup patterns** - Different tests use different cleanup approaches, making maintenance difficult

This ADR documents the test isolation patterns and utilities we've established to address these challenges.

## Decision

We will use a layered approach to test isolation consisting of:

1. **TestContext Factory** - Unique context generation per test with automatic cleanup
2. **Namespace Isolation** - All test resources use namespaced identifiers
3. **Resource Lifecycle Management** - LIFO cleanup task execution
4. **Test Suite Configuration** - Standardized `beforeEach`/`afterEach` patterns
5. **Parallel Execution Support** - Isolation primitives that support concurrent execution

### 1. TestContext Factory

Every test that creates state should use `createTestContext()`:

```typescript
/**
 * @example Basic Usage
 */
import { createTestContext, type TestContext } from '@apex/core/test-fixtures';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MyFeature', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('should create isolated task IDs', () => {
    // Every ID is unique per test run and per test
    const taskId = ctx.uniqueTaskId();
    expect(taskId).toMatch(/^task_test_\d+_\w+_\d+$/);

    // IDs increment within the same test context
    const taskId2 = ctx.uniqueTaskId();
    expect(taskId2).not.toBe(taskId);
  });
});
```

### 2. Hook-Based Usage Pattern

For simpler integration with describe/it blocks:

```typescript
/**
 * @example Hook-Based Pattern
 */
import { useTestContext } from '@apex/core/test-fixtures';

describe('MyFeature', () => {
  const { context: ctx, setup, teardown } = useTestContext();

  beforeEach(setup);  // Creates fresh context
  afterEach(teardown); // Cleans up context

  it('should have isolated data per test', () => {
    ctx.setData('key', 'value');
    expect(ctx.getData('key')).toBe('value');
    // Data is automatically cleared in teardown
  });
});
```

### 3. Unique Identifier Generation

TestContext provides typed ID generators for all APEX entity types:

```typescript
// All IDs include the test namespace for traceability
ctx.uniqueTaskId();       // 'task_test_1234567890_abc123_1'
ctx.uniqueSessionId();    // 'sess_test_1234567890_abc123_2'
ctx.uniqueAgentId();      // 'agent_test_1234567890_abc123_3'
ctx.uniqueWorkflowId();   // 'wf_test_1234567890_abc123_4'
ctx.uniqueCheckpointId(); // 'checkpoint_test_1234567890_abc123_5'
ctx.uniqueId('custom');   // 'custom_test_1234567890_abc123_6'
```

### 4. Namespace Isolation for Resources

When tests need to create external resources:

```typescript
/**
 * @example Namespaced Resources
 */
describe('Database Integration', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext({ namespacePrefix: 'db_test' });
  });

  it('should use namespaced table names', () => {
    // Prevents collision with other tests
    const tableName = ctx.namespacedTable('tasks');
    expect(tableName).toMatch(/^tasks_db_test_\d+_\w+$/);
  });

  it('should use namespaced file paths', async () => {
    const tempDir = await ctx.createTempDir();
    const filePath = await ctx.writeFile('config.json', '{}');

    // Files are in an isolated directory per test
    expect(filePath).toContain(ctx.testId);
  });

  it('should use namespaced cache keys', () => {
    const cacheKey = ctx.namespacedKey('userToken');
    expect(cacheKey).toBe(`${ctx.namespace}:userToken`);
  });
});
```

### 5. Cleanup Task Management

Tests register cleanup tasks that run in LIFO order:

```typescript
/**
 * @example Cleanup Task Registration
 */
describe('ResourceManagement', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('should cleanup resources in correct order', async () => {
    const order: string[] = [];

    // Resources should be cleaned up in reverse order of creation
    ctx.addCleanupTask(() => order.push('first-created-last-cleaned'));
    ctx.addCleanupTask(() => order.push('second-created'));
    ctx.addCleanupTask(() => order.push('third-created-first-cleaned'));

    await ctx.cleanup();

    expect(order).toEqual([
      'third-created-first-cleaned',
      'second-created',
      'first-created-last-cleaned'
    ]);
  });

  it('should handle async cleanup tasks', async () => {
    const db = await createTestDatabase();

    ctx.addCleanupTask(async () => {
      await db.close();
    });

    // Database is automatically closed in afterEach
  });
});
```

### 6. State Cleanup Between Tests

Tests should not rely on implicit state:

```typescript
/**
 * @example State Cleanup Pattern
 */
import { createTestSuite } from '@apex/core/test-fixtures';

describe('StateManagement', () => {
  const suite = createTestSuite({
    setupMocks: true,
    cleanupAfterEach: true,
    mockConfig: {
      mockFs: true,
      mockData: {
        fileSystemData: {
          '/test/config.yaml': 'version: 1.0'
        }
      }
    }
  });

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);

  it('should have clean state', () => {
    // Every test starts with fresh mocks
    // File system is reset between tests
    // Environment variables are restored
  });
});
```

### 7. Parallel Test Execution Support

All isolation primitives are designed for concurrent execution:

```typescript
/**
 * @example Parallel Test Support
 */
describe.concurrent('ParallelTests', () => {
  // Each test gets its own context - no interference

  it('test A', async () => {
    const ctx = createTestContext();
    const taskId = ctx.uniqueTaskId();

    // Do work with taskId - guaranteed unique across all parallel tests

    await ctx.cleanup();
  });

  it('test B', async () => {
    const ctx = createTestContext();
    const taskId = ctx.uniqueTaskId();

    // taskId is different from test A, even if they run simultaneously

    await ctx.cleanup();
  });
});
```

### 8. Integration Test Context

For tests requiring filesystem access:

```typescript
/**
 * @example Integration Test Context
 */
import { createIntegrationTestContext } from '@apex/core/test-fixtures';

describe('FileSystemIntegration', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = createIntegrationTestContext();
    await ctx.createTempDir(); // Creates isolated temp directory
  });

  afterEach(async () => {
    await ctx.cleanup(); // Automatically removes temp directory
  });

  it('should create isolated files', async () => {
    const configPath = await ctx.writeFile('config.json', '{"key": "value"}');
    const subDir = await ctx.createSubDir('nested/path');

    // All paths are within the test's temp directory
    expect(configPath).toContain(ctx.testId);
    expect(subDir).toContain(ctx.testId);
  });
});
```

### 9. Database Isolation

For orchestrator package tests:

```typescript
/**
 * @example Database Isolation Pattern
 */
import { createTestDatabase, cleanupTestDatabase, type TestDatabaseContext } from '@apex/orchestrator/test-utils';

describe('TaskStore', () => {
  let testDb: TestDatabaseContext;

  beforeEach(async () => {
    // Creates in-memory SQLite with full schema
    testDb = await createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  it('should perform isolated database operations', () => {
    const stmt = testDb.db.prepare('INSERT INTO tasks (id, description, ...) VALUES (?, ?, ...)');
    // Each test has its own in-memory database
  });
});
```

## Key Patterns Summary

| Pattern | Use Case | Module |
|---------|----------|--------|
| `createTestContext()` | General test isolation | `@apex/core/test-fixtures` |
| `useTestContext()` | Hook-based test setup | `@apex/core/test-fixtures` |
| `createIntegrationTestContext()` | Filesystem integration tests | `@apex/core/test-fixtures` |
| `createUnitTestContext()` | Lightweight unit tests | `@apex/core/test-fixtures` |
| `createTestSuite()` | Full mock configuration | `@apex/core/test-fixtures` |
| `createTestDatabase()` | Database integration tests | `@apex/orchestrator/test-utils` |

## Consequences

### Positive

1. **Guaranteed isolation** - Each test runs in a clean environment
2. **Deterministic execution** - Tests produce the same results regardless of order
3. **Parallel safety** - Tests can run concurrently without interference
4. **Easy debugging** - Unique IDs make it easy to trace test artifacts
5. **Automatic cleanup** - Reduced risk of resource leaks

### Negative

1. **Overhead** - Context creation adds small overhead per test
2. **Learning curve** - Developers must learn the isolation patterns
3. **Boilerplate** - Requires explicit beforeEach/afterEach setup

### Mitigation

- Use `useTestContext()` hook for minimal boilerplate
- Context creation is optimized for speed
- Documentation and examples reduce learning curve

## Related ADRs

- ADR-045: Error Recovery Integration Tests
- ADR-046: Error Recovery Test Architecture
- ADR-048: Test Coverage Verification Architecture

## References

- `packages/core/src/test-fixtures/context/test-context.ts` - TestContext implementation
- `packages/core/src/test-fixtures/setup-teardown.ts` - Suite configuration
- `packages/orchestrator/src/test-utils/db.ts` - Database utilities
- `test-setup.ts` - Global test setup
