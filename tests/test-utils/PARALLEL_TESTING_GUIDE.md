# Parallel Test Execution Utilities Guide

This guide explains how to use APEX's comprehensive parallel test execution utilities to write tests that run safely in parallel without interfering with each other.

## Overview

APEX provides multiple layers of parallel test execution support:

1. **Database Isolation** - Unique database paths per test worker
2. **Event Emitter Isolation** - Isolated event emitter instances with history tracking
3. **State Guards** - Prevention of shared mutable state interference
4. **Resource Coordination** - Mutex/locking helpers for shared resources
5. **Complete Test Isolation** - Files, environment, mocks, timers, processes

## Quick Start

### Simple Parallel Context

For basic parallel testing with isolated databases and event emitters:

```typescript
import { createParallelTestContext } from '../test-utils/parallel-utils';

describe('My Feature', () => {
  let ctx: ParallelTestContext;

  beforeEach(async () => {
    ctx = await createParallelTestContext({
      prefix: 'my-feature',
      createDbStructure: true,
    });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('should work in parallel', async () => {
    // Each test worker gets:
    // - ctx.workerId: unique worker identifier
    // - ctx.tempDir: isolated temporary directory
    // - ctx.dbPath: unique database path
    // - ctx.eventEmitter: isolated event emitter with history

    const store = new TaskStore(ctx.tempDir);
    await store.initialize();

    ctx.eventEmitter.emitter.emit('test:event', 'data');
    expect(ctx.eventEmitter.getEventCount('test:event')).toBe(1);
  });
});
```

### Comprehensive Test Environment

For advanced testing with full isolation and worker coordination:

```typescript
import { createComprehensiveTestEnvironment } from '../test-utils/parallel-utils';

describe('Advanced Feature', () => {
  let env: ComprehensiveTestEnvironment;

  beforeEach(async () => {
    env = await createComprehensiveTestEnvironment({
      prefix: 'advanced-feature',
      withDatabase: true,
      withIsolation: true,
      withWorkerCoordination: true,
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should use all isolation features', async () => {
    // Database isolation
    const store = new TaskStore(env.parallel.tempDir);
    await store.initialize();

    // File system isolation
    const configFile = await env.isolation!.files.createTempFile(
      'config.json',
      JSON.stringify({ setting: 'value' })
    );

    // Environment isolation
    env.isolation!.env.setEnv('TEST_MODE', 'parallel');
    expect(process.env.TEST_MODE).toBe('parallel');

    // Worker coordination
    await env.coordinator!.createBarrier('test-sync', 1);
    await env.coordinator!.waitAtBarrier('test-sync', 1);

    // Everything cleaned up automatically
  });
});
```

### Using the Isolation Wrapper

For automatic cleanup without manual lifecycle management:

```typescript
import { withIsolation, runWithComprehensiveIsolation } from '../test-utils/parallel-utils';

it('should use isolation wrapper', async () => {
  const result = await runWithComprehensiveIsolation(async (env) => {
    // Use any combination of utilities
    await env.parallel.eventEmitter.emitter.emit('test:start');

    if (env.isolation) {
      await env.isolation.files.createTempFile('test.txt', 'content');
      env.isolation.env.setEnv('WRAPPER_TEST', 'value');
    }

    return 'test completed';
  }, {
    withIsolation: true,
    withDatabase: true,
  });

  expect(result).toBe('test completed');
  // All resources automatically cleaned up
});
```

## Utility Categories

### 1. Worker Identification

```typescript
import { getTestWorkerId, isParallelTestExecution } from '../test-utils/parallel-utils';

const workerId = getTestWorkerId();        // 'w1', 'p2', 'pid123_abc'
const isParallel = isParallelTestExecution(); // true in Vitest workers
```

### 2. Database Isolation

```typescript
import {
  getWorkerUniqueDbPath,
  createWorkerUniqueTempDir,
  createParallelSafeTaskStore
} from '../test-utils/parallel-utils';

// Unique paths per worker
const dbPath = getWorkerUniqueDbPath('feature-test');
const tempDir = await createWorkerUniqueTempDir('test-workspace');

// Complete TaskStore setup
const { store, cleanup } = await createParallelSafeTaskStore({
  prefix: 'feature-db'
});
```

