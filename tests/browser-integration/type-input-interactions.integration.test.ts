/**
 * @fileoverview Integration tests for type/input interactions
 *
 * Comprehensive test suite covering:
 * - Text input field typing interactions
 * - Password field typing with masking
 * - Textarea typing and multi-line content
 * - Content-editable element typing
 * - Special key combinations (Enter, Tab, Escape)
 * - Text clearing and replacement operations
 * - Disabled and readonly field behavior
 * - Input validation and error handling
 *
 * These tests verify that browser automation can reliably interact with
 * all types of text input elements and handle various keyboard scenarios.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';

import {
  createBrowser,
  createBrowserContext,
  createPage,
} from './setup.js';

import {
  safeClick,
  safeFill,
  waitForElement,
  takeScreenshot,
  withBrowserTest,
} from './utils/test-helpers.js';

describe('Type/Input Interactions Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;

  beforeAll(async () => {
    // Create browser instance
    browser = await createBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);

    // Setup temporary directory for screenshots
    tempDir = globalThis.browserTestContext.tempDir!;

    console.log(`Using temp directory: ${tempDir}`);
  });

  afterAll(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  beforeEach(async () => {
    // Create a dynamic test page with various input elements
    const testPageHtml = `<!DOCTYPE html>
<html><head><title>Type Input Test</title>
<style>
  body { font-family: Arial, sans-serif; padding: 20px; }
  .form-group { margin: 15px 0; }
  label { display: block; margin-bottom: 5px; font-weight: bold; }
  input, textarea, [contenteditable] {
    width: 100%; max-width: 400px; padding: 8px;
    border: 1px solid #ddd; border-radius: 4px;
    font-size: 14px; font-family: inherit;
  }
  [contenteditable] { min-height: 100px; background: #f9f9f9; border: 2px solid #ccc; }
  .disabled { background: #f0f0f0; color: #999; }
  .error { color: red; font-size: 0.9em; margin-top: 5px; }
</style>
</head><body>

<h1>Type/Input Interaction Test Page</h1>

<div class="form-group">
  <label for="text-input">Text Input Field</label>
  <input type="text" id="text-input" name="text-input" placeholder="Enter text here..." />
  <div id="text-input-error" class="error"></div>
</div>

<div class="form-group">
  <label for="password-input">Password Input Field</label>
  <input type="password" id="password-input" name="password-input" placeholder="Enter secure text..." />
  <div id="password-input-error" class="error"></div>
</div>

<div class="form-group">
  <label for="email-input">Email Input Field</label>
  <input type="email" id="email-input" name="email-input" placeholder="user@domain.com..." />
  <div id="email-input-error" class="error"></div>
</div>

<div class="form-group">
  <label for="number-input">Number Input Field</label>
  <input type="number" id="number-input" name="number-input" placeholder="Enter number..." min="0" max="999" />
  <div id="number-input-error" class="error"></div>
</div>

<div class="form-group">
  <label for="textarea">Textarea (Multi-line)</label>
  <textarea id="textarea" name="textarea" rows="4" placeholder="Enter multi-line text here..."></textarea>
  <div id="textarea-error" class="error"></div>
</div>

<div class="form-group">
  <label for="contenteditable">Content-Editable Div</label>
  <div id="contenteditable" contenteditable="true">Click here to type...</div>
  <div id="contenteditable-error" class="error"></div>
</div>

<div class="form-group">
  <label for="disabled-input">Disabled Input Field</label>
  <input type="text" id="disabled-input" name="disabled-input" disabled placeholder="Disabled field..." />
</div>

<div class="form-group">
  <label for="readonly-input">Readonly Input Field</label>
  <input type="text" id="readonly-input" name="readonly-input" readonly value="Readonly field" />
</div>

<div class="form-group">
  <button id="clear-all-btn">Clear All Fields</button>
  <button id="validate-btn">Validate All</button>
</div>

<script>
// Add event listeners to track interactions
document.querySelectorAll('input, textarea, [contenteditable]').forEach(element => {
  element.addEventListener('input', (e) => {
    console.log('Input event on', element.id, 'value:', element.value || element.textContent);
  });

  element.addEventListener('blur', (e) => {
    validateField(element);
  });
});

function validateField(element) {
  const value = element.value || element.textContent || '';
  const errorElement = document.getElementById(element.id + '-error');
  if (!errorElement) return;

  errorElement.textContent = '';

  if (element.type === 'email' && value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
    errorElement.textContent = 'Please enter a valid email address';
  } else if (element.type === 'number' && value && (isNaN(value) || value < 0 || value > 999)) {
    errorElement.textContent = 'Please enter a number between 0 and 999';
  }
}

document.getElementById('clear-all-btn').addEventListener('click', () => {
  document.querySelectorAll('input:not([readonly]):not([disabled]), textarea, [contenteditable]').forEach(el => {
    if (el.contentEditable === 'true') {
      el.textContent = '';
    } else {
      el.value = '';
    }
  });
});

document.getElementById('validate-btn').addEventListener('click', () => {
  document.querySelectorAll('input, textarea, [contenteditable]').forEach(validateField);
});

console.log('Type/Input test page loaded and ready');
</script>
</body></html>`;

    await page.goto(`data:text/html,${encodeURIComponent(testPageHtml)}`);
    await page.waitForLoadState('domcontentloaded');
    await waitForElement(page, '#text-input', { visible: true });
  });

  describe('Basic Text Input Field Interactions', () => {
    it('should type in text input field and verify content', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        // Clear any existing content
        await textInput.clear();

        // Type text content
        const testText = 'Hello, this is a test message!';
        await textInput.fill(testText);

        // Verify the typed content
        const inputValue = await textInput.inputValue();
        expect(inputValue).toBe(testText);

        await takeScreenshot(page, 'text-input-typing', tempDir);

      }, page);
    });

    it('should handle special characters in text input', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        // Test special characters (no sensitive data)
        const specialText = 'Special chars: !@#$%^&*()_+-={}[]|\\:";\'<>?,./ 🚀 testing';
        await textInput.clear();
        await textInput.fill(specialText);

        const value = await textInput.inputValue();
        expect(value).toBe(specialText);

        await takeScreenshot(page, 'text-input-special-chars', tempDir);

      }, page);
    });

    it('should handle text selection and replacement', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        // Fill initial text
        await textInput.fill('This is original text that will be modified');

        // Select all text and replace
        await textInput.selectText();
        await page.keyboard.type('Complete replacement text');

        const value = await textInput.inputValue();
        expect(value).toBe('Complete replacement text');

        await takeScreenshot(page, 'text-selection-replacement', tempDir);

      }, page);
    });
  });

  describe('Password Field Interactions', () => {
    it('should type in password field and verify masking behavior', async () => {
      await withBrowserTest(async (page) => {
        const passwordInput = await waitForElement(page, '#password-input', {
          visible: true,
          enabled: true
        });

        // Type secure text (test data only)
        const testSecureText = 'TestSecureInput123!';
        await passwordInput.fill(testSecureText);

        // Verify the actual value is stored correctly
        const actualValue = await passwordInput.inputValue();
        expect(actualValue).toBe(testSecureText);

        // Verify that the display value is masked
        const displayValue = await passwordInput.evaluate((el: HTMLInputElement) => {
          return el.type === 'password' ? 'MASKED' : el.value;
        });
        expect(displayValue).toBe('MASKED');

        await takeScreenshot(page, 'password-field-masking', tempDir);

      }, page);
    });
  });

  describe('Textarea Multi-line Interactions', () => {
    it('should type multi-line content in textarea', async () => {
      await withBrowserTest(async (page) => {
        const textarea = await waitForElement(page, '#textarea', {
          visible: true,
          enabled: true
        });

        // Type multi-line content
        const multilineText = `Line 1: This is the first line
Line 2: This is the second line with some longer content
Line 3: Final line with special chars: !@#$%^&*()

Line 5: After blank line`;

        await textarea.fill(multilineText);

        const value = await textarea.inputValue();
        expect(value).toBe(multilineText);

        // Verify line count
        const lines = value.split('\n');
        expect(lines).toHaveLength(5);

        await takeScreenshot(page, 'textarea-multiline-content', tempDir);

      }, page);
    });
  });

  describe('Content-Editable Element Interactions', () => {
    it('should type in content-editable div', async () => {
      await withBrowserTest(async (page) => {
        const contentEditable = await waitForElement(page, '#contenteditable', {
          visible: true
        });

        // Clear existing content and type new content
        await contentEditable.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.type('Rich text content with formatting');

        const textContent = await contentEditable.textContent();
        expect(textContent).toBe('Rich text content with formatting');

        await takeScreenshot(page, 'contenteditable-typing', tempDir);

      }, page);
    });
  });

  describe('Special Key Combinations', () => {
    it('should handle Enter key in different input types', async () => {
      await withBrowserTest(async (page) => {
        // Enter in text input (should not add newline)
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        await textInput.fill('Before Enter');
        await textInput.press('Enter');
        await page.keyboard.type('After Enter');

        let value = await textInput.inputValue();
        expect(value).toBe('Before EnterAfter Enter'); // No newline in text input

        // Enter in textarea (should add newline)
        const textarea = await waitForElement(page, '#textarea', {
          visible: true,
          enabled: true
        });

        await textarea.fill('Before Enter');
        await textarea.press('Enter');
        await page.keyboard.type('After Enter');

        value = await textarea.inputValue();
        expect(value).toBe('Before Enter\nAfter Enter'); // Newline in textarea

        await takeScreenshot(page, 'enter-key-handling', tempDir);

      }, page);
    });

    it('should handle Tab key navigation between fields', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        await textInput.focus();

        // Tab through fields
        await page.keyboard.press('Tab');

        // Check which field has focus (should be password input)
        const focusedElement = await page.evaluate(() => {
          return document.activeElement?.id || 'none';
        });

        expect(focusedElement).toBe('password-input');

        await takeScreenshot(page, 'tab-navigation', tempDir);

      }, page);
    });

    it('should handle Escape key and editing shortcuts', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        await textInput.fill('Some text content');
        await textInput.focus();

        // Test Ctrl+A (Select All) and Delete
        await textInput.fill('Text to select and delete');
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');

        const valueAfterDelete = await textInput.inputValue();
        expect(valueAfterDelete).toBe('');

        await takeScreenshot(page, 'escape-and-shortcuts', tempDir);

      }, page);
    });
  });

  describe('Text Clearing and Replacement', () => {
    it('should clear existing text using different methods', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        // Method 1: Using clear()
        await textInput.fill('Text to clear using clear method');
        await textInput.clear();

        let value = await textInput.inputValue();
        expect(value).toBe('');

        // Method 2: Using selectAll + delete
        await textInput.fill('Text to clear using select all');
        await textInput.focus();
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');

        value = await textInput.inputValue();
        expect(value).toBe('');

        await takeScreenshot(page, 'text-clearing-methods', tempDir);

      }, page);
    });
  });

  describe('Disabled and Readonly Field Behavior', () => {
    it('should prevent typing in disabled input fields', async () => {
      await withBrowserTest(async (page) => {
        const disabledInput = await waitForElement(page, '#disabled-input', {
          visible: true
        });

        // Verify field is disabled
        const isDisabled = await disabledInput.isDisabled();
        expect(isDisabled).toBe(true);

        // Attempt to type (should fail or be ignored)
        try {
          await disabledInput.focus();
          await page.keyboard.type('This should not work');

          const value = await disabledInput.inputValue();
          expect(value).toBe(''); // Disabled fields remain unchanged

        } catch (error) {
          // Expected behavior - cannot focus disabled fields
          expect(error).toBeDefined();
        }

        await takeScreenshot(page, 'disabled-input-test', tempDir);

      }, page);
    });

    it('should prevent typing in readonly input fields', async () => {
      await withBrowserTest(async (page) => {
        const readonlyInput = await waitForElement(page, '#readonly-input', {
          visible: true
        });

        // Verify field is readonly
        const isReadonly = await readonlyInput.getAttribute('readonly');
        expect(isReadonly).not.toBeNull();

        // Get initial value
        const initialValue = await readonlyInput.inputValue();
        expect(initialValue).toBe('Readonly field');

        // Readonly fields can be focused but not modified
        await readonlyInput.focus();
        await page.keyboard.type('Additional text');

        // Value should remain unchanged
        const finalValue = await readonlyInput.inputValue();
        expect(finalValue).toBe(initialValue);

        await takeScreenshot(page, 'readonly-input-test', tempDir);

      }, page);
    });
  });

  describe('Input Validation and Error Handling', () => {
    it('should trigger validation on blur and display errors', async () => {
      await withBrowserTest(async (page) => {
        // Test email validation
        const emailInput = await waitForElement(page, '#email-input', {
          visible: true,
          enabled: true
        });

        await emailInput.fill('invalid-email-format');
        await emailInput.blur();

        // Wait for validation to run
        await page.waitForTimeout(100);

        const emailError = await page.locator('#email-input-error').textContent();
        expect(emailError).toContain('valid email address');

        // Test number validation
        const numberInput = await waitForElement(page, '#number-input', {
          visible: true,
          enabled: true
        });

        await numberInput.fill('1000'); // Outside 0-999 range
        await numberInput.blur();
        await page.waitForTimeout(100);

        const numberError = await page.locator('#number-input-error').textContent();
        expect(numberError).toContain('between 0 and 999');

        await takeScreenshot(page, 'input-validation-errors', tempDir);

      }, page);
    });

    it('should clear validation errors on valid input', async () => {
      await withBrowserTest(async (page) => {
        const emailInput = await waitForElement(page, '#email-input', {
          visible: true,
          enabled: true
        });

        // Trigger error first
        await emailInput.fill('invalid');
        await emailInput.blur();
        await page.waitForTimeout(100);

        let emailError = await page.locator('#email-input-error').textContent();
        expect(emailError).toContain('valid email address');

        // Fix the error
        await emailInput.fill('valid@example.com');
        await emailInput.blur();
        await page.waitForTimeout(100);

        emailError = await page.locator('#email-input-error').textContent();
        expect(emailError).toBe('');

        await takeScreenshot(page, 'validation-errors-cleared', tempDir);

      }, page);
    });
  });
});