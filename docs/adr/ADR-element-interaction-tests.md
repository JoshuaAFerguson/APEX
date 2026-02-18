# ADR: Element Interaction Integration Tests Architecture

## Status
Proposed (Architecture Stage)

## Context

APEX requires comprehensive integration tests for element interactions to validate browser automation capabilities. The task is to create integration tests for element interactions including:
- Click interactions (single, double, right-click, with modifiers)
- Type/input interactions (text inputs, textareas, contenteditable)
- Hover interactions (mouse events, tooltips, CSS hover states)
- Select interactions (dropdowns, multi-select, radio buttons, checkboxes)
- Other DOM interactions (focus, blur, scroll, keyboard events)

### Acceptance Criteria
Integration tests must exist and pass for element interactions including:
- Click interactions with various element types and states
- Type interactions with form inputs
- Form control interactions (select, checkbox, radio)
- Handling of dynamic elements (lazy-loaded, conditionally rendered)
- Handling of hidden/disabled elements (proper error handling)

## Decision

### 1. Test Architecture Overview

```
tests/browser-integration/
├── element-interaction-tests/
│   ├── click-interactions.integration.test.ts        # Click action tests
│   ├── type-interactions.integration.test.ts         # Text input tests
│   ├── hover-select-interactions.integration.test.ts # Hover + select tests
│   ├── dynamic-hidden-elements.integration.test.ts   # Dynamic/hidden element tests
│   └── fixtures/
│       └── element-interaction-test-page.html        # Shared HTML fixture
```

### 2. Test Categories and Coverage

#### 2.1 Click Interactions (`click-interactions.integration.test.ts`)
| Test Case | Description | Coverage |
|-----------|-------------|----------|
| Basic click on visible buttons | Validates standard click events | Core functionality |
| Click with various selector types | ID, class, data-testid, CSS pseudo-selectors | Selector support |
| Click with modifier keys | Ctrl+click, Shift+click | Modifier support |
| Double-click interactions | dblclick events | Extended click types |
| Right-click (context menu) | contextmenu events | Extended click types |
| Click on disabled elements | Should fail gracefully | Error handling |
| Click on hidden elements | Should fail or use force option | Error handling |
| Click on dynamically created elements | Wait for element before click | Dynamic content |
| Click with timeout handling | Custom timeout scenarios | Timeout handling |
| Click on nested elements | Event bubbling verification | DOM hierarchy |

#### 2.2 Type Interactions (`type-interactions.integration.test.ts`)
| Test Case | Description | Coverage |
|-----------|-------------|----------|
| Type into text inputs | Standard input[type="text"] | Core functionality |
| Type into password inputs | Masked input handling | Input types |
| Type into email/tel/number inputs | Validation-aware inputs | Input types |
| Type into textareas | Multi-line text input | Element types |
| Type into contenteditable divs | Rich text editors | Advanced inputs |
| Type with delay option | Simulated human typing | Options |
| Type with clear option | Clear existing content first | Options |
| Type special characters | Unicode, emoji, symbols | Character handling |
| Type into disabled inputs | Should fail gracefully | Error handling |
| Type into readonly inputs | Should fail gracefully | Error handling |
| Type into hidden inputs | Should fail gracefully | Error handling |
| Type triggering validation events | blur/change event firing | Event handling |

#### 2.3 Hover and Select Interactions (`hover-select-interactions.integration.test.ts`)
| Test Case | Description | Coverage |
|-----------|-------------|----------|
| Hover over elements | mouseover/mouseenter events | Core hover |
| Hover triggering tooltips | Tooltip display verification | Visual feedback |
| Hover triggering CSS changes | :hover state application | CSS integration |
| Hover with force option | Force hover on hidden elements | Options |
| Select dropdown options | select > option interactions | Form controls |
| Multi-select interactions | multiple attribute handling | Form controls |
| Checkbox toggle | checked state toggling | Form controls |
| Radio button selection | mutual exclusivity | Form controls |
| Custom dropdown components | JavaScript-driven dropdowns | Advanced patterns |
| Focus/blur events | Focus management | Form interaction |

#### 2.4 Dynamic and Hidden Elements (`dynamic-hidden-elements.integration.test.ts`)
| Test Case | Description | Coverage |
|-----------|-------------|----------|
| Lazy-loaded elements | Wait for element to appear | Dynamic content |
| Conditionally rendered | React/Vue-style conditional rendering | SPA patterns |
| Elements behind modals | Overlay handling | Z-index scenarios |
| Elements outside viewport | Scroll-into-view behavior | Viewport handling |
| display:none elements | Hidden element detection | Visibility states |
| visibility:hidden elements | Invisible element detection | Visibility states |
| opacity:0 elements | Transparent element handling | Visibility states |
| Disabled state transitions | Enable after async operation | State transitions |
| Detached DOM elements | Elements removed during operation | Edge cases |
| Iframe content | Cross-frame interactions | Advanced patterns |

