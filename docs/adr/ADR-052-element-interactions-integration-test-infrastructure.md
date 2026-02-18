# ADR-052: Element Interactions Integration Test Infrastructure

## Status
Proposed

## Context

The APEX project requires a comprehensive integration test infrastructure for DOM element interactions. The current testing setup includes browser automation capabilities via Playwright/Puppeteer, but lacks dedicated utilities specifically designed for testing element interactions in a standardized, reusable way.

### Current State Analysis

The project has extensive existing test infrastructure:

1. **`tests/test-utils/`** - Core test utilities package (`@apex/test-utils`)
   - `async.ts` - Async testing helpers (wait, waitFor, retry, etc.)
   - `assertions.ts` - Enhanced assertion utilities
   - `cleanup.ts` - Resource cleanup management
   - `context.ts` - Test context management
   - `browser-test-fixtures.ts` - Browser test page templates and scenarios

2. **`tests/browser-integration/`** - Browser automation integration tests
   - `setup.ts` - Global browser setup with Playwright
   - `utils/test-helpers.ts` - Browser-specific helpers
   - `fixtures/common-scenarios.ts` - Navigation and interaction scenarios

3. **`packages/browser/src/__tests__/`** - Element interaction tests
   - `element-interaction-actions.test.ts` - Click, type, scroll, hover, focus tests
   - `element-visibility-waiting.test.ts` - Visibility and waiting tests

### Gaps Identified

The acceptance criteria specify:
> Test infrastructure exists with helper utilities for creating DOM elements, waiting for conditions, and asserting element states. A sample test runs successfully.

While the project has robust browser automation, it lacks:
1. **Dedicated DOM element creation utilities** for unit/integration testing without full browser context
2. **Element state assertion helpers** specific to DOM interactions
3. **Standardized element fixture patterns** for consistent test writing
4. **A sample integration test** demonstrating the complete infrastructure

## Decision

### 1. Architecture Overview

Create a new module within `tests/test-utils/` for element interaction testing:

```
tests/test-utils/
├── element-interactions/
│   ├── index.ts                    # Main exports
│   ├── element-factory.ts          # DOM element creation utilities
│   ├── element-assertions.ts       # Element state assertion helpers
│   ├── element-fixtures.ts         # Pre-defined element fixtures
│   ├── wait-conditions.ts          # Condition waiting utilities
│   └── __tests__/
│       └── element-interactions.integration.test.ts  # Sample integration test
└── index.ts                        # Updated to export element-interactions
```

### 2. Component Design

#### 2.1 Element Factory (`element-factory.ts`)

Provides utilities for creating DOM elements for testing without requiring a full browser context.

```typescript
/**
 * @fileoverview DOM Element Factory for Integration Testing
 *
 * Provides utilities for creating DOM elements with various configurations
 * for testing element interactions in isolation.
 */

export interface ElementConfig {
  tag: string;
  id?: string;
  className?: string;
  attributes?: Record<string, string>;
  styles?: Record<string, string>;
  content?: string;
  children?: ElementConfig[];
  eventHandlers?: Record<string, (e: Event) => void>;
}

export interface FormElementConfig extends ElementConfig {
  type?: string;
  name?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
}

export interface InteractiveElementConfig extends ElementConfig {
  focusable?: boolean;
  clickable?: boolean;
  hoverable?: boolean;
  draggable?: boolean;
}

/**
 * Creates an HTML element from configuration
 */
export function createElement(config: ElementConfig): HTMLElement;

/**
 * Creates a form input element
 */
export function createFormElement(config: FormElementConfig): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Creates an interactive element (button, link, etc.)
 */
export function createInteractiveElement(config: InteractiveElementConfig): HTMLElement;

/**
 * Creates a complete form with multiple inputs
 */
export function createForm(fields: FormElementConfig[], formConfig?: ElementConfig): HTMLFormElement;

/**
 * Creates a container with child elements
 */
export function createContainer(children: ElementConfig[], containerConfig?: ElementConfig): HTMLDivElement;

/**
 * Creates an element with delayed appearance (for waiting tests)
 */
export function createDelayedElement(config: ElementConfig, delayMs: number): Promise<HTMLElement>;

/**
 * Creates a mock page context with document-like interface
 */
export function createMockDocument(): MockDocument;

export interface MockDocument {
  body: HTMLElement;
  getElementById(id: string): HTMLElement | null;
  querySelector(selector: string): HTMLElement | null;
  querySelectorAll(selector: string): NodeListOf<HTMLElement>;
  createElement(tag: string): HTMLElement;
  cleanup(): void;
}
```

