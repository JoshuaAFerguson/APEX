# ADR-051: Shared Test Configuration and Base Utilities Architecture

## Status
**Accepted** - Architecture review for test infrastructure completeness

## Context

Task: Create shared test configuration and base utilities for the APEX monorepo.

**Acceptance Criteria:** A shared test config (vitest or jest) is set up at the monorepo root with proper TypeScript support. Base test utility functions (describe helpers, async utilities, timeout helpers) are available in a shared location accessible by all packages.

## Analysis of Existing Infrastructure

After thorough exploration, the APEX monorepo **already has a comprehensive, production-grade test infrastructure** that fully satisfies the acceptance criteria. This ADR documents the existing architecture and validates its completeness.

### 1. Shared Vitest Configuration (Root Level)

| File | Purpose | Status |
|------|---------|--------|
| `vitest.shared.config.ts` | Base config factory with `createSharedConfig()`, `createUnitTestConfig()`, `createIntegrationTestConfig()`, `createE2ETestConfig()`, `createBrowserTestConfig()` | Complete |
| `vitest.config.ts` | Main monorepo config with environment-specific globs, coverage thresholds (50%), all test type includes | Complete |
| `vitest.unit.config.ts` | Unit test runner (5s timeout, excludes integration/e2e/stress/edge tests) | Complete |
| `vitest.e2e.config.ts` | E2E test runner (60s timeout, forked pool, sequential, CI retries) | Complete |

**TypeScript Support:** All configs use `vitest/config` with full TS support. Each package's `tsconfig.json` targets ES2022 with NodeNext modules and strict mode.

### 2. Per-Package Vitest Configurations

| Package | Config | Notes |
|---------|--------|-------|
| `@apexcli/core` | Inherits root config | Tests via `vitest run src/__tests__/**/*.test.ts` |
| `@apex/orchestrator` | Inherits root config | `vitest run` with watch support |
| `@apex/cli` | `packages/cli/vitest.config.ts` | jsdom environment, 70% coverage, testing-library |
| `@apex/api` | `packages/api/vitest.config.ts` | Integration config, 30s timeout |
| Integration tests | `tests/integration/vitest.config.ts` | Forked pool, sequential |
| Browser tests | `tests/browser-integration/vitest.config.ts` | 60s timeout, 2 forks max |

### 3. Base Test Utilities (Shared Location)

All utilities are centralized in `packages/core/src/test-fixtures/` and exported via `@apexcli/core/test-fixtures`.

#### Async Utilities (`test-fixtures/test-utils.ts`)
- `waitFor(condition, options)` - Wait for async condition with configurable timeout/interval
- `sleep(ms)` - Promise-based delay
- `flushPromises()` - Flush microtask queue
- `retry(operation, options)` - Retry with exponential backoff
- `createDeferredPromise()` - Externally controllable promise

#### Describe Helpers / Test Suite Factory (`test-setup.ts`)
- `createTestSuite(name, setupFn)` - Prefixed describe blocks with shared setup
- `testFactories.createTestId()` - Consistent test IDs
- `testFactories.createTestDate()` - Deterministic dates
- `testFactories.createTestPath()` - Consistent file paths

#### Timeout Helpers (`test-setup.ts`)
- `setupTimeoutHelpers(defaultTimeout)` - Registers `globalThis.withTimeout`
- `globalThis.withTimeout(promise, timeout)` - Race-based timeout wrapper
- `globalThis.waitFor(condition, options)` - Global condition waiter

#### Assertion Helpers
- `assertionHelpers.assertDefined()` - Non-null assertion
- `assertionHelpers.assertLength()` - Array length assertion
- `assertionHelpers.assertRejectsWithError()` - Typed rejection assertion
- `assertionHelpers.assertHasProperties()` - Property existence assertion
- `assertions.eventually()` - Wait-for assertion pattern
- `assertions.throws()` - Error type/message assertion
- `assertions.arrayContains()` - Array inclusion assertion
- `assertions.deepEqual()` - Deep equality check

#### Mock Helpers (`test-fixtures/mock-helpers.ts`)
- `createOrchestratorMock()` - Full ApexOrchestrator mock
- `createAgentSdkMock()` - Claude Agent SDK mock
- `createFileSystemMock()` - FS operations mock
- `createNetworkMock()` - HTTP/fetch mock
- `createTaskStoreMock()` - SQLite store mock
- `createEventEmitterMock()` - EventEmitter3 mock
- `createPageMock()` - Browser page mock
- `createConsoleMock()` - Console capturing mock
- `createMockEnvironment()` - Combined environment mock

#### Performance Utilities
- `performance.measureTime()` - Execution timing
- `performance.withinTime()` - Time-bound assertions
- `performance.benchmark()` - Multi-iteration benchmarking

#### Data Generation
- `dataGenerator.randomString()` / `randomInt()` / `randomId()`
- `dataGenerator.randomTaskId()` / `randomSessionId()`
- `dataGenerator.randomFileContent()` / `randomProjectStructure()`

### 4. Package Export Map

The `@apexcli/core` package exports test utilities via multiple subpath exports:

