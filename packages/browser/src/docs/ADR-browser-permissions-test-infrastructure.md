# ADR: Browser Permissions Test Infrastructure Architecture

## Status
Accepted

## Date
2025-01-30

## Context

The task requires browser permissions test infrastructure and base utilities including:
1. Test utilities for mocking browser permission APIs
2. Test fixtures for setting up permission test scenarios
3. Utilities to verify permission check behavior
4. Base test configuration with necessary dependencies

### Existing Infrastructure Assessment

After thorough analysis, the browser permissions test infrastructure is **already substantially implemented**. The following components exist and are complete:

#### 1. Permission Mocking Module (`packages/browser/src/permission-mocking/`)
- **`types.ts`** (186 lines) - Complete W3C Permissions API type definitions covering 19 standard permission names, `MockPermissionStatus`, `MockPermissionConfig`, `MockPermissionHandle`, `NavigatorWithMockedPermissions`, and type guard functions
- **`mock-permission-status.ts`** (196 lines) - `MockPermissionStatusImpl` extending `EventTarget`, implementing W3C PermissionStatus with `setState()`, `getState()`, `reset()`, `onchange` support, and event dispatching
- **`mock-permissions.ts`** (326 lines) - Factory function `mockPermissions()`, handle-based lifecycle management, lazy permission creation, `withMockedPermissions()` auto-cleanup wrapper, `isPermissionsMocked()` and `getCurrentMockHandle()` utilities
- **`index.ts`** (102 lines) - Barrel exports for all mocking functions, types, classes, and type guards
- **`README.md`** (179 lines) - Full API documentation with examples

#### 2. Browser Test Fixtures (`packages/core/src/test-fixtures/browser-fixtures.ts`)
- `browserFixtures` - Preset collection (cleanState, loggedInPage, errorPage, loadingPage, offlinePage, permissionDeniedPage, fromScenario)
- `browserHelpers` - Helper functions for state manipulation
- `BrowserStateBuilder` - Fluent builder for composing browser states

#### 3. Test Utilities (`packages/browser/src/__tests__/test-utils.ts`)
- `TestPages` - HTML page generators (simple, tall, complex, unicode, empty, transparent)
- `ScreenshotValidators` - PNG/JPEG validation helpers
- `PerformanceMonitor` - Timing and statistics
- `MockScenarios` - Error simulation (slowLoadingPage, networkError, jsError)
- `TestDataGenerators` - Content generation utilities

#### 4. Test Suite (`packages/browser/src/__tests__/permission-mocking.test.ts`)
- 571-line comprehensive test suite covering:
  - `mockPermissions()` factory function tests
  - `MockPermissionHandle` state management tests
  - `navigator.permissions.query()` integration tests
  - `MockPermissionStatus` event handling tests
  - Utility function tests (`isPermissionsMocked`, `getCurrentMockHandle`, `withMockedPermissions`)
  - Integration scenarios (permission request flows, multi-permission workflows)
  - Error handling (non-browser environment, edge cases)

#### 5. Test Configuration
- **Root `vitest.config.ts`** - JSdom environment, environment routing per package, v8 coverage (50% thresholds)
- **Root `vitest.unit.config.ts`** - Fast unit test configuration
- **Root `vitest.e2e.config.ts`** - E2E-specific configuration
- **Browser package** - Uses root config with `vitest run src/__tests__/**/*.test.ts`

#### 6. Dependencies
- **Vitest** (`^4.0.15`) - Testing framework in browser package devDependencies
- **JSdom** - Browser environment simulation via root vitest config
- **Playwright** (`^1.47.0`) - Real browser automation for integration/e2e tests

## Decision

### Architecture Validation: No New Implementation Required

The existing infrastructure **fully satisfies** all acceptance criteria:

| Acceptance Criterion | Current State | Component |
|---|---|---|
| Test utilities for mocking browser permission APIs | **Complete** | `permission-mocking/` module with factory, handle, status classes |
| Setting up test fixtures | **Complete** | `browser-fixtures.ts` with presets, helpers, builder pattern |
| Verifying permission check behavior | **Complete** | `permission-mocking.test.ts` (571 lines, full coverage) |
| Base test configuration | **Complete** | Vitest configs (root + package-level), JSdom environment |
| Testing framework dependency | **Complete** | Vitest `^4.0.15` in devDependencies |
| Browser mocking libraries | **Complete** | JSdom for DOM simulation, custom permission mocking module |

### Architecture Design (for reference and future extensions)

The implemented architecture follows these design patterns:

#### Component Diagram