#### 2.2 Element Assertions (`element-assertions.ts`)

Provides specialized assertions for element states.

```typescript
/**
 * @fileoverview Element State Assertion Utilities
 *
 * Provides assertion helpers specifically designed for DOM element testing.
 */

import { expect } from 'vitest';

export interface ElementStateOptions {
  timeout?: number;
  pollInterval?: number;
}

/**
 * Asserts element is visible in the DOM
 */
export function assertElementVisible(
  element: HTMLElement,
  message?: string
): void;

/**
 * Asserts element is hidden (display: none, visibility: hidden, or opacity: 0)
 */
export function assertElementHidden(
  element: HTMLElement,
  message?: string
): void;

/**
 * Asserts element is enabled (not disabled)
 */
export function assertElementEnabled(
  element: HTMLElement,
  message?: string
): void;

/**
 * Asserts element is disabled
 */
export function assertElementDisabled(
  element: HTMLElement,
  message?: string
): void;

/**
 * Asserts element has focus
 */
export function assertElementFocused(
  element: HTMLElement,
  message?: string
): void;

/**
 * Asserts element has specific text content
 */
export function assertElementText(
  element: HTMLElement,
  expectedText: string,
  options?: { exact?: boolean }
): void;

/**
 * Asserts element has specific attribute value
 */
export function assertElementAttribute(
  element: HTMLElement,
  attributeName: string,
  expectedValue: string | boolean
): void;

/**
 * Asserts element has specific CSS class
 */
export function assertElementHasClass(
  element: HTMLElement,
  className: string
): void;

/**
 * Asserts element does not have specific CSS class
 */
export function assertElementNotHasClass(
  element: HTMLElement,
  className: string
): void;

/**
 * Asserts element has specific computed style
 */
export function assertElementStyle(
  element: HTMLElement,
  property: string,
  expectedValue: string
): void;

/**
 * Asserts form input has specific value
 */
export function assertInputValue(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  expectedValue: string
): void;

/**
 * Asserts checkbox/radio is checked
 */
export function assertChecked(
  input: HTMLInputElement,
  expectedChecked?: boolean
): void;

/**
 * Asserts element is within viewport
 */
export function assertElementInViewport(
  element: HTMLElement,
  viewport?: { width: number; height: number }
): void;

/**
 * Asserts element dimensions
 */
export function assertElementDimensions(
  element: HTMLElement,
  expectedDimensions: {
    width?: number;
    height?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  }
): void;

/**
 * Asserts element position
 */
export function assertElementPosition(
  element: HTMLElement,
  expectedPosition: {
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
  },
  tolerance?: number
): void;
```

#### 2.3 Wait Conditions (`wait-conditions.ts`)

Utilities for waiting on element conditions.

```typescript
/**
 * @fileoverview Element Wait Condition Utilities
 *
 * Provides utilities for waiting on specific element conditions
 * to be met before proceeding with tests.
 */

export interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
  timeoutMessage?: string;
}

export const DEFAULT_WAIT_OPTIONS: WaitOptions = {
  timeout: 5000,
  pollInterval: 50,
};

/**
 * Waits for an element to appear in the DOM
 */
export function waitForElement(
  selector: string | (() => HTMLElement | null),
  options?: WaitOptions
): Promise<HTMLElement>;

/**
 * Waits for an element to become visible
 */
export function waitForVisible(
  element: HTMLElement | (() => HTMLElement | null),
  options?: WaitOptions
): Promise<void>;

/**
 * Waits for an element to become hidden
 */
export function waitForHidden(
  element: HTMLElement | (() => HTMLElement | null),
  options?: WaitOptions
): Promise<void>;

/**
 * Waits for an element to become enabled
 */
export function waitForEnabled(
  element: HTMLElement | (() => HTMLElement | null),
  options?: WaitOptions
): Promise<void>;

/**
 * Waits for an element to have specific text content
 */
export function waitForText(
  element: HTMLElement | (() => HTMLElement | null),
  expectedText: string | RegExp,
  options?: WaitOptions
): Promise<void>;

/**
 * Waits for an element to have specific attribute value
 */
export function waitForAttribute(
  element: HTMLElement | (() => HTMLElement | null),
  attributeName: string,
  expectedValue: string | null,
  options?: WaitOptions
): Promise<void>;

/**
 * Waits for a condition to be true
 */
export function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options?: WaitOptions
): Promise<void>;

/**
 * Waits for element to be stable (no changes for specified duration)
 */
export function waitForStable(
  element: HTMLElement,
  stabilityDuration?: number,
  options?: WaitOptions
): Promise<void>;

/**
 * Waits for element count to match expected
 */
export function waitForElementCount(
  selector: string,
  count: number,
  options?: WaitOptions
): Promise<NodeListOf<HTMLElement>>;

/**
 * Creates a condition that can be used with waitForCondition
 */
export function createCondition(
  check: () => boolean,
  description: string
): () => boolean;
```

