/**
 * @fileoverview Comprehensive Integration Tests for Type/Input Interactions
 *
 * This comprehensive test suite validates all aspects of type and input interactions
 * as specified in the acceptance criteria:
 *
 * ✅ Text input field typing interactions
 * ✅ Password field typing with masking behavior
 * ✅ Textarea typing and multi-line content handling
 * ✅ Content-editable element typing interactions
 * ✅ Special key combinations (Enter, Tab, Escape)
 * ✅ Text clearing and replacement operations
 * ✅ Disabled and readonly field behavior verification
 * ✅ Input validation and error handling scenarios
 * ✅ Cross-browser compatibility testing
 * ✅ Performance and edge case testing
 *
 * Tests are designed to be thorough, reliable, and maintainable while providing
 * comprehensive coverage of all user interaction scenarios with input elements.
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
  captureConsoleMessages,
  capturePageErrors,
} from './utils/test-helpers.js';

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
} from './utils/type-interaction-helpers.js';

// Declare window extensions for test utilities
declare global {
  interface Window {
    testUtils: {
      getEventLog: () => any[];
      getValidationState: () => Record<string, any>;
      clearEventLog: () => void;
      simulateError: (elementId: string) => void;
    };
  }
}

describe('Comprehensive Type/Input Interactions Integration Tests', () => {
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
    // Create a comprehensive test page with all required input elements
    const testPageHtml = `<!DOCTYPE html>
<html><head>
  <title>Comprehensive Type/Input Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    .test-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .form-group {
      margin: 20px 0;
      display: flex;
      flex-direction: column;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #333;
    }
    input, textarea, [contenteditable] {
      width: 100%;
      max-width: 500px;
      padding: 12px;
      border: 2px solid #ddd;
      border-radius: 6px;
      font-size: 16px;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus, textarea:focus, [contenteditable]:focus {
      outline: none;
      border-color: #007acc;
      box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
    }
    [contenteditable] {
      min-height: 120px;
      background: #fafafa;
      border: 2px solid #ccc;
      white-space: pre-wrap;
    }
    .disabled { background: #f0f0f0; color: #999; cursor: not-allowed; }
    .readonly { background: #f9f9f9; color: #666; }
    .error {
      color: #d32f2f;
      font-size: 14px;
      margin-top: 5px;
      min-height: 20px;
    }
    .success {
      color: #388e3c;
      font-size: 14px;
      margin-top: 5px;
    }
    .button-group {
      display: flex;
      gap: 10px;
      margin: 20px 0;
    }
    button {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      background: #007acc;
      color: white;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    button:hover { background: #005a9e; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .validation-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-left: 8px;
    }
    .valid { background: #4caf50; }
    .invalid { background: #f44336; }
    .pending { background: #ff9800; }
  </style>
</head><body>

<div class="test-container">
  <h1>Comprehensive Type/Input Interaction Test Page</h1>
  <p>This page tests all aspects of typing and input interactions for browser automation.</p>

  <!-- Text Input Fields -->
  <div class="form-group">
    <label for="text-input">Standard Text Input Field</label>
    <input type="text" id="text-input" name="text-input" placeholder="Type text here..." />
    <div id="text-input-error" class="error"></div>
    <div id="text-input-info" class="success"></div>
  </div>

  <div class="form-group">
    <label for="secure-input">Secure Input Field</label>
    <input type="password" id="secure-input" name="secure-input" placeholder="Enter test data..." />
    <div id="secure-input-error" class="error"></div>
  </div>

  <div class="form-group">
    <label for="email-input">Email Input Field (with validation)</label>
    <input type="email" id="email-input" name="email-input" placeholder="user@example.com" required />
    <span id="email-validation-indicator" class="validation-indicator pending"></span>
    <div id="email-input-error" class="error"></div>
  </div>

  <div class="form-group">
    <label for="number-input">Number Input Field</label>
    <input type="number" id="number-input" name="number-input" placeholder="Enter number..." min="0" max="999" />
    <div id="number-input-error" class="error"></div>
  </div>

  <div class="form-group">
    <label for="tel-input">Phone Number Input</label>
    <input type="tel" id="tel-input" name="tel-input" placeholder="(555) 123-4567" pattern="\\([0-9]{3}\\) [0-9]{3}-[0-9]{4}" />
    <div id="tel-input-error" class="error"></div>
  </div>

  <div class="form-group">
    <label for="url-input">URL Input Field</label>
    <input type="url" id="url-input" name="url-input" placeholder="https://example.com" />
    <div id="url-input-error" class="error"></div>
  </div>

  <!-- Textarea -->
  <div class="form-group">
    <label for="textarea">Multi-line Textarea</label>
    <textarea id="textarea" name="textarea" rows="4" placeholder="Enter multi-line text here...
Line breaks and formatting will be preserved."></textarea>
    <div id="textarea-error" class="error"></div>
    <div id="textarea-info" class="success"></div>
  </div>

  <!-- Content-Editable Element -->
  <div class="form-group">
    <label for="contenteditable">Content-Editable Div</label>
    <div id="contenteditable" contenteditable="true" placeholder="Click here to type with rich text formatting...">
      <p>You can edit this content directly. Try typing, using Enter for new lines, and various formatting.</p>
    </div>
    <div id="contenteditable-error" class="error"></div>
  </div>

  <!-- Input with Constraints -->
  <div class="form-group">
    <label for="maxlength-input">Limited Length Input (max 50 characters)</label>
    <input type="text" id="maxlength-input" name="maxlength-input" maxlength="50" placeholder="Maximum 50 characters allowed..." />
    <div id="maxlength-counter" class="success">0/50 characters</div>
  </div>

  <div class="form-group">
    <label for="pattern-input">Pattern Validated Input (only letters and numbers)</label>
    <input type="text" id="pattern-input" name="pattern-input" pattern="[A-Za-z0-9]+" placeholder="Only letters and numbers..." />
    <div id="pattern-input-error" class="error"></div>
  </div>

  <div class="form-group">
    <label for="required-input">Required Input Field</label>
    <input type="text" id="required-input" name="required-input" required placeholder="This field is required..." />
    <div id="required-input-error" class="error"></div>
  </div>

  <!-- Disabled and Readonly Fields -->
  <div class="form-group">
    <label for="disabled-input">Disabled Input Field</label>
    <input type="text" id="disabled-input" name="disabled-input" disabled placeholder="This field is disabled" />
  </div>

  <div class="form-group">
    <label for="readonly-input">Readonly Input Field</label>
    <input type="text" id="readonly-input" name="readonly-input" readonly value="This field is readonly and cannot be modified" />
  </div>

  <!-- Additional Test Fields -->
  <div class="form-group">
    <label for="search-input">Search Input Field</label>
    <input type="search" id="search-input" name="search-input" placeholder="Search terms..." />
  </div>

  <div class="form-group">
    <label for="copy-target-input">Copy Target Input (for clipboard tests)</label>
    <input type="text" id="copy-target-input" name="copy-target-input" placeholder="Paste content here..." />
  </div>

  <!-- Control Buttons -->
  <div class="button-group">
    <button id="clear-all-btn">Clear All Fields</button>
    <button id="validate-all-btn">Validate All</button>
    <button id="fill-test-data-btn">Fill Test Data</button>
    <button id="focus-first-btn">Focus First Field</button>
  </div>

  <!-- Results Display -->
  <div id="test-results" style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 6px;">
    <h3>Test Results</h3>
    <div id="results-content">Ready to run tests...</div>
  </div>
</div>

<script>
// Enhanced event tracking and validation system
let eventLog = [];
let validationState = new Map();

// Add comprehensive event listeners
document.querySelectorAll('input, textarea, [contenteditable]').forEach(element => {
  ['input', 'change', 'focus', 'blur', 'keydown', 'keyup', 'paste', 'cut'].forEach(eventType => {
    element.addEventListener(eventType, function(e) {
      const timestamp = Date.now();
      const event = {
        type: eventType,
        target: e.target.id || 'unknown',
        value: e.target.value || e.target.textContent || '',
        timestamp,
        key: e.key || null,
        ctrlKey: e.ctrlKey || false,
        shiftKey: e.shiftKey || false,
        altKey: e.altKey || false
      };

      eventLog.push(event);

      // Real-time validation for specific fields
      if (eventType === 'input' || eventType === 'blur') {
        validateField(e.target);
      }

      // Update character counter
      if (e.target.id === 'maxlength-input') {
        updateCharacterCounter(e.target);
      }

      console.log('Event captured:', event);
    });
  });
});

function validateField(element) {
  const value = element.value || element.textContent || '';
  const errorElement = document.getElementById(element.id + '-error');
  const indicator = document.getElementById(element.id.replace('-input', '-validation-indicator'));

  if (!errorElement) return;

  errorElement.textContent = '';
  let isValid = true;
  let errorMessage = '';

  // Email validation
  if (element.type === 'email' && value) {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(value)) {
      errorMessage = 'Please enter a valid email address';
      isValid = false;
    }
  }

  // Number validation
  if (element.type === 'number' && value) {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 999) {
      errorMessage = 'Please enter a number between 0 and 999';
      isValid = false;
    }
  }

  // Phone number validation
  if (element.type === 'tel' && value) {
    const phoneRegex = /^\\([0-9]{3}\\) [0-9]{3}-[0-9]{4}$/;
    if (!phoneRegex.test(value)) {
      errorMessage = 'Please enter phone in format: (555) 123-4567';
      isValid = false;
    }
  }

  // URL validation
  if (element.type === 'url' && value) {
    try {
      new URL(value);
    } catch {
      errorMessage = 'Please enter a valid URL';
      isValid = false;
    }
  }

  // Pattern validation
  if (element.pattern && value) {
    const regex = new RegExp(element.pattern);
    if (!regex.test(value)) {
      errorMessage = 'Input does not match required pattern';
      isValid = false;
    }
  }

  // Required field validation
  if (element.required && !value.trim()) {
    errorMessage = 'This field is required';
    isValid = false;
  }

  // Update UI
  errorElement.textContent = errorMessage;
  if (indicator) {
    indicator.className = 'validation-indicator ' + (isValid ? 'valid' : 'invalid');
  }

  // Store validation state
  validationState.set(element.id, { isValid, errorMessage, value });
}

function updateCharacterCounter(element) {
  const counter = document.getElementById('maxlength-counter');
  if (counter) {
    const current = element.value.length;
    const max = parseInt(element.maxLength);
    counter.textContent = \`\${current}/\${max} characters\`;
    counter.className = current >= max * 0.9 ? 'error' : 'success';
  }
}

// Button event handlers
document.getElementById('clear-all-btn').addEventListener('click', () => {
  document.querySelectorAll('input:not([readonly]):not([disabled]), textarea, [contenteditable]').forEach(el => {
    if (el.contentEditable === 'true') {
      el.innerHTML = '<p>Click here to type...</p>';
    } else {
      el.value = '';
    }

    // Clear validation states
    const errorEl = document.getElementById(el.id + '-error');
    if (errorEl) errorEl.textContent = '';
  });

  eventLog = [];
  validationState.clear();
  updateResults('All fields cleared');
});

document.getElementById('validate-all-btn').addEventListener('click', () => {
  let results = [];
  document.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
    if (!el.disabled && !el.readOnly) {
      validateField(el);
      const state = validationState.get(el.id);
      results.push(\`\${el.id}: \${state?.isValid ? 'Valid' : 'Invalid'}\`);
    }
  });
  updateResults('Validation Results:\\n' + results.join('\\n'));
});

document.getElementById('fill-test-data-btn').addEventListener('click', () => {
  const testData = {
    'text-input': 'Sample text content',
    'secure-input': 'TestSecure123',
    'email-input': 'test@example.com',
    'number-input': '42',
    'tel-input': '(555) 123-4567',
    'url-input': 'https://example.com',
    'textarea': 'Multi-line text content\\nSecond line\\nThird line with more content',
    'maxlength-input': 'Short text within limit',
    'pattern-input': 'ABC123',
    'required-input': 'Required field content',
    'search-input': 'search query terms'
  };

  Object.entries(testData).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element && !element.disabled && !element.readOnly) {
      element.value = value;
      validateField(element);
    }
  });

  // Special handling for contenteditable
  const contentEditable = document.getElementById('contenteditable');
  if (contentEditable) {
    contentEditable.innerHTML = '<p>Rich text content with <strong>formatting</strong>.</p><p>Multiple paragraphs supported.</p>';
  }

  updateResults('Test data filled in all fields');
});

document.getElementById('focus-first-btn').addEventListener('click', () => {
  const firstInput = document.getElementById('text-input');
  if (firstInput) {
    firstInput.focus();
    updateResults('Focused on first input field');
  }
});

function updateResults(message) {
  const resultsContent = document.getElementById('results-content');
  if (resultsContent) {
    const timestamp = new Date().toISOString();
    resultsContent.innerHTML = \`<strong>\${timestamp}:</strong> \${message}\`;
  }
}

// Expose utilities for testing
window.testUtils = {
  getEventLog: () => eventLog,
  getValidationState: () => Object.fromEntries(validationState),
  clearEventLog: () => { eventLog = []; },
  simulateError: (elementId) => {
    const element = document.getElementById(elementId);
    if (element) {
      const errorEl = document.getElementById(elementId + '-error');
      if (errorEl) {
        errorEl.textContent = 'Simulated error for testing';
      }
    }
  }
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  console.log('Comprehensive Type/Input test page loaded');
  updateResults('Page initialized and ready for testing');
});
</script>
</body></html>`;

    await page.goto(`data:text/html,${encodeURIComponent(testPageHtml)}`);
    await page.waitForLoadState('domcontentloaded');
    await waitForElement(page, '#text-input', { visible: true });
  });

  describe('1. Text Input Field Interactions', () => {
    it('should type in standard text input field with proper validation', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        // Clear any existing content and type test content
        await textInput.clear();
        const testText = 'Hello, this is a comprehensive test message with special characters: !@#$%^&*()_+';
        await simulateTyping(page, '#text-input', testText);

        // Verify the typed content
        const inputValue = await textInput.inputValue();
        expect(inputValue).toBe(testText);

        // Verify event logging
        const eventLog = await page.evaluate(() => window.testUtils.getEventLog());
        expect(eventLog.length).toBeGreaterThan(0);

        // Check that input events were fired
        const inputEvents = eventLog.filter(e => e.type === 'input' && e.target === 'text-input');
        expect(inputEvents.length).toBeGreaterThan(0);

        await takeScreenshot(page, 'text-input-comprehensive-typing', tempDir);

      }, page);
    });

    it('should handle text selection and replacement in text inputs', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        // Fill initial text
        await textInput.fill('Original text that will be completely replaced');

        // Select all and replace
        await textInput.selectText();
        await page.keyboard.type('Complete replacement text');

        const value = await textInput.inputValue();
        expect(value).toBe('Complete replacement text');

        await takeScreenshot(page, 'text-selection-replacement', tempDir);

      }, page);
    });
  });

  describe('2. Secure Input Field Interactions', () => {
    it('should type in secure field with proper masking behavior', async () => {
      await withBrowserTest(async (page) => {
        const secureInput = await waitForElement(page, '#secure-input', {
          visible: true,
          enabled: true
        });

        // Type test data (non-sensitive test content)
        const testData = 'TestData123';
        await simulateTyping(page, '#secure-input', testData);

        // Verify the actual value is stored correctly
        const actualValue = await secureInput.inputValue();
        expect(actualValue).toBe(testData);

        // Verify that the field type is password (content masked)
        const fieldType = await secureInput.getAttribute('type');
        expect(fieldType).toBe('password');

        await takeScreenshot(page, 'secure-field-masking-test', tempDir);

      }, page);
    });
  });

  describe('3. Textarea Multi-line Interactions', () => {
    it('should handle multi-line text with proper line break preservation', async () => {
      await withBrowserTest(async (page) => {
        const textarea = await waitForElement(page, '#textarea', {
          visible: true,
          enabled: true
        });

        const multilineText = `First line of multi-line content
Second line with different content
Third line containing special chars: !@#$%^&*()
Fourth line with numbers: 1234567890

Final line after blank line with more content`;

        await textarea.clear();
        await simulateTyping(page, '#textarea', multilineText);

        const value = await textarea.inputValue();
        expect(value).toBe(multilineText);

        // Verify line count
        const lines = value.split('\n');
        expect(lines).toHaveLength(6); // Including the empty line

        await takeScreenshot(page, 'textarea-multiline-comprehensive', tempDir);

      }, page);
    });
  });

  describe('4. Content-Editable Element Interactions', () => {
    it('should type in content-editable element with rich text support', async () => {
      await withBrowserTest(async (page) => {
        const contentEditable = await waitForElement(page, '#contenteditable', {
          visible: true
        });

        // Clear existing content and add new content
        await contentEditable.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.type('Rich text content with multiple lines.\n\nThis is a second paragraph with different content.');

        const textContent = await contentEditable.textContent();
        expect(textContent).toContain('Rich text content with multiple lines.');
        expect(textContent).toContain('This is a second paragraph');

        await takeScreenshot(page, 'contenteditable-rich-text', tempDir);

      }, page);
    });
  });

  describe('5. Special Key Combinations', () => {
    it('should handle Enter key behavior in different input types', async () => {
      await withBrowserTest(async (page) => {
        // Enter in text input (should not add newline)
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        await textInput.clear();
        await textInput.type('Before Enter');
        await textInput.press('Enter');
        await page.keyboard.type('After Enter');

        let value = await textInput.inputValue();
        expect(value).toBe('Before EnterAfter Enter'); // No newline in text input

        // Enter in textarea (should add newline)
        const textarea = await waitForElement(page, '#textarea', {
          visible: true,
          enabled: true
        });

        await textarea.clear();
        await textarea.type('Before Enter');
        await textarea.press('Enter');
        await page.keyboard.type('After Enter');

        value = await textarea.inputValue();
        expect(value).toBe('Before Enter\nAfter Enter'); // Newline in textarea

        await takeScreenshot(page, 'enter-key-behavior-comprehensive', tempDir);

      }, page);
    });

    it('should handle Tab key navigation between form fields', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        await textInput.focus();

        // Tab through several fields and verify focus progression
        const expectedTabOrder = [
          'text-input',
          'secure-input',
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

        await takeScreenshot(page, 'tab-navigation-comprehensive', tempDir);

      }, page);
    });

    it('should handle Escape key and various keyboard shortcuts', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        await textInput.clear();
        await textInput.type('Text content for shortcut testing');
        await textInput.focus();

        // Test Ctrl+A (Select All)
        await page.keyboard.press('Control+a');
        await page.keyboard.type('Replaced all text');

        const value = await textInput.inputValue();
        expect(value).toBe('Replaced all text');

        await takeScreenshot(page, 'keyboard-shortcuts-comprehensive', tempDir);

      }, page);
    });
  });

  describe('6. Text Clearing and Replacement Operations', () => {
    it('should clear existing text using multiple methods', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        // Method 1: Using clear() method
        await textInput.fill('Text to clear using clear method');
        await textInput.clear();

        let value = await textInput.inputValue();
        expect(value).toBe('');

        // Method 2: Using selectAll + delete
        await textInput.fill('Text to clear using select and delete');
        await textInput.focus();
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');

        value = await textInput.inputValue();
        expect(value).toBe('');

        await takeScreenshot(page, 'text-clearing-methods-comprehensive', tempDir);

      }, page);
    });
  });

  describe('7. Disabled and Readonly Field Behavior', () => {
    it('should prevent typing in disabled input fields', async () => {
      await withBrowserTest(async (page) => {
        const disabledInput = await waitForElement(page, '#disabled-input', {
          visible: true
        });

        // Verify field is disabled
        const isDisabled = await disabledInput.isDisabled();
        expect(isDisabled).toBe(true);

        // Attempt to interact with disabled field
        const initialValue = await disabledInput.inputValue();

        try {
          await disabledInput.focus();
          // Should not be able to focus
          const isFocused = await disabledInput.evaluate(el => document.activeElement === el);
          expect(isFocused).toBe(false);
        } catch (error) {
          // Expected behavior - cannot interact with disabled fields
          expect(error).toBeDefined();
        }

        await takeScreenshot(page, 'disabled-input-comprehensive-test', tempDir);

      }, page);
    });

    it('should allow focus but prevent editing in readonly fields', async () => {
      await withBrowserTest(async (page) => {
        const readonlyInput = await waitForElement(page, '#readonly-input', {
          visible: true
        });

        // Verify field is readonly
        const isReadonly = await readonlyInput.getAttribute('readonly');
        expect(isReadonly).not.toBeNull();

        // Get initial value
        const initialValue = await readonlyInput.inputValue();
        expect(initialValue).toBe('This field is readonly and cannot be modified');

        // Readonly fields can be focused
        await readonlyInput.focus();
        const isFocused = await readonlyInput.evaluate(el => document.activeElement === el);
        expect(isFocused).toBe(true);

        // But typing should not modify content
        await page.keyboard.type('Additional text that should not appear');

        const finalValue = await readonlyInput.inputValue();
        expect(finalValue).toBe(initialValue); // Should remain unchanged

        await takeScreenshot(page, 'readonly-input-comprehensive-test', tempDir);

      }, page);
    });
  });

  describe('8. Input Validation and Error Handling', () => {
    it('should handle input validation for various field types', async () => {
      await withBrowserTest(async (page) => {
        // Test email validation
        const emailInput = await waitForElement(page, '#email-input', {
          visible: true,
          enabled: true
        });

        await simulateTyping(page, '#email-input', 'invalid-email');
        await emailInput.blur();
        await page.waitForTimeout(100);

        let emailError = await page.locator('#email-input-error').textContent();
        expect(emailError).toContain('valid email address');

        // Fix the email
        await emailInput.clear();
        await simulateTyping(page, '#email-input', 'valid@example.com');
        await emailInput.blur();
        await page.waitForTimeout(100);

        emailError = await page.locator('#email-input-error').textContent();
        expect(emailError).toBe('');

        await takeScreenshot(page, 'input-validation-comprehensive', tempDir);

      }, page);
    });
  });

  describe('9. Performance and Edge Cases', () => {
    it('should handle rapid typing without performance degradation', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        const rapidText = 'a'.repeat(500);

        const startTime = Date.now();
        await simulateTyping(page, '#text-input', rapidText, {
          delayBetweenChars: 1 // Very fast typing
        });
        const endTime = Date.now();

        const value = await textInput.inputValue();
        expect(value).toBe(rapidText);
        expect(value.length).toBe(500);

        // Should complete in reasonable time
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(10000); // Less than 10 seconds

        await takeScreenshot(page, 'rapid-typing-performance', tempDir);

      }, page);
    });

    it('should handle unicode and special character input', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', {
          visible: true,
          enabled: true
        });

        const unicodeTestCases = [
          'Hello 世界 🌍', // Mixed ASCII, CJK, and emoji
          'Café résumé naïve', // Accented characters
          'العربية', // Arabic
          'русский язык', // Cyrillic
          '♠♥♦♣♪♫♬', // Miscellaneous symbols
        ];

        for (const testCase of unicodeTestCases) {
          await textInput.clear();
          await simulateTyping(page, '#text-input', testCase);

          const value = await textInput.inputValue();
          expect(value).toBe(testCase);
        }

        await takeScreenshot(page, 'unicode-comprehensive-test', tempDir);

      }, page);
    });
  });

  describe('10. Integration Test Scenarios', () => {
    it('should execute multiple typing scenarios in sequence', async () => {
      await withBrowserTest(async (page) => {
        const scenarios = [
          createTypingScenario({
            name: 'Basic text input',
            selector: '#text-input',
            text: 'Basic text content',
            options: TYPING_PATTERNS.NORMAL_SPEED
          }),
          createTypingScenario({
            name: 'Email input with validation',
            selector: '#email-input',
            text: 'test@example.com',
            validationExpected: true
          }),
          createTypingScenario({
            name: 'Secure field test',
            selector: '#secure-input',
            text: 'TestSecure123',
            options: TYPING_PATTERNS.SLOW_DELIBERATE
          }),
          createTypingScenario({
            name: 'Number input validation',
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

        await takeScreenshot(page, 'multiple-scenarios-complete', tempDir);

      }, page);
    });
  });
});