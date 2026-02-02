# ADR-132: Browser State Fixtures API Documentation Architecture

## Status
Accepted

## Date
2025-01-15

## Context

The APEX test fixtures module (`@apex/core/test-fixtures`) includes a comprehensive browser state fixtures system in `packages/core/src/test-fixtures/browser-fixtures.ts`. This system provides:

- A `browserFixtures` object with 6 scenario-specific factory functions plus a `fromScenario` dispatcher
- A `BrowserState` interface and `TestScenario` type (in `types.ts`)
- A `BrowserStateBuilder` class for fluent construction of complex states
- A `browserHelpers` utility object for immutable state transformations
- A `createBrowserState()` factory function

Currently, the source code is well-documented with JSDoc comments, and there are existing guides (`QUICK_REFERENCE.md`, `USAGE_GUIDE.md`) within the test-fixtures directory. However, there is no standalone API reference document in the `docs/` directory specifically covering the browser state fixtures API.

The task requires creating `docs/browser-state-fixtures-api.md` with complete API reference for all 7 `browserFixtures` functions including TypeScript signatures, parameter tables with types/defaults, return type documentation, and usage examples.

## Decision

### Document Structure

The API reference document will follow the established patterns from `docs/browser-permission-test-utilities.md` and `docs/api-reference.md`:

1. **Overview section** - Module purpose, import paths, quick-start example
2. **Type Definitions** - `BrowserState` interface and `TestScenario` type with full property tables
3. **`browserFixtures` API Reference** - All 7 functions with:
   - TypeScript signature
   - Parameter table (name, type, required, default, description)
   - Return type
   - Default values table (showing what each fixture returns)
   - Usage example
4. **`BrowserStateBuilder` Reference** - Builder class API with method chain examples
5. **`browserHelpers` Reference** - Helper functions for state manipulation
6. **`createBrowserState()` Reference** - Factory function
7. **Cross-references** - Links to related docs

### Design Decisions

1. **Single file in `docs/`**: Placed at `docs/browser-state-fixtures-api.md` for discoverability alongside other API references. Does NOT replace existing `QUICK_REFERENCE.md` or `USAGE_GUIDE.md` in the package directory.

2. **Parameter tables format**: Consistent with `docs/browser-permission-test-utilities.md` - using markdown tables with columns: Parameter, Type, Required, Default, Description.

3. **Default values as tables**: Each fixture function gets a "Default Values" table showing all BrowserState properties and their defaults, since knowing exact defaults is critical for test assertions.

4. **Import path documentation**: Document both the barrel import (`@apex/core/test-fixtures`) and direct import paths.

5. **No code changes**: This is a documentation-only deliverable. The source code in `browser-fixtures.ts` and `types.ts` is complete and well-structured.

### Document Scope

**In scope:**
- `browserFixtures.cleanState()`
- `browserFixtures.loggedInPage()`
- `browserFixtures.errorPage()`
- `browserFixtures.loadingPage()`
- `browserFixtures.offlinePage()`
- `browserFixtures.permissionDeniedPage()`
- `browserFixtures.fromScenario()`
- `BrowserState` interface
- `TestScenario` type
- `BrowserStateBuilder` class
- `browserHelpers` object
- `createBrowserState()` factory

**Out of scope:**
- Other test fixture modules (errors, responses, requests)
- Browser automation runtime APIs
- Permission system APIs

## Consequences

### Positive
- Complete API reference for browser state fixtures in a single document
- Consistent formatting with existing documentation
- Enables developers to quickly look up function signatures and default values
- Cross-referenced with related documentation

### Negative
- Some duplication with inline JSDoc and existing QUICK_REFERENCE.md
- Requires maintenance when source API changes

## Implementation Plan

1. Create `docs/browser-state-fixtures-api.md` with the structure defined above
2. Populate all sections from source code analysis
3. Verify build and tests pass (documentation-only, no code changes expected to affect either)
