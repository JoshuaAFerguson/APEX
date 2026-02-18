# ADR 060: Shared Test Configuration and Base Utilities Architecture

## Status
Accepted

## Date
2025-02-02

## Context

The task requires establishing a shared test configuration (vitest) at the monorepo root with proper TypeScript support, and making base test utility functions (describe helpers, async utilities, timeout helpers) available in a shared location accessible by all packages.

After thorough analysis of the existing codebase, the APEX monorepo **already has a comprehensive, well-structured test infrastructure** in place. This ADR documents the existing architecture, validates it against the acceptance criteria, and identifies the complete component inventory for future reference.

## Decision

The existing test infrastructure satisfies all acceptance criteria. The architecture is validated and documented as-is, with no changes required.

## Architecture Overview

### Layer 1: Shared Vitest Configuration (Root Level)

The monorepo employs a **factory pattern** for test configuration, centered on `vitest.shared.config.ts`:

```
vitest.shared.config.ts          # Base factory: createSharedConfig(), createUnitTestConfig(), etc.
  vitest.config.ts               # Main config (all tests, jsdom default)
  vitest.unit.config.ts          # Unit tests only (fast, 5s timeout)
  vitest.e2e.config.ts           # E2E tests (60s timeout, forked pool)
  packages/api/vitest.config.ts  # API package overrides (30s timeout)
  packages/cli/vitest.config.ts  # CLI package overrides (jsdom, 70% coverage)
  tests/integration/vitest.config.ts
  tests/browser-integration/vitest.config.ts
```

**Key design decisions:**
- `createSharedConfig(environment, options)` accepts `TestEnvironment` and `SharedConfigOptions` for flexible composition
- Specialized factories (`createUnitTestConfig`, `createIntegrationTestConfig`, `createE2ETestConfig`, `createBrowserTestConfig`) provide sensible presets
- Package-level configs use `mergeConfig()` to overlay package-specific needs on shared base
- Coverage provider: V8 with 50% baseline thresholds (package overrides allowed)
- Environment-specific glob patterns for node vs jsdom environments

### Layer 2: Global Test Setup (`test-setup.ts`)

Root-level `test-setup.ts` provides:
- `setupGlobalTestEnvironment(options)` - master setup function
- `setupConsoleHelpers()` - console mocking with auto-restore
- `setupCommonMocks()` - NODE_ENV, APEX_TEST_MODE, CI, TZ environment stubs
- `setupTimeoutHelpers(defaultTimeout)` - global `withTimeout()` function
- `setupAsyncUtilities()` - global `flushPromises()`, `nextTick()`, `sleep()`, `waitFor()`
- `createTestSuite(name, setupFn)` - describe helper factory
- `testFactories` - ID, date, and path generators
- `assertionHelpers` - `assertDefined`, `assertLength`, `assertRejectsWithError`, `assertHasProperties`
- `mockHelpers` - typed mock creation, partial mocks, class constructor mocks

Global type declarations extend `globalThis` for TypeScript support.

### Layer 3: Shared Test Utilities Package (`tests/test-utils/`)

Registered as workspace package `@apex/test-utils` with npm workspace in root `package.json`:

```
tests/test-utils/
  index.ts         # Barrel exports + createTestEnvironment(), setupTest(), runWithCleanup()
  async.ts         # wait(), waitFor(), waitForPromise(), createDeferred(), retry(), sequence(), parallel()
  assertions.ts    # expectToThrow(), expectObjectShape(), expectArrayToContain(), expectArrayToBeSorted(), etc.
  context.ts       # TestContext, MockManager, EventTracker, TestTimer, DatabaseTestContext
  cleanup.ts       # CleanupRegistry, CleanupManager, FileSystemCleanup, ProcessCleanup, EnvironmentCleanup
  mcp-test-base.ts # MCP protocol test base class
  browser-test-base.ts # Browser automation test base
  mock-server-factory.ts # Mock HTTP server creation
  package.json     # @apex/test-utils with subpath exports
  tsconfig.json    # ES2022, NodeNext, strict
```

**Subpath exports** enable targeted imports:
- `@apex/test-utils` - everything
- `@apex/test-utils/async` - async utilities only
- `@apex/test-utils/assertions` - assertion helpers only
- `@apex/test-utils/context` - test context management only
- `@apex/test-utils/cleanup` - cleanup utilities only

### Layer 4: Package-Specific Test Utilities

| Package | File | Utilities Provided |
|---------|------|--------------------|
| `@apex/core` | `src/test-utils.ts` | Platform detection, temp directory management, SQLite test database creation |
| `@apex/orchestrator` | `src/test-utils.ts` | Async directory creation with .apex setup, SQLite in-memory databases |
| `@apex/orchestrator` | `src/test-helpers.ts` | `createMinimalAnalysis()`, `createAnalysisWithIssues()` fixture factories |
| `@apex/cli` | `src/__tests__/test-utils.tsx` | Theme mocking, React rendering with providers, Ink hook mocks |

### Layer 5: Test Environment Configurations

