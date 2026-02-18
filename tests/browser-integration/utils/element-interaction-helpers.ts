/**
 * @fileoverview Comprehensive Element Interaction Utilities
 *
 * This file provides comprehensive utilities for DOM element interactions in browser tests:
 * - Element creation and manipulation utilities
 * - Advanced wait conditions and state assertions
 * - Interactive element testing helpers
 * - Form interaction and validation utilities
 * - Element state comparison and verification
 *
 * These utilities complement the existing browser automation infrastructure
 * and provide a complete foundation for element interaction testing.
 */

import { Page, Locator, ElementHandle } from 'playwright';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ElementInteractionOptions {
  timeout?: number;
  retries?: number;
  delay?: number;
  force?: boolean;
  waitForStable?: boolean;
  scrollIntoView?: boolean;
  highlightElement?: boolean;
}

export interface ElementState {
  visible: boolean;
  enabled: boolean;
  focused: boolean;
  selected?: boolean;
  checked?: boolean;
  value: string;
  text: string;
  tagName: string;
  attributes: Record<string, string | null>;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  computedStyles: Record<string, string>;
  classes: string[];
}

export interface WaitCondition {
  condition: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'focused' | 'stable' | 'text-contains' | 'attribute-equals' | 'custom';
  value?: string | number | boolean;
  attribute?: string;
  customFn?: (element: ElementHandle) => Promise<boolean>;
  timeout?: number;
}

export interface FormField {
  selector: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file';
  value: string | boolean | string[];
  label?: string;
  required?: boolean;
  validation?: (value: any) => boolean | string;
}

export interface ElementAssertion {
  type: 'text' | 'attribute' | 'class' | 'style' | 'state' | 'count' | 'position';
  expected: any;
  actual?: any;
  selector?: string;
  attribute?: string;
  property?: string;
  tolerance?: number;
}

// ============================================================================
// Element Creation and Management Utilities
// ============================================================================

/**
 * Creates a DOM element with specified properties for testing
 */
