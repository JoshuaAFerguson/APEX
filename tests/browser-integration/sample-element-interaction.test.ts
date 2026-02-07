/**
 * @fileoverview Sample Element Interaction Test
 *
 * This sample test demonstrates the full element interaction infrastructure
 * capabilities and serves as both a test and documentation of the available utilities.
 *
 * This test verifies that:
 * ✅ Element creation utilities work correctly
 * ✅ Wait conditions and state management function properly
 * ✅ Interactive testing helpers perform reliable operations
 * ✅ Assertion utilities provide detailed validation
 * ✅ Integration with screenshot and browser utilities is seamless
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest } from '../test-utils/browser-test-base.js';
import {
  createElement,
  createTestForm,
  waitForConditions,
  getElementState,
  performClick,
  performTextInput,
  fillForm,
  assertElement,
  assertElements,
  type FormField,
  type ElementAssertion
} from './utils/element-interaction-helpers.js';
import {
  takeScreenshot,
  waitForElement,
  safeClick,
  safeFill
} from './utils/test-helpers.js';

describe('Sample Element Interaction Test', () => {
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

  it('demonstrates complete element interaction workflow', async () => {
    // 1. Set up a test page
    await browserTest.context.page!.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sample Test Page</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
          .button { padding: 10px 20px; margin: 5px; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; }
          .input { padding: 8px; margin: 5px; border: 1px solid #ccc; border-radius: 4px; }
          #output { margin-top: 10px; padding: 10px; background: #f0f0f0; border-radius: 4px; min-height: 50px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Sample Element Interaction Test</h1>
          <div class="test-section" id="buttons-section">
            <h2>Button Tests</h2>
            <button id="sample-button" class="button">Sample Button</button>
            <div id="button-output">No clicks yet</div>
          </div>
          <div class="test-section" id="inputs-section">
            <h2>Input Tests</h2>
            <input type="text" id="sample-input" class="input" placeholder="Enter text" />
            <div id="input-output">No text entered</div>
          </div>
          <div id="output">Test output will appear here</div>
        </div>
        <script>
          document.getElementById('sample-button').addEventListener('click', function() {
            const output = document.getElementById('button-output');
            output.textContent = 'Button clicked at ' + new Date().toISOString();
          });

          document.getElementById('sample-input').addEventListener('input', function() {
            const output = document.getElementById('input-output');
            output.textContent = 'Text entered: ' + this.value;
          });
        </script>
      </body>
      </html>
    `);

    await browserTest.context.page!.waitForLoadState('domcontentloaded');

    // 2. Test basic element interactions
    console.log('Testing basic button click...');

    // Wait for button to be ready and click it
    await waitForElement(browserTest.context.page!, '#sample-button', {
      visible: true,
      enabled: true
    });

    const clickResult = await performClick(browserTest.context.page!, '#sample-button', {
      captureBeforeState: true,
      waitForStable: true
    });

    expect(clickResult.success).toBe(true);
    expect(clickResult.beforeState).toBeDefined();

    // Verify the click had the expected effect
    const buttonOutput = await browserTest.context.page!.locator('#button-output').textContent();
    expect(buttonOutput).toContain('Button clicked at');

    // 3. Test text input
    console.log('Testing text input...');

    const inputText = 'Sample test text input';
    const inputResult = await performTextInput(
      browserTest.context.page!,
      '#sample-input',
      inputText,
      {
        clearFirst: true,
        validateInput: true,
        expectedValue: inputText
      }
    );

    expect(inputResult.success).toBe(true);
    expect(inputResult.finalValue).toBe(inputText);
    expect(inputResult.expectedMatch).toBe(true);

    // Verify input had the expected effect
    const inputOutput = await browserTest.context.page!.locator('#input-output').textContent();
    expect(inputOutput).toContain(inputText);

    // 4. Create a dynamic form for more complex testing
    console.log('Testing dynamic form creation...');

    const formFields: FormField[] = [
      {
        selector: 'name',
        type: 'text',
        value: 'Test User',
        required: true
      },
      {
        selector: 'email',
        type: 'email',
        value: 'test@example.com',
        required: true
      },
      {
        selector: 'subscribe',
        type: 'checkbox',
        value: true
      }
    ];

    const { form, fields } = await createTestForm(browserTest.context.page!, {
      id: 'sample-form',
      fields: formFields,
      submitButton: true,
      parent: '.container'
    });

    expect(form).toBeDefined();
    expect(Object.keys(fields)).toHaveLength(3);

    // 5. Fill the form using utilities
    const formData = {
      '#sample-form-name': 'John Doe',
      '#sample-form-email': 'john@example.com'
    };

    const fillResult = await fillForm(browserTest.context.page!, '#sample-form', formData, {
      validateEach: true,
      clearBefore: true
    });

    expect(fillResult.success).toBe(true);
    expect(fillResult.fieldResults['#sample-form-name'].success).toBe(true);
    expect(fillResult.fieldResults['#sample-form-email'].success).toBe(true);

    // 6. Create additional dynamic elements to test collection creation
    console.log('Testing dynamic element collection creation...');

    const dynamicElements = await browserTest.context.page!.evaluateHandle(() => {
      const container = document.querySelector('.container');
      const dynamicSection = document.createElement('div');
      dynamicSection.className = 'test-section';
      dynamicSection.id = 'dynamic-section';
      dynamicSection.innerHTML = '<h2>Dynamic Elements</h2>';
      container!.appendChild(dynamicSection);
      return dynamicSection;
    });

    // Create a collection of test buttons
    const buttonElements = await browserTest.context.page!.evaluate(() => {
      const container = document.getElementById('dynamic-section');
      const buttons = [];
      for (let i = 0; i < 3; i++) {
        const button = document.createElement('button');
        button.id = `dynamic-btn-${i}`;
        button.className = 'button';
        button.textContent = `Dynamic Button ${i + 1}`;
        button.addEventListener('click', function() {
          this.textContent = `Clicked ${i + 1}`;
          this.setAttribute('data-clicked', 'true');
        });
        container!.appendChild(button);
        buttons.push(button);
      }
      return buttons.length;
    });

    expect(buttonElements).toBe(3);

    // Test clicking the dynamic buttons
    for (let i = 0; i < 3; i++) {
      const selector = `#dynamic-btn-${i}`;
      await safeClick(browserTest.context.page!, selector);

      // Verify the button was clicked
      const buttonText = await browserTest.context.page!.locator(selector).textContent();
      expect(buttonText).toBe(`Clicked ${i + 1}`);

      const clickedAttr = await browserTest.context.page!.locator(selector).getAttribute('data-clicked');
      expect(clickedAttr).toBe('true');
    }

    // 7. Test comprehensive element state assertions
    console.log('Testing element state assertions...');

    const assertions: (ElementAssertion & { selector: string })[] = [
      {
        selector: '#sample-button',
        type: 'state',
        property: 'visible',
        expected: true
      },
      {
        selector: '#sample-input',
        type: 'attribute',
        attribute: 'value',
        expected: 'Sample test text input'
      },
      {
        selector: '#sample-form',
        type: 'state',
        property: 'visible',
        expected: true
      },
      {
        selector: '#dynamic-btn-0',
        type: 'text',
        expected: 'Clicked 1'
      },
      {
        selector: '#dynamic-btn-0',
        type: 'attribute',
        attribute: 'data-clicked',
        expected: 'true'
      }
    ];

    const assertionResult = await assertElements(browserTest.context.page!, assertions);
    expect(assertionResult.passed).toBe(true);

    // Verify all individual assertions passed
    assertionResult.results.forEach((result, index) => {
      console.log(`Assertion ${index + 1}: ${result.passed ? 'PASS' : 'FAIL'} - ${result.message}`);
      expect(result.passed).toBe(true);
    });

    // 8. Capture a final screenshot to document the test
    console.log('Capturing final screenshot...');

    const screenshotPath = await takeScreenshot(
      browserTest.context.page!,
      'sample-element-interaction-demo',
      browserTest.context.tempDir!
    );

    expect(screenshotPath).toBeDefined();

    // Verify screenshot file exists
    const fs = await import('fs/promises');
    const stats = await fs.stat(screenshotPath);
    expect(stats.size).toBeGreaterThan(0);

    // 9. Test element state tracking
    console.log('Testing element state management...');

    const buttonState = await getElementState(browserTest.context.page!, '#sample-button');
    expect(buttonState).toBeDefined();
    expect(buttonState!.visible).toBe(true);
    expect(buttonState!.enabled).toBe(true);
    expect(buttonState!.tagName).toBe('button');
    expect(buttonState!.text).toBe('Sample Button');

    const inputState = await getElementState(browserTest.context.page!, '#sample-input');
    expect(inputState).toBeDefined();
    expect(inputState!.visible).toBe(true);
    expect(inputState!.enabled).toBe(true);
    expect(inputState!.value).toBe('Sample test text input');

    console.log('✅ Sample element interaction test completed successfully');
    console.log('🎯 All infrastructure components verified:');
    console.log('  - Element creation and manipulation');
    console.log('  - Form creation and filling');
    console.log('  - Dynamic element interaction');
    console.log('  - Comprehensive state assertions');
    console.log('  - Screenshot capture');
    console.log('  - Wait conditions and stability checks');
    console.log('  - Integration with existing browser utilities');
  });

  it('demonstrates element wait conditions and state management', async () => {
    // Set up a page with delayed/dynamic content
    await browserTest.context.page!.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Wait Conditions Test</title>
        <style>
          .delayed-element { display: none; }
          .loading { opacity: 0.5; }
        </style>
      </head>
      <body>
        <div id="container">
          <button id="trigger-btn">Trigger Delayed Element</button>
          <div id="delayed-element" class="delayed-element">I will appear after delay!</div>
          <div id="output">Ready</div>
        </div>
        <script>
          document.getElementById('trigger-btn').addEventListener('click', function() {
            const delayed = document.getElementById('delayed-element');
            const output = document.getElementById('output');

            output.textContent = 'Loading...';
            output.className = 'loading';

            setTimeout(() => {
              delayed.style.display = 'block';
              delayed.textContent = 'Element appeared at ' + new Date().toISOString();
              output.textContent = 'Done!';
              output.className = '';
            }, 1000);
          });
        </script>
      </body>
      </html>
    `);

    await browserTest.context.page!.waitForLoadState('domcontentloaded');

    // Test initial state
    let delayedState = await getElementState(browserTest.context.page!, '#delayed-element');
    expect(delayedState).toBeDefined();
    expect(delayedState!.visible).toBe(false);

    // Trigger the delayed element
    await safeClick(browserTest.context.page!, '#trigger-btn');

    // Wait for the element to become visible with timeout
    const becameVisible = await waitForConditions(browserTest.context.page!, '#delayed-element', [
      { condition: 'visible', timeout: 5000 }
    ]);

    expect(becameVisible).toBe(true);

    // Verify final state
    delayedState = await getElementState(browserTest.context.page!, '#delayed-element');
    expect(delayedState).toBeDefined();
    expect(delayedState!.visible).toBe(true);
    expect(delayedState!.text).toContain('Element appeared at');

    console.log('✅ Wait conditions and state management test completed');
  });

  it('demonstrates advanced form interaction testing', async () => {
    // Create a comprehensive form page
    await browserTest.context.page!.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Advanced Form Test</title>
        <style>
          form { max-width: 500px; margin: 20px; }
          .form-group { margin: 10px 0; }
          label { display: block; margin-bottom: 5px; }
          input, textarea, select { width: 100%; padding: 8px; margin-bottom: 10px; }
          .error { color: red; }
          .success { color: green; }
        </style>
      </head>
      <body>
        <form id="advanced-form">
          <div class="form-group">
            <label for="username">Username *</label>
            <input type="text" id="username" name="username" required>
          </div>
          <div class="form-group">
            <label for="email">Email *</label>
            <input type="email" id="email" name="email" required>
          </div>
          <div class="form-group">
            <label for="age">Age</label>
            <input type="number" id="age" name="age" min="18" max="100">
          </div>
          <div class="form-group">
            <label for="bio">Biography</label>
            <textarea id="bio" name="bio" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label for="country">Country</label>
            <select id="country" name="country">
              <option value="">Choose country</option>
              <option value="us">United States</option>
              <option value="ca">Canada</option>
              <option value="uk">United Kingdom</option>
            </select>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="newsletter" name="newsletter">
              Subscribe to newsletter
            </label>
          </div>
          <div class="form-group">
            <button type="submit">Submit</button>
            <button type="reset">Reset</button>
          </div>
        </form>
        <div id="form-result"></div>
        <script>
          document.getElementById('advanced-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const result = Object.fromEntries(formData.entries());
            document.getElementById('form-result').innerHTML =
              '<div class="success">Form submitted: ' + JSON.stringify(result, null, 2) + '</div>';
          });
        </script>
      </body>
      </html>
    `);

    await browserTest.context.page!.waitForLoadState('domcontentloaded');

    // Test comprehensive form filling
    const formData = {
      '#username': 'testuser123',
      '#email': 'testuser@example.com',
      '#age': '25',
      '#bio': 'This is a test biography with multiple lines.\nSecond line of biography.',
      '#country': 'us'
    };

    const fillResult = await fillForm(browserTest.context.page!, '#advanced-form', formData, {
      validateEach: true,
      clearBefore: true
    });

    expect(fillResult.success).toBe(true);

    // Test checkbox interaction separately
    const checkbox = browserTest.context.page!.locator('#newsletter');
    await checkbox.check();
    const isChecked = await checkbox.isChecked();
    expect(isChecked).toBe(true);

    // Test form submission
    await safeClick(browserTest.context.page!, 'button[type="submit"]');

    // Wait for form result
    await browserTest.context.page!.waitForSelector('#form-result div.success', { timeout: 5000 });

    const resultText = await browserTest.context.page!.locator('#form-result').textContent();
    expect(resultText).toContain('Form submitted');
    expect(resultText).toContain('testuser123');
    expect(resultText).toContain('testuser@example.com');

    console.log('✅ Advanced form interaction test completed');
  });
});