### 3. Test Infrastructure Design

#### 3.1 Shared Test Setup Pattern
```typescript
// Reuse existing setup from tests/browser-integration/setup.ts
import {
  createBrowser,
  createBrowserContext,
  createPage,
  captureScreenshot,
  waitForNetworkIdle,
  DEFAULT_BROWSER_CONFIG,
} from '../setup.ts';

// Import shared test utilities
import {
  waitForElement,
  safeClick,
  safeFill,
  takeScreenshot,
  captureConsoleMessages,
  capturePageErrors,
  withBrowserTest,
} from '../utils/test-helpers.ts';
```

#### 3.2 HTML Test Fixture Structure
The shared fixture (`element-interaction-test-page.html`) provides:
- All element types needed for interaction tests
- Event tracking via data attributes
- Validation feedback displays
- Dynamic element generation capabilities
- Console logging for test verification

```html
<div id="click-tests">
  <!-- Button variants, links, custom elements -->
</div>
<div id="type-tests">
  <!-- Input variants, textareas, contenteditable -->
</div>
<div id="select-tests">
  <!-- Dropdowns, checkboxes, radios -->
</div>
<div id="dynamic-tests">
  <!-- Lazy-loaded, conditional, hidden elements -->
</div>
<div id="event-log">
  <!-- Captured events for test verification -->
</div>
```

#### 3.3 Test Utilities Extension
Extend existing utilities with element interaction helpers:
```typescript
interface ElementInteractionHelpers {
  // Click helpers
  clickWithModifiers(page: Page, selector: string, modifiers: string[]): Promise<void>;
  doubleClick(page: Page, selector: string): Promise<void>;
  rightClick(page: Page, selector: string): Promise<void>;

  // Type helpers
  typeWithDelay(page: Page, selector: string, text: string, delay: number): Promise<void>;
  clearAndType(page: Page, selector: string, text: string): Promise<void>;

  // Select helpers
  selectOption(page: Page, selector: string, value: string): Promise<void>;
  selectMultiple(page: Page, selector: string, values: string[]): Promise<void>;
  toggleCheckbox(page: Page, selector: string): Promise<boolean>;

  // Verification helpers
  verifyEventFired(page: Page, eventType: string, targetSelector: string): Promise<boolean>;
  getInputValue(page: Page, selector: string): Promise<string>;
  isElementVisible(page: Page, selector: string): Promise<boolean>;
  isElementEnabled(page: Page, selector: string): Promise<boolean>;
}
```

### 4. Integration with Existing Tests

#### 4.1 Alignment with Existing Test Files
The new tests complement and extend existing browser integration tests:

| Existing Test File | Relationship |
|--------------------|--------------|
| `element-interaction-actions.test.ts` | Unit tests for BrowserSession methods - our integration tests validate end-to-end behavior |
| `hover-focus-interactions.integration.test.ts` | Covers hover/focus - we extend with more edge cases |
| `form-control-interactions.integration.test.ts` | Covers form controls - we extend with dynamic/hidden handling |
| `advanced-selector-interactions.test.ts` | Covers selector patterns - we extend with interaction-specific scenarios |

#### 4.2 Test Data Flow
```
Test Case → HTML Fixture → BrowserSession Methods → Playwright → DOM → Event Capture → Assertions
```

### 5. Test Configuration

#### 5.1 Vitest Configuration Extension
```typescript
// tests/browser-integration/vitest.config.ts extension
export default defineConfig({
  test: {
    include: [
      '**/*.integration.test.ts',
      '**/element-interaction-tests/**/*.test.ts',
    ],
    testTimeout: 30000, // Extended for browser operations
    hookTimeout: 60000, // Extended for browser setup/teardown
    retry: 1, // Retry flaky browser tests once
    pool: 'forks', // Isolate browser tests
  },
});
```

#### 5.2 Browser Configuration for Interaction Tests
```typescript
const INTERACTION_TEST_CONFIG: BrowserTestConfig = {
  ...DEFAULT_BROWSER_CONFIG,
  headless: true,
  viewport: { width: 1280, height: 720 },
  slowMo: process.env.CI ? 0 : 50, // Slight delay for visual debugging
};
```

### 6. Key Design Decisions

#### 6.1 Use Playwright Over BrowserSession
**Decision**: Tests will primarily use Playwright Page directly rather than BrowserSession wrapper.

