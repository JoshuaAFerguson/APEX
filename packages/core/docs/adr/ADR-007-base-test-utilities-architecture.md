# ADR-007: Base Test Utilities Architecture

## Status
Accepted

## Date
2025-01-24

## Context

The APEX monorepo needs a centralized, well-structured base test utilities module that provides common helpers across all packages. The acceptance criteria requires:

1. **Async utilities** - Functions for handling promises, timeouts, retries, and async flow control in tests
2. **Assertion helpers** - Enhanced assertion utilities beyond what vitest provides natively
3. **Test context management** - Lifecycle management for test setup/teardown with resource tracking
4. **Cleanup utilities** - Deterministic resource cleanup to prevent test pollution

### Current State Analysis

The monorepo already has extensive test utilities, but they are:

- **Domain-specific**: The existing `packages/core/src/test-utils.ts` (2,735 lines) focuses almost entirely on platform detection and permission system mocking
- **Scattered**: Each package has its own test-utils with overlapping patterns (CLI has `waitFor`, orchestrator has temp directory management, API has `TestContext`)
- **Missing general-purpose utilities**: No centralized async helpers (retry, withTimeout, waitForCondition), no generic test context management, no structured cleanup utilities

### What Exists Already

| Package | File | Focus |
|---------|------|-------|
| core | `src/test-utils.ts` | Platform detection, permission mocks, custom vitest matchers |
| orchestrator | `src/test-utils.ts` | SQLite test DB, temp directories, policy/browser mocks |
| cli | `src/__tests__/test-utils.tsx` | React render helpers, theme mocking, `waitFor` |
| browser | `src/__tests__/test-utils.ts` | Screenshot validation, performance monitoring |
| web-ui | `src/lib/__tests__/test-utils.ts` | Mock data generators, fetch mocking |
| api | `src/__tests__/setup.ts` | TestContext, WebSocket test client |

### What's Missing (Per Acceptance Criteria)

1. **Async utilities**: `retry()`, `withTimeout()`, `waitForCondition()`, `flushPromises()`, `delay()`, `withConcurrency()`
2. **Generic assertion helpers**: `expectToThrowAsync()`, `expectEventually()`, `expectNever()`, `assertDeepPartial()`
3. **Test context management**: Generic `TestContext` class with lifecycle hooks, resource registration, scoped cleanup
4. **Cleanup utilities**: `CleanupManager` for deterministic LIFO cleanup, `withTempDir()`, `withCleanup()`

## Decision

### Architecture: Extend `@apexcli/core/test-utils` with a Modular Internal Structure

Rather than creating a new package or a separate file, we will **add the base utilities to the existing `packages/core/src/test-utils.ts`** file, organized with clear section separators. This decision is based on:

1. The existing export path `@apexcli/core/test-utils` is already configured in `package.json` and used across packages
2. The file is already excluded from production builds (in `tsconfig.json` exclude)
3. Adding a new package would add build complexity with minimal benefit
4. The utilities are general-purpose and belong in `core`

### Module Structure

The additions will be organized as clearly-separated sections at the end of the existing file:

```
packages/core/src/test-utils.ts
├── [EXISTING] Platform Detection (~140 lines)
├── [EXISTING] Test Skipping Utilities (~100 lines)
├── [EXISTING] Platform-Specific Describe Blocks (~80 lines)
├── [EXISTING] Platform Conditionals (~60 lines)
├── [EXISTING] Platform Mocking (~50 lines)
├── [EXISTING] Permission Mock Factories (~2000 lines)
├── [EXISTING] Custom Vitest Matchers (~300 lines)
├── [NEW] Async Utilities Section
├── [NEW] Assertion Helpers Section
├── [NEW] Test Context Management Section
└── [NEW] Cleanup Utilities Section
```

### Detailed Design

#### 1. Async Utilities