#### 2.4 Element Fixtures (`element-fixtures.ts`)

Pre-defined element fixtures for common testing scenarios.

```typescript
/**
 * @fileoverview Pre-defined Element Fixtures for Testing
 *
 * Provides ready-to-use element configurations for common
 * testing scenarios.
 */

/**
 * Basic button fixtures
 */
export const buttonFixtures = {
  primary: {
    tag: 'button',
    className: 'btn btn-primary',
    content: 'Primary Button',
  },
  disabled: {
    tag: 'button',
    content: 'Disabled Button',
    attributes: { disabled: 'true' },
  },
  withIcon: {
    tag: 'button',
    className: 'btn-icon',
    content: '<span class="icon">+</span> Add Item',
  },
};

/**
 * Form input fixtures
 */
export const inputFixtures = {
  text: {
    tag: 'input',
    type: 'text',
    placeholder: 'Enter text...',
  },
  email: {
    tag: 'input',
    type: 'email',
    placeholder: 'email@example.com',
    attributes: { required: 'true' },
  },
  password: {
    tag: 'input',
    type: 'password',
    placeholder: 'Enter password',
  },
  checkbox: {
    tag: 'input',
    type: 'checkbox',
    name: 'terms',
  },
  radio: {
    tag: 'input',
    type: 'radio',
    name: 'option',
  },
};

/**
 * Container/layout fixtures
 */
export const containerFixtures = {
  modal: {
    tag: 'div',
    className: 'modal',
    styles: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '1000',
    },
  },
  dropdown: {
    tag: 'div',
    className: 'dropdown',
    styles: {
      position: 'absolute',
      display: 'none',
    },
  },
  tooltip: {
    tag: 'div',
    className: 'tooltip',
    styles: {
      position: 'absolute',
      visibility: 'hidden',
    },
  },
};

/**
 * Complete form fixtures
 */
export const formFixtures = {
  login: {
    fields: [
      { tag: 'input', type: 'text', name: 'username', placeholder: 'Username', required: true },
      { tag: 'input', type: 'password', name: 'password', placeholder: 'Password', required: true },
    ],
    submitText: 'Login',
  },
  contact: {
    fields: [
      { tag: 'input', type: 'text', name: 'name', placeholder: 'Full Name', required: true },
      { tag: 'input', type: 'email', name: 'email', placeholder: 'Email', required: true },
      { tag: 'textarea', name: 'message', placeholder: 'Your message...', required: true },
    ],
    submitText: 'Send Message',
  },
  search: {
    fields: [
      { tag: 'input', type: 'search', name: 'query', placeholder: 'Search...', required: true },
    ],
    submitText: 'Search',
  },
};

/**
 * Interactive element fixtures (for event testing)
 */
export const interactiveFixtures = {
  clickableDiv: {
    tag: 'div',
    className: 'clickable',
    content: 'Click me',
    styles: { cursor: 'pointer' },
    attributes: { tabindex: '0', role: 'button' },
  },
  draggableItem: {
    tag: 'div',
    className: 'draggable',
    content: 'Drag me',
    attributes: { draggable: 'true' },
  },
  collapsible: {
    tag: 'div',
    className: 'collapsible',
    content: 'Click to expand',
    attributes: { 'aria-expanded': 'false' },
  },
};

/**
 * State change fixtures (for testing transitions)
 */
export const stateChangeFixtures = {
  loading: {
    initial: { className: 'btn', content: 'Submit' },
    loading: { className: 'btn loading', content: 'Loading...' },
    success: { className: 'btn success', content: 'Done!' },
    error: { className: 'btn error', content: 'Failed' },
  },
  toggle: {
    off: { className: 'toggle', attributes: { 'aria-checked': 'false' } },
    on: { className: 'toggle active', attributes: { 'aria-checked': 'true' } },
  },
};

/**
 * Accessibility fixtures
 */
export const a11yFixtures = {
  labeledInput: {
    label: { tag: 'label', content: 'Email Address', attributes: { for: 'email' } },
    input: { tag: 'input', type: 'email', id: 'email', name: 'email' },
  },
  ariaButton: {
    tag: 'div',
    content: 'Custom Button',
    attributes: {
      role: 'button',
      tabindex: '0',
      'aria-pressed': 'false',
    },
  },
  liveRegion: {
    tag: 'div',
    attributes: {
      role: 'alert',
      'aria-live': 'polite',
    },
  },
};
```

