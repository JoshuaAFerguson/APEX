/**
 * @fileoverview Browser Test Fixtures for APEX Integration Testing
 *
 * Safe and focused test fixtures for browser automation integration testing including:
 * - Basic HTML test pages without sensitive content
 * - Test scenario definitions for common browser operations
 * - Mock data structures for testing various scenarios
 * - Utility functions for fixture management
 *
 * @module tests/test-utils/browser-test-fixtures
 */

import type { Page } from 'playwright';

// ============================================================================
// Basic Test Page Templates
// ============================================================================

/**
 * Simple test page with basic interactive elements
 */
export const SIMPLE_TEST_PAGE = `
<!DOCTYPE html>
<html>
<head>
    <title>APEX Test Page</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .button { background: #007acc; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin: 5px; }
        #output { background: #f5f5f5; padding: 15px; margin: 10px 0; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <h1>Test Page</h1>
    <button id="test-button" class="button">Click Me</button>
    <input id="test-input" type="text" placeholder="Enter text">
    <div id="output">Ready for testing</div>
    <script>
        document.getElementById('test-button').onclick = function() {
            document.getElementById('output').innerHTML = 'Button clicked at ' + new Date().toISOString();
        };
    </script>
</body>
</html>
`;

/**
 * Form test page for input validation scenarios
 */
export const FORM_TEST_PAGE = `
<!DOCTYPE html>
<html>
<head>
    <title>Form Test Page</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; }
        input, select { width: 200px; padding: 8px; margin-bottom: 10px; }
        .button { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>Form Testing</h1>
    <form id="test-form">
        <div class="form-group">
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" required>
        </div>
        <div class="form-group">
            <label for="option">Choose Option:</label>
            <select id="option" name="option">
                <option value="a">Option A</option>
                <option value="b">Option B</option>
                <option value="c">Option C</option>
            </select>
        </div>
        <button type="submit" class="button">Submit</button>
    </form>
    <div id="result">No form submitted yet</div>
    <script>
        document.getElementById('test-form').onsubmit = function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            document.getElementById('result').innerHTML = 'Form submitted with: ' + JSON.stringify(data);
        };
    </script>
</body>
</html>
`;

// ============================================================================
// Test Scenario Definitions
// ============================================================================

/**
 * Browser test step interface
 */
export interface BrowserTestStep {
  action: 'click' | 'type' | 'select' | 'wait' | 'navigate' | 'screenshot';
  selector?: string;
  value?: string;
  timeout?: number;
  description: string;
}

/**
 * Browser test scenario interface
 */
export interface BrowserTestScenario {
  name: string;
  description: string;
  page: string;
  steps: BrowserTestStep[];
  assertions: string[];
}

/**
 * Pre-defined test scenarios
 */
export const TEST_SCENARIOS: BrowserTestScenario[] = [
  {
    name: 'basic-interaction',
    description: 'Test basic button click interaction',
    page: SIMPLE_TEST_PAGE,
    steps: [
      { action: 'click', selector: '#test-button', description: 'Click the test button' },
      { action: 'wait', timeout: 500, description: 'Wait for UI update' }
    ],
    assertions: ['output contains timestamp']
  },
  {
    name: 'form-submission',
    description: 'Test form filling and submission',
    page: FORM_TEST_PAGE,
    steps: [
      { action: 'type', selector: '#name', value: 'Test User', description: 'Fill name field' },
      { action: 'select', selector: '#option', value: 'b', description: 'Select option B' },
      { action: 'click', selector: 'button[type="submit"]', description: 'Submit form' },
      { action: 'wait', timeout: 300, description: 'Wait for form processing' }
    ],
    assertions: ['result contains form data']
  }
];

// ============================================================================
// Mock Data for Testing
// ============================================================================

/**
 * Test data for various scenarios
 */
