# ADR-008: Base Test Setup and Teardown Utilities

## Status
Accepted

## Date
2025-01-26

## Context

The APEX monorepo needs a standardized, reusable test setup and teardown utility module with beforeEach/afterEach patterns. The acceptance criteria requires:

1. **A test utilities module** with reusable beforeEach/afterEach helper functions
2. **Mock initialization** handled in setup functions
3. **State cleanup** handled in teardown functions
4. **Documented patterns** with usage examples

### Current State Analysis

The monorepo already has extensive test utilities spread across multiple locations:

| Location | Purpose | Key Features |
|----------|---------|--------------|
| `packages/core/src/test-utils.ts` | Core test utilities | Platform detection, permission mocks, custom matchers |
| `packages/orchestrator/src/test-utils.ts` | Orchestrator utilities | SQLite test DB, temp directories, MCP mocks |
| `tests/test-utils/index.ts` | Central utilities | Test environment creation, fixtures |
| `tests/test-utils/context.ts` | Context management | TestContext class, MockManager, EventTracker |
| `tests/test-utils/cleanup.ts` | Cleanup utilities | CleanupManager, FileSystemCleanup, etc. |
| `tests/test-utils/async.ts` | Async utilities | waitFor, retry, createDeferred |
| `tests/test-utils/assertions.ts` | Assertion helpers | expectToThrow, expectObjectShape, etc. |

### What's Missing

The existing utilities are comprehensive but lack a **standardized lifecycle pattern** specifically designed for beforeEach/afterEach usage:

1. **No unified setup/teardown functions** that encapsulate common patterns
2. **No pre-built hooks** that tests can import directly
3. **Scattered patterns** require each test file to manually configure setup/teardown
4. **No type-safe context passing** between beforeEach and test functions

## Decision

### Architecture: Create a Dedicated Lifecycle Module

Create a new module `tests/test-utils/lifecycle.ts` that provides:

1. **Pre-built beforeEach/afterEach hooks** that can be imported and used directly
2. **Composable setup builders** for creating custom test lifecycles
3. **Type-safe context management** between setup and test functions
4. **Standardized patterns** for common scenarios (database tests, file system tests, mock tests)

### Module Location

```
tests/test-utils/
├── index.ts          # Add re-exports for lifecycle module
├── context.ts        # Existing context management
├── cleanup.ts        # Existing cleanup utilities
├── async.ts          # Existing async utilities
├── assertions.ts     # Existing assertion helpers
└── lifecycle.ts      # NEW: beforeEach/afterEach patterns
```

### API Design

#### 1. Core Lifecycle Types

```typescript
// ============================================================================
// Core Types
// ============================================================================

/**
 * Configuration for a test lifecycle
 */
export interface LifecycleConfig<TContext> {
  /** Setup function called in beforeEach */
  setup: () => Promise<TContext> | TContext;
  /** Teardown function called in afterEach */
  teardown: (context: TContext) => Promise<void> | void;
  /** Optional timeout for setup (default: 5000ms) */
  setupTimeout?: number;
  /** Optional timeout for teardown (default: 5000ms) */
  teardownTimeout?: number;
}

/**
 * Result of creating a lifecycle
 */
export interface LifecycleHooks<TContext> {
  /** Context shared between beforeEach and tests */
  context: () => TContext;
  /** Function to call in beforeEach */
  beforeEach: () => Promise<void>;
  /** Function to call in afterEach */
  afterEach: () => Promise<void>;
}

/**
 * Options for automatic lifecycle registration
 */
export interface UseLifecycleOptions {
  /** Whether to register hooks automatically (default: true) */
  autoRegister?: boolean;
}
```

#### 2. Pre-built Lifecycle Patterns

```typescript
// ============================================================================
// Pre-built Lifecycle Patterns
// ============================================================================

/**
 * Context for basic test setup
 */
export interface BasicTestContext {
  /** Unique test ID */
  testId: string;
  /** Start time of the test */
  startTime: Date;
  /** Cleanup manager for registering resources */
  cleanup: CleanupManager;
  /** Mock manager for managing vitest mocks */
  mocks: MockManager;
}

/**
 * Create a basic test lifecycle with mocks and cleanup
 */
export function createBasicLifecycle(): LifecycleHooks<BasicTestContext>;

/**
 * Context for file system tests
 */
export interface FileSystemTestContext extends BasicTestContext {
  /** Temporary directory for the test */
  tempDir: string;
  /** Helper to create files in temp directory */
  createFile: (name: string, content?: string) => Promise<string>;
  /** Helper to create subdirectories */
  createDir: (name: string) => Promise<string>;
}

/**
 * Create a file system test lifecycle with temp directory
 */
export function createFileSystemLifecycle(options?: {
  prefix?: string;
}): LifecycleHooks<FileSystemTestContext>;

/**
 * Context for database tests
 */
export interface DatabaseTestContext extends BasicTestContext {
  /** Path to the test database */
  dbPath: string;
  /** Temporary directory containing the database */
  tempDir: string;
  /** Database instance (better-sqlite3) */
  db?: any;
}

/**
 * Create a database test lifecycle with SQLite setup
 */
export function createDatabaseLifecycle(options?: {
  /** Whether to use in-memory database (default: false) */
  inMemory?: boolean;
  /** Schema initialization function */
  initSchema?: (db: any) => void;
}): LifecycleHooks<DatabaseTestContext>;

/**
 * Context for orchestrator tests
 */
export interface OrchestratorTestContext extends DatabaseTestContext {
  /** TaskStore instance */
  store?: any;
  /** Test project path */
  projectPath: string;
}

/**
 * Create an orchestrator test lifecycle with TaskStore
 */
export function createOrchestratorLifecycle(): LifecycleHooks<OrchestratorTestContext>;
```