```typescript
// ============================================================================
// Async Utilities
// ============================================================================

/**
 * Delay execution for a specified duration
 */
export function delay(ms: number): Promise<void>;

/**
 * Flush all pending microtasks (Promise callbacks)
 */
export function flushPromises(): Promise<void>;

/**
 * Execute an async function with a timeout
 * Rejects with TimeoutError if the function doesn't complete in time
 */
export function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
  message?: string
): Promise<T>;

/**
 * Retry an async function with configurable attempts and backoff
 */
export function retry<T>(
  fn: () => Promise<T>,
  options?: {
    attempts?: number;       // default: 3
    delay?: number;          // default: 100ms
    backoff?: number;        // default: 2 (exponential)
    shouldRetry?: (error: Error) => boolean;  // default: always retry
  }
): Promise<T>;

/**
 * Wait for a condition to become true (polling-based)
 */
export function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options?: {
    timeout?: number;        // default: 5000ms
    interval?: number;       // default: 50ms
    message?: string;        // custom timeout error message
  }
): Promise<void>;

/**
 * Run multiple async operations with limited concurrency
 */
export function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]>;

/**
 * Collect events emitted during an async operation
 */
export function collectEvents<T>(
  emitter: { on: Function; off: Function },
  eventName: string,
  operation: () => Promise<void>
): Promise<T[]>;
```

#### 2. Assertion Helpers

```typescript
// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that an async function throws a specific error
 */
export async function expectToThrowAsync(
  fn: () => Promise<any>,
  matcher?: string | RegExp | (new (...args: any[]) => Error)
): Promise<void>;

/**
 * Assert a condition becomes true within a timeout (async polling)
 */
export async function expectEventually(
  assertion: () => void | Promise<void>,
  options?: { timeout?: number; interval?: number }
): Promise<void>;

/**
 * Assert a condition never becomes true within a duration
 */
export async function expectNever(
  assertion: () => void | Promise<void>,
  options?: { duration?: number; interval?: number }
): Promise<void>;

/**
 * Assert deep partial match (object contains expected fields)
 */
export function assertDeepPartial<T extends object>(
  actual: T,
  expected: Partial<T>
): void;

/**
 * Assert arrays contain same items regardless of order
 */
export function assertUnorderedEqual<T>(
  actual: T[],
  expected: T[],
  comparator?: (a: T, b: T) => boolean
): void;

/**
 * Create a spy that tracks calls and can assert on them
 */
export function createCallTracker(): {
  fn: (...args: any[]) => void;
  calls: any[][];
  callCount: number;
  lastCall: any[] | undefined;
  reset: () => void;
  waitForCalls: (count: number, timeout?: number) => Promise<void>;
};
```

#### 3. Test Context Management

```typescript
// ============================================================================
// Test Context Management
// ============================================================================

/**
 * Interface for disposable resources
 */
export interface Disposable {
  dispose: () => void | Promise<void>;
}

/**
 * Generic test context that manages lifecycle and resources
 */
export class TestContext {
  private resources: Disposable[];
  private cleanupFns: (() => void | Promise<void>)[];
  private metadata: Map<string, any>;

  constructor();

  /** Register a resource for automatic cleanup */
  register<T extends Disposable>(resource: T): T;

  /** Register an arbitrary cleanup function */
  onCleanup(fn: () => void | Promise<void>): void;

  /** Set metadata for this test context */
  set(key: string, value: any): void;

  /** Get metadata from this test context */
  get<T>(key: string): T | undefined;

  /** Clean up all registered resources (LIFO order) */
  cleanup(): Promise<void>;
}

/**
 * Create a scoped test context that auto-cleans up
 */
export function withTestContext(
  fn: (ctx: TestContext) => Promise<void>
): Promise<void>;

/**
 * Create a test context with common setup (temp dir, etc.)
 */
export function createBaseTestContext(options?: {
  tempDir?: boolean;        // Create temp directory
  tempDirPrefix?: string;   // Prefix for temp dir name
}): Promise<TestContext & { tempDir?: string }>;
```

#### 4. Cleanup Utilities

