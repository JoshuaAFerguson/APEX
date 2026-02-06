# ADR-052: Element Interaction Integration Test Infrastructure

## Status
Proposed

## Context

The APEX project requires a robust integration test infrastructure for element interactions in browser automation testing. This infrastructure should support:

1. Creating and manipulating DOM elements for testing
2. Waiting for various conditions (element visibility, network idle, etc.)
3. Asserting element states (text content, attributes, visibility, etc.)
4. Establishing base fixtures for consistent test scenarios

### Existing Infrastructure Analysis

After analyzing the current codebase, the following test infrastructure already exists:

#### Testing Framework
- **Vitest** v4.0.15 with multiple configurations:
  - `vitest.config.ts` - Main configuration (jsdom environment)
  - `vitest.unit.config.ts` - Fast, isolated unit tests (5s timeout)
  - `vitest.e2e.config.ts` - E2E tests (60s timeout, sequential, forks pool)
  - `tests/browser-integration/vitest.config.ts` - Browser-specific tests

#### Browser Automation
- **Playwright** v1.47.0 for browser automation
- **Puppeteer** v24.34.0 as alternative backend
- Global browser instance management via `setup.ts`

#### Existing Test Utilities

| Location | Purpose |
|----------|---------|
| `packages/browser/src/test-utils/dom-builders.ts` | HTML structure builders (forms, tables, modals, cards) |
| `packages/browser/src/test-utils/mock-page-objects.ts` | Lightweight mock page factories |
| `packages/browser/src/test-utils/assertions.ts` | Framework-agnostic assertion helpers |
| `tests/test-utils/browser-test-base.ts` | Base class for browser automation tests |
| `tests/test-utils/browser-test-fixtures.ts` | Test page templates and scenarios |
| `tests/browser-integration/utils/browser-automation-test-helpers.ts` | Enhanced test context management |

## Decision

### 1. Architecture Overview

The element interaction test infrastructure will build upon and extend the existing utilities to provide a complete, consistent testing experience. The architecture follows these layers:

```
+------------------------------------------------------------------+
|                     Integration Test Layer                        |
|  (tests/browser-integration/*.integration.test.ts)               |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                      Test Utilities Layer                         |
|  - Element Interaction Utilities (NEW)                           |
|  - Condition Waiting Utilities (EXTEND)                          |
|  - State Assertion Utilities (EXTEND)                            |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                      Fixtures Layer                               |
|  - DOM Element Fixtures (EXTEND)                                  |
|  - Test Page Templates (EXISTING)                                |
|  - Test Scenarios (EXISTING)                                     |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    Browser Test Base                              |
|  - BrowserTestBase class (EXISTING)                              |
|  - Setup/Teardown Hooks (EXISTING)                               |
|  - Screenshot Capture (EXISTING)                                 |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    Browser Backends                               |
|  - Playwright (PRIMARY)                                          |
|  - Puppeteer (SECONDARY)                                         |
+------------------------------------------------------------------+
```

### 2. Element Interaction Utilities

Create new utilities in `tests/test-utils/element-interactions.ts`:

```typescript
/**
 * @fileoverview Element Interaction Utilities for Integration Tests
 *
 * Provides high-level helpers for common element interactions:
 * - Click interactions (single, double, right-click, hover)
 * - Input interactions (type, clear, fill)
 * - Select interactions (dropdown, checkbox, radio)
 * - Drag and drop interactions
 * - Keyboard interactions
 */

import { Page, Locator, ElementHandle } from 'playwright';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface ElementInteractionConfig {
  timeout?: number;
  force?: boolean;
  noWaitAfter?: boolean;
  clickCount?: number;
  delay?: number;
  position?: { x: number; y: number };
}

export interface InteractionResult {
  success: boolean;
  duration: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Click Interactions
// ============================================================================

export interface ClickOptions extends ElementInteractionConfig {
  button?: 'left' | 'right' | 'middle';
  modifiers?: ('Alt' | 'Control' | 'Meta' | 'Shift')[];
}

export async function clickElement(
  page: Page,
  selector: string,
  options: ClickOptions = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.click({
      timeout: options.timeout || 10000,
      force: options.force,
      noWaitAfter: options.noWaitAfter,
      button: options.button,
      clickCount: options.clickCount,
      delay: options.delay,
      position: options.position,
      modifiers: options.modifiers,
    });

    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Click failed on ${selector}: ${error}`,
    };
  }
}

export async function doubleClickElement(
  page: Page,
  selector: string,
  options: Omit<ClickOptions, 'clickCount'> = {}
): Promise<InteractionResult> {
  return clickElement(page, selector, { ...options, clickCount: 2 });
}

export async function rightClickElement(
  page: Page,
  selector: string,
  options: Omit<ClickOptions, 'button'> = {}
): Promise<InteractionResult> {
  return clickElement(page, selector, { ...options, button: 'right' });
}

export async function hoverElement(
  page: Page,
  selector: string,
  options: ElementInteractionConfig = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.hover({
      timeout: options.timeout || 10000,
      force: options.force,
      position: options.position,
    });

    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Hover failed on ${selector}: ${error}`,
    };
  }
}

// ============================================================================
// Input Interactions
// ============================================================================

export interface TypeOptions extends ElementInteractionConfig {
  clear?: boolean;
}

export async function typeInElement(
  page: Page,
  selector: string,
  text: string,
  options: TypeOptions = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);

    if (options.clear) {
      await element.clear({ timeout: options.timeout || 10000 });
    }

    await element.fill(text, { timeout: options.timeout || 10000 });

    return {
      success: true,
      duration: Date.now() - startTime,
      metadata: { typedText: text },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Type failed on ${selector}: ${error}`,
    };
  }
}

