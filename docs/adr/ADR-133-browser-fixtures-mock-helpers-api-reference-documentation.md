# ADR-133: Browser State Fixtures & Mock Helpers API Reference — Documentation Architecture

## Status
Accepted

## Date
2025-02-01

## Context

The APEX test infrastructure provides two major utility categories that need complete API reference documentation:

1. **Browser State Fixtures** — `browserFixtures`, `browserHelpers`, `BrowserStateBuilder`, and `createBrowserState()` in `packages/core/src/test-fixtures/browser-fixtures.ts`
2. **Mock Helpers** — 8 `create*` factory functions, `mockHelpers` aggregate, and `createMockEnvironment()` in `packages/core/src/test-fixtures/mock-helpers.ts`

### Current Documentation State

| Document | What It Covers | Gap |
|---|---|---|
| `docs/browser-state-fixtures-api.md` | `browserFixtures` (all 7 methods with signatures, params, defaults, examples) | **Missing**: `browserHelpers` (11 methods), `BrowserStateBuilder` (10 methods), `createBrowserState()` — mentioned in a 3-bullet "Helper Utilities" section with no API details |
| `docs/browser-permission-test-utilities.md` | Permission assertions + **full** `browserHelpers` API (11 methods) + **full** `BrowserStateBuilder` API (10 methods + `createBrowserState()`) | Covers browser state helpers/builder comprehensively but positioned under "permission test utilities", not discoverable for non-permission use cases |
| `tests/test-utils/README.md` | Async utils, assertions, context management, cleanup, event tracking | No browser fixtures or mock helpers |
| `test-utils/README.md` | Test setup, shared config, APEX-specific helpers | No browser fixtures or mock helpers |
| **Mock helpers** | **No documentation anywhere** | `createOrchestratorMock`, `createAgentSdkMock`, `createFileSystemMock`, `createNetworkMock`, `createTaskStoreMock`, `createEventEmitterMock`, `createPageMock`, `createConsoleMock`, `mockHelpers`, `createMockEnvironment` — zero API reference docs |

### Source Code APIs Requiring Documentation

**`browser-fixtures.ts`** (635 lines):
- `browserFixtures` — 7 factory methods (already documented in `browser-state-fixtures-api.md`)
- `browserHelpers` — 11 immutable state manipulation methods (documented in `browser-permission-test-utilities.md` but NOT in `browser-state-fixtures-api.md`)
- `BrowserStateBuilder` class — 10 fluent chainable methods + `build()` (documented in `browser-permission-test-utilities.md` but NOT in `browser-state-fixtures-api.md`)
- `createBrowserState()` — factory function (documented in `browser-permission-test-utilities.md` but NOT in `browser-state-fixtures-api.md`)

**`mock-helpers.ts`** (429 lines):
- `createOrchestratorMock(overrides?)` — returns mock with 10 methods (`executeTask`, `createTask`, `getTask`, `getTasks`, `on`, `off`, `emit`, etc.)
- `createAgentSdkMock(overrides?)` — returns mock with `query` and `createClient` methods
- `createFileSystemMock(fileData?)` — returns mock with 7 methods (`readFile`, `writeFile`, `mkdir`, `unlink`, `readdir`, `stat`, `access`)
- `createNetworkMock(responses?)` — returns mock with `fetch`, `addResponse`, `simulateNetworkError`
- `createTaskStoreMock(initialTasks?)` — returns mock with CRUD + helpers (`create`, `get`, `update`, `delete`, `list`, `_getTasks`, `_clearTasks`, `_addTask`)
- `createEventEmitterMock()` — returns mock with `on`, `off`, `emit`, `once`, `_getListeners`, `_clearListeners`
- `createPageMock(overrides?)` — returns Playwright-style page mock with 15+ methods
- `createConsoleMock()` — returns console mock with `log`, `error`, `warn`, `info`, `_getMessages`, `_clearMessages`, `_getMessagesByLevel`
- `mockHelpers` — aggregate object re-exporting all 8 factories
- `createMockEnvironment(options?)` — combined factory creating orchestrator + fs + network + taskStore mocks

