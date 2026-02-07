/**
 * @fileoverview HTML Fixtures for Input Element Testing
 *
 * This module provides comprehensive HTML fixtures for testing various input types:
 * - Standard HTML input elements (text, email, number, etc.)
 * - Textarea elements with different configurations
 * - Content-editable elements
 * - Form validation and constraint testing
 */

import { Page } from 'playwright';

// Input fixture types for type-safe fixture creation
export interface InputFixtureConfig {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: string;
  max?: string;
  step?: string;
  value?: string;
}

// Predefined input configurations for comprehensive testing
export const INPUT_FIXTURE_CONFIGS: InputFixtureConfig[] = [
  {
    id: 'text-input',
    type: 'text',
    label: 'Standard Text Input',
    placeholder: 'Enter text here...'
  },
  {
    id: 'password-input',
    type: 'password',
    label: 'Password Input',
    placeholder: 'Enter secure password...',
    minLength: 8
  },
  {
    id: 'email-input',
    type: 'email',
    label: 'Email Address Input',
    placeholder: 'user@example.com',
    required: true
  },
  {
    id: 'number-input',
    type: 'number',
    label: 'Number Input',
    placeholder: 'Enter number...',
    min: '0',
    max: '999',
    step: '1'
  },
  {
    id: 'tel-input',
    type: 'tel',
    label: 'Phone Number Input',
    placeholder: '(555) 123-4567'
  },
  {
    id: 'url-input',
    type: 'url',
    label: 'URL Input',
    placeholder: 'https://example.com'
  },
  {
    id: 'search-input',
    type: 'search',
    label: 'Search Input',
    placeholder: 'Search terms...'
  },
  {
    id: 'date-input',
    type: 'date',
    label: 'Date Input',
    min: '2020-01-01',
    max: '2030-12-31'
  },
  {
    id: 'time-input',
    type: 'time',
    label: 'Time Input',
    step: '60'
  },
  {
    id: 'range-input',
    type: 'range',
    label: 'Range Input',
    min: '0',
    max: '100',
    step: '5',
    value: '50'
  },
  {
    id: 'color-input',
    type: 'color',
    label: 'Color Input',
    value: '#007acc'
  }
];

// Special input configurations for edge case testing
export const SPECIAL_INPUT_CONFIGS: InputFixtureConfig[] = [
  {
    id: 'disabled-input',
    type: 'text',
    label: 'Disabled Input',
    placeholder: 'This field is disabled',
    disabled: true
  },
  {
    id: 'readonly-input',
    type: 'text',
    label: 'Readonly Input',
    value: 'This field is readonly',
    readonly: true
  },
  {
    id: 'maxlength-input',
    type: 'text',
    label: 'Limited Length Input (max 50 characters)',
    placeholder: 'Maximum 50 characters allowed...',
    maxLength: 50
  },
  {
    id: 'pattern-input',
    type: 'text',
    label: 'Pattern Validated Input (alphanumeric only)',
    placeholder: 'Only letters and numbers...',
    pattern: '[A-Za-z0-9]+'
  },
  {
    id: 'required-input',
    type: 'text',
    label: 'Required Input Field',
    placeholder: 'This field is required...',
    required: true
  }
];

/**
 * Creates comprehensive HTML fixtures for input element testing
 */
export function createInputFixtures(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Type Interactions Test Fixtures</title>
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
      transition: border-color 0.2s;
    }

    input:focus, textarea:focus, [contenteditable]:focus {
      outline: none;
      border-color: #007acc;
    }

    input:disabled {
      background: #f0f0f0;
      color: #999;
      cursor: not-allowed;
    }

    input:read-only {
      background: #f9f9f9;
      color: #666;
    }

    textarea {
      min-height: 100px;
      resize: vertical;
    }

    [contenteditable] {
      min-height: 100px;
      background: #fafafa;
      white-space: pre-wrap;
    }

    .error {
      color: #d32f2f;
      font-size: 14px;
      margin-top: 5px;
      min-height: 20px;
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
      transition: background 0.2s;
    }

    button:hover {
      background: #005a9e;
    }
  </style>