### 3. Event Emitter Isolation

```typescript
import { createIsolatedEventEmitter } from '../test-utils/parallel-utils';

const { emitter, getEventHistory, cleanup } = createIsolatedEventEmitter<{
  'task:started': (id: string) => void;
  'task:completed': (id: string, result: any) => void;
}>();

emitter.emit('task:started', 'task-1');

// Assert event history
const history = getEventHistory();
expect(history).toHaveLength(1);
expect(history[0].event).toBe('task:started');

cleanup(); // Remove listeners and clear history
```

### 4. Resource Coordination

```typescript
import {
  AsyncMutex,
  ResourceLockManager,
  globalResourceLocks
} from '../test-utils/parallel-utils';

// Simple mutex
const mutex = new AsyncMutex();
await mutex.withLock(async () => {
  // Critical section
});

// Named resource locks
const lock = await globalResourceLocks.acquireLock('shared-port-3000', 10000);
try {
  // Use the resource
} finally {
  globalResourceLocks.releaseLock(lock);
}
```

### 5. State Guards

```typescript
import {
  assertNoSharedMutation,
  createImmutableSnapshot
} from '../test-utils/parallel-utils';

// Verify no shared state mutation
await assertNoSharedMutation(
  () => globalState.config,
  async () => {
    // Test that should restore state
    globalState.config = newConfig;
    // Must restore globalState.config or test fails
  }
);

// Create immutable snapshots
const snapshot = createImmutableSnapshot(complexObject);
// snapshot.prop = newValue; // Throws in strict mode
```

### 6. Environment Isolation

```typescript
import { createEnvironmentIsolation } from '../test-utils/parallel-utils';

const envCtx = createEnvironmentIsolation();

envCtx.set('NODE_ENV', 'test');
envCtx.set('DEBUG', 'apex:*');

// In cleanup:
envCtx.restore(); // Restores all original values
```

## Common Patterns

### 1. Database Testing

```typescript
describe('Database Operations', () => {
  let store: TaskStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await parallelTestPatterns.simpleDatabase('db-ops'));
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should create tasks', async () => {
    const task = await store.createTask({
      description: 'Test task',
      workflow: 'test',
    });
    expect(task.id).toBeTruthy();
  });
});
```

### 2. Event-Driven Testing

```typescript
describe('Event System', () => {
  it('should handle events in isolation', async () => {
    const { emitter, getEventHistory, cleanup } =
      parallelTestPatterns.simpleEventEmitter<TaskEvents>();

    try {
      const orchestrator = new ApexOrchestrator(config);
      orchestrator.setEventEmitter(emitter);

      await orchestrator.executeTask('test-task');

      const events = getEventHistory();
      expect(events.some(e => e.event === 'task:started')).toBe(true);
      expect(events.some(e => e.event === 'task:completed')).toBe(true);
    } finally {
      cleanup();
    }
  });
});
```

### 3. File System Testing

```typescript
it('should manage files in isolation', async () => {
  await withIsolation(async (ctx) => {
    const configPath = await ctx.files.createTempFile(
      'apex.config.yaml',
      'version: 1.0\nproject:\n  name: test'
    );

    const config = await loadConfig(configPath);
    expect(config.project.name).toBe('test');

    // Files cleaned up automatically
  });
});
```

### 4. Cross-Worker Coordination

```typescript
describe('Worker Coordination', () => {
  let coordinator: WorkerCoordinator;

  beforeEach(async () => {
    coordinator = WorkerCoordinator.getInstance();
    await coordinator.joinAsWorker({
      workerId: getTestWorkerId(),
      capabilities: ['test'],
    });
  });

  afterEach(async () => {
    await coordinator.leaveAsWorker();
  });

  it('should coordinate across workers', async () => {
    // Create a barrier for 2 workers
    await coordinator.createBarrier('sync-point', 2);

    // This will wait until 2 workers reach this point
    await coordinator.waitAtBarrier('sync-point', 2);

    // Now all workers have synchronized
    expect(true).toBe(true);
  });
});
```

## Best Practices

### ✅ Do

- Always use `beforeEach`/`afterEach` for context setup/cleanup
- Use the isolation wrapper for automatic cleanup
- Prefer isolation over locking when possible
- Use descriptive prefixes for test resources
- Clean up resources even if tests fail

