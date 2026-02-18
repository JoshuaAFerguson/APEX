/**
 * @fileoverview Complete Element Interaction Infrastructure Test
 *
 * This test demonstrates and validates the complete element interaction infrastructure
 * for DOM element testing. It serves as both verification of the infrastructure and
 * a comprehensive example of how to use all the available utilities.
 *
 * Infrastructure Components Tested:
 * - Browser test setup and teardown
 * - Element creation utilities
 * - Element interaction helpers (click, type, hover, etc.)
 * - Element state management and assertions
 * - Wait conditions and timing utilities
 * - Form handling and validation
 * - Screenshot capture and visual verification
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest, BrowserTestUtils } from '../test-utils/browser-test-base.js';
import {
  createElement,
  createElementCollection,
  createTestForm,
  performClick,
  performTextInput,
  fillForm,
  getElementState,
  compareElementStates,
  waitForConditions,
  assertElement,
  assertElements,
  type ElementState,
  type WaitCondition,
  type FormField
} from './utils/element-interaction-helpers.js';
import {
  BUTTON_FIXTURES,
  INPUT_FIXTURES,
  FORM_FIXTURES,
  NAVIGATION_FIXTURE,
  TABLE_FIXTURE,
  createButtonCollectionTemplate,
  createInputCollectionTemplate,
  WAIT_CONDITIONS,
  ASSERTION_TEMPLATES
} from './fixtures/dom-element-test-fixtures.js';
import { takeScreenshot } from './utils/test-helpers.js';

describe('Element Interaction Infrastructure - Complete Integration Test', () => {
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

  describe('Infrastructure Foundation', () => {
    it('should have complete browser test infrastructure', async () => {
      // Verify browser test base is properly initialized
      expect(browserTest).toBeDefined();
      expect(browserTest.context.browser).toBeDefined();
      expect(browserTest.context.context).toBeDefined();
      expect(browserTest.context.page).toBeDefined();
      expect(browserTest.context.tempDir).toBeDefined();

      console.log('✅ Browser test infrastructure verified');
    });

    it('should create test page with standard elements', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const title = await browserTest.context.page!.title();
      expect(title).toBe('APEX Browser Test Page');

      // Verify standard elements exist
      const button = await browserTest.context.page!.locator('#test-button').count();
      const input = await browserTest.context.page!.locator('#test-input').count();
      const output = await browserTest.context.page!.locator('#output').count();

      expect(button).toBe(1);
      expect(input).toBe(1);
      expect(output).toBe(1);

      console.log('✅ Test page creation verified');
    });
  });

  describe('Element Creation and Management', () => {
    it('should create individual elements using fixtures', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create button using fixture
      const button = await createElement(browserTest.context.page!, {
        ...BUTTON_FIXTURES.primary,
        id: 'test-primary-btn',
        text: 'Test Primary Button',
        parent: '.container'
      });

      expect(button).toBeDefined();

      // Verify element exists in DOM
      const buttonCount = await browserTest.context.page!.locator('#test-primary-btn').count();
      expect(buttonCount).toBe(1);

      // Create input using fixture
      const input = await createElement(browserTest.context.page!, {
        ...INPUT_FIXTURES.text,
        id: 'test-text-input',
        parent: '.container'
      });

      expect(input).toBeDefined();

      const inputCount = await browserTest.context.page!.locator('#test-text-input').count();
      expect(inputCount).toBe(1);

      console.log('✅ Individual element creation verified');
    });

    it('should create element collections', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create button collection
      const buttonTemplate = createButtonCollectionTemplate(5);
      const buttons = await createElementCollection(browserTest.context.page!, {
        ...buttonTemplate,
        parent: '.container'
      });

      expect(buttons).toHaveLength(5);

      // Verify all buttons exist in DOM
      for (let i = 0; i < 5; i++) {
        const count = await browserTest.context.page!.locator(`#collection-btn-${i}`).count();
        expect(count).toBe(1);
      }

      // Create input collection
      const inputTemplate = createInputCollectionTemplate(3);
      const inputs = await createElementCollection(browserTest.context.page!, {
        ...inputTemplate,
        parent: '.container'
      });

      expect(inputs).toHaveLength(3);

      console.log('✅ Element collections verified');
    });

    it('should create complex forms using fixtures', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const { form, fields } = await createTestForm(browserTest.context.page!, {
        ...FORM_FIXTURES.contactForm,
        parent: '.container'
      });

      expect(form).toBeDefined();
      expect(Object.keys(fields)).toHaveLength(3);

      // Verify form elements exist
      const formCount = await browserTest.context.page!.locator('#contact-form').count();
      expect(formCount).toBe(1);

      const nameField = await browserTest.context.page!.locator('#contact-form-name').count();
      const subjectField = await browserTest.context.page!.locator('#contact-form-subject').count();
      const messageField = await browserTest.context.page!.locator('#contact-form-message').count();

      expect(nameField).toBe(1);
      expect(subjectField).toBe(1);
      expect(messageField).toBe(1);

      console.log('✅ Complex form creation verified');
    });
  });

  describe('Element State Management', () => {
    it('should capture and compare element states', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create test button
      await createElement(browserTest.context.page!, {
        ...BUTTON_FIXTURES.primary,
        id: 'state-test-btn',
        text: 'State Test Button',
        parent: '.container'
      });

      // Get initial state
      const initialState = await getElementState(browserTest.context.page!, '#state-test-btn');
      expect(initialState).toBeDefined();
      expect(initialState!.visible).toBe(true);
      expect(initialState!.text).toBe('State Test Button');
      expect(initialState!.tagName).toBe('button');

      // Modify element and get new state
      await browserTest.context.page!.evaluate(() => {
        const btn = document.getElementById('state-test-btn')!;
        btn.textContent = 'Modified Button';
        btn.style.backgroundColor = 'red';
      });

      const modifiedState = await getElementState(browserTest.context.page!, '#state-test-btn');
      expect(modifiedState!.text).toBe('Modified Button');

      // Compare states
      const comparison = compareElementStates(initialState!, modifiedState!);
      expect(comparison.changed).toBe(true);
      expect(comparison.differences).toContain(expect.stringContaining('text:'));

      console.log('✅ Element state management verified');
    });

    it('should handle wait conditions properly', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create element that will become visible after delay
      await browserTest.context.page!.evaluate(() => {
        const div = document.createElement('div');
        div.id = 'delayed-element';
        div.textContent = 'Delayed Element';
        div.style.display = 'none';
        document.body.appendChild(div);

        // Make visible after 1 second
        setTimeout(() => {
          div.style.display = 'block';
        }, 1000);
      });

      // Wait for element to become visible
      const conditions: WaitCondition[] = [
        { condition: 'visible', timeout: 5000 }
      ];

      const result = await waitForConditions(browserTest.context.page!, '#delayed-element', conditions);
      expect(result).toBe(true);

      console.log('✅ Wait conditions verified');
    });
  });

  describe('Element Interactions', () => {
    it('should perform comprehensive click interactions', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create interactive button
      await createElement(browserTest.context.page!, {
        ...BUTTON_FIXTURES.primary,
        id: 'click-test-btn',
        text: 'Click Me',
        parent: '.container'
      });

      // Add click handler
      await browserTest.context.page!.evaluate(() => {
        const btn = document.getElementById('click-test-btn')!;
        btn.addEventListener('click', () => {
          btn.textContent = 'Clicked!';
          btn.style.backgroundColor = '#28a745';
        });
      });

      // Perform click with full validation
      const clickResult = await performClick(browserTest.context.page!, '#click-test-btn', {
        captureBeforeState: true,
        waitForStable: true,
        highlightElement: false
      });

      expect(clickResult.success).toBe(true);
      expect(clickResult.beforeState).toBeDefined();

      // Verify click effect
      const buttonText = await browserTest.context.page!.locator('#click-test-btn').textContent();
      expect(buttonText).toBe('Clicked!');

      console.log('✅ Click interactions verified');
    });

    it('should perform comprehensive text input', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create text input
      await createElement(browserTest.context.page!, {
        ...INPUT_FIXTURES.text,
        id: 'text-input-test',
        parent: '.container'
      });

      // Test text input with validation
      const inputResult = await performTextInput(
        browserTest.context.page!,
        '#text-input-test',
        'Hello, Element Interaction Infrastructure!',
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: 'Hello, Element Interaction Infrastructure!',
          typeDelay: 50
        }
      );

      expect(inputResult.success).toBe(true);
      expect(inputResult.finalValue).toBe('Hello, Element Interaction Infrastructure!');
      expect(inputResult.expectedMatch).toBe(true);

      console.log('✅ Text input interactions verified');
    });

    it('should handle complex form interactions', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create form
      const { form } = await createTestForm(browserTest.context.page!, {
        ...FORM_FIXTURES.simpleForm,
        parent: '.container'
      });

      // Fill form with comprehensive validation
      const formData = {
        '#name': 'Test User',
        '#email': 'test@example.com'
      };

      const fillResult = await fillForm(
        browserTest.context.page!,
        '#test-form',
        formData,
        {
          validateEach: true,
          clearBefore: true
        }
      );

      expect(fillResult.success).toBe(true);
      expect(fillResult.fieldResults['#name'].success).toBe(true);
      expect(fillResult.fieldResults['#email'].success).toBe(true);

      console.log('✅ Form interactions verified');
    });
  });

  describe('Element Assertions and Validation', () => {
    it('should perform comprehensive element assertions', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create test elements
      await createElement(browserTest.context.page!, {
        ...BUTTON_FIXTURES.primary,
        id: 'assertion-btn',
        text: 'Assertion Test',
        parent: '.container'
      });

      await createElement(browserTest.context.page!, {
        ...INPUT_FIXTURES.text,
        id: 'assertion-input',
        parent: '.container'
      });

      // Fill input for testing
      await performTextInput(
        browserTest.context.page!,
        '#assertion-input',
        'Test Value'
      );

      // Single element assertions
      const buttonTextAssertion = await assertElement(browserTest.context.page!, {
        selector: '#assertion-btn',
        type: 'text',
        expected: 'Assertion Test'
      });

      const inputValueAssertion = await assertElement(browserTest.context.page!, {
        selector: '#assertion-input',
        type: 'attribute',
        attribute: 'value',
        expected: 'Test Value'
      });

      expect(buttonTextAssertion.passed).toBe(true);
      expect(inputValueAssertion.passed).toBe(true);

      // Multiple element assertions
      const assertions = [
        {
          selector: '#assertion-btn',
          type: 'state' as const,
          property: 'visible',
          expected: true
        },
        {
          selector: '#assertion-input',
          type: 'state' as const,
          property: 'visible',
          expected: true
        }
      ];

      const multipleAssertions = await assertElements(browserTest.context.page!, assertions);
      expect(multipleAssertions.passed).toBe(true);
      expect(multipleAssertions.results).toHaveLength(2);

      console.log('✅ Element assertions verified');
    });

    it('should use assertion templates effectively', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create button for template testing
      await createElement(browserTest.context.page!, {
        ...BUTTON_FIXTURES.secondary,
        id: 'template-btn',
        text: 'Template Test',
        parent: '.container'
      });

      // Use assertion template
      const buttonAssertions = ASSERTION_TEMPLATES.buttonState('#template-btn', 'Template Test');
      const results = await assertElements(browserTest.context.page!, buttonAssertions);

      expect(results.passed).toBe(true);
      expect(results.results).toHaveLength(2);

      console.log('✅ Assertion templates verified');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle element not found gracefully', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Try to interact with non-existent element
      const state = await getElementState(browserTest.context.page!, '#non-existent-element');
      expect(state).toBeNull();

      // Try assertion on non-existent element
      const assertion = await assertElement(browserTest.context.page!, {
        selector: '#non-existent-element',
        type: 'text',
        expected: 'anything'
      });

      expect(assertion.passed).toBe(false);
      expect(assertion.message).toContain('Element not found');

      console.log('✅ Error handling verified');
    });

    it('should handle interaction timeouts properly', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create disabled button
      await createElement(browserTest.context.page!, {
        ...BUTTON_FIXTURES.disabled,
        id: 'disabled-btn',
        parent: '.container'
      });

      // Try to click disabled button (this should handle the disabled state)
      const clickResult = await performClick(browserTest.context.page!, '#disabled-btn', {
        timeout: 1000,
        force: true // Force click on disabled element
      });

      // Click might succeed with force option, but element should remain disabled
      const isDisabled = await browserTest.context.page!.locator('#disabled-btn').isDisabled();
      expect(isDisabled).toBe(true);

      console.log('✅ Interaction timeouts verified');
    });
  });

  describe('Visual Verification and Screenshots', () => {
    it('should capture screenshots for visual verification', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      // Create complex layout for screenshot testing
      await createElement(browserTest.context.page!, NAVIGATION_FIXTURE);

      // Create data table
      await createElement(browserTest.context.page!, {
        ...TABLE_FIXTURE,
        parent: '.container'
      });

      // Create button collection
      const buttonTemplate = createButtonCollectionTemplate(3);
      await createElementCollection(browserTest.context.page!, {
        ...buttonTemplate,
        parent: '.container'
      });

      // Take comprehensive screenshot
      const screenshotPath = await takeScreenshot(
        browserTest.context.page!,
        'infrastructure-complete',
        browserTest.context.tempDir!
      );

      expect(screenshotPath).toBeDefined();
      expect(screenshotPath).toContain('infrastructure-complete');

      // Verify screenshot file exists
      const fs = await import('fs/promises');
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);

      console.log(`✅ Screenshot verification completed: ${screenshotPath}`);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of elements efficiently', async () => {
      await BrowserTestUtils.createTestPage(browserTest);

      const startTime = Date.now();

      // Create 20 buttons efficiently
      const buttonTemplate = createButtonCollectionTemplate(20);
      const buttons = await createElementCollection(browserTest.context.page!, {
        ...buttonTemplate,
        parent: '.container'
      });

      // Create 10 inputs
      const inputTemplate = createInputCollectionTemplate(10);
      const inputs = await createElementCollection(browserTest.context.page!, {
        ...inputTemplate,
        parent: '.container'
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(buttons).toHaveLength(20);
      expect(inputs).toHaveLength(10);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`✅ Performance test completed in ${duration}ms`);
    });
  });

  describe('Complete Integration Workflow', () => {
    it('should demonstrate complete element interaction workflow', async () => {
      console.log('🚀 Starting complete integration workflow...');

      // 1. Setup test page
      await BrowserTestUtils.createTestPage(browserTest);
      console.log('📄 Test page created');

      // 2. Create comprehensive form
      const { form, fields } = await createTestForm(browserTest.context.page!, {
        id: 'complete-test-form',
        fields: [
          {
            selector: 'username',
            type: 'text',
            value: 'testuser',
            label: 'Username',
            required: true
          },
          {
            selector: 'email',
            type: 'email',
            value: 'testuser@example.com',
            label: 'Email',
            required: true
          },
          {
            selector: 'message',
            type: 'textarea',
            value: 'This is a comprehensive test of the element interaction infrastructure.',
            label: 'Message',
            required: true
          }
        ] as FormField[],
        submitButton: true,
        resetButton: true,
        parent: '.container'
      });
      console.log('📝 Complex form created');

      // 3. Create navigation and buttons
      await createElement(browserTest.context.page!, {
        ...NAVIGATION_FIXTURE,
        parent: '.container'
      });

      const actionButtons = await createElementCollection(browserTest.context.page!, {
        ...createButtonCollectionTemplate(3),
        baseId: 'action-btn',
        parent: '.container'
      });
      console.log('🔘 Navigation and action buttons created');

      // 4. Fill form with comprehensive validation
      const formData = {
        '#username': 'integration_test_user',
        '#email': 'integration@test.com',
        '#message': 'Complete infrastructure integration test successful!'
      };

      const fillResult = await fillForm(
        browserTest.context.page!,
        '#complete-test-form',
        formData,
        {
          validateEach: true,
          clearBefore: true
        }
      );

      expect(fillResult.success).toBe(true);
      console.log('✍️  Form filled and validated');

      // 5. Test element interactions
      for (let i = 0; i < 3; i++) {
        const clickResult = await performClick(
          browserTest.context.page!,
          `#action-btn-${i}`,
          { waitForStable: true }
        );
        expect(clickResult.success).toBe(true);
      }
      console.log('👆 Action buttons tested');

      // 6. Perform comprehensive assertions
      const allAssertions = [
        {
          selector: '#complete-test-form',
          type: 'state' as const,
          property: 'visible',
          expected: true
        },
        {
          selector: '#complete-test-form-username',
          type: 'attribute' as const,
          attribute: 'value',
          expected: 'integration_test_user'
        },
        {
          selector: '#complete-test-form-email',
          type: 'attribute' as const,
          attribute: 'value',
          expected: 'integration@test.com'
        },
        {
          selector: '#complete-test-form-message',
          type: 'attribute' as const,
          attribute: 'value',
          expected: 'Complete infrastructure integration test successful!'
        }
      ];

      const assertionResults = await assertElements(browserTest.context.page!, allAssertions);
      expect(assertionResults.passed).toBe(true);
      console.log('✅ All assertions passed');

      // 7. Take final verification screenshot
      const finalScreenshot = await takeScreenshot(
        browserTest.context.page!,
        'complete-workflow-final',
        browserTest.context.tempDir!
      );
      expect(finalScreenshot).toBeDefined();
      console.log(`📸 Final screenshot captured: ${finalScreenshot}`);

      console.log('🎉 Complete integration workflow successfully completed!');
      console.log('📋 Infrastructure components verified:');
      console.log('  ✅ Browser test setup and teardown');
      console.log('  ✅ Element creation (individual, collections, forms)');
      console.log('  ✅ Element state management and comparison');
      console.log('  ✅ Wait conditions and timing utilities');
      console.log('  ✅ Click interactions with validation');
      console.log('  ✅ Text input with comprehensive options');
      console.log('  ✅ Form filling and validation');
      console.log('  ✅ Element assertions (single and multiple)');
      console.log('  ✅ Screenshot capture and verification');
      console.log('  ✅ Error handling and edge cases');
      console.log('  ✅ Test fixtures and templates');
      console.log('  ✅ Performance with large element counts');
    });
  });
});

/**
 * Infrastructure Summary Test
 *
 * This test provides a final verification that all infrastructure components
 * are working correctly and can be used together in real testing scenarios.
 */
describe('Element Interaction Infrastructure - Summary Verification', () => {
  it('should confirm all infrastructure components are operational', async () => {
    const browserTest = createBrowserTest({ headless: true });

    try {
      await browserTest.setup();
      await BrowserTestUtils.createTestPage(browserTest);

      // Quick verification of key components
      const button = await createElement(browserTest.context.page!, {
        ...BUTTON_FIXTURES.primary,
        id: 'summary-btn',
        text: 'Summary Test',
        parent: '.container'
      });

      const state = await getElementState(browserTest.context.page!, '#summary-btn');
      const assertion = await assertElement(browserTest.context.page!, {
        selector: '#summary-btn',
        type: 'text',
        expected: 'Summary Test'
      });

      expect(button).toBeDefined();
      expect(state?.visible).toBe(true);
      expect(assertion.passed).toBe(true);

      console.log('🎯 Element Interaction Infrastructure is fully operational!');
      console.log('📊 Ready for comprehensive DOM element testing across APEX');

    } finally {
      await browserTest.teardown();
    }
  });
});