| Test Type | Environment | Pool | Timeout | Concurrency | Config File |
|-----------|------------|------|---------|-------------|-------------|
| Unit | node | default | 5s | parallel (shuffle) | `vitest.unit.config.ts` |
| Integration | node | forks (max 4) | 30s | sequential | `tests/integration/vitest.config.ts` |
| E2E | node | forks (max 4) | 60s | sequential | `vitest.e2e.config.ts` |
| Browser | node | forks (max 2) | 60s | sequential | `tests/browser-integration/vitest.config.ts` |
| All | jsdom (default) | default | 5s | parallel | `vitest.config.ts` |

### npm Scripts (Root level)

```
test                    # vitest run (all tests)
test:unit               # unit tests only (fast)
test:unit:watch         # unit tests in watch mode
test:unit:coverage      # unit tests with coverage
test:integration        # integration tests
test:e2e                # end-to-end tests
test:watch              # all tests in watch mode
test:coverage           # all tests with coverage
test:browser-integration # browser automation tests
```

## Acceptance Criteria Validation

### 1. "A shared test config (vitest or jest) is set up at the monorepo root with proper TypeScript support"

**SATISFIED:**
- `vitest.shared.config.ts` provides the factory-based shared configuration
- `vitest.config.ts`, `vitest.unit.config.ts`, `vitest.e2e.config.ts` are concrete configs at root
- All configs use TypeScript natively (vitest supports `.ts` config files)
- TypeScript path aliases (`@`, `@tests`, `@fixtures`) configured in shared config
- `tsconfig.json` at root with `@apex/*` path mappings for workspace packages

### 2. "Base test utility functions (describe helpers, async utilities, timeout helpers) are available in a shared location accessible by all packages"

**SATISFIED:**
- **Describe helpers**: `createTestSuite()` in `test-setup.ts`
- **Async utilities**: Full suite in `tests/test-utils/async.ts` (`wait`, `waitFor`, `waitForPromise`, `createDeferred`, `retry`, `sequence`, `parallel`, `createAsyncMock`, `createAsyncErrorMock`, `expectAsyncToCompleteWithin`, `expectAsyncToTakeAtLeast`)
- **Timeout helpers**: `setupTimeoutHelpers()` in `test-setup.ts` providing global `withTimeout()`; `waitForPromise()` in async utils
- **Shared location**: `tests/test-utils/` is an npm workspace package (`@apex/test-utils`) importable by all packages
- **Additional shared utilities**: Test context management, cleanup management, assertion helpers, mock management, event tracking, timer utilities, fixture factories

## Component Dependency Graph

```
vitest.shared.config.ts
    (consumed by)
    vitest.config.ts
    vitest.unit.config.ts
    vitest.e2e.config.ts
    packages/api/vitest.config.ts
    packages/cli/vitest.config.ts

test-setup.ts
    (referenced as setupFile by)
    packages/api/vitest.config.ts
    packages/cli/vitest.config.ts

@apex/test-utils (tests/test-utils/)
    (importable by all workspace packages)
    async.ts      --> vitest
    assertions.ts --> vitest
    context.ts    --> vitest, fs, os, path
    cleanup.ts    --> vitest, fs, path

packages/core/src/test-utils.ts
    (used by)
    packages/core tests
    packages/orchestrator tests (via @apex/core)

packages/orchestrator/src/test-utils.ts
    (used by)
    packages/orchestrator tests
```

## Architectural Principles

1. **Layered composition**: Shared base -> specialized presets -> package overrides
2. **Factory pattern**: `createSharedConfig()` enables consistent yet flexible configuration
3. **Workspace-native sharing**: `@apex/test-utils` as npm workspace package with subpath exports
4. **LIFO cleanup**: All cleanup utilities use reverse-order execution for proper resource teardown
5. **Context isolation**: Each test gets unique ID, temp directory, and dedicated cleanup stack
6. **Environment-aware**: Automatic node vs jsdom switching via `environmentMatchGlobs`
7. **Timeout tiers**: 5s (unit) -> 30s (integration) -> 60s (E2E) progressive timeouts

## Notes for Next Stages

1. **Implementation stage**: The shared test configuration and utilities are already fully implemented. The implementation stage should focus on verifying that all packages can successfully import from `@apex/test-utils` and that the test-setup.ts global helpers work correctly.

2. **Testing stage**: Should verify:
   - All test scripts (`test`, `test:unit`, `test:e2e`) execute successfully
   - Coverage thresholds are met across all packages
   - Test isolation works correctly (no cross-test contamination)
   - Cleanup functions properly release all resources

3. **Potential enhancements** (not required for current acceptance criteria):
   - Add `@apex/test-utils/fixtures` subpath for shared fixture factories
   - Consider moving `packages/core/src/test-utils.ts` content into `@apex/test-utils` to consolidate
   - Add vitest custom matchers registration in shared setup

## Consequences

### Positive
- Consistent test configuration across all packages via factory pattern
- Rich set of test utilities reduces boilerplate in individual test files
- Workspace package approach ensures utilities are importable without path manipulation
- Layered configuration allows packages to override only what they need
- Progressive timeout tiers prevent slow tests from blocking fast feedback

### Negative
- Test utilities are spread across multiple locations (`test-setup.ts`, `@apex/test-utils`, `packages/*/test-utils.ts`) which requires awareness of what's where
- The `test-setup.ts` global approach (`globalThis`) loses type safety outside TypeScript (mitigated by `declare global`)

### Neutral
- The factory pattern for vitest configs adds a small abstraction layer but improves maintainability at scale