#### 3. Lifecycle Builders

```typescript
// ============================================================================
// Lifecycle Builders
// ============================================================================

/**
 * Builder for creating custom lifecycles
 */
export class LifecycleBuilder<TContext> {
  private setupFns: Array<(ctx: Partial<TContext>) => Promise<void> | void> = [];
  private teardownFns: Array<(ctx: TContext) => Promise<void> | void> = [];

  /**
   * Add a setup step
   */
  addSetup(fn: (ctx: Partial<TContext>) => Promise<void> | void): this;

  /**
   * Add a teardown step (executed in reverse order)
   */
  addTeardown(fn: (ctx: TContext) => Promise<void> | void): this;

  /**
   * Include another lifecycle's setup/teardown
   */
  include<TOther extends object>(
    other: LifecycleHooks<TOther>
  ): LifecycleBuilder<TContext & TOther>;

  /**
   * Build the lifecycle hooks
   */
  build(): LifecycleHooks<TContext>;
}

/**
 * Create a new lifecycle builder
 */
export function lifecycleBuilder<TContext>(): LifecycleBuilder<TContext>;
```

#### 4. Utility Functions

```typescript
// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Use a lifecycle in a describe block with automatic registration
 *
 * @example
 * ```typescript
 * describe('MyTests', () => {
 *   const ctx = useLifecycle(createBasicLifecycle());
 *
 *   it('should work', () => {
 *     expect(ctx().testId).toBeDefined();
 *     ctx().mocks.fn(() => 'mocked');
 *   });
 * });
 * ```
 */
export function useLifecycle<TContext>(
  lifecycle: LifecycleHooks<TContext>,
  options?: UseLifecycleOptions
): () => TContext;

/**
 * Combine multiple lifecycles into one
 * Setup runs in order, teardown runs in reverse order
 */
export function combineLifecycles<T1, T2>(
  first: LifecycleHooks<T1>,
  second: LifecycleHooks<T2>
): LifecycleHooks<T1 & T2>;

/**
 * Create a lifecycle from a simple setup/teardown pair
 */
export function createLifecycle<TContext>(
  config: LifecycleConfig<TContext>
): LifecycleHooks<TContext>;

/**
 * Wrap a lifecycle to add additional behavior
 */
export function wrapLifecycle<TContext, TExtended extends TContext>(
  base: LifecycleHooks<TContext>,
  wrapper: {
    setup?: (ctx: TContext) => Promise<TExtended> | TExtended;
    teardown?: (ctx: TExtended) => Promise<void> | void;
  }
): LifecycleHooks<TExtended>;
```

### Usage Examples

#### Example 1: Basic Test with Mocks

```typescript
import { describe, it, expect } from 'vitest';
import { useLifecycle, createBasicLifecycle } from '../../tests/test-utils';

describe('MyService', () => {
  // Automatically registers beforeEach/afterEach
  const ctx = useLifecycle(createBasicLifecycle());

  it('should handle mock functions', () => {
    const mockFn = ctx().mocks.fn(() => 'mocked');
    expect(mockFn()).toBe('mocked');
  });

  it('should have unique test ID per test', () => {
    expect(ctx().testId).toBeDefined();
    expect(ctx().testId).toContain('test_');
  });
});
```

#### Example 2: File System Tests

```typescript
import { describe, it, expect } from 'vitest';
import { useLifecycle, createFileSystemLifecycle } from '../../tests/test-utils';
import * as fs from 'fs/promises';

describe('FileOperations', () => {
  const ctx = useLifecycle(createFileSystemLifecycle({ prefix: 'file-test-' }));

  it('should work with temp directory', async () => {
    const filePath = await ctx().createFile('test.txt', 'hello');
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('hello');
  });

  // tempDir is automatically cleaned up in afterEach
});
```

#### Example 3: Database Tests

```typescript
import { describe, it, expect } from 'vitest';
import { useLifecycle, createDatabaseLifecycle } from '../../tests/test-utils';

describe('TaskStore', () => {
  const ctx = useLifecycle(createDatabaseLifecycle({
    initSchema: (db) => {
      db.exec('CREATE TABLE tasks (id TEXT PRIMARY KEY, name TEXT)');
    }
  }));

  it('should insert and retrieve tasks', () => {
    const db = ctx().db;
    db.exec("INSERT INTO tasks VALUES ('1', 'Test Task')");
    const result = db.prepare('SELECT * FROM tasks').get();
    expect(result.name).toBe('Test Task');
  });

  // Database is automatically closed and temp dir cleaned in afterEach
});
```

