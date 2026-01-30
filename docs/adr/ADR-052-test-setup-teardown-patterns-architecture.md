# ADR-052: Test Setup and Teardown Patterns with Fixtures

## Status
Accepted

## Date
2026-01-30

## Context

APEX has a comprehensive test suite spanning 2,200+ test files across multiple packages. The test infrastructure already includes several fixture and setup/teardown modules in `@apexcli/core`, but they are not yet fully integrated into a cohesive, reusable pattern that development-stage agents can consume consistently.

The task requires:
1. Reusable `beforeEach`/`afterEach` patterns are established
2. Test fixtures for common browser states (logged-in page, error page, loading state) are available
3. Setup functions properly initialize mocks and teardown functions clean up state

### Current State Analysis

The following modules already exist and provide the foundation:

| Module | Location | Capabilities |
|--------|----------|-------------|
| `setup-teardown.ts` | `packages/core/src/test-fixtures/` | `createTestSuite()` with configurable mock/timer setup, cleanup tasks, temp dirs |
| `browser-fixtures.ts` | `packages/core/src/test-fixtures/` | `browserFixtures` (cleanState, loggedInPage, errorPage, loadingPage, offlinePage, permissionDeniedPage), `browserHelpers`, `BrowserStateBuilder` |
| `mock-helpers.ts` | `packages/core/src/test-fixtures/` | `createOrchestratorMock`, `createAgentSdkMock`, `createFileSystemMock`, `createNetworkMock`, `createTaskStoreMock`, `createEventEmitterMock`, `createPageMock`, `createConsoleMock`, `createMockEnvironment` |
| `test-utils.ts` | `packages/core/src/test-fixtures/` | `waitFor`, `sleep`, `flushPromises`, `retry`, `createDeferredPromise`, `dataGenerator`, `assertions`, `performance` |
| `test-setup-utils.ts` | `packages/core/src/` | `createMockCleanup`, `createTimerCleanup`, `createFileSystemMock`, `createCompressionMock`, `createCompleteTestSetup`, `createResourceCleanup` |
| `types.ts` | `packages/core/src/test-fixtures/` | `TestSuiteConfig`, `BrowserState`, `MockConfig`, `SetupTeardownHooks`, `TestEnvironment`, `TestScenario` |

All of these are exported from `@apexcli/core/test-fixtures` and `@apexcli/core/test-setup-utils`.

### Existing Test Coverage

Browser fixtures and helpers are well-tested in:
- `packages/core/src/test-fixtures/__tests__/browser-fixtures.test.ts` (655 lines)
- `packages/core/src/test-fixtures/__tests__/browser-state-builder.test.ts`
- `packages/core/src/test-fixtures/__tests__/mock-helpers-page.test.ts`

Setup/teardown module (`setup-teardown.ts`) does **not** yet have a dedicated test file.

## Decision

### 1. Architecture is Already Sound - No Structural Changes Required

After thorough analysis, the existing architecture properly addresses all acceptance criteria. The modules follow SOLID principles:

- **Single Responsibility**: Each module handles one concern (browser fixtures, mock helpers, setup/teardown lifecycle, test utilities)
- **Open/Closed**: All fixtures accept `overrides` parameters and builders support extension without modification
- **Liskov Substitution**: `SetupTeardownHooks` interface allows any conforming setup/teardown pair
- **Interface Segregation**: Types are granular (`MockConfig`, `TestSuiteConfig`, `BrowserState`)
- **Dependency Inversion**: Setup functions accept config objects rather than hardcoded dependencies

### 2. Add Missing Test Coverage for `setup-teardown.ts`

The `setup-teardown.ts` module needs a dedicated test file at:
```
packages/core/src/test-fixtures/__tests__/setup-teardown.test.ts
```

This test should validate:
- `createTestSuite()` produces correct `beforeEach`/`afterEach` hooks
- Mock initialization and cleanup lifecycle
- Fake timer setup and teardown
- Custom setup/teardown function integration
- `addCleanupTask()` / `cleanupTestState()` behavior
- `createTempDir()` temporary directory lifecycle
- `createMockFunction()` registration in global environment
- `flushTimers()` and `advanceTimers()` timer helpers
- `createModuleSpy()` module-level spy creation
- `setupFileSystemMocks()` and `setupNetworkMocks()` mock initialization
- `getTestEnvironment()`, `setTestData()`, `getTestData()` state management
- Error handling in teardown (custom teardown failures, cleanup task failures)

### 3. Recommended Usage Patterns for Next Stages

#### Pattern A: Simple Unit Test Setup
```typescript
import { createMockCleanup } from '@apexcli/core/test-setup-utils';

describe('MyComponent', () => {
  createMockCleanup(); // Auto beforeEach/afterEach

  it('should work', () => { /* ... */ });
});
```

