# ADR-004: Browser Test Utilities Module

## Status
Accepted

## Date
2025-01-30

## Context

The `@apexcli/browser` package has accumulated several test utility patterns scattered across different locations:

1. **`src/__tests__/test-utils.ts`** — Internal test helpers (TestPages, ScreenshotValidators, PerformanceMonitor, MockScenarios, TestDataGenerators). These are only accessible within the `__tests__/` directory because tsconfig excludes `__tests__/` from the build output.

2. **`src/mocks/`** — Full mock infrastructure (MockBrowserSession, MockBrowserManager, scenario-builder) already properly exported via `./mocks` subpath export and the main index.

3. **Missing utilities** — No test URL generators, no DOM structure simulation helpers, and no general browser state assertion utilities available to external consumers.

External consumers (other packages, integration tests) cannot reuse the internal test-utils because they live in the excluded `__tests__/` directory. The mocks system is well-structured but serves a different purpose (full mock session simulation vs. lightweight test helpers).

## Decision

Create a new **`packages/browser/src/test-utils.ts`** module at the `src/` root level (not inside `__tests__/`) that:

1. **Consolidates and re-exports** the existing internal test helpers from `__tests__/test-utils.ts` by moving them to the new public module
2. **Adds new utilities** for the gaps identified:
   - **Mock Page Objects**: Lightweight mock page object factory (simpler than the full MockBrowserSession for unit tests)
   - **DOM Structure Simulation**: HTML template builders for common DOM patterns (forms, tables, navigation, etc.)
   - **Test URL Generation**: Deterministic and pattern-based URL generators for test scenarios
   - **Browser State Assertions**: Assertion helpers for verifying navigation state, page content, console output, error state, and element visibility
3. **Exports from the package** via a new `./test-utils` subpath export in `package.json` AND from the main index
4. **Keeps the existing `__tests__/test-utils.ts`** as-is but has it re-import from the new public module to avoid duplication

### Module Structure

```
packages/browser/src/
  test-utils.ts          # NEW: Central public test-utils module
  test-utils/
    index.ts             # Re-exports all sub-modules
    mock-page-objects.ts  # Lightweight mock page factories
    dom-builders.ts       # DOM structure simulation / HTML templates
    url-generators.ts     # Test URL generation utilities
    assertions.ts         # Browser state assertion helpers
    test-pages.ts         # Migrated from __tests__/test-utils.ts (TestPages, TestDataGenerators)
    validators.ts         # Migrated from __tests__/test-utils.ts (ScreenshotValidators)
    performance.ts        # Migrated from __tests__/test-utils.ts (PerformanceMonitor)
```

### Key Design Decisions

#### 1. Separate directory (`test-utils/`) with barrel file

Rather than putting everything in a single file, we use a directory with focused sub-modules. This keeps each file small and focused, allows tree-shaking by consumers, and follows the existing `mocks/` and `permission-mocking/` patterns in this package.

The top-level `src/test-utils.ts` acts as the barrel re-export for the subpath.

#### 2. Subpath export (`./test-utils`)

Following the existing `./mocks` pattern in `package.json`, we add:
```json
"./test-utils": {
  "types": "./dist/test-utils.d.ts",
  "import": "./dist/test-utils.js",
  "require": "./dist/test-utils.js",
  "default": "./dist/test-utils.js"
}
```

This allows: `import { createMockPage, generateTestUrl } from '@apexcli/browser/test-utils'`

#### 3. No Playwright runtime dependency in test-utils

The test-utils module must NOT require a running Playwright browser. All utilities work with plain TypeScript types and mock data. Functions that reference Playwright types use only type imports.

#### 4. Assertion helpers return boolean + message (not throw)

Assertion helpers follow a pattern that works with any test framework:
```typescript
interface AssertionResult {
  pass: boolean;
  message: string;
  actual?: unknown;
  expected?: unknown;
}
```

This makes them usable with Vitest, Jest, or any other framework.

## Interfaces and Contracts

### Mock Page Objects (`mock-page-objects.ts`)