**Rationale**:
- BrowserSession wraps Playwright but adds abstraction
- Integration tests should validate end-to-end behavior
- Playwright's native APIs are more feature-complete for testing scenarios
- Existing integration tests already use this pattern

#### 6.2 HTML Fixtures Over Dynamic Page Generation
**Decision**: Use static HTML fixture files rather than inline data URLs.

**Rationale**:
- Larger, more complex test pages are maintainable in files
- Fixtures can be version controlled independently
- Enables testing page load scenarios
- Matches pattern in existing form-control tests

#### 6.3 Event Capture Pattern
**Decision**: Use JavaScript event listeners in fixtures to capture and log events.

**Rationale**:
- Enables verification that correct events fired
- Allows testing event properties (target, modifiers, etc.)
- Console capture infrastructure already exists
- Matches pattern in hover-focus tests

#### 6.4 Graceful Error Handling Tests
**Decision**: Tests for error conditions should verify specific error messages/behaviors.

**Rationale**:
- Ensures consistent error handling across operations
- Validates timeout behavior is predictable
- Confirms disabled/hidden element handling is correct
- Matches existing test patterns

### 7. File Dependencies

#### 7.1 Required Imports
```typescript
// Core test framework
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Playwright types
import { Browser, BrowserContext, Page } from 'playwright';

// Existing test infrastructure
import { createBrowser, createBrowserContext, createPage } from '../setup.ts';
import { waitForElement, safeClick, safeFill } from '../utils/test-helpers.ts';

// Optional: BrowserSession for comparative testing
import { BrowserSession } from '@apexcli/browser';
```

#### 7.2 New Utilities to Create
```typescript
// tests/browser-integration/utils/element-interaction-helpers.ts
export function clickWithModifiers(...);
export function doubleClick(...);
export function rightClick(...);
export function selectMultiple(...);
export function toggleCheckbox(...);
export function verifyEventFired(...);
export function waitForElementEnabled(...);
export function waitForElementVisible(...);
```

### 8. Test Execution Flow

```
beforeAll()
  ├── Create browser instance
  ├── Create browser context
  └── Create temp directory for artifacts

beforeEach()
  ├── Create new page
  └── Navigate to test fixture

Test Execution
  ├── Perform interaction
  ├── Capture console messages
  ├── Verify element state
  └── Assert expected behavior

afterEach()
  ├── Capture screenshot on failure
  └── Close page

afterAll()
  ├── Close context
  ├── Close browser
  └── Cleanup temp directory
```

### 9. Success Criteria

All tests must pass when running:
```bash
npm run test -- --filter="element-interaction"
```

Coverage requirements:
- 100% of acceptance criteria scenarios covered
- All element types (button, input, select, checkbox, radio) tested
- All visibility states (visible, hidden, disabled, dynamic) tested
- All interaction types (click, type, hover, select) tested
- Error handling for invalid operations validated

## Consequences

### Positive
- Comprehensive coverage of element interaction scenarios
- Reuses existing test infrastructure patterns
- Maintainable fixture-based test organization
- Clear separation of test categories
- Validates both happy path and error scenarios

### Negative
- Browser tests are inherently slower than unit tests
- Requires Playwright browsers to be installed
- Flaky test potential due to timing-sensitive operations
- Additional maintenance burden for HTML fixtures

### Risks
- Browser version differences may cause test flakiness
- Complex dynamic element tests may be timing-sensitive
- Shadow DOM tests may have limited coverage due to encapsulation
- CI environment may differ from local development

## Implementation Notes

### File Locations
- Tests: `tests/browser-integration/element-interaction-tests/`
- Fixtures: `tests/browser-integration/element-interaction-tests/fixtures/`
- Utilities: `tests/browser-integration/utils/element-interaction-helpers.ts`
- ADR: `docs/adr/ADR-element-interaction-tests.md`

### Dependencies on Other Stages
- **Previous Stage (Planning)**: Restored from checkpoint - no explicit artifacts
- **Next Stage (Development)**: Will implement the test files per this architecture
- **Testing Stage**: Will verify all tests pass
- **Review Stage**: Will validate test coverage completeness

## References
- `packages/browser/src/browser-session.ts` - BrowserSession API
- `packages/orchestrator/src/tools/browser-tool.adr.md` - BrowserTool architecture
- `tests/browser-integration/setup.ts` - Existing test infrastructure
- `tests/browser-integration/utils/test-helpers.ts` - Existing test utilities
- `tests/browser-integration/hover-focus-interactions.integration.test.ts` - Pattern reference
- `tests/browser-integration/form-control-interactions.integration.test.ts` - Pattern reference
- `packages/browser/src/__tests__/element-interaction-actions.test.ts` - Unit test reference