### 3. Integration Test Sample

The sample integration test will demonstrate all components working together.

```typescript
/**
 * @fileoverview Element Interactions Integration Test
 *
 * Sample integration test demonstrating the element interactions
 * test infrastructure including:
 * - DOM element creation utilities
 * - Element state assertions
 * - Wait condition utilities
 * - Element fixtures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createElement,
  createFormElement,
  createInteractiveElement,
  createForm,
  createContainer,
  createDelayedElement,
  createMockDocument,
} from '../element-factory';
import {
  assertElementVisible,
  assertElementHidden,
  assertElementEnabled,
  assertElementDisabled,
  assertElementFocused,
  assertElementText,
  assertElementAttribute,
  assertInputValue,
  assertChecked,
} from '../element-assertions';
import {
  waitForElement,
  waitForVisible,
  waitForEnabled,
  waitForText,
  waitForCondition,
  waitForStable,
} from '../wait-conditions';
import {
  buttonFixtures,
  inputFixtures,
  formFixtures,
  interactiveFixtures,
} from '../element-fixtures';

describe('Element Interactions Integration Tests', () => {
  let mockDoc: ReturnType<typeof createMockDocument>;

  beforeEach(() => {
    mockDoc = createMockDocument();
  });

  afterEach(() => {
    mockDoc.cleanup();
    vi.clearAllMocks();
  });

  describe('Element Creation', () => {
    it('should create basic elements with configuration', () => {
      const button = createElement({
        tag: 'button',
        id: 'test-btn',
        className: 'btn primary',
        content: 'Click Me',
        attributes: { 'data-action': 'submit' },
      });

      expect(button.tagName).toBe('BUTTON');
      expect(button.id).toBe('test-btn');
      expect(button.className).toBe('btn primary');
      expect(button.textContent).toBe('Click Me');
      expect(button.getAttribute('data-action')).toBe('submit');
    });

    it('should create form elements with appropriate attributes', () => {
      const input = createFormElement({
        tag: 'input',
        type: 'email',
        name: 'email',
        placeholder: 'Enter email',
        required: true,
      });

      expect(input.type).toBe('email');
      expect(input.name).toBe('email');
      expect(input.placeholder).toBe('Enter email');
      expect(input.required).toBe(true);
    });

    it('should create complete forms from fixtures', () => {
      const form = createForm(
        formFixtures.login.fields as any,
        { id: 'login-form' }
      );

      expect(form.tagName).toBe('FORM');
      expect(form.querySelectorAll('input').length).toBe(2);
      expect(form.querySelector('input[name="username"]')).not.toBeNull();
      expect(form.querySelector('input[name="password"]')).not.toBeNull();
    });

    it('should create containers with nested children', () => {
      const container = createContainer([
        { tag: 'h1', content: 'Title' },
        { tag: 'p', content: 'Description' },
        { tag: 'button', content: 'Action' },
      ], { className: 'card' });

      expect(container.className).toBe('card');
      expect(container.children.length).toBe(3);
      expect(container.querySelector('h1')?.textContent).toBe('Title');
    });
  });

  describe('Element Assertions', () => {
    it('should assert element visibility states', () => {
      const visible = createElement({ tag: 'div', content: 'Visible' });
      const hidden = createElement({
        tag: 'div',
        content: 'Hidden',
        styles: { display: 'none' },
      });

      assertElementVisible(visible);
      assertElementHidden(hidden);
    });

    it('should assert element enabled/disabled states', () => {
      const enabled = createFormElement({ tag: 'input', type: 'text' });
      const disabled = createFormElement({
        tag: 'input',
        type: 'text',
        disabled: true,
      });

      assertElementEnabled(enabled);
      assertElementDisabled(disabled);
    });

    it('should assert element text content', () => {
      const element = createElement({
        tag: 'span',
        content: 'Hello World',
      });

      assertElementText(element, 'Hello World', { exact: true });
      assertElementText(element, 'Hello');
    });

    it('should assert input values', () => {
      const input = createFormElement({
        tag: 'input',
        type: 'text',
        value: 'test value',
      });

      assertInputValue(input as HTMLInputElement, 'test value');
    });

    it('should assert checkbox checked state', () => {
      const unchecked = createFormElement({
        tag: 'input',
        type: 'checkbox',
      }) as HTMLInputElement;

      const checked = createFormElement({
        tag: 'input',
        type: 'checkbox',
        attributes: { checked: 'true' },
      }) as HTMLInputElement;
      checked.checked = true;

      assertChecked(unchecked, false);
      assertChecked(checked, true);
    });
  });

  describe('Wait Conditions', () => {
    it('should wait for element to appear', async () => {
      let element: HTMLElement | null = null;

      // Simulate delayed element creation
      setTimeout(() => {
        element = createElement({ tag: 'div', id: 'delayed' });
        mockDoc.body.appendChild(element);
      }, 100);

      const found = await waitForElement(
        () => mockDoc.getElementById('delayed'),
        { timeout: 1000 }
      );

      expect(found).toBeDefined();
      expect(found.id).toBe('delayed');
    });

    it('should wait for element to become visible', async () => {
      const element = createElement({
        tag: 'div',
        id: 'fade-in',
        styles: { display: 'none' },
      });
      mockDoc.body.appendChild(element);

      // Simulate visibility change
      setTimeout(() => {
        element.style.display = 'block';
      }, 100);

      await waitForVisible(element, { timeout: 1000 });

      expect(element.style.display).toBe('block');
    });

    it('should wait for condition to be true', async () => {
      let counter = 0;

      // Increment counter over time
      const interval = setInterval(() => {
        counter++;
        if (counter >= 5) clearInterval(interval);
      }, 50);

      await waitForCondition(
        () => counter >= 5,
        { timeout: 1000 }
      );

      expect(counter).toBeGreaterThanOrEqual(5);
    });

    it('should wait for text content to change', async () => {
      const element = createElement({
        tag: 'span',
        id: 'status',
        content: 'Loading...',
      });

      setTimeout(() => {
        element.textContent = 'Complete';
      }, 100);

      await waitForText(element, 'Complete', { timeout: 1000 });

      expect(element.textContent).toBe('Complete');
    });
  });

  describe('Fixture Usage', () => {
    it('should use button fixtures correctly', () => {
      const primary = createElement(buttonFixtures.primary);
      const disabled = createElement(buttonFixtures.disabled);

      expect(primary.className).toContain('btn-primary');
      expect(disabled.getAttribute('disabled')).toBe('true');
    });

    it('should use input fixtures correctly', () => {
      const emailInput = createFormElement(inputFixtures.email as any);
      const checkbox = createFormElement(inputFixtures.checkbox as any);

      expect((emailInput as HTMLInputElement).type).toBe('email');
      expect((checkbox as HTMLInputElement).type).toBe('checkbox');
    });

    it('should use interactive fixtures for event testing', () => {
      const clickable = createElement(interactiveFixtures.clickableDiv);

      expect(clickable.getAttribute('tabindex')).toBe('0');
      expect(clickable.getAttribute('role')).toBe('button');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle form interaction flow', async () => {
      // Create a login form
      const form = createForm(
        formFixtures.login.fields as any,
        { id: 'test-login-form' }
      );
      mockDoc.body.appendChild(form);

      // Get form elements
      const usernameInput = form.querySelector('input[name="username"]') as HTMLInputElement;
      const passwordInput = form.querySelector('input[name="password"]') as HTMLInputElement;

      // Verify initial state
      assertElementEnabled(usernameInput);
      assertElementEnabled(passwordInput);
      assertInputValue(usernameInput, '');

      // Simulate user input
      usernameInput.value = 'testuser';
      passwordInput.value = 'password123';

      // Verify input values
      assertInputValue(usernameInput, 'testuser');
      assertInputValue(passwordInput, 'password123');
    });

    it('should handle element state transitions', async () => {
      const button = createElement({
        tag: 'button',
        id: 'submit-btn',
        content: 'Submit',
        className: 'btn',
      });
      mockDoc.body.appendChild(button);

      // Initial state
      assertElementText(button, 'Submit');
      assertElementEnabled(button);

      // Simulate loading state
      button.textContent = 'Loading...';
      button.setAttribute('disabled', 'true');
      button.className = 'btn loading';

      assertElementText(button, 'Loading...');
      assertElementDisabled(button);

      // Simulate success state
      button.textContent = 'Success!';
      button.removeAttribute('disabled');
      button.className = 'btn success';

      await waitForText(button, 'Success!');
      assertElementEnabled(button);
    });

    it('should handle dynamic element creation and removal', async () => {
      const container = createContainer([], { id: 'dynamic-container' });
      mockDoc.body.appendChild(container);

      // Create elements dynamically
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const item = createElement({
            tag: 'div',
            className: 'list-item',
            content: `Item ${i + 1}`,
          });
          container.appendChild(item);
        }, i * 100);
      }

      // Wait for all items to be added
      await waitForCondition(
        () => container.querySelectorAll('.list-item').length === 3,
        { timeout: 1000 }
      );

      expect(container.children.length).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should timeout when element never appears', async () => {
      await expect(
        waitForElement(
          () => mockDoc.getElementById('nonexistent'),
          { timeout: 200, timeoutMessage: 'Element not found' }
        )
      ).rejects.toThrow('Element not found');
    });

    it('should handle assertion failures gracefully', () => {
      const element = createElement({
        tag: 'div',
        styles: { display: 'none' },
      });

      expect(() => assertElementVisible(element)).toThrow();
    });
  });
});
```