```typescript
/** Lightweight mock page for unit tests (not full MockBrowserSession) */
interface MockPageObject {
  url: string;
  title: string;
  content: string;
  elements: Map<string, MockElementState>;
  consoleMessages: Array<{ level: string; text: string }>;
  errors: string[];
  cookies: Array<{ name: string; value: string; domain?: string }>;
  localStorage: Map<string, string>;
}

interface MockElementState {
  selector: string;
  visible: boolean;
  enabled: boolean;
  text: string;
  value: string;
  attributes: Record<string, string>;
  tagName: string;
  children: MockElementState[];
}

function createMockPage(overrides?: Partial<MockPageObject>): MockPageObject;
function createMockElement(selector: string, overrides?: Partial<MockElementState>): MockElementState;
function createMockPageWithForm(formConfig: FormConfig): MockPageObject;
function createMockPageWithNavigation(links: NavLink[]): MockPageObject;
```

### DOM Structure Simulation (`dom-builders.ts`)

```typescript
/** Build HTML strings representing common DOM structures */
function buildFormHtml(config: FormConfig): string;
function buildTableHtml(config: TableConfig): string;
function buildNavigationHtml(links: NavLink[]): string;
function buildListHtml(items: string[], ordered?: boolean): string;
function buildModalHtml(config: ModalConfig): string;
function buildCardGridHtml(cards: CardConfig[]): string;

interface FormConfig {
  action?: string;
  method?: string;
  fields: FormField[];
  submitLabel?: string;
}

interface FormField {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio';
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // for select/radio
  value?: string;
}
```

### Test URL Generation (`url-generators.ts`)

```typescript
function generateTestUrl(options?: TestUrlOptions): string;
function generateTestUrls(count: number, options?: TestUrlOptions): string[];
function createUrlPattern(pattern: string, params?: Record<string, string>): string;

/** Predefined URL collections for common test scenarios */
const testUrls: {
  valid: string[];         // Well-formed URLs
  invalid: string[];       // Malformed URLs for error testing
  protocols: string[];     // Various protocol schemes
  special: string[];       // Edge cases (unicode, long paths, etc.)
  localhost: (port?: number) => string;
  dataUri: (content: string, mimeType?: string) => string;
  fileUri: (path: string) => string;
};
```

### Browser State Assertions (`assertions.ts`)

```typescript
function assertNavigationState(page: MockPageObject, expected: Partial<NavigationState>): AssertionResult;
function assertPageContent(page: MockPageObject, expectedContent: string | RegExp): AssertionResult;
function assertElementExists(page: MockPageObject, selector: string): AssertionResult;
function assertElementVisible(page: MockPageObject, selector: string): AssertionResult;
function assertElementText(page: MockPageObject, selector: string, expected: string | RegExp): AssertionResult;
function assertNoErrors(page: MockPageObject): AssertionResult;
function assertConsoleContains(page: MockPageObject, level: string, text: string | RegExp): AssertionResult;
function assertBrowserState(page: MockPageObject, expected: Partial<BrowserStateExpectation>): AssertionResult;

interface NavigationState {
  url: string | RegExp;
  title: string | RegExp;
  loaded: boolean;
}

interface BrowserStateExpectation {
  url?: string | RegExp;
  title?: string | RegExp;
  hasErrors?: boolean;
  elementExists?: string[];
  elementVisible?: string[];
  consoleMessages?: Array<{ level: string; text: string | RegExp }>;
}
```

## Consequences

### Positive
- Single import path for all browser test utilities
- Reusable across packages (orchestrator tests, CLI tests, integration tests)
- No Playwright runtime requirement for test setup
- Framework-agnostic assertion helpers
- Follows existing package patterns (`./mocks` subpath)

### Negative
- Slight code duplication during migration (existing `__tests__/test-utils.ts` needs updating)
- Additional build output surface area
- Consumers need to be careful not to confuse `test-utils` (lightweight helpers) with `mocks` (full simulation)

### Risks
- Test utilities shipped in production bundle unless consumers tree-shake. Mitigated by the subpath export — consumers import from `@apexcli/browser/test-utils` only when needed.

## Implementation Plan (for developer stage)

1. Create `src/test-utils/` directory with sub-modules
2. Migrate existing helpers from `__tests__/test-utils.ts` into appropriate sub-modules
3. Implement new utilities (mock-page-objects, dom-builders, url-generators, assertions)
4. Create barrel `src/test-utils.ts`
5. Update `package.json` exports
6. Update `src/index.ts` to export test-utils
7. Update `__tests__/test-utils.ts` to re-export from new module
8. Write tests for all new utilities
9. Verify build and existing tests pass
