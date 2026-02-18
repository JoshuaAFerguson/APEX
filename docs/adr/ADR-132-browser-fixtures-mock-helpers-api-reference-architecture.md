# ADR-132: Browser State Fixtures and Mock Helpers API Reference Architecture

## Status
Accepted

## Date
2025-01-31

## Context

The APEX test infrastructure includes three major utility categories that currently lack dedicated API reference documentation:

1. **Browser State Fixtures** (`browserFixtures` factory functions) in `packages/core/src/test-fixtures/browser-fixtures.ts`
2. **Browser Helpers** (`browserHelpers` methods) and **BrowserStateBuilder** fluent API in the same file
3. **Mock Helpers** (`create*` factory functions) in `packages/core/src/test-fixtures/mock-helpers.ts`

These utilities are exported via `packages/core/src/test-fixtures/index.ts` and are available to all APEX packages. While the source code has JSDoc comments, there is no consolidated API reference documentation that developers can browse without reading source files.

### Current Documentation Landscape

| Document | Content | Gap |
|---|---|---|
| `test-utils/README.md` | Quick start, general test utilities | No browser fixtures or mock helpers API reference |
| `docs/test-utilities.md` | Platform detection utilities | No browser state or mock helpers coverage |
| `docs/api-reference.md` | REST API & WebSocket reference | No test utility APIs |
| `docs/browser-permission-test-utilities.md` | Permission assertions, permission mocks | No browser state fixtures or general mock helpers |
| ADR-130 | Shared test configuration architecture | Architecture only, no API reference |
| ADR-131 | Browser permission test utilities docs architecture | Covers permission mocking, not general browser state fixtures |

### Source Code APIs to Document

**`browser-fixtures.ts`** exports:
- `browserFixtures` object with 7 factory methods (`cleanState`, `loggedInPage`, `errorPage`, `loadingPage`, `offlinePage`, `permissionDeniedPage`, `fromScenario`)
- `browserHelpers` object with 11 manipulation methods
- `BrowserStateBuilder` class with 10 fluent methods
- `createBrowserState()` convenience function

**`mock-helpers.ts`** exports:
- 8 standalone `create*` factory functions (`createOrchestratorMock`, `createAgentSdkMock`, `createFileSystemMock`, `createNetworkMock`, `createTaskStoreMock`, `createEventEmitterMock`, `createPageMock`, `createConsoleMock`)
- `mockHelpers` aggregate object re-exporting all factories
- `createMockEnvironment()` combined factory

**`types.ts`** exports:
- `BrowserState` interface (11 properties)
- `TestScenario` union type (8 variants)
- `MockConfig`, `TestSuiteConfig`, `TestEnvironment`, `SetupTeardownHooks` interfaces

## Decision

### Architecture: Add New Sections to `test-utils/README.md`

Add three new API reference sections to the existing `test-utils/README.md`, which is the canonical location for test utility documentation. This follows the established pattern where test utility documentation lives alongside the test utilities themselves.

### Document Structure

The new sections will be appended to `test-utils/README.md` after the existing "APEX-Specific Helpers" section:

```
## Existing sections (unchanged)
...

## Browser State Fixtures API                    [NEW]
### browserFixtures
  - cleanState(overrides?)
  - loggedInPage(overrides?)
  - errorPage(overrides?)
  - loadingPage(overrides?)
  - offlinePage(overrides?)
  - permissionDeniedPage(overrides?)
  - fromScenario(scenario, overrides?)
### browserHelpers
  - addConsoleMessage(state, type, message)
  - addNetworkRequest(state, url, method?, status?, headers?)
  - setLocalStorage(state, key, value)
  - setSessionStorage(state, key, value)
  - addCookie(state, name, value, options?)
  - navigateTo(state, url, title?)
  - startLoading(state)
  - finishLoading(state)
  - setError(state, hasError?)
  - setAuthenticated(state, isAuthenticated)
  - clearBrowserData(state)
### BrowserStateBuilder
  - constructor(initialState?)
  - withUrl(url) → this
  - withTitle(title) → this
  - withLoading(isLoading) → this
  - withError(hasError) → this
  - withAuth(isAuthenticated) → this
  - withLocalStorage(data) → this
  - withSessionStorage(data) → this
  - withConsoleMessages(messages) → this
  - withNetworkRequests(requests) → this
  - build() → BrowserState
### createBrowserState(initialState?)
### BrowserState Interface
### TestScenario Type

## Mock Helpers API                              [NEW]
### createOrchestratorMock(overrides?)
### createAgentSdkMock(overrides?)
### createFileSystemMock(fileData?)
### createNetworkMock(responses?)
### createTaskStoreMock(initialTasks?)
### createEventEmitterMock()
### createPageMock(overrides?)
### createConsoleMock()
### createMockEnvironment(options?)
### mockHelpers (aggregate)
```

### Design Decisions

#### D1: Extend `test-utils/README.md` Rather Than Create New File

**Decision**: Add to the existing `test-utils/README.md`.