#### Example 4: Custom Lifecycle with Builder

```typescript
import { describe, it, expect } from 'vitest';
import { lifecycleBuilder, useLifecycle, createBasicLifecycle } from '../../tests/test-utils';

interface MyTestContext {
  service: MyService;
  mockApi: ReturnType<typeof vi.fn>;
}

describe('MyService with custom lifecycle', () => {
  const customLifecycle = lifecycleBuilder<MyTestContext>()
    .include(createBasicLifecycle())
    .addSetup(async (ctx) => {
      ctx.mockApi = vi.fn().mockResolvedValue({ data: 'test' });
      ctx.service = new MyService(ctx.mockApi);
      await ctx.service.initialize();
    })
    .addTeardown(async (ctx) => {
      await ctx.service.shutdown();
    })
    .build();

  const ctx = useLifecycle(customLifecycle);

  it('should use the service', async () => {
    const result = await ctx().service.getData();
    expect(result).toBe('test');
    expect(ctx().mockApi).toHaveBeenCalled();
  });
});
```

#### Example 5: Manual Hook Registration

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createOrchestratorLifecycle } from '../../tests/test-utils';

describe('OrchestratorTests', () => {
  const lifecycle = createOrchestratorLifecycle();

  // Manual registration gives more control
  beforeEach(async () => {
    await lifecycle.beforeEach();
  });

  afterEach(async () => {
    await lifecycle.afterEach();
  });

  it('should have TaskStore', () => {
    const ctx = lifecycle.context();
    expect(ctx.store).toBeDefined();
    expect(ctx.projectPath).toBeDefined();
  });
});
```

### Integration with Existing Infrastructure

The lifecycle module integrates with existing utilities:

1. **Uses `CleanupManager`** from `tests/test-utils/cleanup.ts` for resource cleanup
2. **Uses `MockManager`** from `tests/test-utils/context.ts` for mock management
3. **Uses `createTestContext`** patterns from `tests/test-utils/context.ts`
4. **Compatible with `createTestDatabase`** from `packages/orchestrator/src/test-utils.ts`
5. **Re-exported through** `tests/test-utils/index.ts` for consistent imports

### Design Principles

1. **Composability** - Lifecycles can be combined and extended
2. **Type Safety** - Full TypeScript generics for context types
3. **LIFO Teardown** - Teardown runs in reverse order of setup
4. **Isolation** - Each test gets a fresh context
5. **Error Resilience** - Teardown continues even if errors occur
6. **Timeout Protection** - Optional timeouts prevent hanging tests
7. **Minimal Boilerplate** - `useLifecycle` auto-registers hooks

### File Structure

```
tests/test-utils/lifecycle.ts
├── Core Types (LifecycleConfig, LifecycleHooks, etc.)
├── Pre-built Lifecycles
│   ├── createBasicLifecycle
│   ├── createFileSystemLifecycle
│   ├── createDatabaseLifecycle
│   └── createOrchestratorLifecycle
├── LifecycleBuilder class
├── Utility Functions
│   ├── useLifecycle
│   ├── combineLifecycles
│   ├── createLifecycle
│   └── wrapLifecycle
└── Internal Helpers
```

## Consequences

### Positive
- **Reduced boilerplate** - Tests can use pre-built lifecycles
- **Consistent patterns** - All tests follow the same setup/teardown patterns
- **Type safety** - Context types are enforced at compile time
- **Easy customization** - LifecycleBuilder allows extending base patterns
- **Better test isolation** - Each test gets a guaranteed fresh state
- **Documentation** - Usage examples serve as documentation

### Negative
- **Learning curve** - Developers need to learn the new patterns
- **Additional abstraction** - May be overkill for simple tests
- **Vitest dependency** - Patterns are specific to vitest's beforeEach/afterEach

### Risks
- **Performance** - Pre-built lifecycles may include unnecessary setup for simple tests
  - Mitigation: Provide minimal `createBasicLifecycle` and let users compose
- **Complexity** - Builder pattern might be overly complex
  - Mitigation: Provide simple `createLifecycle` for basic cases

## Implementation Notes for Next Stages

1. **Developer stage** should implement `lifecycle.ts` with all APIs described above
2. **Tester stage** should:
   - Write unit tests for the lifecycle module itself
   - Update at least 5 existing tests to use the new patterns as validation
3. **Reviewer stage** should verify:
   - All pre-built lifecycles work correctly
   - TypeScript types are correctly inferred
   - Documentation examples are accurate

## Export Updates

Update `tests/test-utils/index.ts` to export:

```typescript
// Export lifecycle utilities
export * from './lifecycle';
```

## Related ADRs

- ADR-007: Base Test Utilities Architecture