export const MOCK_TEST_DATA = {
  users: [
    { id: 1, name: 'Test User 1', role: 'admin' },
    { id: 2, name: 'Test User 2', role: 'user' },
    { id: 3, name: 'Test User 3', role: 'guest' }
  ],

  formInputs: {
    valid: {
      name: 'John Doe',
      email: 'john@example.com',
      option: 'a'
    },
    invalid: {
      name: '',
      email: 'invalid-email',
      option: ''
    }
  },

  navigationPaths: [
    { path: '/', title: 'Home Page' },
    { path: '/about', title: 'About Page' },
    { path: '/contact', title: 'Contact Page' }
  ]
};

// ============================================================================
// Browser Permission Test Configurations
// ============================================================================

/**
 * Permission test scenario configuration
 */
export interface PermissionTestConfig {
  operation: string;
  shouldDeny: boolean;
  expectedError?: string;
  context?: Record<string, any>;
}

/**
 * Browser permission test scenarios
 */
export const PERMISSION_TEST_SCENARIOS: PermissionTestConfig[] = [
  {
    operation: 'navigate',
    shouldDeny: false,
    context: { url: 'http://localhost:3000' }
  },
  {
    operation: 'screenshot',
    shouldDeny: false,
    context: { path: '/tmp/test-screenshot.png' }
  },
  {
    operation: 'evaluate',
    shouldDeny: true,
    expectedError: 'Script execution not permitted',
    context: { script: 'document.title' }
  }
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Load a test page fixture
 */
export async function loadTestPage(page: Page, pageContent: string): Promise<void> {
  await page.setContent(pageContent);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Execute a test scenario
 */
export async function executeTestScenario(
  page: Page,
  scenario: BrowserTestScenario
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Load the test page
    await loadTestPage(page, scenario.page);

    // Execute each step
    for (const step of scenario.steps) {
      try {
        await executeTestStep(page, step);
      } catch (error) {
        errors.push(`Step "${step.description}" failed: ${error}`);
      }
    }

    return { success: errors.length === 0, errors };
  } catch (error) {
    errors.push(`Scenario execution failed: ${error}`);
    return { success: false, errors };
  }
}

/**
 * Execute a single test step
 */
async function executeTestStep(page: Page, step: BrowserTestStep): Promise<void> {
  switch (step.action) {
    case 'click':
      if (step.selector) {
        await page.click(step.selector);
      }
      break;
    case 'type':
      if (step.selector && step.value) {
        await page.fill(step.selector, step.value);
      }
      break;
    case 'select':
      if (step.selector && step.value) {
        await page.selectOption(step.selector, step.value);
      }
      break;
    case 'wait':
      if (step.timeout) {
        await page.waitForTimeout(step.timeout);
      }
      break;
    case 'screenshot':
      await page.screenshot({ path: `/tmp/test-${Date.now()}.png` });
      break;
    case 'navigate':
      if (step.value) {
        await page.goto(step.value);
      }
      break;
  }
}

/**
 * Create browser automation test context
 */
export interface BrowserTestContext {
  scenarios: BrowserTestScenario[];
  mockData: typeof MOCK_TEST_DATA;
  permissionTests: PermissionTestConfig[];
}

/**
 * Create test context for browser automation
 */
export function createBrowserTestContext(): BrowserTestContext {
  return {
    scenarios: TEST_SCENARIOS,
    mockData: MOCK_TEST_DATA,
    permissionTests: PERMISSION_TEST_SCENARIOS
  };
}

/**
 * Validate test page content
 */
export async function validatePageContent(
  page: Page,
  expectedElements: string[]
): Promise<{ valid: boolean; missing: string[] }> {
  const missing: string[] = [];

  for (const selector of expectedElements) {
    const element = await page.locator(selector).first();
    const isVisible = await element.isVisible().catch(() => false);

    if (!isVisible) {
      missing.push(selector);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  BrowserTestStep,
  BrowserTestScenario,
  PermissionTestConfig,
  BrowserTestContext
};