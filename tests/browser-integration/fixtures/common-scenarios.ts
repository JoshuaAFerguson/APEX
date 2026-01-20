/**
 * @fileoverview Common browser automation test scenarios and fixtures
 *
 * This file provides reusable test scenarios for browser automation testing:
 * - Navigation scenarios
 * - Form interaction scenarios
 * - Element interaction scenarios
 * - Console message scenarios
 * - Error handling scenarios
 */

import { Page, BrowserContext } from 'playwright';

// Test scenario types
export interface NavigationScenario {
  name: string;
  url: string;
  expectedTitle?: string;
  expectedElements?: string[];
  timeout?: number;
}

export interface InteractionScenario {
  name: string;
  actions: Array<{
    type: 'click' | 'type' | 'select' | 'wait';
    selector?: string;
    value?: string;
    timeout?: number;
  }>;
  expectedResults: Array<{
    type: 'text' | 'attribute' | 'visible' | 'hidden';
    selector: string;
    expected: string;
  }>;
}

export interface ConsoleScenario {
  name: string;
  triggerAction: () => Promise<void>;
  expectedMessages: Array<{
    type: 'log' | 'warn' | 'error' | 'info';
    text: string;
  }>;
}

// Common navigation scenarios
export const NAVIGATION_SCENARIOS: NavigationScenario[] = [
  {
    name: 'Basic page load',
    url: 'data:text/html,<html><head><title>Test Page</title></head><body><h1>Hello World</h1></body></html>',
    expectedTitle: 'Test Page',
    expectedElements: ['h1'],
    timeout: 10000,
  },
  {
    name: 'Page with forms',
    url: 'data:text/html,<html><head><title>Form Test</title></head><body><form><input type="text" name="username"><input type="password" name="password"><button type="submit">Submit</button></form></body></html>',
    expectedTitle: 'Form Test',
    expectedElements: ['form', 'input[name="username"]', 'input[name="password"]', 'button[type="submit"]'],
    timeout: 10000,
  },
  {
    name: 'Page with JavaScript',
    url: 'data:text/html,<html><head><title>JS Test</title></head><body><button onclick="alert(\'clicked\')">Click Me</button><script>console.log("Page loaded");</script></body></html>',
    expectedTitle: 'JS Test',
    expectedElements: ['button'],
    timeout: 10000,
  },
];

// Common interaction scenarios
export const INTERACTION_SCENARIOS: InteractionScenario[] = [
  {
    name: 'Form input and submission',
    actions: [
      { type: 'type', selector: 'input[name="username"]', value: 'testuser' },
      { type: 'type', selector: 'input[name="password"]', value: 'testpass' },
      { type: 'click', selector: 'button[type="submit"]' },
    ],
    expectedResults: [
      { type: 'attribute', selector: 'input[name="username"]', expected: 'testuser' },
      { type: 'attribute', selector: 'input[name="password"]', expected: 'testpass' },
    ],
  },
  {
    name: 'Button click interaction',
    actions: [
      { type: 'click', selector: 'button' },
      { type: 'wait', timeout: 1000 },
    ],
    expectedResults: [
      { type: 'visible', selector: 'button', expected: 'true' },
    ],
  },
];

// Common console scenarios
export const CONSOLE_SCENARIOS: ConsoleScenario[] = [
  {
    name: 'Console log messages',
    triggerAction: async () => {
      // This would be implemented by the specific test
    },
    expectedMessages: [
      { type: 'log', text: 'Page loaded' },
    ],
  },
  {
    name: 'Console error messages',
    triggerAction: async () => {
      // This would be implemented by the specific test
    },
    expectedMessages: [
      { type: 'error', text: 'Test error message' },
    ],
  },
];

/**
 * Creates a test page with common elements for browser automation testing
 */