**`types.ts`** (343 lines):
- `BrowserState` interface (11 properties) — already documented in `browser-state-fixtures-api.md`
- `TestScenario` union type (8 variants) — already documented
- `MockConfig`, `TestSuiteConfig`, `TestEnvironment`, `SetupTeardownHooks`, `MockFunction` — not yet documented in API reference

## Decision

### Strategy: Extend Existing Files + Create Mock Helpers Doc

We adopt a **two-part approach** that maximizes discoverability while avoiding content duplication:

#### Part 1: Complete `docs/browser-state-fixtures-api.md`

Replace the skeletal "Helper Utilities" section with full API reference sections for:
- `browserHelpers` (all 11 methods with signatures, params, returns, examples)
- `BrowserStateBuilder` class (constructor + 10 chainable methods + `build()`)
- `createBrowserState()` factory function
- Comparison table (Helpers vs Builder: When to Use Which)

**Rationale**: `docs/browser-state-fixtures-api.md` is the canonical document for browser state test utilities. The `browserHelpers` and `BrowserStateBuilder` content already exists in `browser-permission-test-utilities.md`, but that document's context (permission testing) makes it a poor discovery point for general browser state usage. Having the full API in `browser-state-fixtures-api.md` creates a single, self-contained reference. This does introduce intentional duplication with `browser-permission-test-utilities.md`, but both documents serve different audiences and discovery paths.

#### Part 2: Create `docs/mock-helpers-api.md`

Create a new standalone document covering the complete mock helpers API:
- All 8 `create*` factory functions with:
  - TypeScript signature
  - Parameter table (name, type, default, description)
  - Return shape table (method name, type, default behavior)
  - Helper/utility methods on the returned mock
  - Usage example
- `mockHelpers` aggregate object
- `createMockEnvironment(options?)` combined factory with options table
- Composition examples showing fixtures + mocks together

**Rationale**: Mock helpers are a distinct utility category from browser fixtures. A separate document follows the project's established pattern of one-topic-per-document (cf. `test-utilities.md` for platform, `browser-permission-test-utilities.md` for permissions, `browser-state-fixtures-api.md` for browser state). The mock helpers API is large enough (~250-300 lines) to warrant its own document rather than appending to an existing one.

#### Part 3: Cross-Reference Updates

Add "See also" links:
1. `docs/browser-state-fixtures-api.md` → link to `mock-helpers-api.md` (Related Documentation)
2. `docs/mock-helpers-api.md` → link to `browser-state-fixtures-api.md` (Related Documentation)
3. `docs/test-utilities.md` → add links to both new sections in Related Documentation
4. `docs/browser-permission-test-utilities.md` → add link to `mock-helpers-api.md`

### Design Decisions

#### D1: Full API Reference in `browser-state-fixtures-api.md` (Not Just Cross-References)

**Decision**: Duplicate the `browserHelpers` and `BrowserStateBuilder` content from `browser-permission-test-utilities.md` into `browser-state-fixtures-api.md`.

**Rationale**:
- A developer searching for "browser state builder" will find `browser-state-fixtures-api.md`, not the permission testing doc
- Self-contained documents are more useful than documents that require jumping between 3 files
- The content is generated from a single source (`browser-fixtures.ts`), so both docs can be updated together
- Controlled duplication with clear source-of-truth (the source code) is preferable to fragmented references

#### D2: Separate `mock-helpers-api.md` Rather Than Extending `browser-state-fixtures-api.md`

**Decision**: Create a new document for mock helpers rather than adding them to the browser state fixtures doc.

**Rationale**:
- Mock helpers (`createOrchestratorMock`, `createFileSystemMock`, etc.) are not browser-specific
- They serve a different audience: test infrastructure consumers vs browser testing consumers
- Combined document would be ~900+ lines, exceeding comfortable single-document length
- Separation follows the existing docs organizational pattern

#### D3: Document Return Shape for All Mock Factories

