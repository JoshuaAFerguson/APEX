# ADR-008: Parallel Test Execution Support Utilities

## Status
Accepted

## Date
2026-02-12

## Context

APEX uses Vitest with parallel test execution enabled across the monorepo:
- `packages/orchestrator/vitest.config.ts`: `pool: 'threads'`, `maxConcurrency: 5`
- `packages/core/vitest.config.ts`: `pool: 'forks'`
- Various integration test configs use `pool: 'forks'` or `pool: 'threads'`

Current test utilities in `packages/orchestrator/src/test-utils.ts` provide:
- `createTestDatabase()` - In-memory SQLite for isolated testing
- `createTestTaskStore()` - TaskStore with temp directory
- `createTempDirectoryAsync()` - Unique temp directories per test
- `DatabaseSeeder` - Consolidated E2E test data management

However, the current implementation lacks explicit guarantees for parallel test safety, which can lead to:
1. **Database path collisions** - Multiple workers could potentially create databases with the same name
2. **Shared mutable state** - Static variables or module-level state could be modified by concurrent tests
3. **Event emitter interference** - Global or shared event emitters could receive events from other tests
4. **Resource contention** - Tests accessing the same files or ports concurrently

The existing `tests/test-utils/isolation.ts` provides a comprehensive isolation framework but is not integrated with orchestrator-specific test utilities.

## Decision

We will create a new `packages/orchestrator/src/parallel-test-utils.ts` module that provides:

### 1. Worker-Aware Database Paths
```typescript
/**
 * Get a unique database path incorporating Vitest worker ID
 * Ensures no database collisions during parallel execution
 */
function getWorkerUniqueDbPath(prefix?: string): string;

/**
 * Get the current Vitest worker ID (falls back to process ID)
 */
function getTestWorkerId(): string;
```

### 2. Isolated Event Emitter Factory
```typescript
/**
 * Creates an isolated EventEmitter instance for testing
 * Each test gets its own emitter that doesn't interfere with others
 */
function createIsolatedEventEmitter<T extends EventMap>(): TypedEventEmitter<T>;

/**
 * Context for managing isolated event emitters in tests
 */
interface IsolatedEventEmitterContext<T extends EventMap> {
  emitter: TypedEventEmitter<T>;
  cleanup: () => void;
  getEventHistory: () => Array<{ event: string; args: any[] }>;
}
```

### 3. Shared State Guards
```typescript
/**
 * Assertion helper to verify no shared mutable state
 * Captures state before test and verifies it's restored after
 */
function assertNoSharedMutation<T>(
  getState: () => T,
  testFn: () => Promise<void>
): Promise<void>;

/**
 * Creates a deep-frozen copy of state that throws on modification
 */
function createImmutableSnapshot<T>(state: T): Readonly<T>;
```

### 4. Mutex/Locking Helpers (Optional Resource Sharing)
```typescript
/**
 * Simple async mutex for coordinating access to shared resources
 * Use sparingly - prefer isolation over locking
 */
class AsyncMutex {
  acquire(): Promise<() => void>;
  withLock<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Named resource locks for test coordination
 * Prevents concurrent access to same resource across workers
 */
class ResourceLockManager {
  acquireLock(resourceId: string, timeout?: number): Promise<ResourceLock>;
  releaseLock(lock: ResourceLock): void;
  isLocked(resourceId: string): boolean;
}
```