```json
{
  "./test-utils":       "dist/test-utils/index.js",
  "./test-setup":       "dist/test-setup.js",
  "./test-setup-utils": "dist/test-setup-utils.js",
  "./test-config":      "../../../vitest.shared.config.js",
  "./test-fixtures":    "dist/test-fixtures/index.js"
}
```

This allows any package to import shared test infrastructure:

```typescript
// Vitest config reuse
import { createUnitTestConfig } from '@apexcli/core/test-config';

// Test fixtures and mocks
import { createOrchestratorMock, testUtils } from '@apexcli/core/test-fixtures';

// Global setup
import { setupGlobalTestEnvironment } from '@apexcli/core/test-setup';
```

### 5. Global Test Setup (`test-setup.ts`)

The root `test-setup.ts` file provides `setupGlobalTestEnvironment()` which configures:
- Console mocking (auto-suppression with restore)
- Environment variable stubbing (`NODE_ENV=test`, `APEX_TEST_MODE=unit`)
- Global timeout utilities (`withTimeout`, `testTimeout`)
- Global async utilities (`flushPromises`, `nextTick`, `sleep`, `waitFor`)

Referenced by package configs via `setupFiles: ['../../test-setup.ts']`.

### 6. Test Script Organization

```
npm run test                         # All tests (vitest run)
npm run test:unit                    # Unit tests only (5s timeout)
npm run test:integration             # Integration tests (30s timeout)
npm run test:e2e                     # E2E tests (60s timeout, forked)
npm run test:browser-integration     # Browser automation tests
npm run test:coverage                # All tests with coverage
npm run test:watch                   # Watch mode
```

## Architecture Diagram

```
vitest.shared.config.ts                    <-- Base factory functions
    |
    +-- vitest.config.ts                   <-- Root config (all test types)
    +-- vitest.unit.config.ts              <-- Unit tests only
    +-- vitest.e2e.config.ts               <-- E2E with forked pools
    |
    +-- packages/api/vitest.config.ts      <-- API integration tests
    +-- packages/cli/vitest.config.ts      <-- CLI with jsdom
    +-- tests/integration/vitest.config.ts <-- Integration runner
    +-- tests/browser-integration/...      <-- Browser runner

test-setup.ts                              <-- Global setup (setupFiles)
    |
    +-- setupConsoleHelpers()
    +-- setupCommonMocks()
    +-- setupTimeoutHelpers()
    +-- setupAsyncUtilities()
    +-- createTestSuite()
    +-- testFactories / assertionHelpers / mockHelpers

packages/core/src/test-fixtures/           <-- Centralized test utilities
    |
    +-- test-utils.ts       (async, sleep, retry, deferred, data gen)
    +-- mock-helpers.ts     (orchestrator, SDK, FS, network mocks)
    +-- types.ts            (test type definitions)
    +-- setup-teardown.ts   (lifecycle patterns)
    +-- builders/           (response/request builders)
    +-- factories/          (fixture factories)
    +-- errors/             (error presets by category)
    +-- responses/          (response fixtures)
    +-- requests/           (request fixtures)
    +-- browser-fixtures.ts
    +-- package-helpers.ts
    +-- sensitive-info-utils.ts
    +-- index.ts            (barrel export)
```

## Decision

**No new infrastructure is needed.** The existing test configuration and utilities fully satisfy the acceptance criteria:

1. **Shared Vitest config with TypeScript support** - `vitest.shared.config.ts` provides factory functions used by all package configs. Full TypeScript support via ES2022/NodeNext.

2. **Base test utility functions** - Centralized in `packages/core/src/test-fixtures/` with:
   - Describe helpers (`createTestSuite`)
   - Async utilities (`waitFor`, `sleep`, `flushPromises`, `retry`, `createDeferredPromise`)
   - Timeout helpers (`withTimeout`, `setupTimeoutHelpers`)

3. **Accessible by all packages** - Exported via `@apexcli/core/test-fixtures`, `@apexcli/core/test-setup`, `@apexcli/core/test-config` subpath exports.

## Consequences

### Positive
- Mature, battle-tested infrastructure already in use across 1000+ test files
- Clear separation: config factories vs. test utilities vs. mock helpers vs. fixtures
- Multi-environment support (node, jsdom, happy-dom)
- Tiered timeout strategy (5s unit / 30s integration / 60s E2E)
- CI-aware retry logic

### Risks to Monitor
- The `@apexcli/core/test-config` export points to `../../../vitest.shared.config.js` (relative path) - fragile if package structure changes
- Some test utilities exist in both `test-setup.ts` (globals) and `test-fixtures/test-utils.ts` (importable) - potential confusion for new contributors
- `console` export in `test-utils.ts` shadows the global `console` - naming could be improved

### Recommendations for Future Stages
1. **Documentation**: Consider adding a `TESTING.md` guide documenting the test utility APIs and import patterns
2. **Deduplication**: The `waitFor`/`sleep`/`flushPromises` functions exist in both `test-setup.ts` and `test-fixtures/test-utils.ts` - future cleanup could consolidate
3. **Type Safety**: The `globalThis` declarations in `test-setup.ts` should be referenced in a shared `vitest.d.ts` to ensure IDE support across packages
