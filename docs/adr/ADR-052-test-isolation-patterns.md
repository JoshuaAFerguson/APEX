# ADR-052: Test Isolation Patterns Architecture

## Status
Accepted

## Context

The APEX test suite requires robust isolation patterns to ensure tests are:
1. **Independent**: Each test runs in isolation without side effects from other tests
2. **Parallelizable**: Tests can run concurrently without interference
3. **Reproducible**: Tests produce consistent results across runs
4. **Cleanable**: All test resources are properly cleaned up after execution

Current test infrastructure includes scattered utilities for context management, cleanup, and async operations. This ADR establishes a unified architecture for test isolation.

## Decision

### 1. Test Isolation Architecture Layers

We implement a **four-layer isolation architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 4: Test Suite Level                    │
│    Global setup/teardown, shared fixtures, suite-wide config    │
├─────────────────────────────────────────────────────────────────┤
│                    Layer 3: Test File Level                     │
│    File-scoped resources, describe block isolation              │
├─────────────────────────────────────────────────────────────────┤
│                    Layer 2: Test Case Level                     │
│    Per-test context, unique IDs, temp directories               │
├─────────────────────────────────────────────────────────────────┤
│                    Layer 1: Resource Level                      │
│    File system, database, process, mock, timer cleanup          │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Core Isolation Patterns

#### 2.1 Unique Test Context Pattern

Each test receives a unique context with:
- **Unique ID**: `test_${timestamp}_${random}` format ensures no collision
- **Isolated Temp Directory**: Unique path per test for file operations
- **Cleanup Registry**: LIFO-ordered cleanup functions

```typescript
interface IsolatedTestContext {
  id: string;                    // Unique identifier
  tempDir: string;               // Isolated temp directory
  startTime: Date;               // For duration tracking
  cleanupRegistry: CleanupFn[];  // LIFO cleanup stack
  data: Record<string, any>;     // Shared test data
}
```

#### 2.2 State Cleanup Pattern

Cleanup follows **LIFO (Last-In-First-Out)** order to ensure dependent resources are cleaned before their dependencies:

```
Registration Order:    Cleanup Order:
1. Create database  →  4. Remove temp dirs
2. Start server     →  3. Cleanup mocks
3. Setup mocks      →  2. Close server
4. Create temp dirs →  1. Close database
```

#### 2.3 Parallel Test Support Pattern

Tests achieve parallel execution isolation through:

1. **Unique Resource Namespacing**: All resources include test ID in their names
2. **No Shared Mutable State**: Global state is read-only or per-test
3. **Resource Tracking**: All created resources are tracked for cleanup
4. **Timeout Boundaries**: Each test has defined timeout limits

```typescript
// Resource namespacing example
const dbPath = path.join(tempDir, `${testId}-test.db`);
const serverPort = 3000 + parseInt(testId.slice(-4), 36) % 1000;
```

### 3. Isolation Utility Classes

#### 3.1 TestIsolationContext

Central class managing all isolation concerns:

```typescript
class TestIsolationContext {
  // Unique identification
  readonly id: string;
  readonly tempDir: string;

  // Resource managers
  readonly files: FileSystemIsolation;
  readonly env: EnvironmentIsolation;
  readonly mocks: MockIsolation;
  readonly timers: TimerIsolation;
  readonly processes: ProcessIsolation;

  // Lifecycle
  async setup(): Promise<void>;
  async teardown(): Promise<void>;

  // Cleanup registration
  registerCleanup(fn: CleanupFn, priority?: number): void;
}
```

#### 3.2 FileSystemIsolation

Manages file system resources with automatic tracking:

```typescript
class FileSystemIsolation {
  createTempDir(prefix?: string): Promise<string>;
  createTempFile(name: string, content?: string): Promise<string>;
  trackPath(path: string): void;
  cleanup(): Promise<void>;
}
```

#### 3.3 EnvironmentIsolation

Captures and restores environment variables:

```typescript
class EnvironmentIsolation {
  setEnv(key: string, value: string): void;
  deleteEnv(key: string): void;
  snapshot(): Record<string, string | undefined>;
  restore(): void;
}
```

#### 3.4 MockIsolation

Manages mock lifecycle with automatic restoration:

```typescript
class MockIsolation {
  spyOn<T, K>(obj: T, method: K): SpyInstance;
  mock<T>(path: string, factory?: () => T): void;
  fn<T>(impl?: T): MockFn;
  restoreAll(): void;
}
```

