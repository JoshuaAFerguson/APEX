# ADR-001: TestContext Factory for Test Isolation

## Status
Proposed

## Context

The APEX test infrastructure currently has several patterns for test isolation:
1. Manual unique directory creation using `Date.now()` and `Math.random()` in individual tests
2. The `createTestSuite` function in `setup-teardown.ts` for setup/teardown hooks
3. The `dataGenerator` utility in `test-utils.ts` for generating random test data
4. Various factory functions in the `factories/` directory for creating test fixtures

However, there's no unified `TestContext` abstraction that:
- Generates unique identifiers per test
- Provides isolated namespaces for test data
- Manages test-scoped resources (directories, databases, etc.)
- Ensures proper cleanup after each test

This leads to:
- Duplicated boilerplate in test files for generating unique IDs
- Inconsistent isolation patterns across packages
- Potential test pollution when tests share resources
- Verbose setup/teardown code in each test file

## Decision

Create a `TestContext` class/factory that:

1. **Generates unique identifiers per test** - Provides methods to create test-scoped unique IDs with consistent prefixes
2. **Provides isolated namespaces** - Creates namespaced paths, keys, and identifiers that are scoped to a specific test
3. **Manages test lifecycle** - Integrates with beforeEach/afterEach patterns for automatic setup/cleanup
4. **Is type-safe** - Full TypeScript types for all context properties and methods

## Design

### Core Interface

```typescript
interface TestContext {
  // Unique test identifier
  readonly testId: string;

  // Namespace prefix for all test-scoped resources
  readonly namespace: string;

  // Timestamp when context was created
  readonly createdAt: Date;

  // Generate unique identifiers
  uniqueId(prefix?: string): string;
  uniqueTaskId(): string;
  uniqueSessionId(): string;

  // Namespace utilities
  namespacedPath(basePath: string): string;
  namespacedKey(key: string): string;

  // Test data storage
  getData<T>(key: string): T | undefined;
  setData<T>(key: string, value: T): void;

  // Resource management
  addCleanupTask(task: () => Promise<void> | void): void;
  cleanup(): Promise<void>;

  // Directory management
  createTempDir(): Promise<string>;
  getTempDir(): string | undefined;
}
```

### Factory Function

```typescript
function createTestContext(options?: TestContextOptions): TestContext;
```

### Integration with Test Suite

```typescript
// In test files
const ctx = createTestContext();
beforeEach(() => ctx.setup());
afterEach(() => ctx.cleanup());

// Or use the hook-based approach
const ctx = useTestContext();
```

## Location

The TestContext will be located in:
```
packages/core/src/test-fixtures/context/
├── index.ts              # Barrel export
├── test-context.ts       # TestContext class implementation
├── types.ts              # TypeScript interfaces
└── ADR-001-test-context-factory.md  # This document
```

## Consequences

### Positive
- Consistent test isolation across all packages
- Reduced boilerplate in test files
- Type-safe test context access
- Automatic cleanup prevents test pollution
- Clear namespace boundaries between tests

### Negative
- Additional abstraction layer
- Learning curve for new developers
- Slight overhead for simple tests (mitigated by optional usage)

### Neutral
- Existing tests can be migrated incrementally
- Compatible with current `createTestSuite` pattern

## Alternatives Considered

1. **Extend dataGenerator** - Too narrow in scope, doesn't handle lifecycle
2. **Extend createTestSuite** - Would make it too complex, mixing concerns
3. **Per-package solutions** - Would lead to inconsistency and duplication

## References

- Existing patterns in `packages/core/src/test-fixtures/`
- `packages/orchestrator/src/daemon-lifecycle.integration.test.ts` - Example of manual isolation
- `packages/orchestrator/src/approval-handlers.integration.test.ts` - Example of unique ID generation