export async function createElement(
  page: Page,
  config: {
    tag: string;
    id?: string;
    className?: string;
    attributes?: Record<string, string>;
    styles?: Record<string, string>;
    text?: string;
    html?: string;
    parent?: string;
  }
): Promise<ElementHandle> {
  const element = await page.evaluateHandle((config) => {
    const element = document.createElement(config.tag);

    if (config.id) element.id = config.id;
    if (config.className) element.className = config.className;

    if (config.attributes) {
      Object.entries(config.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

    if (config.styles) {
      Object.entries(config.styles).forEach(([key, value]) => {
        (element.style as any)[key] = value;
      });
    }

    if (config.text) element.textContent = config.text;
    if (config.html) element.innerHTML = config.html;

    const parent = config.parent
      ? document.querySelector(config.parent)
      : document.body;

    if (parent) {
      parent.appendChild(element);
    }

    return element;
  }, config);

  return element as ElementHandle;
}

/**
 * Creates multiple test elements based on a template
 */
export async function createElementCollection(
  page: Page,
  template: {
    tag: string;
    baseId: string;
    className?: string;
    count: number;
    attributes?: Record<string, string>;
    parent?: string;
  }
): Promise<ElementHandle[]> {
  const elements: ElementHandle[] = [];

  for (let i = 0; i < template.count; i++) {
    const element = await createElement(page, {
      tag: template.tag,
      id: `${template.baseId}-${i}`,
      className: template.className,
      attributes: {
        ...template.attributes,
        'data-index': i.toString(),
        'data-test-element': 'true'
      },
      parent: template.parent
    });
    elements.push(element);
  }

  return elements;
}

/**
 * Creates a complex form structure for testing
 */
export async function createTestForm(
  page: Page,
  formConfig: {
    id: string;
    fields: FormField[];
    submitButton?: boolean;
    resetButton?: boolean;
    parent?: string;
  }
): Promise<{ form: ElementHandle; fields: Record<string, ElementHandle> }> {
  const formElement = await createElement(page, {
    tag: 'form',
    id: formConfig.id,
    attributes: { 'data-test-form': 'true' },
    parent: formConfig.parent
  });

  const fields: Record<string, ElementHandle> = {};

  for (const fieldConfig of formConfig.fields) {
    let fieldElement: ElementHandle;

    switch (fieldConfig.type) {
      case 'textarea':
        fieldElement = await createElement(page, {
          tag: 'textarea',
          id: `${formConfig.id}-${fieldConfig.selector.replace('#', '')}`,
          attributes: {
            name: fieldConfig.selector.replace('#', ''),
            placeholder: fieldConfig.label || '',
            required: fieldConfig.required ? 'true' : 'false'
          },
          parent: `#${formConfig.id}`
        });
        break;

      case 'select':
        fieldElement = await createElement(page, {
          tag: 'select',
          id: `${formConfig.id}-${fieldConfig.selector.replace('#', '')}`,
          attributes: {
            name: fieldConfig.selector.replace('#', ''),
            required: fieldConfig.required ? 'true' : 'false'
          },
          parent: `#${formConfig.id}`
        });

        // Add options
        if (Array.isArray(fieldConfig.value)) {
          await page.evaluate((selectId, options) => {
            const select = document.getElementById(selectId) as HTMLSelectElement;
            options.forEach((optValue: string) => {
              const option = document.createElement('option');
              option.value = optValue;
              option.textContent = optValue;
              select.appendChild(option);
            });
          }, `${formConfig.id}-${fieldConfig.selector.replace('#', '')}`, fieldConfig.value);
        }
        break;

      default:
        fieldElement = await createElement(page, {
          tag: 'input',
          id: `${formConfig.id}-${fieldConfig.selector.replace('#', '')}`,
          attributes: {
            type: fieldConfig.type,
            name: fieldConfig.selector.replace('#', ''),
            placeholder: fieldConfig.label || '',
            required: fieldConfig.required ? 'true' : 'false'
          },
          parent: `#${formConfig.id}`
        });
    }

    fields[fieldConfig.selector] = fieldElement;
  }

  // Add submit button
  if (formConfig.submitButton) {
    await createElement(page, {
      tag: 'button',
      id: `${formConfig.id}-submit`,
      attributes: { type: 'submit' },
      text: 'Submit',
      parent: `#${formConfig.id}`
    });
  }

  // Add reset button
  if (formConfig.resetButton) {
    await createElement(page, {
      tag: 'button',
      id: `${formConfig.id}-reset`,
      attributes: { type: 'reset' },
      text: 'Reset',
      parent: `#${formConfig.id}`
    });
  }

  return { form: formElement, fields };
}

// ============================================================================
// Advanced Wait Conditions and State Management
// ============================================================================

/**
 * Waits for multiple conditions to be met on an element
 */
export async function waitForConditions(
  page: Page,
  selector: string,
  conditions: WaitCondition[]
): Promise<boolean> {
  const timeout = Math.max(...conditions.map(c => c.timeout || 30000));

  return await page.waitForFunction(
    ({ selector, conditions }) => {
      const element = document.querySelector(selector) as HTMLElement;
      if (!element) return false;

      return conditions.every(condition => {
        const computedStyle = window.getComputedStyle(element);

        switch (condition.condition) {
          case 'visible':
            return computedStyle.display !== 'none' &&
                   computedStyle.visibility !== 'hidden' &&
                   element.offsetParent !== null;

          case 'hidden':
            return computedStyle.display === 'none' ||
                   computedStyle.visibility === 'hidden' ||
                   element.offsetParent === null;

          case 'enabled':
            return !(element as any).disabled;

          case 'disabled':
            return (element as any).disabled === true;

          case 'focused':
            return document.activeElement === element;

          case 'stable':
            // Check if element position and size haven't changed in last 100ms
            const rect = element.getBoundingClientRect();
            const lastRect = (element as any)._lastStableRect;
            if (!lastRect) {
              (element as any)._lastStableRect = rect;
              (element as any)._stableCheckTime = Date.now();
              return false;
            }

            const isStable = rect.x === lastRect.x &&
                           rect.y === lastRect.y &&
                           rect.width === lastRect.width &&
                           rect.height === lastRect.height;

            if (isStable && Date.now() - (element as any)._stableCheckTime > 100) {
              return true;
            }

            (element as any)._lastStableRect = rect;
            return false;

          case 'text-contains':
            return element.textContent?.includes(condition.value as string) || false;

          case 'attribute-equals':
            return element.getAttribute(condition.attribute!) === condition.value;

          default:
            return true;
        }
      });
    },
    { selector, conditions },
    { timeout }
  );
}

/**
 * Gets comprehensive element state information
 */
export async function getElementState(
  page: Page,
  selector: string
): Promise<ElementState | null> {
  return await page.evaluate((selector) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) return null;

    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    // Get all attributes
    const attributes: Record<string, string | null> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }

    // Get computed styles (key properties)
    const computedStyles: Record<string, string> = {
      display: computedStyle.display,
      visibility: computedStyle.visibility,
      opacity: computedStyle.opacity,
      position: computedStyle.position,
      backgroundColor: computedStyle.backgroundColor,
      color: computedStyle.color,
      fontSize: computedStyle.fontSize,
      fontFamily: computedStyle.fontFamily,
      border: computedStyle.border,
      margin: computedStyle.margin,
      padding: computedStyle.padding,
      zIndex: computedStyle.zIndex
    };

    return {
      visible: computedStyle.display !== 'none' &&
               computedStyle.visibility !== 'hidden' &&
               element.offsetParent !== null,
      enabled: !(element as any).disabled,
      focused: document.activeElement === element,
      selected: (element as any).selected,
      checked: (element as any).checked,
      value: (element as any).value || '',
      text: element.textContent || '',
      tagName: element.tagName.toLowerCase(),
      attributes,
      boundingBox: rect.width > 0 && rect.height > 0 ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      } : null,
      computedStyles,
      classes: Array.from(element.classList)
    };
  }, selector);
}