### 4. Package Integration

Update `tests/test-utils/package.json` exports:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./element-interactions": {
      "types": "./dist/element-interactions/index.d.ts",
      "import": "./dist/element-interactions/index.js"
    }
  }
}
```

### 5. Test Configuration

The integration tests should:
- Use Vitest with jsdom environment for DOM simulation
- Be included in the main test suite via `npm run test`
- Support both isolated testing and browser-based testing

```typescript
// In vitest.config.ts, ensure jsdom support:
environmentMatchGlobs: [
  ['**/element-interactions/**', 'jsdom'],
]
```

## Consequences

### Positive

1. **Reusable Infrastructure**: Element creation, assertion, and waiting utilities can be used across all test files
2. **Consistent Testing Patterns**: Standardized fixtures ensure consistent test writing
3. **Isolated Testing**: Can test DOM interactions without full browser context
4. **Better Documentation**: Fixtures serve as documentation for expected element structures
5. **Improved Test Coverage**: Dedicated utilities make it easier to test edge cases

### Negative

1. **Learning Curve**: Developers need to learn the new utility APIs
2. **Maintenance Overhead**: New module requires ongoing maintenance
3. **JSDOM Limitations**: Some browser-specific behaviors may not be captured in jsdom

### Mitigations

1. **Comprehensive Examples**: Sample integration test demonstrates all features
2. **JSDoc Documentation**: All utilities are documented with JSDoc
3. **Browser Integration Path**: Existing browser-integration tests remain for full browser testing

## Implementation Notes for Developer Stage

### Files to Create

1. `tests/test-utils/element-interactions/index.ts` - Main exports
2. `tests/test-utils/element-interactions/element-factory.ts` - Element creation
3. `tests/test-utils/element-interactions/element-assertions.ts` - Assertions
4. `tests/test-utils/element-interactions/element-fixtures.ts` - Fixtures
5. `tests/test-utils/element-interactions/wait-conditions.ts` - Wait utilities
6. `tests/test-utils/element-interactions/__tests__/element-interactions.integration.test.ts` - Sample test

### Files to Modify

1. `tests/test-utils/package.json` - Add exports
2. `tests/test-utils/index.ts` - Re-export element-interactions module
3. `vitest.config.ts` - Ensure jsdom environment for element-interactions tests

### Test Verification

After implementation:
1. Run `npm run build` - Must pass
2. Run `npm run test` - All tests must pass including new integration test
3. Verify the sample test demonstrates all acceptance criteria:
   - Helper utilities for creating DOM elements
   - Waiting for conditions
   - Asserting element states

## Related ADRs

- ADR-045: Error Recovery Integration Tests (testing patterns)
- Browser integration setup (`tests/browser-integration/setup.ts`)
- Existing element interaction tests (`packages/browser/src/__tests__/element-interaction-actions.test.ts`)

## References

- [Vitest Testing Library](https://vitest.dev/)
- [Testing Library principles](https://testing-library.com/docs/guiding-principles/)
- [JSDOM](https://github.com/jsdom/jsdom)
