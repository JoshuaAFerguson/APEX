# ADR-051: Test Isolation Patterns

## Status
Accepted

## Date
2025-02-07

## Context

APEX has extensive test infrastructure with utilities for cleanup, context management, and async testing. However, the current implementation lacks formal patterns for:

1. **Unique test contexts** - Session/correlation IDs for tracking test execution
2. **State cleanup verification** - Automated detection of state leakage between tests
3. **Parallel test support** - Coordination for tests running concurrently without interference
4. **Documented isolation patterns** - Example patterns in documentation comments

### Current State Analysis

The existing test utilities provide:
- `TestContext` with unique IDs and temp directories
- `CleanupManager` with LIFO cleanup ordering
- `MockManager` for spy/mock tracking
- `EventTracker` for event-driven testing
- In-memory SQLite databases for database isolation

Gaps identified:
- No explicit session/correlation ID propagation
- No automatic verification that tests cleaned up properly
- No built-in parallel test coordination
- Cleanup errors are logged but not aggregated for analysis

## Decision

We will enhance the test isolation infrastructure with four key patterns:

### 1. Isolated Test Session Pattern

Create `IsolatedTestSession` that provides:
- Unique session ID (UUID v4) for each test
- Correlation ID for tracing related operations
- Automatic context propagation
- Session-scoped resource tracking

```typescript
interface IsolatedTestSession {
  /** Unique session identifier (UUID v4) */
  sessionId: string;
  /** Correlation ID for tracing related operations */
  correlationId: string;
  /** Test context with temp directory and cleanup */
  context: TestContext;
  /** Session-scoped cleanup manager */
  cleanup: CleanupManager;
  /** Session metadata for debugging */
  metadata: SessionMetadata;
  /** Mark session as complete and verify cleanup */
  complete(): Promise<IsolationReport>;
}
```

### 2. State Isolation Verification Pattern

Create `StateVerifier` that:
- Takes snapshots of relevant state before test execution
- Compares state after test completion
- Detects unexpected mutations or leaked resources
- Reports isolation violations

```typescript
interface StateVerifier {
  /** Capture initial state before test */
  captureInitialState(): Promise<StateSnapshot>;
  /** Verify state matches initial after cleanup */
  verifyIsolation(initial: StateSnapshot): Promise<IsolationReport>;
  /** Register custom state checkers */
  addChecker(name: string, checker: StateChecker): void;
}

interface IsolationReport {
  success: boolean;
  violations: IsolationViolation[];
  warnings: string[];
  cleanupStats: CleanupStats;
}
```

### 3. Parallel Test Coordination Pattern

Create `ParallelTestCoordinator` that:
- Assigns unique namespaces to parallel test workers
- Prevents resource collisions (ports, files, database tables)
- Coordinates shared resource access
- Tracks cross-worker dependencies

```typescript
interface ParallelTestCoordinator {
  /** Get unique namespace for this worker */
  getWorkerNamespace(): string;
  /** Allocate a unique port for this test */
  allocatePort(basePort: number): number;
  /** Create namespaced temp directory */
  createNamespacedTempDir(prefix: string): Promise<string>;
  /** Register shared resource with lock */
  acquireSharedResource(name: string): Promise<ResourceLock>;
  /** Release shared resource lock */
  releaseSharedResource(lock: ResourceLock): Promise<void>;
}
```

### 4. Test Isolation Boundary Pattern

Create `IsolationBoundary` that:
- Defines explicit isolation scopes (test, suite, file)
- Enforces cleanup at boundary exit
- Provides isolation guarantees documentation
- Supports nested boundaries

```typescript
interface IsolationBoundary {
  /** Boundary scope type */
  scope: 'test' | 'suite' | 'file' | 'worker';
  /** Parent boundary if nested */
  parent?: IsolationBoundary;
  /** Resources tracked in this boundary */
  resources: TrackedResource[];
  /** Enter the boundary - setup isolation */
  enter(): Promise<void>;
  /** Exit the boundary - enforce cleanup */
  exit(): Promise<IsolationReport>;
}
```

## Implementation Architecture

### File Structure

```
tests/test-utils/
├── isolation/
│   ├── index.ts                 # Public exports
│   ├── session.ts               # IsolatedTestSession implementation
│   ├── verifier.ts              # StateVerifier implementation
│   ├── coordinator.ts           # ParallelTestCoordinator implementation
│   ├── boundary.ts              # IsolationBoundary implementation
│   ├── types.ts                 # Shared types and interfaces
│   └── __tests__/
│       ├── session.test.ts      # Session isolation tests
│       ├── verifier.test.ts     # State verification tests
│       ├── coordinator.test.ts  # Parallel coordination tests
│       └── boundary.test.ts     # Boundary tests
└── index.ts                     # Updated to export isolation module
```