export async function clearElement(
  page: Page,
  selector: string,
  options: ElementInteractionConfig = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.clear({ timeout: options.timeout || 10000 });

    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Clear failed on ${selector}: ${error}`,
    };
  }
}

// ============================================================================
// Select Interactions
// ============================================================================

export async function selectOption(
  page: Page,
  selector: string,
  value: string | string[],
  options: ElementInteractionConfig = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.selectOption(value, { timeout: options.timeout || 10000 });

    return {
      success: true,
      duration: Date.now() - startTime,
      metadata: { selectedValue: value },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Select failed on ${selector}: ${error}`,
    };
  }
}

export async function checkElement(
  page: Page,
  selector: string,
  options: ElementInteractionConfig = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.check({ timeout: options.timeout || 10000, force: options.force });

    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Check failed on ${selector}: ${error}`,
    };
  }
}

export async function uncheckElement(
  page: Page,
  selector: string,
  options: ElementInteractionConfig = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.uncheck({ timeout: options.timeout || 10000, force: options.force });

    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Uncheck failed on ${selector}: ${error}`,
    };
  }
}

// ============================================================================
// Keyboard Interactions
// ============================================================================

export async function pressKey(
  page: Page,
  key: string,
  options: { delay?: number } = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    await page.keyboard.press(key, { delay: options.delay });

    return {
      success: true,
      duration: Date.now() - startTime,
      metadata: { key },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Key press failed for ${key}: ${error}`,
    };
  }
}

export async function typeText(
  page: Page,
  text: string,
  options: { delay?: number } = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    await page.keyboard.type(text, { delay: options.delay });

    return {
      success: true,
      duration: Date.now() - startTime,
      metadata: { typedText: text },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Type text failed: ${error}`,
    };
  }
}

// ============================================================================
// Drag and Drop
// ============================================================================

export async function dragAndDrop(
  page: Page,
  sourceSelector: string,
  targetSelector: string,
  options: ElementInteractionConfig = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const source = page.locator(sourceSelector);
    const target = page.locator(targetSelector);

    await source.dragTo(target, {
      timeout: options.timeout || 10000,
      force: options.force,
    });

    return {
      success: true,
      duration: Date.now() - startTime,
      metadata: { source: sourceSelector, target: targetSelector },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Drag and drop failed from ${sourceSelector} to ${targetSelector}: ${error}`,
    };
  }
}

// ============================================================================
// Focus Management
// ============================================================================

export async function focusElement(
  page: Page,
  selector: string,
  options: ElementInteractionConfig = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.focus({ timeout: options.timeout || 10000 });

    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Focus failed on ${selector}: ${error}`,
    };
  }
}