```typescript
// ============================================================================
// Cleanup Utilities
// ============================================================================

/**
 * Manages multiple cleanup functions with LIFO execution order
 */
export class CleanupManager {
  private cleanups: (() => void | Promise<void>)[];

  /** Add a cleanup function */
  add(fn: () => void | Promise<void>): void;

  /** Execute all cleanups in reverse order, collecting errors */
  run(): Promise<CleanupResult>;

  /** Number of registered cleanups */
  get size(): number;

  /** Reset the manager (without running cleanups) */
  reset(): void;
}

export interface CleanupResult {
  success: boolean;
  errors: Error[];
}

/**
 * Create a temporary directory with automatic cleanup
 */
export function withTempDir(
  fn: (dir: string) => Promise<void>,
  options?: { prefix?: string; keep?: boolean }
): Promise<void>;

/**
 * Create a temporary file with automatic cleanup
 */
export function withTempFile(
  content: string,
  fn: (filePath: string) => Promise<void>,
  options?: { name?: string; dir?: string }
): Promise<void>;

/**
 * Execute a function with automatic cleanup of registered resources
 */
export function withCleanup<T>(
  setup: (manager: CleanupManager) => Promise<T>,
  fn: (resource: T) => Promise<void>
): Promise<void>;

/**
 * Safe cleanup helper that never throws
 */
export function safeCleanup(
  fn: () => void | Promise<void>,
  label?: string
): Promise<void>;
```

### Import Pattern

All new utilities will be importable via the existing export path:

```typescript
// In test files across any package:
import {
  // Async utilities
  delay,
  flushPromises,
  withTimeout,
  retry,
  waitForCondition,
  withConcurrency,
  collectEvents,

  // Assertion helpers
  expectToThrowAsync,
  expectEventually,
  expectNever,
  assertDeepPartial,
  assertUnorderedEqual,
  createCallTracker,

  // Test context management
  TestContext,
  withTestContext,
  createBaseTestContext,

  // Cleanup utilities
  CleanupManager,
  withTempDir,
  withTempFile,
  withCleanup,
  safeCleanup,
} from '@apexcli/core/test-utils';
```

### Design Principles

1. **Zero external dependencies** - Only use Node.js built-ins (`fs`, `os`, `path`, `timers`) and `vitest`
2. **Composable** - Each utility is standalone and can be combined with others
3. **Type-safe** - Full TypeScript generics support
4. **Idempotent cleanup** - All cleanup functions are safe to call multiple times
5. **Error isolation** - Cleanup errors don't prevent other cleanups from running
6. **No global state** - Each TestContext instance is independent
7. **Platform-agnostic** - All new utilities work on Windows, macOS, and Linux

### Integration with Existing Utilities

The new utilities complement (not replace) existing test-utils:

- **Orchestrator's `createTempDirectoryAsync`/`removeTempDirectory`** → The new `withTempDir` wraps this pattern into a single call
- **CLI's `waitFor`** → The new `waitForCondition` is a superset with configurable timeout/interval
- **API's `TestContext`** → The new generic `TestContext` class can be extended for domain-specific contexts
- **Core's `waitForPermissionEvent`** → Uses the same pattern as `waitForCondition` but for events

## Consequences

### Positive
- Single import location for all general-purpose test helpers
- Reduced boilerplate in test files across all packages
- Consistent patterns for async testing, cleanup, and resource management
- No new packages or build configurations needed
- Backward compatible - existing imports continue to work

### Negative
- `test-utils.ts` grows larger (adding ~500 lines to existing 2,735)
- All utilities share a single import path (no tree-shaking within test-utils)
- Vitest dependency remains a requirement for any consumer

### Risks
- Large file size could impact IDE performance (mitigated: test files are excluded from production build)
- Name collisions with future vitest features (mitigated: using specific, non-generic names)

## Implementation Notes for Next Stages

1. **Developer stage** should implement all four sections in order: async utilities, assertion helpers, test context, cleanup utilities
2. **Tester stage** should write tests for the new utilities in `packages/core/src/__tests__/test-utils.base-helpers.test.ts`
3. All utilities must pass on all platforms (the existing platform testing infrastructure can validate this)
4. The `package.json` exports for `./test-utils` already point to `src/test-utils.js` which will include the new code after build