</head>
<body>
  <div class="test-container">
    <h1>Type Interactions Test Fixtures</h1>
    <p>Test environment for input element typing interactions</p>

    ${INPUT_FIXTURE_CONFIGS.map(config => createInputElement(config)).join('\n')}

    <div class="form-group">
      <label for="textarea-input">Multi-line Textarea</label>
      <textarea
        id="textarea-input"
        name="textarea-input"
        rows="4"
        placeholder="Enter multi-line text here..."
      ></textarea>
      <div id="textarea-error" class="error"></div>
    </div>

    <div class="form-group">
      <label for="contenteditable-input">Content-Editable Div</label>
      <div
        id="contenteditable-input"
        contenteditable="true"
        role="textbox"
      >
        <p>You can edit this content directly.</p>
      </div>
      <div id="contenteditable-error" class="error"></div>
    </div>

    ${SPECIAL_INPUT_CONFIGS.map(config => createInputElement(config)).join('\n')}

    <div class="button-group">
      <button id="clear-all-btn" type="button">Clear All Fields</button>
      <button id="validate-all-btn" type="button">Validate All Fields</button>
      <button id="fill-test-data-btn" type="button">Fill Test Data</button>
    </div>

    <div id="test-results" style="margin-top: 20px; padding: 15px; background: #f0f0f0;">
      <h3>Test Results</h3>
      <div id="results-content">Ready to run tests...</div>
    </div>
  </div>

  <script>
    let eventLog = [];
    let validationState = new Map();

    document.addEventListener('DOMContentLoaded', function() {
      setupEventListeners();
      setupButtonHandlers();
    });

    function setupEventListeners() {
      document.querySelectorAll('input, textarea, [contenteditable]').forEach(element => {
        ['input', 'change', 'focus', 'blur', 'keydown', 'keyup'].forEach(eventType => {
          element.addEventListener(eventType, function(e) {
            const event = {
              type: eventType,
              target: e.target.id || 'unknown',
              value: e.target.value || e.target.textContent || '',
              timestamp: Date.now(),
              key: e.key || null
            };
            eventLog.push(event);

            if (eventType === 'input' || eventType === 'blur') {
              validateField(e.target);
            }
          });
        });
      });
    }

    function validateField(element) {
      const value = element.value || element.textContent || '';
      const errorElement = document.getElementById(element.id + '-error');

      if (!errorElement) return;

      let isValid = true;
      let errorMessage = '';

      if (element.type === 'email' && value) {
        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!emailRegex.test(value)) {
          errorMessage = 'Please enter a valid email address';
          isValid = false;
        }
      }

      if (element.required && !value.trim()) {
        errorMessage = 'This field is required';
        isValid = false;
      }

      errorElement.textContent = errorMessage;
      validationState.set(element.id, { isValid, errorMessage, value });
    }

    function setupButtonHandlers() {
      document.getElementById('clear-all-btn').addEventListener('click', () => {
        document.querySelectorAll('input:not([readonly]):not([disabled]), textarea, [contenteditable]').forEach(el => {
          if (el.contentEditable === 'true') {
            el.innerHTML = '<p>Content cleared</p>';
          } else {
            el.value = '';
          }
        });
        document.querySelectorAll('.error').forEach(el => el.textContent = '');
        eventLog = [];
        updateResults('All fields cleared');
      });

      document.getElementById('validate-all-btn').addEventListener('click', () => {
        let results = [];
        document.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
          if (!el.disabled && !el.readOnly) {
            validateField(el);
            const state = validationState.get(el.id);
            results.push(el.id + ': ' + (state?.isValid ? 'Valid' : 'Invalid'));
          }
        });
        updateResults('Validation Results:\\n' + results.join('\\n'));
      });

      document.getElementById('fill-test-data-btn').addEventListener('click', () => {
        const testData = {
          'text-input': 'Sample text content',
          'password-input': 'TestData123',
          'email-input': 'test@example.com',
          'number-input': '42',
          'tel-input': '(555) 123-4567',
          'url-input': 'https://example.com',
          'textarea-input': 'Multi-line content\\nSecond line',
          'search-input': 'search query'
        };

        Object.entries(testData).forEach(([id, value]) => {
          const element = document.getElementById(id);
          if (element && !element.disabled && !element.readOnly) {
            element.value = value;
            validateField(element);
          }
        });

        const contentEditable = document.getElementById('contenteditable-input');
        if (contentEditable) {
          contentEditable.innerHTML = '<p>Rich text content</p>';
        }

        updateResults('Test data filled');
      });
    }

    function updateResults(message) {
      const resultsContent = document.getElementById('results-content');
      if (resultsContent) {
        const timestamp = new Date().toISOString();
        resultsContent.innerHTML = timestamp + ': ' + message;
      }
    }

    window.testUtils = {
      getEventLog: () => eventLog,
      getValidationState: () => Object.fromEntries(validationState),
      clearEventLog: () => { eventLog = []; }
    };
  </script>
</body>
</html>`;
}

/**
 * Creates an individual input element with proper attributes
 */
function createInputElement(config: InputFixtureConfig): string {
  const attributes: string[] = [
    `id="${config.id}"`,
    `name="${config.id}"`,
    `type="${config.type}"`
  ];

  if (config.placeholder) attributes.push(`placeholder="${config.placeholder}"`);
  if (config.required) attributes.push('required');
  if (config.disabled) attributes.push('disabled');
  if (config.readonly) attributes.push('readonly');
  if (config.minLength) attributes.push(`minlength="${config.minLength}"`);
  if (config.maxLength) attributes.push(`maxlength="${config.maxLength}"`);
  if (config.pattern) attributes.push(`pattern="${config.pattern}"`);
  if (config.min) attributes.push(`min="${config.min}"`);
  if (config.max) attributes.push(`max="${config.max}"`);
  if (config.step) attributes.push(`step="${config.step}"`);
  if (config.value) attributes.push(`value="${config.value}"`);

  return `
    <div class="form-group">
      <label for="${config.id}">${config.label}</label>
      <input ${attributes.join(' ')} />
      <div id="${config.id}-error" class="error"></div>
    </div>
  `;
}

/**
 * Validates that input fixtures are properly rendered
 */
export async function validateInputFixture(page: Page, selector: string): Promise<boolean> {
  try {
    const element = page.locator(selector);
    await element.waitFor({ state: 'visible', timeout: 5000 });

    const hasLabel = await element.evaluate(el => {
      const id = el.id;
      const label = document.querySelector(`label[for="${id}"]`);
      return !!label;
    });

    return hasLabel;
  } catch (error) {
    console.warn(`Validation failed for ${selector}:`, error);
    return false;
  }
}

/**
 * Sets up event listeners for interaction tracking during tests
 */
export async function setupInputEventListeners(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.testUtils && typeof window.testUtils.clearEventLog === 'function') {
      window.testUtils.clearEventLog();
    }
  });
}

// Declare window extensions for TypeScript
declare global {
  interface Window {
    testUtils: {
      getEventLog: () => any[];
      getValidationState: () => Record<string, any>;
      clearEventLog: () => void;
    };
  }
}

// Export fixture types and configurations
export { InputFixtureConfig, INPUT_FIXTURE_CONFIGS, SPECIAL_INPUT_CONFIGS };