/**
 * Compares two element states for changes
 */
export function compareElementStates(
  state1: ElementState,
  state2: ElementState,
  options: { tolerance?: number; ignoreProperties?: string[] } = {}
): { changed: boolean; differences: string[] } {
  const differences: string[] = [];
  const ignore = new Set(options.ignoreProperties || []);
  const tolerance = options.tolerance || 0;

  // Check basic properties
  const basicProps = ['visible', 'enabled', 'focused', 'selected', 'checked', 'value', 'text', 'tagName'];
  for (const prop of basicProps) {
    if (ignore.has(prop)) continue;

    if ((state1 as any)[prop] !== (state2 as any)[prop]) {
      differences.push(`${prop}: ${(state1 as any)[prop]} → ${(state2 as any)[prop]}`);
    }
  }

  // Check bounding box changes
  if (!ignore.has('boundingBox')) {
    const box1 = state1.boundingBox;
    const box2 = state2.boundingBox;

    if (box1 && box2) {
      if (Math.abs(box1.x - box2.x) > tolerance ||
          Math.abs(box1.y - box2.y) > tolerance ||
          Math.abs(box1.width - box2.width) > tolerance ||
          Math.abs(box1.height - box2.height) > tolerance) {
        differences.push(`boundingBox: (${box1.x},${box1.y},${box1.width}x${box1.height}) → (${box2.x},${box2.y},${box2.width}x${box2.height})`);
      }
    } else if (box1 !== box2) {
      differences.push(`boundingBox: ${box1 ? 'visible' : 'null'} → ${box2 ? 'visible' : 'null'}`);
    }
  }

  // Check class changes
  if (!ignore.has('classes')) {
    const classes1 = new Set(state1.classes);
    const classes2 = new Set(state2.classes);

    const added = Array.from(classes2).filter(c => !classes1.has(c));
    const removed = Array.from(classes1).filter(c => !classes2.has(c));

    if (added.length || removed.length) {
      differences.push(`classes: +[${added.join(',')}] -[${removed.join(',')}]`);
    }
  }

  return { changed: differences.length > 0, differences };
}

// ============================================================================
// Interactive Element Testing Helpers
// ============================================================================

/**
 * Performs a comprehensive click interaction with validation
 */
export async function performClick(
  page: Page,
  selector: string,
  options: ElementInteractionOptions & {
    expectedChanges?: string[];
    validateClick?: boolean;
    captureBeforeState?: boolean;
  } = {}
): Promise<{ success: boolean; beforeState?: ElementState; afterState?: ElementState; changes?: string[] }> {
  const beforeState = options.captureBeforeState ? await getElementState(page, selector) : undefined;

  // Wait for element to be ready
  if (options.waitForStable) {
    await waitForConditions(page, selector, [
      { condition: 'visible', timeout: options.timeout },
      { condition: 'enabled', timeout: options.timeout },
      { condition: 'stable', timeout: options.timeout }
    ]);
  }

  // Highlight element if requested
  if (options.highlightElement) {
    await page.evaluate((selector) => {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        element.style.outline = '3px solid red';
        element.style.outlineOffset = '2px';
        setTimeout(() => {
          element.style.outline = '';
          element.style.outlineOffset = '';
        }, 1000);
      }
    }, selector);
  }

  // Perform the click
  const clickOptions: any = {
    timeout: options.timeout || 30000,
    force: options.force,
  };

  if (options.delay) {
    clickOptions.delay = options.delay;
  }

  let success = false;
  let error: string | undefined;

  try {
    if (options.scrollIntoView) {
      await page.locator(selector).scrollIntoViewIfNeeded();
    }

    await page.click(selector, clickOptions);
    success = true;
  } catch (e) {
    error = `Click failed: ${e}`;
    success = false;
  }

  const afterState = options.captureBeforeState && beforeState ? await getElementState(page, selector) : undefined;

  let changes: string[] | undefined;
  if (beforeState && afterState) {
    const comparison = compareElementStates(beforeState, afterState);
    changes = comparison.differences;
  }

  return { success, beforeState, afterState, changes };
}