```
packages/
├── core/src/test-fixtures/
│   ├── browser-fixtures.ts          # BrowserState presets, helpers, builder
│   ├── types.ts                     # Fixture type definitions
│   └── index.ts                     # Barrel exports
│
├── browser/src/
│   ├── permission-mocking/
│   │   ├── types.ts                 # W3C API types + mock extensions
│   │   ├── mock-permission-status.ts # MockPermissionStatusImpl (EventTarget)
│   │   ├── mock-permissions.ts      # Factory + handle + utilities
│   │   ├── index.ts                 # Barrel exports
│   │   └── README.md               # API documentation
│   │
│   ├── __tests__/
│   │   ├── test-utils.ts            # Shared test utilities
│   │   ├── permission-mocking.test.ts # Permission mock tests (571 lines)
│   │   └── ... (45 total test files)
│   │
│   └── index.ts                     # Package exports (includes permission mocking)
│
└── vitest.config.ts                 # Root test configuration
```

#### Key Design Patterns

1. **Handle-Based Lifecycle Management**
   - `mockPermissions()` returns a `MockPermissionHandle`
   - Handle controls state, queries, and cleanup
   - `restore()` method ensures clean teardown
   - `withMockedPermissions()` provides RAII-style auto-cleanup

2. **Lazy Permission Creation**
   - Permission status instances created only when `query()` is called
   - Instances cached in a `Map<PermissionName, MockPermissionStatusImpl>`
   - Reduces overhead for tests that only check specific permissions

3. **W3C Standards Compliance**
   - `MockPermissionStatusImpl` extends `EventTarget` (not custom event emitter)
   - Implements `state`, `name`, `onchange` per W3C PermissionStatus spec
   - 19 standard permission names from the Permission Registry
   - `change` event dispatching follows browser behavior (only on actual state changes)

4. **Builder Pattern for Fixtures**
   - `BrowserStateBuilder` enables fluent, composable test state construction
   - Preset methods (`cleanState()`, `loggedInPage()`, etc.) for common scenarios
   - Helper functions for incremental state modification

5. **Type Safety Throughout**
   - `PermissionName` union type constrains valid permission names
   - `MockPermissionStatus` interface enforces mock-specific methods
   - Type guard functions (`isMockPermissionStatus`, `isPermissionsMocked`)
   - `NavigatorWithMockedPermissions` extends `Navigator` for type-safe access

#### Test Infrastructure Layers

```
Layer 3: Test Suites (*.test.ts)
  ├── Unit tests (permission state, events, config)
  ├── Integration tests (multi-permission flows)
  └── Edge case tests (non-browser env, restore after error)

Layer 2: Test Utilities (test-utils.ts, browser-fixtures.ts)
  ├── TestPages (HTML generators)
  ├── MockScenarios (error simulation)
  ├── BrowserStateBuilder (fixture composition)
  └── ScreenshotValidators (result verification)

Layer 1: Mock Infrastructure (permission-mocking/)
  ├── mockPermissions() factory
  ├── MockPermissionStatusImpl (W3C EventTarget)
  ├── MockPermissionHandleImpl (lifecycle control)
  └── withMockedPermissions() (auto-cleanup wrapper)

Layer 0: Configuration (vitest.config.ts)
  ├── JSdom environment (browser simulation)
  ├── Environment routing (node vs jsdom per package)
  └── Coverage thresholds (50% minimum)
```

### Extension Points (for future stages)

If future tasks need to extend this infrastructure:

1. **New Permission Types**: Add to `PermissionName` union in `types.ts`
2. **New Fixtures**: Add preset methods to `browserFixtures` or `BrowserStateBuilder`
3. **New Test Utilities**: Extend `test-utils.ts` with additional helpers
4. **Browser-Specific Config**: Create `packages/browser/vitest.config.ts` if needed
5. **MockElement Integration**: ADR-mock-element.md defines the next phase (IElement interface + MockElement class)

## Consequences

### Positive
- Complete, production-ready test infrastructure exists
- Standards-compliant W3C Permissions API mock
- Clean separation of concerns (types, implementation, tests, fixtures)
- Full event support enables realistic permission change testing
- Automatic cleanup prevents test pollution

### Negative
- None identified - infrastructure is well-architected

### Neutral
- The MockElement class (ADR-mock-element.md) is designed but not yet implemented - this is a separate concern from permission testing
- Browser package uses root vitest config rather than its own - this works fine but could be customized if needed

## Related ADRs
- ADR-mock-element.md: MockElement class for browser element interaction testing (proposed, not yet implemented)