export async function createTestPage(page: Page): Promise<void> {
  const testHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>APEX Browser Test Page</title>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          background: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .section {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .button {
          background: #007acc;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
        }
        .button:hover {
          background: #005a9e;
        }
        .input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin: 5px;
          width: 200px;
        }
        .output {
          background: #f9f9f9;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
          min-height: 50px;
        }
        .hidden {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>APEX Browser Test Page</h1>

        <div class="section">
          <h2>Form Testing</h2>
          <form id="testForm">
            <input type="text" name="username" class="input" placeholder="Username" />
            <input type="password" name="password" class="input" placeholder="Password" />
            <input type="email" name="email" class="input" placeholder="Email" />
            <select name="country" class="input">
              <option value="">Select Country</option>
              <option value="us">United States</option>
              <option value="uk">United Kingdom</option>
              <option value="ca">Canada</option>
            </select>
            <br>
            <input type="checkbox" name="terms" id="terms" />
            <label for="terms">I agree to the terms</label>
            <br>
            <button type="submit" class="button">Submit</button>
            <button type="reset" class="button">Reset</button>
          </form>
        </div>

        <div class="section">
          <h2>Interactive Elements</h2>
          <button id="showHideBtn" class="button">Show/Hide Content</button>
          <button id="alertBtn" class="button">Show Alert</button>
          <button id="errorBtn" class="button">Generate Error</button>
          <button id="consoleBtn" class="button">Log to Console</button>
          <div id="toggleContent" class="output">
            This content can be toggled.
          </div>
        </div>

        <div class="section">
          <h2>Dynamic Content</h2>
          <input type="text" id="dynamicInput" class="input" placeholder="Type something..." />
          <button id="addContentBtn" class="button">Add Content</button>
          <div id="dynamicOutput" class="output">
            Dynamic content will appear here...
          </div>
        </div>

        <div class="section">
          <h2>Network Testing</h2>
          <button id="fetchBtn" class="button">Fetch Data</button>
          <button id="slowBtn" class="button">Slow Request</button>
          <div id="networkOutput" class="output">
            Network responses will appear here...
          </div>
        </div>
      </div>

      <script>
        // Form handling
        document.getElementById('testForm').addEventListener('submit', function(e) {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          console.log('Form submitted with data:', data);
          alert('Form submitted successfully!');
        });

        // Interactive elements
        document.getElementById('showHideBtn').addEventListener('click', function() {
          const content = document.getElementById('toggleContent');
          content.classList.toggle('hidden');
          console.log('Content toggled:', !content.classList.contains('hidden'));
        });

        document.getElementById('alertBtn').addEventListener('click', function() {
          alert('This is a test alert');
          console.log('Alert shown');
        });

        document.getElementById('errorBtn').addEventListener('click', function() {
          console.error('This is a test error message');
          throw new Error('Intentional test error');
        });

        document.getElementById('consoleBtn').addEventListener('click', function() {
          console.log('Info: Button clicked');
          console.warn('Warning: This is a test warning');
          console.error('Error: This is a test error');
          console.info('Info: This is test info');
        });

        // Dynamic content
        document.getElementById('addContentBtn').addEventListener('click', function() {
          const input = document.getElementById('dynamicInput').value;
          const output = document.getElementById('dynamicOutput');
          if (input) {
            const p = document.createElement('p');
            p.textContent = \`Added: \${input} at \${new Date().toISOString()}\`;
            output.appendChild(p);
            document.getElementById('dynamicInput').value = '';
            console.log('Content added:', input);
          }
        });

        // Network requests
        document.getElementById('fetchBtn').addEventListener('click', async function() {
          const output = document.getElementById('networkOutput');
          output.textContent = 'Fetching...';

          try {
            // Simulate API call with fake data
            const fakeData = { message: 'Success', timestamp: new Date().toISOString() };
            setTimeout(() => {
              output.textContent = \`Fetched: \${JSON.stringify(fakeData)}\`;
              console.log('Fetch completed:', fakeData);
            }, 1000);
          } catch (error) {
            output.textContent = \`Error: \${error.message}\`;
            console.error('Fetch error:', error);
          }
        });

        document.getElementById('slowBtn').addEventListener('click', function() {
          const output = document.getElementById('networkOutput');
          output.textContent = 'Processing slow request...';

          setTimeout(() => {
            output.textContent = 'Slow request completed after 3 seconds';
            console.log('Slow request completed');
          }, 3000);
        });

        // Initial console messages
        console.log('Test page initialized');
        console.info('All event listeners attached');
      </script>
    </body>
    </html>
  `;

  await page.setContent(testHTML);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Executes a navigation scenario and validates results
 */
export async function runNavigationScenario(
  page: Page,
  scenario: NavigationScenario
): Promise<void> {
  // Navigate to URL
  await page.goto(scenario.url, { timeout: scenario.timeout || 30000 });

  // Validate title if expected
  if (scenario.expectedTitle) {
    const title = await page.title();
    if (title !== scenario.expectedTitle) {
      throw new Error(`Expected title "${scenario.expectedTitle}", got "${title}"`);
    }
  }

  // Validate expected elements
  if (scenario.expectedElements) {
    for (const selector of scenario.expectedElements) {
      const element = await page.locator(selector).first();
      if (!(await element.isVisible())) {
        throw new Error(`Expected element "${selector}" to be visible`);
      }
    }
  }
}

/**
 * Executes an interaction scenario and validates results
 */
export async function runInteractionScenario(
  page: Page,
  scenario: InteractionScenario
): Promise<void> {
  // Execute actions
  for (const action of scenario.actions) {
    switch (action.type) {
      case 'click':
        if (action.selector) {
          await page.click(action.selector, { timeout: action.timeout });
        }
        break;
      case 'type':
        if (action.selector && action.value) {
          await page.fill(action.selector, action.value);
        }
        break;
      case 'select':
        if (action.selector && action.value) {
          await page.selectOption(action.selector, action.value);
        }
        break;
      case 'wait':
        await page.waitForTimeout(action.timeout || 1000);
        break;
    }
  }

  // Validate expected results
  for (const result of scenario.expectedResults) {
    const element = page.locator(result.selector);

    switch (result.type) {
      case 'text':
        const text = await element.textContent();
        if (text !== result.expected) {
          throw new Error(`Expected text "${result.expected}", got "${text}"`);
        }
        break;
      case 'attribute':
        const value = await element.inputValue();
        if (value !== result.expected) {
          throw new Error(`Expected value "${result.expected}", got "${value}"`);
        }
        break;
      case 'visible':
        const isVisible = await element.isVisible();
        const expectedVisible = result.expected === 'true';
        if (isVisible !== expectedVisible) {
          throw new Error(`Expected visibility ${expectedVisible}, got ${isVisible}`);
        }
        break;
      case 'hidden':
        const isHidden = await element.isHidden();
        const expectedHidden = result.expected === 'true';
        if (isHidden !== expectedHidden) {
          throw new Error(`Expected hidden ${expectedHidden}, got ${isHidden}`);
        }
        break;
    }
  }
}

/**
 * Monitors console messages during scenario execution
 */
export async function monitorConsoleMessages(
  page: Page,
  expectedMessages: Array<{ type: string; text: string }>
): Promise<void> {
  const capturedMessages: Array<{ type: string; text: string }> = [];

  // Set up console message listener
  page.on('console', (msg) => {
    capturedMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  // Wait a bit for messages to be captured
  await page.waitForTimeout(1000);

  // Validate expected messages
  for (const expected of expectedMessages) {
    const found = capturedMessages.find(
      (msg) => msg.type === expected.type && msg.text.includes(expected.text)
    );

    if (!found) {
      throw new Error(
        `Expected console message "${expected.type}: ${expected.text}" not found. ` +
        `Captured: ${JSON.stringify(capturedMessages)}`
      );
    }
  }
}

// Export utility functions and scenarios
export {
  NavigationScenario,
  InteractionScenario,
  ConsoleScenario,
};