/**
 * Performs advanced text input with validation
 */
export async function performTextInput(
  page: Page,
  selector: string,
  text: string,
  options: ElementInteractionOptions & {
    clearFirst?: boolean;
    appendText?: boolean;
    validateInput?: boolean;
    expectedValue?: string;
    typeDelay?: number;
  } = {}
): Promise<{ success: boolean; finalValue: string; expectedMatch: boolean }> {
  await waitForConditions(page, selector, [
    { condition: 'visible', timeout: options.timeout },
    { condition: 'enabled', timeout: options.timeout }
  ]);

  let success = false;
  let finalValue = '';
  let expectedMatch = false;

  try {
    const element = page.locator(selector);

    if (options.clearFirst && !options.appendText) {
      await element.clear();
    }

    if (options.appendText) {
      const currentValue = await element.inputValue();
      text = currentValue + text;
    }

    // Type with optional delay
    if (options.typeDelay) {
      await element.type(text, { delay: options.typeDelay });
    } else {
      await element.fill(text);
    }

    // Validate the input
    if (options.validateInput) {
      await page.waitForTimeout(100); // Allow DOM to update
      finalValue = await element.inputValue();
      expectedMatch = finalValue === (options.expectedValue || text);
    } else {
      finalValue = text;
      expectedMatch = true;
    }

    success = true;
  } catch (e) {
    console.error(`Text input failed for ${selector}:`, e);
    success = false;
  }

  return { success, finalValue, expectedMatch };
}

/**
 * Performs form filling with comprehensive validation
 */
export async function fillForm(
  page: Page,
  formSelector: string,
  fields: Record<string, any>,
  options: {
    validateEach?: boolean;
    submitAfterFill?: boolean;
    clearBefore?: boolean;
    waitForSubmit?: boolean;
  } = {}
): Promise<{ success: boolean; fieldResults: Record<string, any>; submitResult?: boolean }> {
  const fieldResults: Record<string, any> = {};
  let allSuccess = true;

  // Wait for form to be ready
  await waitForConditions(page, formSelector, [
    { condition: 'visible', timeout: 30000 }
  ]);

  // Fill each field
  for (const [fieldSelector, value] of Object.entries(fields)) {
    try {
      const fullSelector = `${formSelector} ${fieldSelector}`;
      const element = page.locator(fullSelector);

      // Determine field type
      const tagName = await element.evaluate(el => el.tagName.toLowerCase());
      const inputType = await element.getAttribute('type');

      if (options.clearBefore && (tagName === 'input' || tagName === 'textarea')) {
        await element.clear();
      }

      let fieldSuccess = false;
      let finalValue: any = value;

      switch (tagName) {
        case 'input':
          switch (inputType) {
            case 'checkbox':
            case 'radio':
              if (value) {
                await element.check();
              } else {
                await element.uncheck();
              }
              finalValue = await element.isChecked();
              fieldSuccess = finalValue === Boolean(value);
              break;

            case 'file':
              if (typeof value === 'string') {
                await element.setInputFiles(value);
                fieldSuccess = true;
              }
              break;

            default:
              const result = await performTextInput(page, fullSelector, String(value), {
                validateInput: options.validateEach,
                expectedValue: String(value)
              });
              fieldSuccess = result.success && result.expectedMatch;
              finalValue = result.finalValue;
          }
          break;

        case 'textarea':
          const textResult = await performTextInput(page, fullSelector, String(value), {
            validateInput: options.validateEach,
            expectedValue: String(value)
          });
          fieldSuccess = textResult.success && textResult.expectedMatch;
          finalValue = textResult.finalValue;
          break;

        case 'select':
          await element.selectOption(String(value));
          finalValue = await element.inputValue();
          fieldSuccess = finalValue === String(value);
          break;
      }

      fieldResults[fieldSelector] = { success: fieldSuccess, value: finalValue };
      if (!fieldSuccess) allSuccess = false;

    } catch (e) {
      fieldResults[fieldSelector] = { success: false, error: `${e}` };
      allSuccess = false;
    }
  }

  // Submit form if requested
  let submitResult: boolean | undefined;
  if (options.submitAfterFill && allSuccess) {
    try {
      const submitButton = page.locator(`${formSelector} [type="submit"]`);
      await submitButton.click();

      if (options.waitForSubmit) {
        await page.waitForTimeout(1000); // Wait for potential navigation or validation
      }

      submitResult = true;
    } catch (e) {
      submitResult = false;
    }
  }

  return { success: allSuccess, fieldResults, submitResult };
}

