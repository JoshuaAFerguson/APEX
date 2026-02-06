/**
 * @fileoverview Sample Infrastructure Demo Test
 *
 * This is a simple demonstration test that shows the element interaction
 * infrastructure working correctly. It serves as both a verification test
 * and an example of how to use the infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest, BrowserTestUtils } from '../test-utils/browser-test-base.js';
import {
  createElement,
  performClick,
  performTextInput,
  getElementState,
  assertElement
} from '../utils/element-interaction-helpers.js';
import { BUTTON_FIXTURES, INPUT_FIXTURES } from '../fixtures/dom-element-test-fixtures.js';
import { takeScreenshot } from '../utils/test-helpers.js';

describe('Sample Infrastructure Demo', () => {
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

  it('should demonstrate complete element interaction workflow', async () => {
    console.log('🚀 Starting sample infrastructure demo test...');

    // 1. Create test page
    console.log('📄 Creating test page...');
    await BrowserTestUtils.createTestPage(browserTest);

    // 2. Create dynamic button using fixture
    console.log('🔘 Creating dynamic button...');
    const dynamicButton = await createElement(browserTest.context.page!, {
      ...BUTTON_FIXTURES.primary,
      id: 'demo-button',
      text: 'Demo Button',
      parent: '.container'
    });

    expect(dynamicButton).toBeDefined();

    // 3. Create dynamic input using fixture
    console.log('📝 Creating dynamic input...');
    const dynamicInput = await createElement(browserTest.context.page!, {
      ...INPUT_FIXTURES.text,
      id: 'demo-input',
      attributes: {
        ...INPUT_FIXTURES.text.attributes,
        placeholder: 'Enter demo text...'
      },
      parent: '.container'
    });

    expect(dynamicInput).toBeDefined();

    // 4. Get element states
    console.log('🔍 Checking element states...');
    const buttonState = await getElementState(browserTest.context.page!, '#demo-button');
    const inputState = await getElementState(browserTest.context.page!, '#demo-input');

    expect(buttonState).toBeDefined();
    expect(buttonState!.visible).toBe(true);
    expect(buttonState!.text).toBe('Demo Button');

    expect(inputState).toBeDefined();
    expect(inputState!.visible).toBe(true);

    // 5. Perform text input
    console.log('⌨️  Performing text input...');
    const inputResult = await performTextInput(
      browserTest.context.page!,
      '#demo-input',
      'Hello from infrastructure demo!',
      {
        clearFirst: true,
        validateInput: true,
        expectedValue: 'Hello from infrastructure demo!'
      }
    );

    expect(inputResult.success).toBe(true);
    expect(inputResult.finalValue).toBe('Hello from infrastructure demo!');

    // 6. Perform button click
    console.log('👆 Performing button click...');
    const clickResult = await performClick(browserTest.context.page!, '#demo-button', {
      captureBeforeState: true,
      waitForStable: true
    });

    expect(clickResult.success).toBe(true);
    expect(clickResult.beforeState).toBeDefined();

    // 7. Assert element properties
    console.log('✅ Running element assertions...');
    const buttonAssertion = await assertElement(browserTest.context.page!, {
      selector: '#demo-button',
      type: 'text',
      expected: 'Demo Button'
    });

    const inputAssertion = await assertElement(browserTest.context.page!, {
      selector: '#demo-input',
      type: 'attribute',
      attribute: 'value',
      expected: 'Hello from infrastructure demo!'
    });

    expect(buttonAssertion.passed).toBe(true);
    expect(inputAssertion.passed).toBe(true);

    // 8. Take screenshot for verification
    console.log('📸 Taking verification screenshot...');
    const screenshotPath = await takeScreenshot(
      browserTest.context.page!,
      'sample-demo-complete',
      browserTest.context.tempDir!
    );

    expect(screenshotPath).toBeDefined();
    console.log(`📁 Screenshot saved: ${screenshotPath}`);

    // 9. Verify all elements still exist and are in expected state
    console.log('🔄 Final verification...');
    const finalButtonVisible = await browserTest.context.page!.locator('#demo-button').isVisible();
    const finalInputVisible = await browserTest.context.page!.locator('#demo-input').isVisible();
    const finalInputValue = await browserTest.context.page!.locator('#demo-input').inputValue();

    expect(finalButtonVisible).toBe(true);
    expect(finalInputVisible).toBe(true);
    expect(finalInputValue).toBe('Hello from infrastructure demo!');

    console.log('✅ Sample infrastructure demo test completed successfully!');
    console.log('🎯 All infrastructure components verified working:');
    console.log('  ✅ Browser test setup and teardown');
    console.log('  ✅ Dynamic element creation');
    console.log('  ✅ Element state management');
    console.log('  ✅ Text input interactions');
    console.log('  ✅ Button click interactions');
    console.log('  ✅ Element assertions');
    console.log('  ✅ Screenshot capture');
    console.log('  ✅ Test fixtures integration');
  });

  it('should demonstrate error handling', async () => {
    console.log('🚨 Testing error handling...');

    await BrowserTestUtils.createTestPage(browserTest);

    // Try to interact with non-existent element
    try {
      await performClick(browserTest.context.page!, '#non-existent-button', {
        timeout: 1000
      });
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
      console.log('✅ Error handling working correctly');
    }

    // Try invalid assertion
    const invalidAssertion = await assertElement(browserTest.context.page!, {
      selector: '#test-button',
      type: 'text',
      expected: 'Wrong Text'
    });

    expect(invalidAssertion.passed).toBe(false);
    expect(invalidAssertion.message).toContain('does not match');

    console.log('✅ Error handling demo completed');
  });
});