**Rationale**:
- `test-utils/README.md` is the established entry point for test utility documentation
- Browser fixtures and mock helpers are exported through `test-utils/index.ts`
- Keeps all test utility API reference in a single, discoverable location
- The existing README already covers mock management, test helpers, and APEX-specific helpers — browser fixtures and mock helpers are natural extensions
- Avoids documentation fragmentation across multiple files

#### D2: Full Parameter Type Signatures

**Decision**: Document exact TypeScript parameter types and return types for every function.

**Rationale**:
- Developers need type information without opening source files
- Parameter types like `Partial<BrowserState>` and `Record<string, any>` convey usage constraints
- Return types enable chaining understanding (e.g., `BrowserStateBuilder` methods return `this`)

#### D3: Usage Examples for Every Factory Function

**Decision**: Include at least one usage example per factory function, plus composition examples.

**Rationale**:
- API references without examples force developers to guess at usage patterns
- Examples demonstrate the override/customization pattern used consistently across all factories
- Composition examples show how fixtures and mock helpers work together (e.g., browser fixture + page mock in the same test)

#### D4: Interface Documentation Inline

**Decision**: Document the `BrowserState` interface and related types inline within the API reference sections.

**Rationale**:
- Properties of `BrowserState` are essential context when understanding fixture factories
- Inline documentation eliminates cross-referencing between sections
- Types like `TestScenario` are small enough to document fully inline

#### D5: Include Mock Return Shape Documentation

**Decision**: Document the shape of objects returned by each `create*` mock factory.

**Rationale**:
- Mock factories return objects with pre-configured `vi.fn()` implementations
- Developers need to know what methods are available on each mock (e.g., `createOrchestratorMock` returns `executeTask`, `createTask`, `getTask`, etc.)
- Default mock behaviors (e.g., `mockResolvedValue`) should be documented so developers know what to expect without overrides
- Helper methods like `_getTasks()` on `createTaskStoreMock` and `addResponse()` on `createNetworkMock` are not obvious from the factory name

### Content Specification

Each API entry follows this format:

```markdown
### functionName(param1, param2?)

Description of what the function does.

**Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `param1` | `TypeName` | — | Description |
| `param2` | `TypeName` | `defaultValue` | Description |

**Returns:** `ReturnType` — Description

**Default Return Shape:** (for mock factories)
| Property | Type | Default Behavior |
|---|---|---|
| `method` | `MockFunction` | `mockResolvedValue(...)` |

**Example:**
```typescript
// Usage example
```
```

### Source Files Referenced

All documentation content is derived from these source files:

| File | Documented APIs |
|---|---|
| `packages/core/src/test-fixtures/browser-fixtures.ts` | `browserFixtures`, `browserHelpers`, `BrowserStateBuilder`, `createBrowserState` |
| `packages/core/src/test-fixtures/mock-helpers.ts` | All `create*` functions, `mockHelpers`, `createMockEnvironment` |
| `packages/core/src/test-fixtures/types.ts` | `BrowserState`, `TestScenario`, `MockConfig`, `TestSuiteConfig` |
| `packages/core/src/test-fixtures/index.ts` | Export structure verification |

### Cross-Reference Updates

The following existing docs should receive cross-reference links:
1. `docs/test-utilities.md` — Add "See also" link to browser fixtures and mock helpers sections
2. `packages/core/src/test-setup-utils-README.md` — Add cross-reference to mock helpers

### Estimated Addition Size

~400-500 lines added to `test-utils/README.md`:
- Browser State Fixtures section: ~200 lines
- Mock Helpers section: ~200 lines
- Cross-reference updates: ~10 lines across 2 files

## Implementation Plan for Next Stage

1. **Add Browser State Fixtures API section** to `test-utils/README.md`
   - `browserFixtures` (all 7 methods with parameter types, defaults, examples)
   - `browserHelpers` (all 11 methods with full signatures)
   - `BrowserStateBuilder` (constructor + all 10 chainable methods + `build()`)
   - `createBrowserState()` convenience function
   - `BrowserState` interface reference table
   - `TestScenario` type reference

2. **Add Mock Helpers API section** to `test-utils/README.md`
   - All 8 `create*` factory functions with:
     - Parameter types and defaults
     - Return shape (mock methods and their default behaviors)
     - Helper methods (e.g., `_getTasks`, `addResponse`, `simulateNetworkError`)
   - `createMockEnvironment()` with options table
   - `mockHelpers` aggregate object
   - Composition examples showing fixtures + mocks together

3. **Add cross-reference links** to:
   - `docs/test-utilities.md`
   - `packages/core/src/test-setup-utils-README.md`

4. **Verify** `npm run build` and `npm run test` pass (documentation-only changes)

## Consequences

### Positive
- **Complete API discoverability** — developers can find all browser fixture and mock helper APIs in one place
- **Type-safe documentation** — exact TypeScript signatures prevent incorrect usage
- **Example-driven** — every factory function has a working code example
- **Consistent with existing docs** — follows the established pattern in `test-utils/README.md`

### Negative
- **README size increase** — `test-utils/README.md` grows by ~450 lines (mitigated by clear heading hierarchy)
- **Maintenance coupling** — API changes in source must be reflected in docs

### Neutral
- No code changes required — purely documentation additions
- No new files created (except this ADR) — extends existing documentation
