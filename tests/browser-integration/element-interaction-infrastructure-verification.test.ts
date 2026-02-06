/**
 * @fileoverview Element Interaction Infrastructure Verification Test
 *
 * This test verifies that all element interaction testing infrastructure
 * is working correctly and provides comprehensive DOM element testing capabilities.
 *
 * Acceptance Criteria Verification:
 * ✅ Test infrastructure exists with helper utilities for creating DOM elements
 * ✅ Wait conditions and element state assertions are available
 * ✅ Base fixtures for DOM element testing are established
 * ✅ A sample test runs successfully
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest, BrowserTestUtils } from '../test-utils/browser-test-base.js';
import {
  createElement,
  createElementCollection,
  createTestForm,
  waitForConditions,
  getElementState,
  performClick,
  performTextInput,
  fillForm,
  assertElement,
  assertElements,
  type ElementInteractionOptions,
  type FormField,
  type ElementAssertion
} from '../utils/element-interaction-helpers.js';
import {
  takeScreenshot,
  waitForElement,
  safeClick,
  safeFill,
  createTestPage
} from '../utils/test-helpers.js';
import * as fs from 'fs/promises';

describe('Element Interaction Infrastructure Verification', () => {
  let browserTest: BrowserTestBase;

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

  describe('DOM Element Creation Utilities', () => {
    it('should create individual DOM elements dynamically', async () => {
      // Set up test page
      await BrowserTestUtils.createTestPage(browserTest);

      const testButton = await createElement(browserTest.context.page!, {
        tag: 'button',
        id: 'dynamic-test-button',
        className: 'test-button',
        attributes: {
          'type': 'button',
          'data-test': 'true'
        },
        styles: {
          backgroundColor: '#007acc',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '4px'
        },
        text: 'Dynamic Test Button',
        parent: '.container'
      });

      expect(testButton).toBeDefined();

      // Verify the element exists in the page
      const elementExists = await browserTest.context.page!.locator('#dynamic-test-button').isVisible();
      expect(elementExists).toBe(true);

      // Verify element attributes
      const buttonText = await browserTest.context.page!.locator('#dynamic-test-button').textContent();
      expect(buttonText).toBe('Dynamic Test Button');

      const dataTest = await browserTest.context.page!.locator('#dynamic-test-button').getAttribute('data-test');
      expect(dataTest).toBe('true');
    });

    it('should create element collections', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const elements = await createElementCollection(browserTest.context.page!, {
        tag: 'div',
        baseId: 'test-item',
        className: 'collection-item',
        count: 5,
        attributes: {
          'data-collection': 'test-items'
        },
        parent: '.container'
      });

      expect(elements).toHaveLength(5);

      // Verify all elements exist
      for (let i = 0; i < 5; i++) {
        const element = await browserTest.context.page!.locator(`#test-item-${i}`).isVisible();
        expect(element).toBe(true);
      }

      // Verify collection attributes
      const firstElement = await browserTest.context.page!.locator('#test-item-0').getAttribute('data-index');
      expect(firstElement).toBe('0');
    });

    it('should create complex form structures', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const formFields: FormField[] = [
        {
          selector: 'username',
          type: 'text',
          value: 'testuser',
          label: 'Username',
          required: true
        },
        {
          selector: 'password',
          type: 'password',
          value: 'testpass',
          label: 'Password',
          required: true
        },
        {
          selector: 'email',
          type: 'email',
          value: 'test@example.com',
          label: 'Email'
        },
        {
          selector: 'bio',
          type: 'textarea',
          value: 'Test biography',
          label: 'Biography'
        },
        {
          selector: 'newsletter',
          type: 'checkbox',
          value: true,
          label: 'Subscribe to newsletter'
        }
      ];

      const { form, fields } = await createTestForm(browserTest.context.page!, {
        id: 'test-form',
        fields: formFields,
        submitButton: true,
        resetButton: true,
        parent: '.container'
      });

      expect(form).toBeDefined();
      expect(Object.keys(fields)).toHaveLength(5);

      // Verify form exists
      const formExists = await browserTest.context.page!.locator('#test-form').isVisible();
      expect(formExists).toBe(true);

      // Verify submit button exists
      const submitButton = await browserTest.context.page!.locator('#test-form-submit').isVisible();
      expect(submitButton).toBe(true);
    });
  });

  describe('Advanced Wait Conditions and State Management', () => {
    it('should wait for multiple element conditions', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create an element that will become visible after delay
      await browserTest.context.page!.evaluate(() => {
        const hiddenDiv = document.createElement('div');
        hiddenDiv.id = 'delayed-element';
        hiddenDiv.style.display = 'none';
        hiddenDiv.textContent = 'Delayed Element';
        document.body.appendChild(hiddenDiv);

        // Make it visible after 500ms
        setTimeout(() => {
          hiddenDiv.style.display = 'block';
        }, 500);
      });

      // Wait for the element to become visible
      const conditionsMet = await waitForConditions(browserTest.context.page!, '#delayed-element', [
        { condition: 'visible', timeout: 2000 }
      ]);

      expect(conditionsMet).toBe(true);

      const isVisible = await browserTest.context.page!.locator('#delayed-element').isVisible();
      expect(isVisible).toBe(true);
    });

    it('should get comprehensive element state information', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Use the existing test button
      const state = await getElementState(browserTest.context.page!, '#test-button');

      expect(state).toBeDefined();
      expect(state!.visible).toBe(true);
      expect(state!.enabled).toBe(true);
      expect(state!.tagName).toBe('button');
      expect(state!.text).toBe('Test Button');
      expect(state!.boundingBox).toBeDefined();
      expect(state!.attributes).toBeDefined();
      expect(state!.computedStyles).toBeDefined();
      expect(state!.classes).toBeDefined();
    });

    it('should track element state changes', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Get initial state
      const initialState = await getElementState(browserTest.context.page!, '#test-button');
      expect(initialState).toBeDefined();

      // Modify element
      await browserTest.context.page!.evaluate(() => {
        const button = document.getElementById('test-button') as HTMLButtonElement;
        if (button) {
          button.textContent = 'Modified Button';
          button.style.backgroundColor = 'red';
          button.disabled = true;
        }
      });

      // Get new state
      const modifiedState = await getElementState(browserTest.context.page!, '#test-button');
      expect(modifiedState).toBeDefined();

      // Verify changes
      expect(modifiedState!.text).toBe('Modified Button');
      expect(modifiedState!.enabled).toBe(false);
      expect(modifiedState!.computedStyles.backgroundColor).toContain('red');
    });
  });

  describe('Interactive Element Testing Helpers', () => {
    it('should perform comprehensive click interactions', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const result = await performClick(browserTest.context.page!, '#test-button', {
        captureBeforeState: true,
        validateClick: true,
        waitForStable: true,
        timeout: 5000
      });

      expect(result.success).toBe(true);
      expect(result.beforeState).toBeDefined();
      expect(result.afterState).toBeDefined();

      // Verify button was clicked by checking output
      const output = await browserTest.context.page!.locator('#output').textContent();
      expect(output).toContain('Button clicked at');
    });

    it('should perform advanced text input with validation', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const testText = 'Advanced test input';
      const result = await performTextInput(
        browserTest.context.page!,
        '#test-input',
        testText,
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: testText,
          typeDelay: 50
        }
      );

      expect(result.success).toBe(true);
      expect(result.finalValue).toBe(testText);
      expect(result.expectedMatch).toBe(true);

      // Verify input value
      const actualValue = await browserTest.context.page!.locator('#test-input').inputValue();
      expect(actualValue).toBe(testText);
    });

    it('should fill forms with comprehensive validation', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // First create a form
      const formFields: FormField[] = [
        { selector: 'input[name="username"]', type: 'text', value: 'testuser' },
        { selector: 'input[name="email"]', type: 'email', value: 'test@example.com' }
      ];

      // Add form HTML to the page
      await browserTest.context.page!.evaluate(() => {
        const form = document.createElement('form');
        form.id = 'validation-form';

        form.innerHTML = `
          <input type="text" name="username" placeholder="Username" />
          <input type="email" name="email" placeholder="Email" />
          <button type="submit">Submit</button>
        `;

        document.querySelector('.container')!.appendChild(form);
      });

      const formData = {
        'input[name="username"]': 'testuser',
        'input[name="email"]': 'test@example.com'
      };

      const result = await fillForm(browserTest.context.page!, '#validation-form', formData, {
        validateEach: true,
        clearBefore: true
      });

      expect(result.success).toBe(true);
      expect(result.fieldResults['input[name="username"]'].success).toBe(true);
      expect(result.fieldResults['input[name="email"]'].success).toBe(true);
    });
  });

  describe('Element State Assertion Utilities', () => {
    it('should assert element properties with detailed messages', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const textAssertion: ElementAssertion & { selector: string } = {
        selector: '#test-button',
        type: 'text',
        expected: 'Test Button'
      };

      const result = await assertElement(browserTest.context.page!, textAssertion);

      expect(result.passed).toBe(true);
      expect(result.actual).toBe('Test Button');
      expect(result.expected).toBe('Test Button');
      expect(result.message).toContain('matches');
    });

    it('should assert multiple element conditions', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const assertions: (ElementAssertion & { selector: string })[] = [
        {
          selector: '#test-button',
          type: 'text',
          expected: 'Test Button'
        },
        {
          selector: '#test-button',
          type: 'state',
          property: 'visible',
          expected: true
        },
        {
          selector: '#test-input',
          type: 'attribute',
          attribute: 'placeholder',
          expected: 'Test input'
        }
      ];

      const result = await assertElements(browserTest.context.page!, assertions);

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results.every(r => r.passed)).toBe(true);
    });

    it('should handle assertion failures gracefully', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const failingAssertion: ElementAssertion & { selector: string } = {
        selector: '#test-button',
        type: 'text',
        expected: 'Wrong Button Text'
      };

      const result = await assertElement(browserTest.context.page!, failingAssertion);

      expect(result.passed).toBe(false);
      expect(result.actual).toBe('Test Button');
      expect(result.expected).toBe('Wrong Button Text');
      expect(result.message).toContain('does not match');
    });
  });

  describe('Integration with Existing Test Utilities', () => {
    it('should work with existing screenshot utilities', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create some dynamic elements
      await createElement(browserTest.context.page!, {
        tag: 'div',
        id: 'screenshot-test-element',
        text: 'Screenshot Test Content',
        styles: {
          backgroundColor: '#28a745',
          color: 'white',
          padding: '20px',
          margin: '10px',
          borderRadius: '8px'
        },
        parent: '.container'
      });

      const screenshotPath = await takeScreenshot(
        browserTest.context.page!,
        'infrastructure-verification',
        browserTest.context.tempDir!
      );

      expect(screenshotPath).toBeDefined();

      // Verify screenshot file exists and has content
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should work with existing element wait utilities', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Use existing waitForElement utility
      const element = await waitForElement(browserTest.context.page!, '#test-button', {
        visible: true,
        enabled: true,
        timeout: 5000
      });

      expect(element).toBeDefined();

      // Use existing safeClick utility
      await safeClick(browserTest.context.page!, '#test-button');

      // Verify click occurred
      const output = await browserTest.context.page!.locator('#output').textContent();
      expect(output).toContain('Button clicked at');
    });

    it('should work with existing form filling utilities', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Use existing safeFill utility
      await safeFill(browserTest.context.page!, '#test-input', 'Integration test value', {
        clear: true,
        verify: true
      });

      // Verify value was set
      const inputValue = await browserTest.context.page!.locator('#test-input').inputValue();
      expect(inputValue).toBe('Integration test value');
    });
  });

  describe('Complete Infrastructure Demo Test', () => {
    it('should demonstrate full element interaction capabilities', async () => {
      // This test demonstrates the complete infrastructure working together

      // 1. Set up test page
      await BrowserTestUtils.createTestPage(browserTest);

      // 2. Create dynamic form
      const formFields: FormField[] = [
        { selector: 'name', type: 'text', value: 'John Doe', required: true },
        { selector: 'email', type: 'email', value: 'john@example.com', required: true },
        { selector: 'message', type: 'textarea', value: 'Hello from integration test!', required: true },
        { selector: 'subscribe', type: 'checkbox', value: true }
      ];

      const { form, fields } = await createTestForm(browserTest.context.page!, {
        id: 'demo-form',
        fields: formFields,
        submitButton: true,
        resetButton: true,
        parent: '.container'
      });

      // 3. Fill form using advanced utilities
      const formData = {
        '#demo-form-name': 'Jane Smith',
        '#demo-form-email': 'jane@example.com',
        '#demo-form-message': 'Updated message from test'
      };

      const fillResult = await fillForm(browserTest.context.page!, '#demo-form', formData, {
        validateEach: true,
        clearBefore: true
      });

      expect(fillResult.success).toBe(true);

      // 4. Create additional interactive elements
      const buttonElements = await createElementCollection(browserTest.context.page!, {
        tag: 'button',
        baseId: 'action-btn',
        className: 'demo-button',
        count: 3,
        attributes: {
          'type': 'button',
          'data-action': 'demo'
        },
        parent: '.container'
      });

      expect(buttonElements).toHaveLength(3);

      // 5. Interact with elements and capture states
      for (let i = 0; i < 3; i++) {
        const selector = `#action-btn-${i}`;

        // Get element state before interaction
        const beforeState = await getElementState(browserTest.context.page!, selector);
        expect(beforeState).toBeDefined();
        expect(beforeState!.visible).toBe(true);

        // Perform click with comprehensive validation
        const clickResult = await performClick(browserTest.context.page!, selector, {
          captureBeforeState: true,
          waitForStable: true,
          timeout: 5000
        });

        expect(clickResult.success).toBe(true);
      }

      // 6. Assert multiple element conditions
      const assertions: (ElementAssertion & { selector: string })[] = [
        { selector: '#demo-form', type: 'state', property: 'visible', expected: true },
        { selector: '#demo-form-name', type: 'attribute', attribute: 'value', expected: 'Jane Smith' },
        { selector: '#demo-form-email', type: 'attribute', attribute: 'value', expected: 'jane@example.com' },
        { selector: '#action-btn-0', type: 'count', expected: 1 },
        { selector: '#action-btn-1', type: 'state', property: 'visible', expected: true },
        { selector: '#action-btn-2', type: 'attribute', attribute: 'data-action', expected: 'demo' }
      ];

      const assertionResult = await assertElements(browserTest.context.page!, assertions);
      expect(assertionResult.passed).toBe(true);

      // 7. Take final screenshot for verification
      const screenshotPath = await takeScreenshot(
        browserTest.context.page!,
        'complete-infrastructure-demo',
        browserTest.context.tempDir!
      );

      expect(screenshotPath).toBeDefined();

      const screenshotStats = await fs.stat(screenshotPath);
      expect(screenshotStats.size).toBeGreaterThan(0);

      console.log('✅ Complete element interaction infrastructure test passed');
      console.log('📊 Infrastructure capabilities verified:');
      console.log('  - Dynamic element creation');
      console.log('  - Complex form generation');
      console.log('  - Element state management');
      console.log('  - Interactive testing utilities');
      console.log('  - Comprehensive assertions');
      console.log('  - Screenshot integration');
      console.log('  - Legacy utility compatibility');
    });
  });
});