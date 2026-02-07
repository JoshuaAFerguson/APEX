/**
 * @fileoverview Complete Infrastructure Integration Test
 *
 * This test validates that all components of the element interaction
 * testing infrastructure work together seamlessly. It serves as a
 * comprehensive integration test and smoke test for the entire framework.
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
  waitForConditions,
  assertElement,
  assertElements,
  type FormField,
  type ElementAssertion
} from './utils/element-interaction-helpers.js';
import {
  BUTTON_FIXTURES,
  INPUT_FIXTURES,
  FORM_FIXTURES,
  createButtonCollectionTemplate,
  WAIT_CONDITIONS,
  ASSERTION_TEMPLATES
} from './fixtures/dom-element-test-fixtures.js';
import { takeScreenshot, waitForElement, safeClick } from './utils/test-helpers.js';
import * as fs from 'fs/promises';

describe('Complete Infrastructure Integration Test', () => {
  let browserTest: BrowserTestBase;

  beforeEach(async () => {
    browserTest = createBrowserTest({
      headless: true,
      timeout: 45000,
    });

    await browserTest.setup();
  });

  afterEach(async () => {
    await browserTest.teardown();
  });

  it('should demonstrate complete infrastructure working together', async () => {
    console.log('🚀 Starting complete infrastructure integration test...');

    // ================================================================
    // 1. FOUNDATION SETUP
    // ================================================================
    console.log('📄 1. Setting up test foundation...');

    // Create base test page using existing utilities
    await BrowserTestUtils.createTestPage(browserTest);

    // Verify base page elements exist
    const baseButton = await waitForElement(browserTest.context.page!, '#test-button', {
      visible: true,
      timeout: 10000
    });
    expect(baseButton).toBeDefined();

    // ================================================================
    // 2. DYNAMIC ELEMENT CREATION
    // ================================================================
    console.log('🔧 2. Creating dynamic elements...');

    // Create a complex form using fixtures and utilities
    const { form: dynamicForm, fields: formFields } = await createTestForm(
      browserTest.context.page!,
      {
        ...FORM_FIXTURES.contactForm,
        id: 'integration-contact-form'
      }
    );

    expect(dynamicForm).toBeDefined();
    expect(Object.keys(formFields)).toHaveLength(3);

    // Create a collection of interactive buttons
    const buttonCollection = await createElementCollection(
      browserTest.context.page!,
      {
        ...createButtonCollectionTemplate(4),
        baseId: 'integration-btn'
      }
    );

    expect(buttonCollection).toHaveLength(4);

    // Create individual elements with custom configuration
    const statusIndicator = await createElement(browserTest.context.page!, {
      tag: 'div',
      id: 'status-indicator',
      className: 'status-panel',
      text: 'Integration Test Status: Running',
      styles: {
        backgroundColor: '#e3f2fd',
        border: '2px solid #2196f3',
        padding: '15px',
        margin: '20px 0',
        borderRadius: '8px',
        fontWeight: 'bold',
        textAlign: 'center'
      },
      parent: '.container'
    });

    expect(statusIndicator).toBeDefined();

    // ================================================================
    // 3. ELEMENT STATE VALIDATION
    // ================================================================
    console.log('🔍 3. Validating element states...');

    // Get comprehensive state information
    const formState = await getElementState(browserTest.context.page!, '#integration-contact-form');
    const statusState = await getElementState(browserTest.context.page!, '#status-indicator');

    expect(formState).toBeDefined();
    expect(formState!.visible).toBe(true);
    expect(formState!.tagName).toBe('form');

    expect(statusState).toBeDefined();
    expect(statusState!.text).toBe('Integration Test Status: Running');
    expect(statusState!.computedStyles.backgroundColor).toMatch(/rgb\(227, 242, 253\)|#e3f2fd/i);

    // ================================================================
    // 4. COMPLEX FORM INTERACTION
    // ================================================================
    console.log('📝 4. Performing complex form interactions...');

    // Fill the form using advanced form utilities
    const complexFormData = {
      '#integration-contact-form-name': 'Integration Test User',
      '#integration-contact-form-subject': 'Complete Infrastructure Test',
      '#integration-contact-form-message': 'This message validates that the complete element interaction infrastructure is working correctly. It tests form filling, validation, and state management.'
    };

    const formFillResult = await fillForm(
      browserTest.context.page!,
      '#integration-contact-form',
      complexFormData,
      {
        validateEach: true,
        clearBefore: true,
        waitBetweenFields: 100
      }
    );

    expect(formFillResult.success).toBe(true);
    expect(formFillResult.fieldResults['#integration-contact-form-name'].success).toBe(true);
    expect(formFillResult.fieldResults['#integration-contact-form-subject'].success).toBe(true);
    expect(formFillResult.fieldResults['#integration-contact-form-message'].success).toBe(true);

    // ================================================================
    // 5. INTERACTIVE ELEMENT TESTING
    // ================================================================
    console.log('👆 5. Testing interactive elements...');

    // Test each button in the collection with full validation
    for (let i = 0; i < 4; i++) {
      const buttonSelector = `#integration-btn-${i}`;

      // Wait for button to be ready
      await waitForConditions(browserTest.context.page!, buttonSelector, WAIT_CONDITIONS.standardVisibility);

      // Get state before interaction
      const beforeState = await getElementState(browserTest.context.page!, buttonSelector);
      expect(beforeState).toBeDefined();

      // Perform click with comprehensive options
      const clickResult = await performClick(browserTest.context.page!, buttonSelector, {
        captureBeforeState: true,
        validateClick: true,
        waitForStable: true,
        timeout: 10000
      });

      expect(clickResult.success).toBe(true);
      expect(clickResult.beforeState).toBeDefined();
    }

    // Test the original page button using existing utilities
    await safeClick(browserTest.context.page!, '#test-button');

    // ================================================================
    // 6. ADVANCED TEXT INPUT TESTING
    // ================================================================
    console.log('⌨️  6. Testing advanced text input...');

    // Test the original input field with advanced options
    const advancedInputText = 'Integration test with special characters: !@#$%^&*()_+-={}[]|;:",./<>?';
    const inputResult = await performTextInput(
      browserTest.context.page!,
      '#test-input',
      advancedInputText,
      {
        clearFirst: true,
        validateInput: true,
        expectedValue: advancedInputText,
        typeDelay: 25,
        finalValidation: true
      }
    );

    expect(inputResult.success).toBe(true);
    expect(inputResult.finalValue).toBe(advancedInputText);
    expect(inputResult.expectedMatch).toBe(true);

    // ================================================================
    // 7. COMPREHENSIVE ASSERTION TESTING
    // ================================================================
    console.log('✅ 7. Running comprehensive assertions...');

    // Create comprehensive assertion set using templates and custom assertions
    const comprehensiveAssertions: (ElementAssertion & { selector: string })[] = [
      // Form assertions
      { selector: '#integration-contact-form', type: 'state', property: 'visible', expected: true },
      { selector: '#integration-contact-form-name', type: 'attribute', attribute: 'value', expected: 'Integration Test User' },
      { selector: '#integration-contact-form-subject', type: 'attribute', attribute: 'value', expected: 'Complete Infrastructure Test' },

      // Button collection assertions
      { selector: '#integration-btn-0', type: 'state', property: 'visible', expected: true },
      { selector: '#integration-btn-1', type: 'count', expected: 1 },
      { selector: '#integration-btn-2', type: 'attribute', attribute: 'data-index', expected: '2' },
      { selector: '#integration-btn-3', type: 'state', property: 'enabled', expected: true },

      // Status indicator assertions
      { selector: '#status-indicator', type: 'text', expected: 'Integration Test Status: Running' },
      { selector: '#status-indicator', type: 'attribute', attribute: 'class', expected: 'status-panel' },

      // Original page element assertions
      { selector: '#test-input', type: 'attribute', attribute: 'value', expected: advancedInputText },
      { selector: '#test-button', type: 'state', property: 'visible', expected: true }
    ];

    const assertionResults = await assertElements(browserTest.context.page!, comprehensiveAssertions);

    expect(assertionResults.passed).toBe(true);
    expect(assertionResults.results).toHaveLength(comprehensiveAssertions.length);
    expect(assertionResults.results.every(result => result.passed)).toBe(true);

    // ================================================================
    // 8. STATE CHANGE VALIDATION
    // ================================================================
    console.log('🔄 8. Validating state changes...');

    // Update status indicator to show completion
    await browserTest.context.page!.evaluate(() => {
      const statusElement = document.getElementById('status-indicator');
      if (statusElement) {
        statusElement.textContent = 'Integration Test Status: Completed Successfully';
        statusElement.style.backgroundColor = '#e8f5e8';
        statusElement.style.borderColor = '#4caf50';
      }
    });

    // Validate the state change
    const updatedState = await getElementState(browserTest.context.page!, '#status-indicator');
    expect(updatedState!.text).toBe('Integration Test Status: Completed Successfully');
    expect(updatedState!.computedStyles.backgroundColor).toMatch(/rgb\(232, 245, 232\)|#e8f5e8/i);

    // ================================================================
    // 9. SCREENSHOT INTEGRATION
    // ================================================================
    console.log('📸 9. Capturing integration screenshots...');

    // Take final screenshot showing complete integration
    const finalScreenshotPath = await takeScreenshot(
      browserTest.context.page!,
      'complete-infrastructure-integration',
      browserTest.context.tempDir!,
      { fullPage: true }
    );

    expect(finalScreenshotPath).toBeDefined();

    // Verify screenshot file exists and has content
    const screenshotStats = await fs.stat(finalScreenshotPath);
    expect(screenshotStats.size).toBeGreaterThan(0);

    // ================================================================
    // 10. FINAL VALIDATION
    // ================================================================
    console.log('🎯 10. Final infrastructure validation...');

    // Comprehensive final state check
    const finalElements = [
      '#integration-contact-form',
      '#integration-btn-0',
      '#integration-btn-1',
      '#integration-btn-2',
      '#integration-btn-3',
      '#status-indicator',
      '#test-button',
      '#test-input'
    ];

    for (const selector of finalElements) {
      const element = await waitForElement(browserTest.context.page!, selector, { visible: true, timeout: 5000 });
      expect(element).toBeDefined();
    }

    // ================================================================
    // SUCCESS REPORTING
    // ================================================================
    console.log('✅ Complete infrastructure integration test PASSED!');
    console.log('📊 Infrastructure Integration Summary:');
    console.log('  ✅ Foundation setup and page creation');
    console.log('  ✅ Dynamic element creation (form, buttons, status indicator)');
    console.log('  ✅ Element state validation and comprehensive state capture');
    console.log('  ✅ Complex form interaction with field-level validation');
    console.log('  ✅ Interactive element testing with full click validation');
    console.log('  ✅ Advanced text input with special character handling');
    console.log('  ✅ Comprehensive assertion framework with 11 validations');
    console.log('  ✅ State change validation and real-time updates');
    console.log('  ✅ Screenshot integration with full-page capture');
    console.log('  ✅ Final validation of all created elements');
    console.log('  📈 All components working together seamlessly');
    console.log(`  🎯 Test completed in: ${browserTest.context.tempDir}`);
    console.log(`  📁 Screenshot saved: ${finalScreenshotPath}`);
  });

  it('should handle error conditions gracefully across all components', async () => {
    console.log('🚨 Testing error handling across infrastructure...');

    await BrowserTestUtils.createTestPage(browserTest);

    // Test element creation with invalid configuration
    try {
      await createElement(browserTest.context.page!, {
        tag: 'button',
        id: 'test-error-button',
        parent: '#non-existent-parent'
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      console.log('✅ Element creation error handling working');
    }

    // Test interaction with non-existent element
    try {
      await performClick(browserTest.context.page!, '#non-existent-button', { timeout: 1000 });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      console.log('✅ Element interaction error handling working');
    }

    // Test assertion failures
    const failingAssertion = await assertElement(browserTest.context.page!, {
      selector: '#test-button',
      type: 'text',
      expected: 'Wrong Button Text'
    });

    expect(failingAssertion.passed).toBe(false);
    expect(failingAssertion.message).toContain('does not match');
    console.log('✅ Assertion error handling working');

    console.log('✅ Error handling validation completed successfully');
  });
});