### 5. Parallel-Safe Test Context
```typescript
/**
 * Complete parallel-safe test context combining all utilities
 */
interface ParallelTestContext {
  workerId: string;
  tempDir: string;
  dbPath: string;
  eventEmitter: IsolatedEventEmitterContext<OrchestratorEvents>;
  cleanup: () => Promise<void>;
}

/**
 * Create a complete parallel-safe test context
 */
async function createParallelTestContext(
  options?: ParallelTestContextOptions
): Promise<ParallelTestContext>;
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Parallel Test Execution                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Worker 1    │  │  Worker 2    │  │  Worker 3    │         │
│  │              │  │              │  │              │         │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │         │
│  │ │ Test A   │ │  │ │ Test B   │ │  │ │ Test C   │ │         │
│  │ └────┬─────┘ │  │ └────┬─────┘ │  │ └────┬─────┘ │         │
│  │      │       │  │      │       │  │      │       │         │
│  │      ▼       │  │      ▼       │  │      ▼       │         │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │         │
│  │ │ParallelTC│ │  │ │ParallelTC│ │  │ │ParallelTC│ │         │
│  │ └────┬─────┘ │  │ └────┬─────┘ │  │ └────┬─────┘ │         │
│  │      │       │  │      │       │  │      │       │         │
│  └──────┼───────┘  └──────┼───────┘  └──────┼───────┘         │
│         │                 │                 │                  │
│  ┌──────┴────────────────┴────────────────┴─────────┐         │
│  │               Isolated Resources                  │         │
│  ├──────────────────────────────────────────────────┤         │
│  │                                                   │         │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │         │
│  │  │ apex-w1-    │  │ apex-w2-    │  │ apex-w3-  │ │         │
│  │  │ test.db     │  │ test.db     │  │ test.db   │ │         │
│  │  └─────────────┘  └─────────────┘  └───────────┘ │         │
│  │                                                   │         │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │         │
│  │  │EventEmitter1│  │EventEmitter2│  │EventEmitter3│         │
│  │  └─────────────┘  └─────────────┘  └───────────┘ │         │
│  │                                                   │         │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │         │
│  │  │ /tmp/w1/    │  │ /tmp/w2/    │  │ /tmp/w3/  │ │         │
│  │  └─────────────┘  └─────────────┘  └───────────┘ │         │
│  │                                                   │         │
│  └──────────────────────────────────────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Worker ID Detection Strategy

Vitest exposes worker information through:
1. `process.env.VITEST_POOL_ID` - Pool identifier
2. `process.env.VITEST_WORKER_ID` - Worker thread/fork ID (undocumented but available)
3. `globalThis.__vitest_worker__` - Worker context object
4. Fallback to `process.pid` for single-threaded execution

```typescript
export function getTestWorkerId(): string {
  // Try Vitest worker ID first
  if (process.env.VITEST_WORKER_ID) {
    return `w${process.env.VITEST_WORKER_ID}`;
  }

  // Try Vitest pool ID
  if (process.env.VITEST_POOL_ID) {
    return `p${process.env.VITEST_POOL_ID}`;
  }

  // Check for worker context
  if ('__vitest_worker__' in globalThis) {
    const worker = (globalThis as any).__vitest_worker__;
    if (worker?.id) {
      return `v${worker.id}`;
    }
  }

  // Fallback to process ID + random suffix for uniqueness
  return `pid${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
}
```

### Database Path Generation

```typescript
export function getWorkerUniqueDbPath(prefix: string = 'apex'): string {
  const workerId = getTestWorkerId();
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  return path.join(
    os.tmpdir(),
    `${prefix}-${workerId}-${timestamp}-${random}`,
    '.apex',
    'apex.db'
  );
}
```

### Isolated Event Emitter Pattern

```typescript
import { EventEmitter } from 'eventemitter3';

export function createIsolatedEventEmitter<T extends EventMap>(): IsolatedEventEmitterContext<T> {
  const emitter = new EventEmitter<T>();
  const eventHistory: Array<{ event: string; args: any[]; timestamp: number }> = [];

  // Wrap emit to capture history
  const originalEmit = emitter.emit.bind(emitter);
  emitter.emit = function<K extends keyof T>(event: K, ...args: any[]): boolean {
    eventHistory.push({
      event: String(event),
      args,
      timestamp: Date.now()
    });
    return originalEmit(event, ...args);
  };

  return {
    emitter,
    cleanup: () => {
      emitter.removeAllListeners();
      eventHistory.length = 0;
    },
    getEventHistory: () => [...eventHistory]
  };
}
```

### Preventing Shared State Mutations

```typescript
export async function assertNoSharedMutation<T>(
  getState: () => T,
  testFn: () => Promise<void>
): Promise<void> {
  const stateBefore = JSON.parse(JSON.stringify(getState()));

  try {
    await testFn();
  } finally {
    const stateAfter = JSON.parse(JSON.stringify(getState()));

    if (JSON.stringify(stateBefore) !== JSON.stringify(stateAfter)) {
      throw new Error(
        'Shared state was mutated during test execution.\n' +
        `Before: ${JSON.stringify(stateBefore, null, 2)}\n` +
        `After: ${JSON.stringify(stateAfter, null, 2)}`
      );
    }
  }
}
```

## File Structure

```
packages/orchestrator/src/
├── test-utils.ts                    # Existing utilities (unchanged)
├── test-utils-mcp.ts               # Existing MCP utilities (unchanged)
├── parallel-test-utils.ts          # NEW: Parallel execution utilities
└── __tests__/
    └── parallel-test-utils.test.ts # NEW: Tests for parallel utilities
```

## Integration with Existing Utilities

The new utilities will integrate with existing test infrastructure:

```typescript
// Enhanced createTestTaskStore with worker isolation
export async function createParallelSafeTaskStore(): Promise<TestTaskStoreContext> {
  const workerId = getTestWorkerId();
  const tempPath = await createTempDirectoryAsync(`apex-test-${workerId}-`);
  const store = new TaskStore(tempPath);
  await store.initialize();

  return {
    store,
    db: store.getDatabase(),
    tempPath,
    workerId,
    cleanup: async () => {
      try {
        store.close();
      } catch {
        // Already closed
      }
      await removeTempDirectory(tempPath);
    },
  };
}
```

## Consequences

### Positive
- **Guaranteed isolation**: Each worker gets unique resources, preventing interference
- **Deterministic tests**: Same test produces same results regardless of parallelization
- **Improved debugging**: Event history tracking aids in understanding test failures
- **Performance**: Tests can run in parallel without sacrificing correctness
- **Backward compatible**: Existing tests continue to work unchanged

### Negative
- **Additional complexity**: More utilities to understand and maintain
- **Slight overhead**: Worker ID detection and path generation add minimal overhead
- **Resource usage**: Each worker creates its own database and temp files

### Risks
- **Vitest internals**: Worker ID detection depends on undocumented Vitest behavior
- **File system pressure**: Many parallel tests create many temp files

## Migration Path

1. New tests SHOULD use `createParallelTestContext()` or individual utilities
2. Existing tests CAN migrate incrementally (no breaking changes)
3. Tests that share state MUST be refactored to use isolated resources

## Usage Examples

### Basic Usage
```typescript
describe('MyFeature', () => {
  let ctx: ParallelTestContext;

  beforeEach(async () => {
    ctx = await createParallelTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('should work in parallel', async () => {
    // Each worker gets unique ctx.dbPath, ctx.tempDir, ctx.eventEmitter
    const store = new TaskStore(ctx.tempDir);
    await store.initialize();

    // Events are isolated
    ctx.eventEmitter.emitter.emit('task:started', 'task-1');
    expect(ctx.eventEmitter.getEventHistory()).toHaveLength(1);
  });
});
```

### With Resource Locking
```typescript
describe('Shared resource tests', () => {
  const mutex = new AsyncMutex();

  it('test 1', async () => {
    await mutex.withLock(async () => {
      // Exclusive access to shared resource
    });
  });

  it('test 2', async () => {
    await mutex.withLock(async () => {
      // Will wait for test 1 if running concurrently
    });
  });
});
```

## References

- Vitest Documentation: https://vitest.dev/guide/
- eventemitter3: https://github.com/primus/eventemitter3
- Existing isolation utilities: `tests/test-utils/isolation.ts`
- Existing test utilities: `packages/orchestrator/src/test-utils.ts`
