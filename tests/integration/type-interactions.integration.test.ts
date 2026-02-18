/**
 * @fileoverview Integration Tests for Type Interactions
 *
 * This test suite validates type and input interactions across various HTML input elements
 * as specified in the acceptance criteria:
 *
 * ✅ Integration test file created with proper imports
 * ✅ Test fixtures (HTML with various input types)
 * ✅ Helper utilities for simulating typing
 * ✅ Test runner can execute the empty test suite
 *
 * Test Structure:
 * - HTML fixtures for different input element types
 * - Shared utilities for typing simulation
 * - Comprehensive test scenarios for type interactions
 * - Error handling and edge case testing
 *
 * Coverage Areas:
 * - Text input fields (standard, password, email, url, tel, search)
 * - Number and date input fields
 * - Textarea elements with multiline support
 * - Content-editable divs
 * - Input validation and constraint handling
 * - Keyboard shortcuts and special key combinations
 * - Cross-browser compatibility
 * - Performance testing with large text inputs
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';

import {
  createBrowser,
  createBrowserContext,
  createPage,
} from '../browser-integration/setup.js';

import {
  safeClick,
  safeFill,
  waitForElement,
  takeScreenshot,
  withBrowserTest,
  captureConsoleMessages,
  capturePageErrors,
} from '../browser-integration/utils/test-helpers.js';

import {
  simulateTyping,
  simulateSlowTyping,
  simulatePasteText,
  simulateKeyboardShortcuts,
  waitForInputValue,
  captureTypingEvents,
  validateInputState,
  createTypingScenario,
  executeTypingScenarios,
  testInputEdgeCases,
  TYPING_PATTERNS,
  TEST_TEXT_SAMPLES,
} from '../browser-integration/utils/type-interaction-helpers.js';

import {
  createInputFixtures,
  InputFixtureTypes,
  validateInputFixture,
  setupInputEventListeners,
} from './fixtures/input-fixtures.js';

import {
  TypeInteractionTestUtils,
  TypingScenarioRunner,
  InputValidationTester,
  KeyboardShortcutTester,
} from './utils/type-interaction-test-utils.js';

// Global test context for browser automation
describe('Type Interactions Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;

  beforeAll(async () => {
    // Initialize browser instances
    browser = await createBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);

    // Setup temporary directory for test artifacts
    tempDir = globalThis.browserTestContext.tempDir!;

    console.log(`Type interaction tests using temp directory: ${tempDir}`);
  });

  afterAll(async () => {
    // Cleanup browser resources
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  beforeEach(async () => {
    // Setup fresh test environment for each test
    const testPageHtml = createInputFixtures();
    await page.goto(`data:text/html,${encodeURIComponent(testPageHtml)}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for input elements to be ready
    await waitForElement(page, '#text-input', { visible: true, enabled: true });

    // Setup event listeners for interaction tracking
    await setupInputEventListeners(page);
  });

  describe('Basic Input Element Tests', () => {
    it('should render all input fixture types correctly', async () => {
      await withBrowserTest(async (page) => {
        // Verify all required input elements are present and accessible
        const inputTypes = [
          '#text-input',
          '#password-input',
          '#email-input',
          '#number-input',
          '#tel-input',
          '#url-input',
          '#search-input',
          '#textarea-input',
          '#contenteditable-input',
          '#date-input',
          '#time-input',
          '#range-input',
          '#color-input'
        ];

        for (const selector of inputTypes) {
          const element = await waitForElement(page, selector, { visible: true });
          expect(element).toBeDefined();

          // Verify element is interactive (not disabled)
          const isDisabled = await element.isDisabled();
          expect(isDisabled).toBe(false);
        }

        await takeScreenshot(page, 'input-fixtures-rendered', tempDir);
      }, page);
    });

    it('should validate HTML fixture structure and accessibility', async () => {
      await withBrowserTest(async (page) => {
        // Test that all inputs have proper labels and ARIA attributes
        const inputs = await page.locator('input, textarea, [contenteditable]').all();

        for (const input of inputs) {
          const id = await input.getAttribute('id');
          expect(id).toBeTruthy();

          // Check for associated label
          const label = page.locator(`label[for="${id}"]`);
          const labelCount = await label.count();
          expect(labelCount).toBeGreaterThan(0);
        }

        await takeScreenshot(page, 'input-accessibility-validation', tempDir);
      }, page);
    });
  });

  describe('Text Input Typing Tests', () => {
    it('should handle basic text input with various content types', async () => {
      await withBrowserTest(async (page) => {
        const testCases = [
          { selector: '#text-input', text: TEST_TEXT_SAMPLES.BASIC },
          { selector: '#text-input', text: TEST_TEXT_SAMPLES.WITH_NUMBERS },
          { selector: '#text-input', text: TEST_TEXT_SAMPLES.WITH_SPECIAL_CHARS },
          { selector: '#text-input', text: TEST_TEXT_SAMPLES.UNICODE }
        ];

        for (const testCase of testCases) {
          await simulateTyping(page, testCase.selector, testCase.text);

          const value = await page.locator(testCase.selector).inputValue();
          expect(value).toBe(testCase.text);

          // Clear for next test
          await page.locator(testCase.selector).clear();
        }

        await takeScreenshot(page, 'text-input-various-content', tempDir);
      }, page);
    });

    it('should handle secure password input with proper masking', async () => {
      await withBrowserTest(async (page) => {
        const passwordText = 'SecurePassword123!@#';

        await simulateTyping(page, '#password-input', passwordText);

        const actualValue = await page.locator('#password-input').inputValue();
        expect(actualValue).toBe(passwordText);

        // Verify field type is password (content is masked)
        const fieldType = await page.locator('#password-input').getAttribute('type');
        expect(fieldType).toBe('password');

        await takeScreenshot(page, 'password-input-masking', tempDir);
      }, page);
    });
  });

  describe('Specialized Input Type Tests', () => {
    it('should handle email input with validation', async () => {
      await withBrowserTest(async (page) => {
        const validEmail = 'test@example.com';
        const invalidEmail = 'invalid-email-format';

        // Test valid email
        await simulateTyping(page, '#email-input', validEmail);
        let validationState = await validateInputState(page, '#email-input');
        expect(validationState.isValid).toBe(true);

        // Test invalid email
        await page.locator('#email-input').clear();
        await simulateTyping(page, '#email-input', invalidEmail);

        // Trigger validation by blurring
        await page.locator('#email-input').blur();
        await page.waitForTimeout(100);

        validationState = await validateInputState(page, '#email-input');
        expect(validationState.isValid).toBe(false);

        await takeScreenshot(page, 'email-validation-testing', tempDir);
      }, page);
    });

    it('should handle number input with range validation', async () => {
      await withBrowserTest(async (page) => {
        const validNumber = '42';
        const invalidNumber = 'not-a-number';

        // Test valid number
        await simulateTyping(page, '#number-input', validNumber);
        let value = await page.locator('#number-input').inputValue();
        expect(value).toBe(validNumber);

        // Test invalid number input
        await page.locator('#number-input').clear();
        await simulateTyping(page, '#number-input', invalidNumber);

        // Number inputs should filter out non-numeric characters
        value = await page.locator('#number-input').inputValue();
        expect(value).not.toBe(invalidNumber);

        await takeScreenshot(page, 'number-input-validation', tempDir);
      }, page);
    });
  });

  describe('Textarea and Content-Editable Tests', () => {
    it('should handle multiline text input in textarea', async () => {
      await withBrowserTest(async (page) => {
        const multilineText = TEST_TEXT_SAMPLES.MULTILINE;

        await simulateTyping(page, '#textarea-input', multilineText);

        const value = await page.locator('#textarea-input').inputValue();
        expect(value).toBe(multilineText);

        // Verify line breaks are preserved
        const lines = value.split('\n');
        expect(lines.length).toBeGreaterThan(1);

        await takeScreenshot(page, 'textarea-multiline-content', tempDir);
      }, page);
    });

    it('should handle rich text editing in contenteditable element', async () => {
      await withBrowserTest(async (page) => {
        const testText = 'Rich text content with formatting support';

        const contentEditable = await waitForElement(page, '#contenteditable-input', { visible: true });
        await contentEditable.click();

        // Clear existing content
        await page.keyboard.press('Control+a');
        await simulateTyping(page, '#contenteditable-input', testText);

        const textContent = await contentEditable.textContent();
        expect(textContent).toContain(testText);

        await takeScreenshot(page, 'contenteditable-rich-text', tempDir);
      }, page);
    });
  });

  describe('Keyboard Shortcuts and Special Keys', () => {
    it('should handle Enter key behavior in different input types', async () => {
      await withBrowserTest(async (page) => {
        // Test Enter in text input (should not add newline)
        await simulateTyping(page, '#text-input', 'Before Enter');
        await page.locator('#text-input').press('Enter');
        await page.keyboard.type('After Enter');

        let value = await page.locator('#text-input').inputValue();
        expect(value).toBe('Before EnterAfter Enter');

        // Test Enter in textarea (should add newline)
        await simulateTyping(page, '#textarea-input', 'Before Enter');
        await page.locator('#textarea-input').press('Enter');
        await page.keyboard.type('After Enter');

        value = await page.locator('#textarea-input').inputValue();
        expect(value).toBe('Before Enter\nAfter Enter');

        await takeScreenshot(page, 'enter-key-behavior', tempDir);
      }, page);
    });

    it('should handle Tab navigation between form fields', async () => {
      await withBrowserTest(async (page) => {
        // Start at first input
        await page.locator('#text-input').focus();

        const expectedTabOrder = [
          'text-input',
          'password-input',
          'email-input',
          'number-input',
          'tel-input',
          'url-input'
        ];

        for (let i = 0; i < expectedTabOrder.length; i++) {
          const focusedId = await page.evaluate(() => document.activeElement?.id || 'none');
          expect(focusedId).toBe(expectedTabOrder[i]);

          if (i < expectedTabOrder.length - 1) {
            await page.keyboard.press('Tab');
          }
        }

        await takeScreenshot(page, 'tab-navigation-sequence', tempDir);
      }, page);
    });
  });

  describe('Copy/Paste and Clipboard Operations', () => {
    it('should handle paste operations in text inputs', async () => {
      await withBrowserTest(async (page) => {
        const textToPaste = 'Clipboard content for testing paste functionality';

        await simulatePasteText(page, '#text-input', textToPaste);

        const value = await page.locator('#text-input').inputValue();
        expect(value).toBe(textToPaste);

        await takeScreenshot(page, 'paste-operation-test', tempDir);
      }, page);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid typing without performance degradation', async () => {
      await withBrowserTest(async (page) => {
        const rapidText = 'a'.repeat(1000);

        const startTime = Date.now();
        await simulateTyping(page, '#text-input', rapidText, {
          delayBetweenChars: 1 // Very fast typing
        });
        const endTime = Date.now();

        const value = await page.locator('#text-input').inputValue();
        expect(value).toBe(rapidText);
        expect(value.length).toBe(1000);

        // Should complete in reasonable time (less than 10 seconds)
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(10000);

        await takeScreenshot(page, 'rapid-typing-performance', tempDir);
      }, page);
    });

    it('should handle edge cases and error conditions', async () => {
      await withBrowserTest(async (page) => {
        // Test disabled input (should not accept input)
        const disabledInput = await page.locator('#text-input');
        await disabledInput.evaluate(el => el.setAttribute('disabled', 'true'));

        const isDisabled = await disabledInput.isDisabled();
        expect(isDisabled).toBe(true);

        // Attempt to type in disabled input should not work
        try {
          await simulateTyping(page, '#text-input', 'Should not work');
          // Should not reach here for disabled inputs
          expect(false).toBe(true);
        } catch (error) {
          // Expected behavior - cannot interact with disabled inputs
          expect(error).toBeDefined();
        }

        await takeScreenshot(page, 'edge-cases-disabled-input', tempDir);
      }, page);
    });
  });

  describe('Event Capture and Validation', () => {
    it('should capture and validate typing events', async () => {
      await withBrowserTest(async (page) => {
        const testText = 'Event tracking test';

        const events = await captureTypingEvents(page, async () => {
          await simulateTyping(page, '#text-input', testText);
        });

        expect(events.totalEvents).toBeGreaterThan(0);
        expect(events.inputEvents.length).toBeGreaterThan(0);
        expect(events.keydownEvents.length).toBeGreaterThan(0);
        expect(events.keyupEvents.length).toBeGreaterThan(0);

        await takeScreenshot(page, 'event-capture-validation', tempDir);
      }, page);
    });
  });

  describe('Multi-Scenario Test Execution', () => {
    it('should execute multiple typing scenarios successfully', async () => {
      await withBrowserTest(async (page) => {
        const scenarios = [
          createTypingScenario({
            name: 'Basic text input',
            selector: '#text-input',
            text: 'Basic test content',
            options: TYPING_PATTERNS.NORMAL_SPEED
          }),
          createTypingScenario({
            name: 'Email validation test',
            selector: '#email-input',
            text: 'user@example.com',
            validationExpected: true
          }),
          createTypingScenario({
            name: 'Password input test',
            selector: '#password-input',
            text: 'SecurePass123!',
            options: TYPING_PATTERNS.SLOW_DELIBERATE
          }),
          createTypingScenario({
            name: 'Number input test',
            selector: '#number-input',
            text: '42',
            validationExpected: true
          })
        ];

        const results = await executeTypingScenarios(page, scenarios);

        // Verify all scenarios passed
        results.forEach((result, index) => {
          expect(result.success).toBe(true);
          expect(result.actualValue).toBe(scenarios[index].expectedResult);
        });

        await takeScreenshot(page, 'multi-scenario-execution-complete', tempDir);
      }, page);
    });
  });
});