// ============================================================================
// Element State Assertion Utilities
// ============================================================================

/**
 * Asserts element properties with detailed error messages
 */
export async function assertElement(
  page: Page,
  assertion: ElementAssertion & { selector: string }
): Promise<{ passed: boolean; message: string; actual?: any; expected: any }> {
  const { selector, type, expected, attribute, property, tolerance = 0 } = assertion;

  const state = await getElementState(page, selector);
  if (!state) {
    return {
      passed: false,
      message: `Element not found: ${selector}`,
      expected
    };
  }

  let actual: any;
  let passed = false;
  let message = '';

  switch (type) {
    case 'text':
      actual = state.text;
      passed = actual === expected || actual.includes(expected);
      message = `Expected text ${passed ? 'matches' : 'does not match'}. Expected: "${expected}", Actual: "${actual}"`;
      break;

    case 'attribute':
      actual = state.attributes[attribute!];
      passed = actual === expected;
      message = `Expected attribute "${attribute}" ${passed ? 'matches' : 'does not match'}. Expected: "${expected}", Actual: "${actual}"`;
      break;

    case 'class':
      actual = state.classes;
      passed = Array.isArray(expected)
        ? expected.every(cls => actual.includes(cls))
        : actual.includes(expected);
      message = `Expected class(es) ${passed ? 'found' : 'not found'}. Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`;
      break;

    case 'style':
      actual = state.computedStyles[property!];
      passed = actual === expected;
      message = `Expected style "${property}" ${passed ? 'matches' : 'does not match'}. Expected: "${expected}", Actual: "${actual}"`;
      break;

    case 'state':
      actual = (state as any)[property!];
      passed = actual === expected;
      message = `Expected state "${property}" ${passed ? 'matches' : 'does not match'}. Expected: ${expected}, Actual: ${actual}`;
      break;

    case 'position':
      if (state.boundingBox && typeof expected === 'object') {
        actual = state.boundingBox;
        passed = Object.entries(expected).every(([key, value]) => {
          const actualValue = (actual as any)[key];
          return Math.abs(actualValue - (value as number)) <= tolerance;
        });
        message = `Expected position ${passed ? 'matches' : 'does not match'} within tolerance ${tolerance}. Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`;
      } else {
        passed = false;
        message = 'Element has no bounding box or invalid expected position format';
      }
      break;

    case 'count':
      // For count assertions, we need to count elements
      const elements = await page.locator(selector).count();
      actual = elements;
      passed = actual === expected;
      message = `Expected element count ${passed ? 'matches' : 'does not match'}. Expected: ${expected}, Actual: ${actual}`;
      break;

    default:
      message = `Unknown assertion type: ${type}`;
  }

  return { passed, message, actual, expected };
}

/**
 * Asserts multiple conditions on elements
 */
export async function assertElements(
  page: Page,
  assertions: (ElementAssertion & { selector: string })[]
): Promise<{ passed: boolean; results: Array<{ passed: boolean; message: string; assertion: ElementAssertion & { selector: string } }> }> {
  const results = [];
  let allPassed = true;

  for (const assertion of assertions) {
    const result = await assertElement(page, assertion);
    results.push({ ...result, assertion });
    if (!result.passed) allPassed = false;
  }

  return { passed: allPassed, results };
}

// ============================================================================
// Export All Utilities
// ============================================================================

export {
  ElementInteractionOptions,
  ElementState,
  WaitCondition,
  FormField,
  ElementAssertion,
};