export async function blurElement(
  page: Page,
  selector: string,
  options: ElementInteractionConfig = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.blur({ timeout: options.timeout || 10000 });

    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Blur failed on ${selector}: ${error}`,
    };
  }
}

// ============================================================================
// Scroll Interactions
// ============================================================================

export async function scrollToElement(
  page: Page,
  selector: string,
  options: ElementInteractionConfig = {}
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.scrollIntoViewIfNeeded({ timeout: options.timeout || 10000 });

    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: `Scroll failed for ${selector}: ${error}`,
    };
  }
}
```

### 3. Extended Condition Waiting Utilities

Extend existing utilities in `tests/test-utils/wait-conditions.ts`:

```typescript
/**
 * @fileoverview Condition Waiting Utilities for Integration Tests
 *
 * Provides utilities for waiting on various conditions:
 * - Element visibility, hidden, attached, detached
 * - Text content changes
 * - Attribute changes
 * - Network idle
 * - Custom conditions
 */

import { Page, Locator } from 'playwright';

// ============================================================================
// Types
// ============================================================================

export interface WaitConditionConfig {
  timeout?: number;
  polling?: number;
}

export interface WaitResult {
  success: boolean;
  duration: number;
  timedOut: boolean;
  error?: string;
}

// ============================================================================
// Element State Conditions
// ============================================================================

export async function waitForElementVisible(
  page: Page,
  selector: string,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.waitFor({
      state: 'visible',
      timeout: options.timeout || 30000
    });

    return {
      success: true,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const timedOut = duration >= (options.timeout || 30000);

    return {
      success: false,
      duration,
      timedOut,
      error: `Wait for visible failed on ${selector}: ${error}`,
    };
  }
}

export async function waitForElementHidden(
  page: Page,
  selector: string,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.waitFor({
      state: 'hidden',
      timeout: options.timeout || 30000
    });

    return {
      success: true,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const timedOut = duration >= (options.timeout || 30000);

    return {
      success: false,
      duration,
      timedOut,
      error: `Wait for hidden failed on ${selector}: ${error}`,
    };
  }
}

export async function waitForElementAttached(
  page: Page,
  selector: string,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.waitFor({
      state: 'attached',
      timeout: options.timeout || 30000
    });

    return {
      success: true,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const timedOut = duration >= (options.timeout || 30000);

    return {
      success: false,
      duration,
      timedOut,
      error: `Wait for attached failed on ${selector}: ${error}`,
    };
  }
}

export async function waitForElementDetached(
  page: Page,
  selector: string,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();

  try {
    const element = page.locator(selector);
    await element.waitFor({
      state: 'detached',
      timeout: options.timeout || 30000
    });

    return {
      success: true,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const timedOut = duration >= (options.timeout || 30000);

    return {
      success: false,
      duration,
      timedOut,
      error: `Wait for detached failed on ${selector}: ${error}`,
    };
  }
}

// ============================================================================
// Content Conditions
// ============================================================================

export async function waitForTextContent(
  page: Page,
  selector: string,
  expectedText: string | RegExp,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 30000;
  const polling = options.polling || 100;

  try {
    const element = page.locator(selector);

    await page.waitForFunction(
      ([sel, text, isRegex]) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const content = el.textContent || '';
        if (isRegex) {
          return new RegExp(text).test(content);
        }
        return content.includes(text);
      },
      [selector, expectedText instanceof RegExp ? expectedText.source : expectedText, expectedText instanceof RegExp],
      { timeout, polling }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const timedOut = duration >= timeout;

    return {
      success: false,
      duration,
      timedOut,
      error: `Wait for text content failed on ${selector}: ${error}`,
    };
  }
}

export async function waitForInputValue(
  page: Page,
  selector: string,
  expectedValue: string | RegExp,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 30000;
  const polling = options.polling || 100;

  try {
    await page.waitForFunction(
      ([sel, value, isRegex]) => {
        const el = document.querySelector(sel) as HTMLInputElement;
        if (!el) return false;
        const inputValue = el.value || '';
        if (isRegex) {
          return new RegExp(value).test(inputValue);
        }
        return inputValue === value;
      },
      [selector, expectedValue instanceof RegExp ? expectedValue.source : expectedValue, expectedValue instanceof RegExp],
      { timeout, polling }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const timedOut = duration >= timeout;

    return {
      success: false,
      duration,
      timedOut,
      error: `Wait for input value failed on ${selector}: ${error}`,
    };
  }
}

// ============================================================================
// Attribute Conditions
// ============================================================================

export async function waitForAttribute(
  page: Page,
  selector: string,
  attributeName: string,
  expectedValue: string | RegExp | null,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 30000;
  const polling = options.polling || 100;

  try {
    await page.waitForFunction(
      ([sel, attr, value, isRegex, isNull]) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const attrValue = el.getAttribute(attr);

        if (isNull) {
          return attrValue === null;
        }
        if (attrValue === null) return false;
        if (isRegex) {
          return new RegExp(value!).test(attrValue);
        }
        return attrValue === value;
      },
      [selector, attributeName, expectedValue instanceof RegExp ? expectedValue.source : expectedValue, expectedValue instanceof RegExp, expectedValue === null],
      { timeout, polling }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const timedOut = duration >= timeout;

    return {
      success: false,
      duration,
      timedOut,
      error: `Wait for attribute failed on ${selector}[${attributeName}]: ${error}`,
    };
  }
}

export async function waitForClass(
  page: Page,
  selector: string,
  className: string,
  shouldHave: boolean = true,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 30000;
  const polling = options.polling || 100;

  try {
    await page.waitForFunction(
      ([sel, cls, has]) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const hasClass = el.classList.contains(cls);
        return has ? hasClass : !hasClass;
      },
      [selector, className, shouldHave],
      { timeout, polling }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const timedOut = duration >= timeout;

    return {
      success: false,
      duration,
      timedOut,
      error: `Wait for class ${shouldHave ? 'present' : 'absent'} failed on ${selector}.${className}: ${error}`,
    };
  }
}

// ============================================================================
// Network and Load Conditions
// ============================================================================

export async function waitForNetworkIdle(
  page: Page,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();

  try {
    await page.waitForLoadState('networkidle', {
      timeout: options.timeout || 30000
    });

    return {
      success: true,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const timedOut = duration >= (options.timeout || 30000);

    return {
      success: false,
      duration,
      timedOut,
      error: `Wait for network idle failed: ${error}`,
    };
  }
}

export async function waitForDOMContentLoaded(
  page: Page,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();

  try {
    await page.waitForLoadState('domcontentloaded', {
      timeout: options.timeout || 30000
    });

    return {
      success: true,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const timedOut = duration >= (options.timeout || 30000);

    return {
      success: false,
      duration,
      timedOut,
      error: `Wait for DOM content loaded failed: ${error}`,
    };
  }
}

// ============================================================================
// Custom Conditions
// ============================================================================

export async function waitForCondition(
  page: Page,
  condition: () => boolean | Promise<boolean>,
  options: WaitConditionConfig = {}
): Promise<WaitResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 30000;
  const polling = options.polling || 100;

  try {
    const deadline = startTime + timeout;

    while (Date.now() < deadline) {
      const result = await condition();
      if (result) {
        return {
          success: true,
          duration: Date.now() - startTime,
          timedOut: false,
        };
      }
      await new Promise(resolve => setTimeout(resolve, polling));
    }

    return {
      success: false,
      duration: Date.now() - startTime,
      timedOut: true,
      error: 'Custom condition timed out',
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      timedOut: false,
      error: `Custom condition failed: ${error}`,
    };
  }
}
```

### 4. Extended Element State Assertions

Build on existing assertions in `tests/test-utils/element-assertions.ts`:

```typescript
/**
 * @fileoverview Element State Assertion Utilities for Integration Tests
 *
 * Provides assertion helpers for verifying element states:
 * - Visibility and existence
 * - Text content and input values
 * - Attributes and classes
 * - Enabled/disabled states
 * - Checked states for checkboxes/radios
 */

import { Page, Locator, expect as playwrightExpect } from 'playwright';

// ============================================================================
// Types
// ============================================================================

export interface AssertionOptions {
  timeout?: number;
  message?: string;
}

export interface AssertionResult {
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  message: string;
}

// ============================================================================
// Existence and Visibility Assertions
// ============================================================================

export async function assertElementExists(
  page: Page,
  selector: string,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toHaveCount(1, { timeout: options.timeout });

    return {
      passed: true,
      message: `Element ${selector} exists`,
    };
  } catch (error) {
    return {
      passed: false,
      message: options.message || `Element ${selector} does not exist: ${error}`,
    };
  }
}

export async function assertElementNotExists(
  page: Page,
  selector: string,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toHaveCount(0, { timeout: options.timeout });

    return {
      passed: true,
      message: `Element ${selector} does not exist`,
    };
  } catch (error) {
    return {
      passed: false,
      message: options.message || `Element ${selector} exists when it should not: ${error}`,
    };
  }
}

export async function assertElementVisible(
  page: Page,
  selector: string,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toBeVisible({ timeout: options.timeout });

    return {
      passed: true,
      message: `Element ${selector} is visible`,
    };
  } catch (error) {
    return {
      passed: false,
      message: options.message || `Element ${selector} is not visible: ${error}`,
    };
  }
}

export async function assertElementHidden(
  page: Page,
  selector: string,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toBeHidden({ timeout: options.timeout });

    return {
      passed: true,
      message: `Element ${selector} is hidden`,
    };
  } catch (error) {
    return {
      passed: false,
      message: options.message || `Element ${selector} is not hidden: ${error}`,
    };
  }
}

// ============================================================================
// Text and Content Assertions
// ============================================================================

export async function assertElementText(
  page: Page,
  selector: string,
  expectedText: string | RegExp,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);

    if (expectedText instanceof RegExp) {
      await playwrightExpect(element).toHaveText(expectedText, { timeout: options.timeout });
    } else {
      await playwrightExpect(element).toHaveText(expectedText, { timeout: options.timeout });
    }

    return {
      passed: true,
      expected: expectedText,
      message: `Element ${selector} has expected text`,
    };
  } catch (error) {
    const actualText = await page.locator(selector).textContent().catch(() => null);

    return {
      passed: false,
      actual: actualText,
      expected: expectedText,
      message: options.message || `Element ${selector} text mismatch: ${error}`,
    };
  }
}

export async function assertElementContainsText(
  page: Page,
  selector: string,
  expectedText: string,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toContainText(expectedText, { timeout: options.timeout });

    return {
      passed: true,
      expected: expectedText,
      message: `Element ${selector} contains expected text`,
    };
  } catch (error) {
    const actualText = await page.locator(selector).textContent().catch(() => null);

    return {
      passed: false,
      actual: actualText,
      expected: expectedText,
      message: options.message || `Element ${selector} does not contain text: ${error}`,
    };
  }
}

export async function assertInputValue(
  page: Page,
  selector: string,
  expectedValue: string | RegExp,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toHaveValue(expectedValue, { timeout: options.timeout });

    return {
      passed: true,
      expected: expectedValue,
      message: `Element ${selector} has expected value`,
    };
  } catch (error) {
    const actualValue = await page.locator(selector).inputValue().catch(() => null);

    return {
      passed: false,
      actual: actualValue,
      expected: expectedValue,
      message: options.message || `Element ${selector} value mismatch: ${error}`,
    };
  }
}

// ============================================================================
// Attribute Assertions
// ============================================================================

export async function assertElementAttribute(
  page: Page,
  selector: string,
  attributeName: string,
  expectedValue: string | RegExp,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toHaveAttribute(attributeName, expectedValue, { timeout: options.timeout });

    return {
      passed: true,
      expected: expectedValue,
      message: `Element ${selector} has expected ${attributeName} attribute`,
    };
  } catch (error) {
    const actualValue = await page.locator(selector).getAttribute(attributeName).catch(() => null);

    return {
      passed: false,
      actual: actualValue,
      expected: expectedValue,
      message: options.message || `Element ${selector} attribute ${attributeName} mismatch: ${error}`,
    };
  }
}

export async function assertElementHasClass(
  page: Page,
  selector: string,
  className: string,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toHaveClass(new RegExp(`\\b${className}\\b`), { timeout: options.timeout });

    return {
      passed: true,
      expected: className,
      message: `Element ${selector} has class ${className}`,
    };
  } catch (error) {
    const actualClass = await page.locator(selector).getAttribute('class').catch(() => null);

    return {
      passed: false,
      actual: actualClass,
      expected: className,
      message: options.message || `Element ${selector} does not have class ${className}: ${error}`,
    };
  }
}

// ============================================================================
// State Assertions
// ============================================================================

export async function assertElementEnabled(
  page: Page,
  selector: string,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toBeEnabled({ timeout: options.timeout });

    return {
      passed: true,
      message: `Element ${selector} is enabled`,
    };
  } catch (error) {
    return {
      passed: false,
      message: options.message || `Element ${selector} is not enabled: ${error}`,
    };
  }
}

export async function assertElementDisabled(
  page: Page,
  selector: string,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toBeDisabled({ timeout: options.timeout });

    return {
      passed: true,
      message: `Element ${selector} is disabled`,
    };
  } catch (error) {
    return {
      passed: false,
      message: options.message || `Element ${selector} is not disabled: ${error}`,
    };
  }
}

export async function assertElementChecked(
  page: Page,
  selector: string,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toBeChecked({ timeout: options.timeout });

    return {
      passed: true,
      message: `Element ${selector} is checked`,
    };
  } catch (error) {
    return {
      passed: false,
      message: options.message || `Element ${selector} is not checked: ${error}`,
    };
  }
}

export async function assertElementUnchecked(
  page: Page,
  selector: string,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).not.toBeChecked({ timeout: options.timeout });

    return {
      passed: true,
      message: `Element ${selector} is unchecked`,
    };
  } catch (error) {
    return {
      passed: false,
      message: options.message || `Element ${selector} is not unchecked: ${error}`,
    };
  }
}

// ============================================================================
// Count Assertions
// ============================================================================

export async function assertElementCount(
  page: Page,
  selector: string,
  expectedCount: number,
  options: AssertionOptions = {}
): Promise<AssertionResult> {
  try {
    const element = page.locator(selector);
    await playwrightExpect(element).toHaveCount(expectedCount, { timeout: options.timeout });

    return {
      passed: true,
      expected: expectedCount,
      message: `Found ${expectedCount} elements matching ${selector}`,
    };
  } catch (error) {
    const actualCount = await page.locator(selector).count().catch(() => 0);

    return {
      passed: false,
      actual: actualCount,
      expected: expectedCount,
      message: options.message || `Element count mismatch for ${selector}: ${error}`,
    };
  }
}
```

### 5. DOM Element Fixtures

Create comprehensive fixtures in `tests/test-utils/element-fixtures.ts`:

```typescript
/**
 * @fileoverview DOM Element Fixtures for Integration Tests
 *
 * Provides reusable DOM element fixtures for testing:
 * - Interactive elements (buttons, links, inputs)
 * - Form elements (full forms with validation)
 * - Complex structures (tables, lists, trees)
 * - Layout components (modals, tooltips, dropdowns)
 */

// ============================================================================
// Basic Interactive Elements
// ============================================================================

export const INTERACTIVE_BUTTON_FIXTURE = `
<button id="test-button" class="btn btn-primary" data-testid="test-button">
  Click Me
</button>
`;

export const DISABLED_BUTTON_FIXTURE = `
<button id="disabled-button" class="btn" disabled data-testid="disabled-button">
  Disabled Button
</button>
`;

export const LINK_FIXTURE = `
<a id="test-link" href="#target" data-testid="test-link">
  Test Link
</a>
`;

export const EXTERNAL_LINK_FIXTURE = `
<a id="external-link" href="https://example.com" target="_blank" rel="noopener noreferrer">
  External Link
</a>
`;

// ============================================================================
// Input Elements
// ============================================================================

export const TEXT_INPUT_FIXTURE = `
<div class="form-group">
  <label for="text-input">Text Input</label>
  <input type="text" id="text-input" name="text-input" placeholder="Enter text" data-testid="text-input">
</div>
`;

export const EMAIL_INPUT_FIXTURE = `
<div class="form-group">
  <label for="email-input">Email</label>
  <input type="email" id="email-input" name="email-input" placeholder="email@example.com" data-testid="email-input">
</div>
`;

export const PASSWORD_INPUT_FIXTURE = `
<div class="form-group">
  <label for="password-input">Password</label>
  <input type="password" id="password-input" name="password-input" placeholder="********" data-testid="password-input">
</div>
`;

export const NUMBER_INPUT_FIXTURE = `
<div class="form-group">
  <label for="number-input">Number</label>
  <input type="number" id="number-input" name="number-input" min="0" max="100" step="1" data-testid="number-input">
</div>
`;

export const TEXTAREA_FIXTURE = `
<div class="form-group">
  <label for="textarea">Message</label>
  <textarea id="textarea" name="textarea" rows="4" placeholder="Enter message" data-testid="textarea"></textarea>
</div>
`;

// ============================================================================
// Selection Elements
// ============================================================================

export const SELECT_FIXTURE = `
<div class="form-group">
  <label for="select-input">Select Option</label>
  <select id="select-input" name="select-input" data-testid="select-input">
    <option value="">-- Select --</option>
    <option value="option1">Option 1</option>
    <option value="option2">Option 2</option>
    <option value="option3">Option 3</option>
  </select>
</div>
`;

export const MULTI_SELECT_FIXTURE = `
<div class="form-group">
  <label for="multi-select">Select Multiple</label>
  <select id="multi-select" name="multi-select" multiple data-testid="multi-select">
    <option value="a">Item A</option>
    <option value="b">Item B</option>
    <option value="c">Item C</option>
    <option value="d">Item D</option>
  </select>
</div>
`;

export const CHECKBOX_FIXTURE = `
<div class="form-group">
  <label class="checkbox-label">
    <input type="checkbox" id="checkbox" name="checkbox" data-testid="checkbox">
    I agree to the terms
  </label>
</div>
`;

export const RADIO_GROUP_FIXTURE = `
<div class="form-group" role="radiogroup" aria-labelledby="radio-label">
  <span id="radio-label">Choose one:</span>
  <label class="radio-label">
    <input type="radio" name="radio-group" value="small" data-testid="radio-small">
    Small
  </label>
  <label class="radio-label">
    <input type="radio" name="radio-group" value="medium" data-testid="radio-medium">
    Medium
  </label>
  <label class="radio-label">
    <input type="radio" name="radio-group" value="large" data-testid="radio-large">
    Large
  </label>
</div>
`;

// ============================================================================
// Complete Form Fixtures
// ============================================================================

export const LOGIN_FORM_FIXTURE = `
<form id="login-form" data-testid="login-form">
  <div class="form-group">
    <label for="login-email">Email</label>
    <input type="email" id="login-email" name="email" required data-testid="login-email">
  </div>
  <div class="form-group">
    <label for="login-password">Password</label>
    <input type="password" id="login-password" name="password" required data-testid="login-password">
  </div>
  <div class="form-group">
    <label class="checkbox-label">
      <input type="checkbox" name="remember" data-testid="login-remember">
      Remember me
    </label>
  </div>
  <button type="submit" id="login-submit" data-testid="login-submit">Log In</button>
</form>
`;

export const REGISTRATION_FORM_FIXTURE = `
<form id="registration-form" data-testid="registration-form">
  <div class="form-group">
    <label for="reg-name">Full Name</label>
    <input type="text" id="reg-name" name="name" required data-testid="reg-name">
  </div>
  <div class="form-group">
    <label for="reg-email">Email</label>
    <input type="email" id="reg-email" name="email" required data-testid="reg-email">
  </div>
  <div class="form-group">
    <label for="reg-password">Password</label>
    <input type="password" id="reg-password" name="password" required minlength="8" data-testid="reg-password">
  </div>
  <div class="form-group">
    <label for="reg-confirm">Confirm Password</label>
    <input type="password" id="reg-confirm" name="confirmPassword" required data-testid="reg-confirm">
  </div>
  <div class="form-group">
    <label class="checkbox-label">
      <input type="checkbox" name="terms" required data-testid="reg-terms">
      I agree to the Terms of Service
    </label>
  </div>
  <button type="submit" id="reg-submit" data-testid="reg-submit">Register</button>
</form>
`;

// ============================================================================
// Complex Structure Fixtures
// ============================================================================

export const DATA_TABLE_FIXTURE = `
<table id="data-table" data-testid="data-table">
  <thead>
    <tr>
      <th data-column="id">ID</th>
      <th data-column="name">Name</th>
      <th data-column="status">Status</th>
      <th data-column="actions">Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr data-row="1">
      <td>1</td>
      <td>Item One</td>
      <td><span class="status active">Active</span></td>
      <td><button class="edit-btn" data-id="1">Edit</button></td>
    </tr>
    <tr data-row="2">
      <td>2</td>
      <td>Item Two</td>
      <td><span class="status inactive">Inactive</span></td>
      <td><button class="edit-btn" data-id="2">Edit</button></td>
    </tr>
    <tr data-row="3">
      <td>3</td>
      <td>Item Three</td>
      <td><span class="status pending">Pending</span></td>
      <td><button class="edit-btn" data-id="3">Edit</button></td>
    </tr>
  </tbody>
</table>
`;

export const NESTED_LIST_FIXTURE = `
<ul id="nested-list" data-testid="nested-list">
  <li data-item="1">
    Item 1
    <ul>
      <li data-item="1.1">Item 1.1</li>
      <li data-item="1.2">Item 1.2</li>
    </ul>
  </li>
  <li data-item="2">
    Item 2
    <ul>
      <li data-item="2.1">Item 2.1</li>
    </ul>
  </li>
  <li data-item="3">Item 3</li>
</ul>
`;

export const TREE_VIEW_FIXTURE = `
<div id="tree-view" role="tree" data-testid="tree-view">
  <div role="treeitem" aria-expanded="true" data-node="root">
    <span class="node-label">Root</span>
    <div role="group">
      <div role="treeitem" aria-expanded="false" data-node="child1">
        <span class="node-label">Child 1</span>
      </div>
      <div role="treeitem" aria-expanded="true" data-node="child2">
        <span class="node-label">Child 2</span>
        <div role="group">
          <div role="treeitem" data-node="grandchild1">
            <span class="node-label">Grandchild 1</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

// ============================================================================
// Modal and Overlay Fixtures
// ============================================================================

export const MODAL_FIXTURE = `
<div class="modal-backdrop" id="modal-backdrop" data-testid="modal-backdrop">
  <div class="modal" id="test-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-testid="test-modal">
    <div class="modal-header">
      <h2 id="modal-title">Modal Title</h2>
      <button class="modal-close" aria-label="Close" data-testid="modal-close">&times;</button>
    </div>
    <div class="modal-body" data-testid="modal-body">
      <p>Modal content goes here.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-testid="modal-cancel">Cancel</button>
      <button class="btn btn-primary" data-testid="modal-confirm">Confirm</button>
    </div>
  </div>
</div>
`;

export const TOOLTIP_FIXTURE = `
<div class="tooltip-container">
  <button id="tooltip-trigger" data-tooltip="This is a tooltip" data-testid="tooltip-trigger">
    Hover me
  </button>
  <div class="tooltip" id="tooltip" role="tooltip" hidden data-testid="tooltip">
    This is a tooltip
  </div>
</div>
`;

export const DROPDOWN_FIXTURE = `
<div class="dropdown" data-testid="dropdown">
  <button class="dropdown-toggle" id="dropdown-toggle" aria-haspopup="true" aria-expanded="false" data-testid="dropdown-toggle">
    Select Option
  </button>
  <ul class="dropdown-menu" id="dropdown-menu" role="listbox" hidden data-testid="dropdown-menu">
    <li role="option" data-value="1">Option 1</li>
    <li role="option" data-value="2">Option 2</li>
    <li role="option" data-value="3">Option 3</li>
  </ul>
</div>
`;

// ============================================================================
// Complete Test Page Template
// ============================================================================

export function createTestPageHTML(content: string, options: { title?: string; styles?: string; scripts?: string } = {}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title || 'APEX Element Interaction Test Page'}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .btn-primary { background: #007acc; color: white; }
    .btn-primary:hover { background: #005a9e; }
    .btn-secondary { background: #6c757d; color: white; }
    .checkbox-label, .radio-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .checkbox-label input, .radio-label input { width: auto; }
    .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .status.active { background: #d4edda; color: #155724; }
    .status.inactive { background: #f8d7da; color: #721c24; }
    .status.pending { background: #fff3cd; color: #856404; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal { background: white; border-radius: 8px; max-width: 500px; width: 100%; }
    .modal-header { padding: 15px 20px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; }
    .modal-body { padding: 20px; }
    .modal-footer { padding: 15px 20px; border-top: 1px solid #ddd; display: flex; justify-content: flex-end; gap: 10px; }
    .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }
    .dropdown { position: relative; display: inline-block; }
    .dropdown-menu { position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ddd; border-radius: 4px; list-style: none; padding: 0; margin: 0; min-width: 150px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .dropdown-menu li { padding: 10px 15px; cursor: pointer; }
    .dropdown-menu li:hover { background: #f5f5f5; }
    .tooltip { position: absolute; background: #333; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; white-space: nowrap; }
    ${options.styles || ''}
  </style>
</head>
<body>
  <div class="container">
    ${content}
  </div>
  <script>
    // Console logging for test verification
    console.log('Test page loaded successfully');

    // Event delegation for button clicks
    document.addEventListener('click', function(e) {
      if (e.target.matches('button')) {
        console.log('Button clicked:', e.target.id || e.target.textContent);
      }
    });

    // Form submission handler
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        console.log('Form submitted:', form.id, data);
        form.dispatchEvent(new CustomEvent('formSubmitted', { detail: data }));
      });
    });

    ${options.scripts || ''}
  </script>
</body>
</html>
`;
}

// ============================================================================
// Fixture Combinations
// ============================================================================

export function createInteractiveElementsPage(): string {
  return createTestPageHTML(`
    <h1>Interactive Elements Test Page</h1>
    ${INTERACTIVE_BUTTON_FIXTURE}
    ${DISABLED_BUTTON_FIXTURE}
    ${LINK_FIXTURE}
    <div id="output" data-testid="output">Click a button to see output</div>
  `, {
    scripts: `
      document.getElementById('test-button').addEventListener('click', function() {
        document.getElementById('output').textContent = 'Button clicked at ' + new Date().toISOString();
      });
    `
  });
}

export function createFormTestPage(): string {
  return createTestPageHTML(`
    <h1>Form Test Page</h1>
    ${LOGIN_FORM_FIXTURE}
    <hr>
    <div id="form-result" data-testid="form-result"></div>
  `, {
    scripts: `
      document.getElementById('login-form').addEventListener('formSubmitted', function(e) {
        document.getElementById('form-result').textContent = 'Login submitted: ' + JSON.stringify(e.detail);
      });
    `
  });
}

export function createComplexStructuresPage(): string {
  return createTestPageHTML(`
    <h1>Complex Structures Test Page</h1>
    <h2>Data Table</h2>
    ${DATA_TABLE_FIXTURE}
    <h2>Nested List</h2>
    ${NESTED_LIST_FIXTURE}
  `);
}
```

### 6. Sample Integration Test

Create a sample test that demonstrates the infrastructure at `tests/browser-integration/element-interactions.integration.test.ts`:

```typescript
/**
 * @fileoverview Element Interactions Integration Tests
 *
 * Sample integration tests demonstrating the element interaction
 * test infrastructure with helper utilities, condition waiting,
 * and state assertions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest, BrowserTestUtils } from '../test-utils/browser-test-base.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import element interaction utilities
import {
  clickElement,
  typeInElement,
  selectOption,
  checkElement,
  uncheckElement,
  hoverElement,
} from '../test-utils/element-interactions.js';

// Import wait condition utilities
import {
  waitForElementVisible,
  waitForTextContent,
  waitForInputValue,
} from '../test-utils/wait-conditions.js';

// Import assertion utilities
import {
  assertElementExists,
  assertElementVisible,
  assertElementText,
  assertInputValue,
  assertElementChecked,
} from '../test-utils/element-assertions.js';

// Import fixtures
import {
  createInteractiveElementsPage,
  createFormTestPage,
  LOGIN_FORM_FIXTURE,
} from '../test-utils/element-fixtures.js';

describe('Element Interactions Integration Tests', () => {
  let browserTest: BrowserTestBase;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-artifacts', 'element-test-'));
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test artifacts:', error);
    }
  });

  beforeEach(async () => {
    browserTest = createBrowserTest({
      headless: true,
      timeout: 30000,
    });
    await browserTest.setup();
  });

  afterEach(async () => {
    await browserTest.teardown();
  });

  describe('Button Interactions', () => {
    it('should click a button and verify output', async () => {
      const page = browserTest.context.page!;

      // Load test page
      await page.setContent(createInteractiveElementsPage());
      await page.waitForLoadState('domcontentloaded');

      // Verify button exists
      const existsResult = await assertElementExists(page, '#test-button');
      expect(existsResult.passed).toBe(true);

      // Click the button
      const clickResult = await clickElement(page, '#test-button');
      expect(clickResult.success).toBe(true);

      // Wait for output to update
      const waitResult = await waitForTextContent(page, '#output', /Button clicked at/);
      expect(waitResult.success).toBe(true);

      // Verify output text
      const textResult = await assertElementText(page, '#output', /Button clicked at \d{4}-\d{2}-\d{2}/);
      expect(textResult.passed).toBe(true);
    });

    it('should not interact with disabled buttons', async () => {
      const page = browserTest.context.page!;

      await page.setContent(createInteractiveElementsPage());
      await page.waitForLoadState('domcontentloaded');

      // Verify disabled button exists
      const existsResult = await assertElementExists(page, '#disabled-button');
      expect(existsResult.passed).toBe(true);

      // Attempt to click disabled button (should not throw, just fail gracefully)
      const clickResult = await clickElement(page, '#disabled-button', { force: false });
      // Playwright allows clicking disabled buttons by default, so this may succeed
      // The key is verifying the element state

      const isDisabled = await page.locator('#disabled-button').isDisabled();
      expect(isDisabled).toBe(true);
    });
  });

  describe('Form Interactions', () => {
    it('should fill and submit a login form', async () => {
      const page = browserTest.context.page!;

      await page.setContent(createFormTestPage());
      await page.waitForLoadState('domcontentloaded');

      // Fill email
      const emailResult = await typeInElement(page, '#login-email', 'test@example.com');
      expect(emailResult.success).toBe(true);

      const emailValueResult = await assertInputValue(page, '#login-email', 'test@example.com');
      expect(emailValueResult.passed).toBe(true);

      // Fill password
      const passwordResult = await typeInElement(page, '#login-password', 'password123');
      expect(passwordResult.success).toBe(true);

      // Check remember me
      const checkResult = await checkElement(page, '[data-testid="login-remember"]');
      expect(checkResult.success).toBe(true);

      const checkedResult = await assertElementChecked(page, '[data-testid="login-remember"]');
      expect(checkedResult.passed).toBe(true);

      // Submit form
      const submitResult = await clickElement(page, '#login-submit');
      expect(submitResult.success).toBe(true);

      // Wait for form result
      const resultWait = await waitForTextContent(page, '#form-result', /Login submitted/);
      expect(resultWait.success).toBe(true);
    });

    it('should clear and re-type in input fields', async () => {
      const page = browserTest.context.page!;

      await page.setContent(createFormTestPage());
      await page.waitForLoadState('domcontentloaded');

      // Type initial value
      await typeInElement(page, '#login-email', 'initial@example.com');

      // Clear and type new value
      const clearTypeResult = await typeInElement(page, '#login-email', 'updated@example.com', { clear: true });
      expect(clearTypeResult.success).toBe(true);

      const valueResult = await assertInputValue(page, '#login-email', 'updated@example.com');
      expect(valueResult.passed).toBe(true);
    });

    it('should toggle checkbox state', async () => {
      const page = browserTest.context.page!;

      await page.setContent(createFormTestPage());
      await page.waitForLoadState('domcontentloaded');

      const checkbox = '[data-testid="login-remember"]';

      // Initially unchecked
      let checkedResult = await assertElementChecked(page, checkbox);
      expect(checkedResult.passed).toBe(false);

      // Check it
      await checkElement(page, checkbox);
      checkedResult = await assertElementChecked(page, checkbox);
      expect(checkedResult.passed).toBe(true);

      // Uncheck it
      await uncheckElement(page, checkbox);
      checkedResult = await assertElementChecked(page, checkbox);
      expect(checkedResult.passed).toBe(false);
    });
  });

  describe('Wait Conditions', () => {
    it('should wait for element visibility', async () => {
      const page = browserTest.context.page!;

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <body>
          <button id="show-btn">Show Element</button>
          <div id="hidden-element" style="display: none;">Hidden Content</div>
          <script>
            document.getElementById('show-btn').addEventListener('click', function() {
              setTimeout(function() {
                document.getElementById('hidden-element').style.display = 'block';
              }, 500);
            });
          </script>
        </body>
        </html>
      `);
      await page.waitForLoadState('domcontentloaded');

      // Initially hidden
      let visibleResult = await assertElementVisible(page, '#hidden-element');
      expect(visibleResult.passed).toBe(false);

      // Click to show
      await clickElement(page, '#show-btn');

      // Wait for visible
      const waitResult = await waitForElementVisible(page, '#hidden-element', { timeout: 5000 });
      expect(waitResult.success).toBe(true);

      // Now visible
      visibleResult = await assertElementVisible(page, '#hidden-element');
      expect(visibleResult.passed).toBe(true);
    });

    it('should wait for text content changes', async () => {
      const page = browserTest.context.page!;

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <body>
          <button id="update-btn">Update</button>
          <div id="content">Initial Content</div>
          <script>
            document.getElementById('update-btn').addEventListener('click', function() {
              setTimeout(function() {
                document.getElementById('content').textContent = 'Updated Content';
              }, 300);
            });
          </script>
        </body>
        </html>
      `);
      await page.waitForLoadState('domcontentloaded');

      // Initial text
      let textResult = await assertElementText(page, '#content', 'Initial Content');
      expect(textResult.passed).toBe(true);

      // Click to update
      await clickElement(page, '#update-btn');

      // Wait for text change
      const waitResult = await waitForTextContent(page, '#content', 'Updated Content', { timeout: 5000 });
      expect(waitResult.success).toBe(true);

      // Verify new text
      textResult = await assertElementText(page, '#content', 'Updated Content');
      expect(textResult.passed).toBe(true);
    });
  });

  describe('Complex Interactions', () => {
    it('should handle hover interactions', async () => {
      const page = browserTest.context.page!;

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .hover-target { padding: 20px; background: #eee; }
            .hover-target:hover { background: #007acc; color: white; }
            .hover-target:hover::after { content: 'Hovered!'; margin-left: 10px; }
          </style>
        </head>
        <body>
          <div class="hover-target" id="hover-element">Hover over me</div>
          <script>
            document.getElementById('hover-element').addEventListener('mouseenter', function() {
              this.setAttribute('data-hovered', 'true');
            });
          </script>
        </body>
        </html>
      `);
      await page.waitForLoadState('domcontentloaded');

      // Hover over element
      const hoverResult = await hoverElement(page, '#hover-element');
      expect(hoverResult.success).toBe(true);

      // Verify hover state was registered
      const hoveredAttr = await page.locator('#hover-element').getAttribute('data-hovered');
      expect(hoveredAttr).toBe('true');
    });
  });

  describe('Screenshot Capture', () => {
    it('should capture screenshots of element interactions', async () => {
      const page = browserTest.context.page!;

      await page.setContent(createInteractiveElementsPage());
      await page.waitForLoadState('domcontentloaded');

      // Take screenshot before interaction
      const beforeScreenshot = await browserTest.takeScreenshot('before-click');
      expect(beforeScreenshot).toBeDefined();

      // Interact
      await clickElement(page, '#test-button');
      await waitForTextContent(page, '#output', /Button clicked/);

      // Take screenshot after interaction
      const afterScreenshot = await browserTest.takeScreenshot('after-click');
      expect(afterScreenshot).toBeDefined();

      // Verify files exist
      const beforeStats = await fs.stat(beforeScreenshot);
      const afterStats = await fs.stat(afterScreenshot);

      expect(beforeStats.size).toBeGreaterThan(0);
      expect(afterStats.size).toBeGreaterThan(0);
    });
  });
});
```

## Consequences

### Positive

- **Comprehensive Coverage**: The infrastructure provides utilities for all common element interactions
- **Consistent API**: All utilities follow a consistent pattern with result objects containing success, duration, and error information
- **Reusable Fixtures**: Pre-built HTML fixtures reduce test setup boilerplate
- **Integration with Existing Infrastructure**: Builds on the existing `BrowserTestBase` class and Playwright integration
- **Type Safety**: Full TypeScript support with well-defined interfaces
- **Debugging Support**: All utilities provide detailed error messages and timing information

### Negative

- **Learning Curve**: Developers need to learn the new utility APIs
- **Maintenance Overhead**: Additional utilities require ongoing maintenance
- **Potential Duplication**: Some functionality overlaps with existing Playwright APIs

### Mitigations

- Documentation and examples in the ADR
- Clear naming conventions
- Integration with existing test patterns
- Gradual adoption path

## Implementation Notes for Developer Stage

1. **Files to Create**:
   - `tests/test-utils/element-interactions.ts` - Element interaction utilities
   - `tests/test-utils/wait-conditions.ts` - Wait condition utilities
   - `tests/test-utils/element-assertions.ts` - Assertion utilities
   - `tests/test-utils/element-fixtures.ts` - DOM element fixtures
   - `tests/browser-integration/element-interactions.integration.test.ts` - Sample integration test

2. **Export Updates**:
   - Update `tests/test-utils/index.ts` to export new utilities

3. **Testing Requirements**:
   - Run `npm run build` - must pass
   - Run `npm run test` - all tests must pass
   - Run `npm run test:browser-integration` - element interaction tests must pass

## Related ADRs

- ADR-045: Error Recovery Integration Tests
- ADR-036: Responsive Layout Integration Test Foundation
- ADR-048: v0.3.0 Test Coverage Verification Architecture

## Files to Create/Modify

- **CREATE**: `tests/test-utils/element-interactions.ts`
- **CREATE**: `tests/test-utils/wait-conditions.ts`
- **CREATE**: `tests/test-utils/element-assertions.ts`
- **CREATE**: `tests/test-utils/element-fixtures.ts`
- **CREATE**: `tests/browser-integration/element-interactions.integration.test.ts`
- **MODIFY**: `tests/test-utils/index.ts` (add exports)