#### Pattern B: Browser State Testing
```typescript
import { browserFixtures, BrowserStateBuilder } from '@apexcli/core/test-fixtures';

describe('Browser Tests', () => {
  it('should handle logged-in state', () => {
    const state = browserFixtures.loggedInPage();
    expect(state.isAuthenticated).toBe(true);
  });

  it('should build custom state', () => {
    const state = new BrowserStateBuilder()
      .withUrl('https://example.com')
      .withAuth(true)
      .withLocalStorage({ theme: 'dark' })
      .build();
  });
});
```

#### Pattern C: Full Integration Test Setup
```typescript
import { createTestSuite } from '@apexcli/core/test-fixtures';
import { createCompleteTestSetup } from '@apexcli/core/test-setup-utils';

describe('Integration Test', () => {
  const suite = createTestSuite({
    setupMocks: true,
    cleanupAfterEach: true,
    useFakeTimers: true,
    mockConfig: {
      mockFs: true,
      mockNetwork: true,
      mockData: {
        fileSystemData: { '/config.yaml': 'key: value' },
        apiResponses: { 'https://api.example.com/data': { ok: true } },
      },
    },
  });

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);
});
```

#### Pattern D: Mock Environment with Resource Cleanup
```typescript
import { createMockEnvironment } from '@apexcli/core/test-fixtures';
import { createResourceCleanup } from '@apexcli/core/test-setup-utils';

describe('Resource Tests', () => {
  const env = createMockEnvironment({
    includeOrchestrator: true,
    includeTaskStore: true,
    fileData: { '/project/package.json': '{}' },
  });
  const { addCleanup } = createResourceCleanup();

  it('should clean up resources', () => {
    const resource = createExpensiveResource();
    addCleanup(() => resource.dispose());
    // ... test
  });
});
```

### 4. Module Dependency Graph

```
@apexcli/core/test-fixtures (barrel export)
├── setup-teardown.ts ──────── types.ts (TestSuiteConfig, SetupTeardownHooks, TestEnvironment, MockConfig)
├── browser-fixtures.ts ────── types.ts (BrowserState, TestScenario)
├── mock-helpers.ts ────────── types.ts (MockFunction)
├── test-utils.ts ──────────── (standalone, vitest only)
├── factories/index.ts ─────── ../types.ts (Task, AgentDefinition)
├── builders/index.ts ──────── types.ts (FixtureBuilder, FluentBuilder)
├── errors/index.ts ────────── (standalone error presets)
├── responses/index.ts ─────── ../types.ts (ToolResult)
├── requests/index.ts ──────── ../types.ts (ToolInvocation, Task)
└── sensitive-info-utils.ts ── (standalone)

@apexcli/core/test-setup-utils (standalone entry point)
├── createMockCleanup
├── createTimerCleanup
├── createFileSystemMock (module-level vi.mock)
├── createCompressionMock (module-level vi.mock)
├── createCompleteTestSetup (combines all above)
├── createResourceCleanup
├── createMockSession / createMockMessage / createMockStore
├── advanceTimersAndRun / withTestTimeout / expectRejection
```

### 5. Key Architectural Properties

| Property | Value |
|----------|-------|
| Immutability | Browser fixtures return new objects; helpers return new state copies |
| Composability | `createTestSuite` accepts `customSetup`/`customTeardown` callbacks |
| Extensibility | All fixture functions accept `overrides: Partial<T>` |
| Builder Pattern | `BrowserStateBuilder` for complex state construction |
| Factory Pattern | `createMockEnvironment()` for complete mock setups |
| Cleanup Safety | Teardown runs cleanup tasks in try/catch, warns on failure |
| Global State | `globalTestEnvironment` tracks active mocks, cleanup tasks, test data |

## Implementation Plan for Development Stage

1. **Create test file**: `packages/core/src/test-fixtures/__tests__/setup-teardown.test.ts`
   - Test all exported functions from `setup-teardown.ts`
   - Focus on lifecycle correctness (setup runs before test, teardown runs after)
   - Test error resilience (teardown completes even when cleanup tasks fail)
   - Test global state management (`getTestEnvironment`, `setTestData`, `getTestData`)

2. **No changes to existing source files** - The architecture is complete and well-designed.

3. **Verify build and tests pass** after adding the new test file.

## Consequences

### Positive
- All test setup/teardown patterns are already centralized in `@apexcli/core`
- Browser state fixtures cover all required scenarios (logged-in, error, loading, plus offline and permission-denied)
- Adding the missing test file completes coverage for the setup-teardown module
- No breaking changes - purely additive

### Negative
- Two separate entry points (`test-fixtures` and `test-setup-utils`) could confuse new developers
  - Mitigated: `test-fixtures/index.ts` re-exports `setup-teardown.ts` which provides the higher-level API
  - `test-setup-utils.ts` is the lower-level module with Vitest-specific mock patterns

### Risks
- Global state in `setup-teardown.ts` (`globalTestEnvironment`) could cause issues in parallel test execution
  - Mitigated: Vitest runs each test file in isolation (separate worker), so global state is per-file