### ❌ Don't

- Don't share mutable state between tests
- Don't use hardcoded paths or ports
- Don't forget cleanup in error cases
- Don't mix test contexts without proper isolation
- Don't rely on test execution order

### Example: Complete Feature Test

```typescript
import {
  createComprehensiveTestEnvironment,
  type ComprehensiveTestEnvironment,
} from '../test-utils/parallel-utils';

describe('Feature: User Management', () => {
  let env: ComprehensiveTestEnvironment;

  beforeEach(async () => {
    env = await createComprehensiveTestEnvironment({
      prefix: 'user-management',
      withDatabase: true,
      withIsolation: true,
      withWorkerCoordination: false,
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should create user with proper isolation', async () => {
    // Database operations
    const store = new TaskStore(env.parallel.tempDir);
    await store.initialize();

    // File operations
    const userConfigPath = await env.isolation!.files.createTempFile(
      'user.json',
      JSON.stringify({ name: 'Test User', role: 'admin' })
    );

    // Environment setup
    env.isolation!.env.setEnv('USER_CONFIG_PATH', userConfigPath);

    // Event tracking
    env.parallel.eventEmitter.emitter.on('user:created', (userId) => {
      console.log('User created:', userId);
    });

    // Execute feature
    const userService = new UserService(store);
    const user = await userService.createUser({
      name: 'Test User',
      configPath: userConfigPath,
    });

    // Assertions
    expect(user.id).toBeTruthy();
    expect(env.parallel.eventEmitter.getEventCount('user:created')).toBe(1);

    // All resources cleaned up automatically in afterEach
  });
});
```

## Troubleshooting

### Tests Interfering with Each Other

**Problem**: Tests pass individually but fail in parallel
**Solution**: Use isolation utilities and unique resource names

```typescript
// Bad
const dbPath = '/tmp/test.db'; // Same path for all workers

// Good
const dbPath = getWorkerUniqueDbPath('feature-test'); // Unique per worker
```

### Resource Leaks

**Problem**: Tests leave behind temp files, processes, or modified env vars
**Solution**: Always use cleanup functions and isolation wrappers

```typescript
// Use automatic cleanup
await withIsolation(async (ctx) => {
  // Resources cleaned up even if test throws
});
```

### Event Listener Accumulation

**Problem**: Too many listeners warning
**Solution**: Use isolated event emitters

```typescript
// Bad
orchestrator.on('event', handler); // Accumulates across tests

// Good
const { emitter } = createIsolatedEventEmitter();
emitter.on('event', handler); // Isolated per test
```

### Port/Resource Conflicts

**Problem**: Multiple tests trying to use same port
**Solution**: Use resource locks or dynamic port allocation

```typescript
const lock = await globalResourceLocks.acquireLock('port:3000');
try {
  // Use port 3000
} finally {
  globalResourceLocks.releaseLock(lock);
}
```

## Performance Considerations

- Isolation has overhead - use appropriate level for each test
- Database operations are slower than in-memory alternatives
- Resource coordination adds synchronization delays
- File system operations can be slow on some systems

Choose the right level of isolation for your test needs:

- **Simple tests**: Use basic parallel context
- **Integration tests**: Use comprehensive environment
- **Unit tests**: May not need parallel utilities at all

## Migration Guide

### From Basic Tests

```typescript
// Before
describe('Feature', () => {
  it('should work', async () => {
    const store = new TaskStore('./test-db');
    // Tests interfere with each other
  });
});

// After
describe('Feature', () => {
  let ctx: ParallelTestContext;

  beforeEach(async () => {
    ctx = await createParallelTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('should work', async () => {
    const store = new TaskStore(ctx.tempDir);
    // Each test gets isolated resources
  });
});
```

### From Manual Cleanup

```typescript
// Before
describe('Feature', () => {
  let tempFiles: string[] = [];

  afterEach(async () => {
    // Manual cleanup prone to errors
    for (const file of tempFiles) {
      await fs.unlink(file).catch(() => {});
    }
    tempFiles = [];
  });
});

// After
describe('Feature', () => {
  it('should work', async () => {
    await withIsolation(async (ctx) => {
      await ctx.files.createTempFile('test.txt');
      // Automatic cleanup
    });
  });
});
```