### Integration with Existing Utilities

The new isolation patterns integrate with existing utilities:

```
                    ┌──────────────────────────────────────────┐
                    │          IsolatedTestSession             │
                    │  - sessionId: UUID                       │
                    │  - correlationId: string                 │
                    │  - metadata: SessionMetadata             │
                    └──────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
           │  TestContext │   │CleanupManager│   │ StateVerifier│
           │  (existing)  │   │  (existing)  │   │    (new)     │
           └──────────────┘   └──────────────┘   └──────────────┘
                    │                  │                  │
                    ▼                  ▼                  ▼
           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
           │  tempDir     │   │  LIFO order  │   │  Snapshots   │
           │  unique ID   │   │  multi-type  │   │  Comparison  │
           │  data store  │   │  cleanup     │   │  Reporting   │
           └──────────────┘   └──────────────┘   └──────────────┘
```

### Parallel Test Coordination Architecture

```
                    ┌────────────────────────────────────────┐
                    │       ParallelTestCoordinator          │
                    │  - workerRegistry: Map<id, namespace>  │
                    │  - resourceLocks: Map<name, lock>      │
                    │  - portAllocator: PortAllocator        │
                    └────────────────────────────────────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          ▼                            ▼                            ▼
   ┌─────────────┐             ┌─────────────┐             ┌─────────────┐
   │  Worker 1   │             │  Worker 2   │             │  Worker 3   │
   │ ns: w1_xxx  │             │ ns: w2_xxx  │             │ ns: w3_xxx  │
   │ ports:      │             │ ports:      │             │ ports:      │
   │ 3000-3099   │             │ 3100-3199   │             │ 3200-3299   │
   └─────────────┘             └─────────────┘             └─────────────┘
          │                            │                            │
          ▼                            ▼                            ▼
   ┌─────────────┐             ┌─────────────┐             ┌─────────────┐
   │ tempDir:    │             │ tempDir:    │             │ tempDir:    │
   │ /tmp/w1_xxx │             │ /tmp/w2_xxx │             │ /tmp/w3_xxx │
   └─────────────┘             └─────────────┘             └─────────────┘
```

### State Verification Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Before    │    │   Execute    │    │   After     │    │   Report     │
│   Test      │───▶│   Test       │───▶│   Test      │───▶│   Results    │
│             │    │              │    │             │    │              │
│ ┌─────────┐ │    │              │    │ ┌─────────┐ │    │ ┌──────────┐ │
│ │Snapshot │ │    │              │    │ │Compare  │ │    │ │Violations│ │
│ │ state   │ │    │              │    │ │ states  │ │    │ │ list     │ │
│ └─────────┘ │    │              │    │ └─────────┘ │    │ └──────────┘ │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
      │                                       │                  │
      └───────── Initial State ───────────────┘                  │
                                                                 │
                                              ┌──────────────────┘
                                              ▼
                                    ┌───────────────────┐
                                    │ IsolationReport   │
                                    │ - success: bool   │
                                    │ - violations: []  │
                                    │ - warnings: []    │
                                    │ - cleanupStats    │
                                    └───────────────────┘
```

## Usage Patterns

### Pattern 1: Simple Test Isolation

```typescript
import { createIsolatedSession, withIsolation } from '@tests/test-utils/isolation';

describe('MyFeature', () => {
  it('should work in isolation', async () => {
    // Creates session with unique ID, temp dir, and automatic cleanup
    await withIsolation(async (session) => {
      // session.sessionId - unique identifier for this test
      // session.context.tempDir - isolated temp directory
      // session.correlationId - for tracing related operations

      const result = await myFeature.doSomething();
      expect(result).toBeDefined();

      // Cleanup verified automatically at boundary exit
    });
  });
});
```

### Pattern 2: State Verification

```typescript
import { createStateVerifier } from '@tests/test-utils/isolation';

describe('DatabaseOperations', () => {
  it('should not leak database state', async () => {
    const verifier = createStateVerifier();

    // Capture initial state
    const initial = await verifier.captureInitialState();

    // Execute test
    await database.createRecord({ name: 'test' });
    await database.deleteRecord('test');

    // Verify isolation
    const report = await verifier.verifyIsolation(initial);

    expect(report.success).toBe(true);
    expect(report.violations).toHaveLength(0);
  });
});
```

### Pattern 3: Parallel Test Coordination

```typescript
import { getParallelCoordinator } from '@tests/test-utils/isolation';