### 4. Test Helpers

#### 4.1 createIsolatedTest

Factory for creating isolated test environments:

```typescript
async function createIsolatedTest(options?: {
  prefix?: string;
  withDatabase?: boolean;
  withMocks?: boolean;
}): Promise<TestIsolationContext>
```

#### 4.2 withIsolation

Wrapper ensuring cleanup even on failure:

```typescript
async function withIsolation<T>(
  fn: (ctx: TestIsolationContext) => Promise<T>
): Promise<T>
```

#### 4.3 isolatedDescribe / isolatedIt

Enhanced test blocks with built-in isolation:

```typescript
isolatedDescribe('Feature', (getContext) => {
  isolatedIt('should work', async () => {
    const ctx = getContext();
    // ctx is fully isolated
  });
});
```

### 5. Parallel Execution Guidelines

#### 5.1 Vitest Configuration

```typescript
// vitest.config.ts for parallel tests
{
  pool: 'forks',
  poolOptions: {
    forks: {
      maxForks: 4,      // CPU cores / 2 for I/O-bound tests
      minForks: 1,
    },
  },
  sequence: {
    shuffle: false,     // Deterministic ordering
  },
}
```

#### 5.2 Resource Allocation

| Resource Type | Isolation Strategy |
|--------------|-------------------|
| Temp Directories | Unique per test via `os.tmpdir()` + test ID |
| SQLite Databases | In-memory or unique file per test |
| Network Ports | Ephemeral ports (0) or offset by test ID |
| Environment Vars | Snapshot/restore pattern |
| Timers | Track and clear all |
| Processes | Track and kill all |

### 6. Integration with Existing Infrastructure

The isolation utilities integrate with existing test infrastructure:

```typescript
// tests/test-utils/isolation.ts - NEW
export * from './isolation/context';
export * from './isolation/file-system';
export * from './isolation/environment';
export * from './isolation/mocks';
export * from './isolation/timers';
export * from './isolation/processes';
export * from './isolation/helpers';

// tests/test-utils/index.ts - UPDATED
export * from './isolation';  // Add to existing exports
```

### 7. Usage Examples

#### 7.1 Basic Isolated Test

```typescript
import { createIsolatedTest } from '../test-utils';

describe('Feature', () => {
  let ctx: TestIsolationContext;

  beforeEach(async () => {
    ctx = await createIsolatedTest({ prefix: 'feature' });
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  it('should work in isolation', async () => {
    // Use ctx.tempDir for files
    const file = await ctx.files.createTempFile('test.txt', 'content');

    // Use ctx.env for environment
    ctx.env.setEnv('TEST_VAR', 'value');

    // All cleaned up automatically
  });
});
```

#### 7.2 Using withIsolation Wrapper

```typescript
import { withIsolation } from '../test-utils';

it('should handle errors with cleanup', async () => {
  await withIsolation(async (ctx) => {
    await ctx.files.createTempFile('data.json', '{}');

    // Even if this throws, cleanup happens
    await someOperationThatMightFail();
  });
});
```

#### 7.3 Database Test Isolation

```typescript
import { createIsolatedTest } from '../test-utils';

describe('Database Feature', () => {
  it('should use isolated database', async () => {
    const ctx = await createIsolatedTest({ withDatabase: true });

    try {
      // ctx.dbPath is unique to this test
      const store = new TaskStore(ctx.dbPath);
      await store.initialize();

      // Database operations...

      store.close();
    } finally {
      await ctx.teardown();
    }
  });
});
```

## Consequences

### Positive
- **Consistent isolation**: All tests use the same patterns
- **Parallel-safe**: Tests can run concurrently without interference
- **Automatic cleanup**: Resources are always cleaned up, even on failure
- **Documented patterns**: Clear guidelines for test authors
- **Extensible**: New isolation strategies can be added easily

### Negative
- **Slight overhead**: Creating isolated contexts adds ~10-50ms per test
- **Learning curve**: Developers need to understand isolation patterns
- **Migration effort**: Existing tests may need updates to use new patterns

### Risks & Mitigations
- **Risk**: Cleanup failure leaves resources behind
  - **Mitigation**: Global cleanup in `afterAll`, orphan resource detection
- **Risk**: Parallel tests accidentally share state
  - **Mitigation**: Static analysis for global variable usage, unique namespacing

## References

- Existing test utilities: `tests/test-utils/`
- Integration test setup: `tests/integration/setup.ts`
- Vitest documentation: https://vitest.dev/guide/