**Decision**: Each `create*` function gets a "Return Shape" table listing every method/property on the returned mock, its type, and default behavior.

**Rationale**:
- Mock factories return objects with `vi.fn()` methods — the return shape IS the API
- Without return shape docs, developers must read source code to discover available methods
- Default behaviors (e.g., `executeTask: mockResolvedValue({ success: true, taskId: 'mock-task-id' })`) are critical for understanding what tests will observe
- Helper methods like `_getTasks()`, `addResponse()`, `simulateNetworkError()` are not discoverable without documentation

#### D4: Content Format Consistency

**Decision**: Follow the exact format established in `browser-permission-test-utilities.md` and `browser-state-fixtures-api.md`.

**Format per API entry**:
```markdown
### functionName(param1, param2?)

Description.

**Signature:**
```typescript
functionName(param1: Type, param2?: Type): ReturnType
```

**Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `param1` | `Type` | — | Description |

**Returns:** `ReturnType` — Description

**Default Return Shape:** (for mock factories)
| Property | Type | Default Behavior |
|---|---|---|
| `method` | `MockFunction` | `mockResolvedValue(...)` |

**Usage Example:**
```typescript
// code
```
```

### Files to Create/Modify

| File | Action | Estimated Lines |
|---|---|---|
| `docs/browser-state-fixtures-api.md` | **Modify** — Replace "Helper Utilities" section (lines 450-457) with full `browserHelpers`, `BrowserStateBuilder`, `createBrowserState()` API reference + comparison table | +350 lines |
| `docs/mock-helpers-api.md` | **Create** — New complete mock helpers API reference | ~350 lines |
| `docs/test-utilities.md` | **Modify** — Add cross-references in Related Documentation | +3 lines |
| `docs/browser-permission-test-utilities.md` | **Modify** — Add cross-reference to mock helpers in Related Documentation | +1 line |
| `docs/adr/ADR-133-browser-fixtures-mock-helpers-api-reference-documentation.md` | **Create** — This ADR | ~250 lines |

### Implementation Plan for Next Stage (developer)

1. **Update `docs/browser-state-fixtures-api.md`**:
   - Replace the "Helper Utilities" section (lines 450-457) with complete API reference for:
     - `browserHelpers` — all 11 methods (copy format from `browser-permission-test-utilities.md` lines 694-1053)
     - `BrowserStateBuilder` — constructor + all 10 methods + `build()` (copy format from lines 1056-1334)
     - `createBrowserState()` factory function
     - Helpers vs Builder comparison table
   - Update Table of Contents to include new sections
   - Update Related Documentation to link to `mock-helpers-api.md`

2. **Create `docs/mock-helpers-api.md`**:
   - Overview section with import paths
   - Each of the 8 `create*` functions with:
     - Signature, parameters table, return shape table, usage example
   - `mockHelpers` aggregate documentation
   - `createMockEnvironment(options?)` with options table and example
   - Composition examples (fixtures + mocks together)
   - Related Documentation links

3. **Update cross-references**:
   - `docs/test-utilities.md` Related Documentation section
   - `docs/browser-permission-test-utilities.md` Related Documentation section

4. **Verify**: `npm run build` and `npm run test` pass (documentation-only changes, should not affect either)

## Consequences

### Positive
- **Complete API discoverability** — all browser state and mock helper APIs documented in dedicated references
- **Self-contained documents** — each doc can be read independently without cross-file jumping
- **Consistent format** — follows established documentation patterns exactly
- **Return shape documentation** — developers can discover mock APIs without reading source code
- **Proper cross-referencing** — all related docs link to each other

### Negative
- **Controlled duplication** — `browserHelpers` and `BrowserStateBuilder` content exists in both `browser-state-fixtures-api.md` and `browser-permission-test-utilities.md`
- **Maintenance surface** — API changes must be reflected in 2 locations for browser helpers/builder
- **README growth** — `browser-state-fixtures-api.md` grows from ~623 to ~970 lines

### Neutral
- No code changes required — purely documentation additions
- No new test files needed
- Build and test suites unaffected
