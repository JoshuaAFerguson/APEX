# Test Isolation Patterns in APEX

This document provides comprehensive guidance on implementing test isolation patterns in APEX using the built-in test utilities. These patterns ensure tests run independently without interference, making them reliable in both local development and CI/CD environments.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Basic Isolation Patterns](#basic-isolation-patterns)
3. [Parallel Test Support](#parallel-test-support)
4. [State Cleanup Patterns](#state-cleanup-patterns)
5. [Resource Isolation](#resource-isolation)
6. [Best Practices](#best-practices)
7. [Advanced Patterns](#advanced-patterns)
8. [Troubleshooting](#troubleshooting)

## Core Concepts

### What is Test Isolation?

Test isolation ensures that:
- Each test runs in its own context
- Tests don't share state or resources
- Tests can run in any order
- Tests can run in parallel without interference
- Cleanup happens automatically

### Why Test Isolation Matters

- **Prevents flaky tests**: No shared state between tests
- **Enables parallel execution**: Tests don't conflict with each other
- **Improves debugging**: Issues are contained to specific tests
- **Enhances reliability**: Tests produce consistent results

## Basic Isolation Patterns

### 1. Unique Test Contexts

Every test should have its own isolated context:

```typescript
import { createTestContext, type TestContext } from '@apex/core/test-fixtures';

describe('User Management', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext({ suiteName: 'UserManagement' });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('should create unique user IDs', () => {
    const userId1 = ctx.uniqueId('user');
    const userId2 = ctx.uniqueId('user');

    expect(userId1).not.toBe(userId2);
    expect(userId1).toMatch(/^user_test_/);
  });
});
```

### 2. Hook-Based Context Management

For simpler setup and teardown:

```typescript
import { useTestContext } from '@apex/core/test-fixtures';

describe('Task Processing', () => {
  const { context: ctx, setup, teardown } = useTestContext({
    namespacePrefix: 'task'
  });

  beforeEach(setup);
  afterEach(teardown);

  it('should process tasks independently', () => {
    const taskId = ctx.uniqueTaskId();
    ctx.setData('status', 'processing');

    expect(ctx.getData('status')).toBe('processing');
    // Data is isolated to this test
  });
});
```

### 3. Isolated Execution Blocks

For one-off isolated operations:

```typescript
import { createIsolatedExecution } from '@apex/core/test-fixtures';

it('should handle isolated data processing', async () => {
  const result = await createIsolatedExecution(async (ctx) => {
    const tempFile = await ctx.writeFile('data.json', '{"test": true}');
    const workflowId = ctx.uniqueWorkflowId();

    // Process data in complete isolation
    return { file: tempFile, workflow: workflowId };
  });

  expect(result.file).toContain('data.json');
  expect(result.workflow).toMatch(/^wf_test_/);
});
```

## Parallel Test Support

### 1. Concurrent Test Execution

Use Vitest's concurrent testing with isolation:

```typescript
import { createIsolatedExecution } from '@apex/core/test-fixtures';

describe.concurrent('Parallel Processing Tests', () => {
  it('test A', async () => {
    await createIsolatedExecution(async (ctx) => {
      const id = ctx.uniqueId('testA');
      // This context is completely isolated
      await simulateWork(id);
    });
  });

  it('test B', async () => {
    await createIsolatedExecution(async (ctx) => {
      const id = ctx.uniqueId('testB');
      // This context is completely isolated
      await simulateWork(id);
    });
  });
});
```

### 2. Resource Locks for Shared Resources

When tests must access shared resources:

```typescript
import { createResourceLock, withLock } from '@apex/core/test-fixtures';

const databaseLock = createResourceLock('database');

describe.concurrent('Database Tests', () => {
  it('test 1', async () => {
    await withLock(databaseLock, async () => {
      // Exclusive access to database
      await database.seed();
      const result = await database.query('SELECT * FROM users');
      await database.clear();
    });
  });

  it('test 2', async () => {
    await withLock(databaseLock, async () => {
      // Exclusive access to database
      await database.seed();
      const result = await database.query('SELECT * FROM orders');
      await database.clear();
    });
  });
});
```

### 3. Database Isolation Patterns

For tests that need database access:

```typescript
import { createDatabaseIsolation } from '@apex/core/test-fixtures';

describe('Database Operations', () => {
  const dbIsolation = createDatabaseIsolation({
    type: 'sqlite',
    freshPerTest: true
  });

  beforeEach(() => dbIsolation.setup());
  afterEach(() => dbIsolation.teardown());

  it('should have isolated database', async () => {
    const { url } = dbIsolation.getConnectionInfo();
    const mockDb = dbIsolation.getMockConnection();

    // Each test gets its own database file
    expect(url).toContain('db_');
  });
});
```

### 4. Port Allocation for Services

For tests that start servers or services:

```typescript
import { createPortAllocator } from '@apex/core/test-fixtures';

describe('Service Tests', () => {
  const portAllocator = createPortAllocator(8000, 8999);

  afterEach(() => portAllocator.releaseAll());

  it('should start service on unique port', async () => {
    const port = await portAllocator.allocate();
    const server = createTestServer().listen(port);

    // Test server operations

    server.close();
  });
});
```

## State Cleanup Patterns

### 1. Automatic Cleanup with Context

The TestContext automatically manages cleanup:

```typescript
it('should cleanup automatically', async () => {
  const ctx = createTestContext();

  // Create resources
  const tempDir = await ctx.createTempDir();
  await ctx.writeFile('test.txt', 'content');

  // Register custom cleanup
  ctx.addCleanupTask(async () => {
    console.log('Custom cleanup completed');
  });

  // Cleanup happens automatically
  await ctx.cleanup();
});
```

### 2. State Snapshots for Comparison

Track state changes during tests:

```typescript
import { createStateTracker } from '@apex/core/test-fixtures';

it('should track state changes', () => {
  const tracker = createStateTracker<{ count: number; items: string[] }>();

  const initialState = { count: 0, items: [] };
  tracker.snapshot('initial', initialState);

  // Perform operations
  const finalState = { count: 5, items: ['a', 'b', 'c'] };
  tracker.snapshot('final', finalState);

  // Verify changes
  expect(tracker.hasChanged('initial', 'final')).toBe(true);
  const changes = tracker.getChangedKeys('initial', 'final');
  expect(changes).toContain('count');
  expect(changes).toContain('items');
});
```

### 3. Mock Registry for Complex Testing

Organize and verify mock usage:

```typescript
import { createMockRegistry } from '@apex/core/test-fixtures';

describe('API Integration', () => {
  const mockRegistry = createMockRegistry();

  beforeEach(() => mockRegistry.reset());
  afterEach(() => mockRegistry.verifyExpectations());

  it('should call all required APIs', () => {
    const fetchUser = mockRegistry.register('fetchUser', vi.fn(), {
      expectedCalls: 1,
      description: 'Fetch user profile'
    });

    const updateUser = mockRegistry.register('updateUser', vi.fn(), {
      expectedCalls: 1,
      description: 'Update user data'
    });

    // Use mocks in test
    fetchUser();
    updateUser();

    // Verification happens in afterEach
  });
});
```

## Resource Isolation

### 1. File System Isolation

Isolate file system operations:

```typescript
import { createFileSystemIsolation } from '@apex/core/test-fixtures';

describe('File Operations', () => {
  const fsIsolation = createFileSystemIsolation();

  beforeEach(() => fsIsolation.setup());
  afterEach(() => fsIsolation.teardown());

  it('should create isolated files', async () => {
    await fsIsolation.createFile('config.json', '{"env": "test"}');
    await fsIsolation.createDir('logs');

    expect(await fsIsolation.exists('config.json')).toBe(true);

    const workingDir = fsIsolation.getWorkingDir();
    expect(workingDir).toContain('apex-fs_');
  });
});
```

### 2. Process Isolation

Manage child processes in tests:

```typescript
import { createProcessIsolation } from '@apex/core/test-fixtures';

describe('Process Management', () => {
  const processIsolation = createProcessIsolation();

  beforeEach(() => processIsolation.setup());
  afterEach(() => processIsolation.teardown());

  it('should spawn isolated processes', async () => {
    const proc1 = await processIsolation.spawn('echo', ['hello']);
    const proc2 = await processIsolation.spawn('cat', ['file.txt']);

    expect(processIsolation.getActiveProcesses()).toHaveLength(2);

    // Processes are automatically cleaned up
  });
});
```

### 3. Network Isolation

Mock network requests consistently:

```typescript
import { createNetworkIsolation } from '@apex/core/test-fixtures';

describe('Network Operations', () => {
  const networkIsolation = createNetworkIsolation();

  beforeEach(() => networkIsolation.setup());
  afterEach(() => networkIsolation.teardown());

  it('should mock network requests', () => {
    networkIsolation.mockRequest('/api/users', {
      users: [{ id: 1, name: 'Test User' }]
    });

    networkIsolation.setNetworkConditions({
      delay: 100, // Simulate network latency
      dropRate: 0.05 // Simulate 5% packet loss
    });

    // Test network-dependent code
  });
});
```

### 4. Memory Isolation

Prevent memory leaks between tests:

```typescript
import { createMemoryIsolation } from '@apex/core/test-fixtures';

describe('Memory Management', () => {
  const memory = createMemoryIsolation();

  afterEach(() => memory.clearAll());

  it('should isolate memory usage', () => {
    const ctx1 = memory.createContext({ data: 'test1' });
    const ctx2 = memory.createContext({ data: 'test2' });

    expect(ctx1.get().data).toBe('test1');
    expect(ctx2.get().data).toBe('test2');

    const stats = memory.getStats();
    expect(stats.contexts).toBe(2);
  });
});
```

## Best Practices

### 1. Always Use Cleanup

```typescript
// ❌ Bad: No cleanup
it('test without cleanup', () => {
  const ctx = createTestContext();
  // Resources may leak
});

// ✅ Good: Proper cleanup
it('test with cleanup', async () => {
  const ctx = createTestContext();
  try {
    // Test logic
  } finally {
    await ctx.cleanup();
  }
});

// ✅ Better: Use hooks
describe('Test Suite', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });
});
```

### 2. Use Appropriate Isolation Level

```typescript
// ✅ Unit tests: Lightweight context
const ctx = createUnitTestContext();

// ✅ Integration tests: Full context with temp directories
const ctx = createIntegrationTestContext();

// ✅ Isolated execution: One-off operations
await createIsolatedExecution(async (ctx) => {
  // Isolated work here
});
```

### 3. Namespace Your Resources

```typescript
it('should use namespaced resources', async () => {
  const ctx = createTestContext({ namespacePrefix: 'myfeature' });

  const taskId = ctx.uniqueTaskId(); // task_myfeature_...
  const dbTable = ctx.namespacedTable('users'); // users_myfeature_...
  const cacheKey = ctx.namespacedKey('session'); // myfeature_...:session
  const envVar = ctx.namespacedEnv('API_KEY'); // MYFEATURE_..._API_KEY
});
```

### 4. Handle Environment Variables

```typescript
import { withEnvironment } from '@apex/core/test-fixtures';

it('should isolate environment variables', async () => {
  await withEnvironment({ NODE_ENV: 'test', API_URL: 'http://test.api' }, async () => {
    // Environment variables are isolated to this scope
    expect(process.env.NODE_ENV).toBe('test');
  });

  // Original values are restored
});
```

## Advanced Patterns

### 1. Orchestrated Cleanup

For complex resource management:

```typescript
import { createCleanupOrchestrator } from '@apex/core/test-fixtures';

describe('Complex Resource Tests', () => {
  const cleanupOrchestrator = createCleanupOrchestrator();

  afterEach(() => cleanupOrchestrator.runAll());

  it('should manage multiple resources', async () => {
    cleanupOrchestrator.add('database', async () => {
      await database.clear();
    });

    cleanupOrchestrator.add('cache', () => {
      cache.flush();
    });

    cleanupOrchestrator.add('files', async () => {
      await fs.rm(tempDir, { recursive: true });
    });

    // Resources are cleaned up in reverse order
  });
});
```

### 2. Custom Test Data Factories

Create consistent test data:

```typescript
import { createTestDataFactory } from '@apex/core/test-fixtures';

const userFactory = createTestDataFactory('user', (sequence, { factoryName }) => ({
  id: sequence,
  name: `User ${sequence}`,
  email: `${factoryName}${sequence}@test.com`,
  createdAt: new Date()
}));

it('should create unique users', () => {
  const user1 = userFactory.create();
  const user2 = userFactory.create({ name: 'Custom Name' });

  expect(user1.id).toBe(1);
  expect(user2.id).toBe(2);
  expect(user2.name).toBe('Custom Name');
  expect(user1.email).toBe('user1@test.com');
});
```

### 3. Complex State Management

For stateful components or systems:

```typescript
class StatefulService {
  private state = new Map<string, unknown>();

  setState(key: string, value: unknown) {
    this.state.set(key, value);
  }

  getState(key: string) {
    return this.state.get(key);
  }

  reset() {
    this.state.clear();
  }
}

describe('Stateful Service', () => {
  const { context: ctx, setup, teardown } = useTestContext();
  let service: StatefulService;

  beforeEach(() => {
    setup();
    service = new StatefulService();

    // Register cleanup for the service
    ctx.addCleanupTask(() => service.reset());
  });

  afterEach(teardown);

  it('should manage state independently', () => {
    const key = ctx.namespacedKey('testData');
    service.setState(key, 'test value');

    expect(service.getState(key)).toBe('test value');
    // State is automatically reset after test
  });
});
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Flaky Tests

**Problem**: Tests pass individually but fail when run together.

**Solution**: Ensure proper isolation:

```typescript
// Check for shared state
describe('Flaky Tests', () => {
  let sharedState: any; // ❌ Problematic

  beforeEach(() => {
    const ctx = createTestContext(); // ✅ Create fresh context
    sharedState = ctx.getData('clean'); // ✅ Use context data
  });
});
```

#### 2. Resource Leaks

**Problem**: Tests consume increasing memory or leave files behind.

**Solution**: Implement proper cleanup:

```typescript
// Monitor resource usage
it('should not leak resources', async () => {
  const ctx = createTestContext();
  const memory = createMemoryIsolation();

  try {
    // Test logic
    const stats = memory.getStats();
    expect(stats.contexts).toBeLessThan(10); // Check limits
  } finally {
    await ctx.cleanup();
    memory.clearAll();
  }
});
```

#### 3. Port Conflicts

**Problem**: Tests fail due to port already in use.

**Solution**: Use port allocation:

```typescript
describe('Server Tests', () => {
  const portAllocator = createPortAllocator(8000, 9000);

  afterEach(() => portAllocator.releaseAll());

  it('should avoid port conflicts', async () => {
    const port = await portAllocator.allocate();
    // Use port safely
  });
});
```

#### 4. Database Conflicts

**Problem**: Tests interfere with each other's database operations.

**Solution**: Use database isolation:

```typescript
describe('Database Tests', () => {
  const dbIsolation = createDatabaseIsolation({
    type: 'sqlite',
    freshPerTest: true // Each test gets fresh DB
  });

  beforeEach(() => dbIsolation.setup());
  afterEach(() => dbIsolation.teardown());
});
```

### Debugging Tips

1. **Use unique identifiers**: Always check that test IDs are unique
2. **Monitor cleanup**: Verify cleanup tasks are running
3. **Check concurrency**: Ensure parallel tests don't share resources
4. **Validate isolation**: Use state snapshots to verify independence

### Performance Considerations

1. **Lazy initialization**: Create resources only when needed
2. **Batch cleanup**: Group related cleanup operations
3. **Resource pooling**: Reuse expensive resources when safe
4. **Parallel-friendly patterns**: Design tests for concurrent execution

---

This documentation provides comprehensive patterns for test isolation in APEX. Following these patterns will help you create reliable, maintainable tests that work well in both development and CI/CD environments.