describe('ParallelTests', () => {
  const coordinator = getParallelCoordinator();

  it('should use isolated port', async () => {
    // Gets unique port for this worker (e.g., 3000 for worker 1, 3100 for worker 2)
    const port = coordinator.allocatePort(3000);

    const server = await startServer({ port });

    // Test with isolated port
    await request(`http://localhost:${port}/api/test`);

    await server.close();
  });

  it('should use namespaced temp directory', async () => {
    // Creates worker-specific temp dir (e.g., /tmp/apex-test-w1_abc123/)
    const tempDir = await coordinator.createNamespacedTempDir('test');

    await writeFile(path.join(tempDir, 'data.json'), '{}');

    // Cleanup handled by coordinator
  });
});
```

### Pattern 4: Isolation Boundaries

```typescript
import { createIsolationBoundary } from '@tests/test-utils/isolation';

describe('NestedIsolation', () => {
  // Suite-level boundary
  const suiteBoundary = createIsolationBoundary({ scope: 'suite' });

  beforeAll(async () => {
    await suiteBoundary.enter();
    // Suite-level setup
  });

  afterAll(async () => {
    const report = await suiteBoundary.exit();
    expect(report.success).toBe(true);
  });

  it('should have test-level isolation', async () => {
    // Test-level boundary nested in suite boundary
    const testBoundary = createIsolationBoundary({
      scope: 'test',
      parent: suiteBoundary,
    });

    await testBoundary.enter();

    // Test code

    const report = await testBoundary.exit();
    expect(report.success).toBe(true);
  });
});
```

## Default State Checkers

The StateVerifier includes default checkers for common isolation concerns:

### 1. Environment Variables Checker
```typescript
// Detects environment variable changes that weren't cleaned up
{
  name: 'environment',
  capture: () => ({ ...process.env }),
  compare: (before, after) => diffObjects(before, after),
}
```

### 2. Global Mock Checker
```typescript
// Detects vitest mocks that weren't restored
{
  name: 'mocks',
  capture: () => vi.getMockState(),
  compare: (before, after) => compareMockStates(before, after),
}
```

### 3. Timer Checker
```typescript
// Detects lingering setTimeout/setInterval
{
  name: 'timers',
  capture: () => getActiveTimers(),
  compare: (before, after) => compareTimers(before, after),
}
```

### 4. Process Checker
```typescript
// Detects spawned processes that weren't killed
{
  name: 'processes',
  capture: () => getChildProcesses(),
  compare: (before, after) => compareProcesses(before, after),
}
```

### 5. File Descriptor Checker
```typescript
// Detects leaked file handles
{
  name: 'fileDescriptors',
  capture: () => getOpenFileDescriptors(),
  compare: (before, after) => compareFDs(before, after),
}
```

## Vitest Integration

The isolation utilities integrate with vitest's lifecycle hooks:

```typescript
// vitest.setup.ts
import { setupIsolation } from '@tests/test-utils/isolation';

// Global setup for all tests
beforeEach(async (context) => {
  // Automatically creates isolated session for each test
  context.isolation = await setupIsolation(context);
});

afterEach(async (context) => {
  // Automatically verifies isolation and reports violations
  const report = await context.isolation.complete();

  if (!report.success) {
    console.warn('Isolation violations:', report.violations);
  }
});
```

## Error Aggregation

Cleanup errors are aggregated into structured reports:

```typescript
interface CleanupError {
  source: string;           // Which cleanup strategy failed
  error: Error;             // Original error
  resource?: string;        // Resource that failed to clean up
  severity: 'warning' | 'error' | 'critical';
}

interface CleanupStats {
  totalCleanups: number;
  successfulCleanups: number;
  failedCleanups: number;
  errors: CleanupError[];
  duration: number;         // Total cleanup time in ms
}
```

## Migration Path

### Phase 1: Add New Utilities (Non-Breaking)
- Create isolation module with new patterns
- Export from existing test-utils index
- No changes to existing tests required

### Phase 2: Gradual Adoption
- Update test templates to use isolation patterns
- Add isolation to new tests by default
- Document patterns with examples

### Phase 3: Opt-in Enforcement
- Add vitest plugin for automatic isolation verification
- Enable strict mode for CI environments
- Report isolation violations in test results

## Consequences

### Positive
- Clear patterns for test isolation with documented examples
- Automatic detection of state leakage
- Support for parallel test execution without interference
- Better debugging with session/correlation IDs
- Structured error reporting for cleanup failures

### Negative
- Additional setup overhead for tests (mitigated by helpers)
- State verification adds some test execution time
- Learning curve for new patterns

### Neutral
- Existing tests continue to work without changes
- New patterns are opt-in until Phase 3
- Compatible with vitest's built-in isolation features

## References

- [Vitest Test Isolation](https://vitest.dev/guide/test-context.html)
- [Jest Environment Isolation](https://jestjs.io/docs/configuration#testenvironment-string)
- [Testing Library Cleanup](https://testing-library.com/docs/react-testing-library/api#cleanup)
- [ADR-004: MCP Testing Architecture](./ADR-004-mcp-testing-architecture.md)
