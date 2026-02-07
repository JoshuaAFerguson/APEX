/**
 * @fileoverview Click Interactions Integration Tests
 *
 * Tests comprehensive click interaction scenarios including:
 * - Basic click events on various element types
 * - Click with modifier keys (Ctrl, Shift, Alt)
 * - Double-click and right-click (context menu)
 * - Click on disabled, hidden, and dynamic elements
 * - Click with timeout and error handling
 * - Event propagation and nested element clicks
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { createBrowser, createBrowserContext, createPage, captureScreenshot } from '../setup.js';
import { waitForElement, safeClick } from '../utils/test-helpers.js';
import * as path from 'path';
import * as fs from 'fs';

describe('Click Interactions Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let testPagePath: string;

  beforeAll(async () => {
    browser = await createBrowser();
    context = await createBrowserContext(browser);

    // Get the test page path
    testPagePath = `file://${path.join(__dirname, 'fixtures', 'element-interaction-test-page.html')}`;
  });

  afterAll(async () => {
    if (context) await context.close();
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    page = await createPage(context);
    await page.goto(testPagePath);

    // Wait for page to be fully loaded
    await page.waitForSelector('#event-log');
    await page.evaluate(() => window.testUtils?.clearEventLog());
  });

  afterEach(async () => {
    // Capture screenshot on test failure
    if (page && expect.getState().currentTestName) {
      const testName = expect.getState().currentTestName;
      if (testName?.includes('failed')) {
        await captureScreenshot(page, `click-interactions-${testName}.png`);
      }
    }

    if (page) await page.close();
  });

  describe('Basic Click Interactions', () => {
    it('should click on basic button element', async () => {
      // Click the basic button
      await page.click('#basic-button');

      // Verify click event was logged
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #basic-button');

      // Verify the element has the last-click data attribute
      const lastClick = await page.getAttribute('#basic-button', 'data-last-click');
      expect(lastClick).toBeDefined();
      expect(Number(lastClick)).toBeGreaterThan(0);
    });

    it('should click on link elements', async () => {
      // Prevent default navigation
      await page.evaluate(() => {
        document.getElementById('test-link')?.addEventListener('click', (e) => e.preventDefault());
      });

      await page.click('#test-link');

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #test-link');
    });

    it('should click on custom clickable elements', async () => {
      await page.click('#custom-clickable');

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #custom-clickable');
    });

    it('should handle different selector types (ID, class, data-testid)', async () => {
      // Test data-testid selector
      await page.click('[data-testid="basic-btn"]');

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #basic-button');
    });

    it('should measure click duration accurately', async () => {
      const startTime = Date.now();
      await page.click('#basic-button');
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Click with Modifier Keys', () => {
    it('should handle Ctrl+click', async () => {
      await page.click('#basic-button', { modifiers: ['Control'] });

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('ctrlKey":true');
    });

    it('should handle Shift+click', async () => {
      await page.click('#basic-button', { modifiers: ['Shift'] });

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('shiftKey":true');
    });

    it('should handle Alt+click', async () => {
      await page.click('#basic-button', { modifiers: ['Alt'] });

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('altKey":true');
    });

    it('should handle multiple modifier keys', async () => {
      await page.click('#basic-button', { modifiers: ['Control', 'Shift'] });

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('ctrlKey":true');
      expect(eventLog).toContain('shiftKey":true');
    });
  });

  describe('Double-click and Right-click Interactions', () => {
    it('should perform double-click interaction', async () => {
      await page.dblclick('#double-click-button');

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('dblclick on #double-click-button');
    });

    it('should perform right-click (context menu)', async () => {
      await page.click('#context-menu-button', { button: 'right' });

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('contextmenu on #context-menu-button');
    });

    it('should handle middle-click', async () => {
      await page.click('#basic-button', { button: 'middle' });

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('"button":1');
    });

    it('should handle click count parameter', async () => {
      await page.click('#basic-button', { clickCount: 2 });

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      // Double click should trigger both click and dblclick events
      expect(eventLog).toContain('click on #basic-button');
      expect(eventLog).toContain('dblclick on #basic-button');
    });
  });

  describe('Nested Element Click Propagation', () => {
    it('should handle click on nested elements with proper event propagation', async () => {
      await page.click('#nested-button');

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #nested-button');

      // Verify that the nested button was clicked specifically
      const nestedButtonClicked = await page.getAttribute('#nested-button', 'data-last-click');
      expect(nestedButtonClicked).toBeDefined();
    });

    it('should handle click on container vs nested element', async () => {
      // Click on container (should not trigger button click)
      await page.click('#nested-container');

      let eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #nested-container');

      // Clear log and click specifically on nested button
      await page.evaluate(() => window.testUtils?.clearEventLog());
      await page.click('#nested-button');

      eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #nested-button');
    });
  });

  describe('Dynamic Element Clicks', () => {
    it('should click on dynamically created elements', async () => {
      // Create a dynamic element
      await page.click('#create-dynamic-button');

      // Wait for the dynamic element to be created
      const dynamicElement = await page.waitForSelector('[id^="dynamic-element-"]', { timeout: 5000 });
      expect(dynamicElement).toBeDefined();

      // Get the dynamic element ID
      const dynamicId = await dynamicElement?.getAttribute('id');
      expect(dynamicId).toBeDefined();

      // Click the dynamic element
      await page.click(`#${dynamicId}`);

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain(`click on #${dynamicId}`);
    });

    it('should wait for element to appear before clicking', async () => {
      // This tests the waiting mechanism for delayed elements
      const clickPromise = page.click('#delayed-element', { timeout: 10000 });

      // Create the delayed element after a short delay
      setTimeout(async () => {
        await page.evaluate(() => {
          const container = document.getElementById('dynamic-elements-container');
          const delayedElement = document.createElement('button');
          delayedElement.id = 'delayed-element';
          delayedElement.className = 'click-button';
          delayedElement.textContent = 'Delayed Element';
          container?.appendChild(delayedElement);
        });
      }, 1000);

      // Wait for click to complete
      await expect(clickPromise).resolves.toBeDefined();

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #delayed-element');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should fail gracefully when clicking disabled elements', async () => {
      // Playwright allows clicking disabled elements, but they won't respond to events
      await page.click('#disabled-button', { force: true });

      // Verify that the click was attempted but the button remains disabled
      const isDisabled = await page.isDisabled('#disabled-button');
      expect(isDisabled).toBe(true);
    });

    it('should fail when clicking hidden elements without force', async () => {
      // This should throw an error because element is not visible
      await expect(page.click('#hidden-button')).rejects.toThrow();
    });

    it('should succeed when clicking hidden elements with force option', async () => {
      await page.click('#hidden-button', { force: true });

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #hidden-button');
    });

    it('should handle clicking invisible elements with force', async () => {
      await page.click('#invisible-button', { force: true });

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #invisible-button');
    });

    it('should handle clicking transparent elements with force', async () => {
      await page.click('#transparent-button', { force: true });

      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #transparent-button');
    });

    it('should timeout when clicking non-existent elements', async () => {
      await expect(page.click('#non-existent-element', { timeout: 1000 })).rejects.toThrow();
    });

    it('should handle invalid selectors gracefully', async () => {
      const invalidSelectors = ['', '   ', 'invalid..selector', '###bad'];

      for (const selector of invalidSelectors) {
        await expect(page.click(selector, { timeout: 1000 })).rejects.toThrow();
      }
    });

    it('should handle clicking elements that become detached', async () => {
      // Create element
      await page.evaluate(() => {
        const tempElement = document.createElement('button');
        tempElement.id = 'temp-element';
        tempElement.className = 'click-button';
        tempElement.textContent = 'Temporary Element';
        document.body.appendChild(tempElement);
      });

      // Verify element exists
      await page.waitForSelector('#temp-element');

      // Remove element
      await page.evaluate(() => {
        const element = document.getElementById('temp-element');
        element?.remove();
      });

      // Try to click removed element
      await expect(page.click('#temp-element', { timeout: 1000 })).rejects.toThrow();
    });
  });

  describe('Click Timing and Performance', () => {
    it('should complete multiple rapid clicks within reasonable time', async () => {
      const startTime = Date.now();

      // Perform 5 rapid clicks
      for (let i = 0; i < 5; i++) {
        await page.click('#basic-button');
      }

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify all clicks were registered
      const clickCount = await page.evaluate(() => {
        const log = window.testUtils?.getEventLog() || '';
        return (log.match(/click on #basic-button/g) || []).length;
      });
      expect(clickCount).toBe(5);
    });

    it('should handle click delay option', async () => {
      const startTime = Date.now();
      await page.click('#basic-button', { delay: 500 });
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(500);
    });

    it('should provide accurate timing measurements for various click types', async () => {
      const timings: Record<string, number> = {};

      // Basic click timing
      let start = Date.now();
      await page.click('#basic-button');
      timings.basic = Date.now() - start;

      // Double-click timing
      start = Date.now();
      await page.dblclick('#double-click-button');
      timings.doubleClick = Date.now() - start;

      // Right-click timing
      start = Date.now();
      await page.click('#context-menu-button', { button: 'right' });
      timings.rightClick = Date.now() - start;

      // All timings should be reasonable (under 5 seconds)
      Object.entries(timings).forEach(([type, duration]) => {
        expect(duration).toBeGreaterThan(0);
        expect(duration).toBeLessThan(5000);
        console.log(`${type} click timing: ${duration}ms`);
      });
    });
  });

  describe('Click Position and Coordinates', () => {
    it('should click at specific coordinates within element', async () => {
      // Get element bounds
      const bounds = await page.evaluate(() => {
        const element = document.getElementById('basic-button');
        return element?.getBoundingClientRect();
      });

      expect(bounds).toBeDefined();

      // Click at center of element
      if (bounds) {
        await page.click('#basic-button', {
          position: { x: bounds.width / 2, y: bounds.height / 2 }
        });

        const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
        expect(eventLog).toContain('click on #basic-button');
      }
    });

    it('should handle clicks near element edges', async () => {
      const bounds = await page.evaluate(() => {
        const element = document.getElementById('basic-button');
        return element?.getBoundingClientRect();
      });

      if (bounds) {
        // Click near top-left corner (within element)
        await page.click('#basic-button', {
          position: { x: 5, y: 5 }
        });

        let eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
        expect(eventLog).toContain('click on #basic-button');

        // Clear log and click near bottom-right corner
        await page.evaluate(() => window.testUtils?.clearEventLog());

        await page.click('#basic-button', {
          position: { x: bounds.width - 5, y: bounds.height - 5 }
        });

        eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
        expect(eventLog).toContain('click on #basic-button');
      }
    });
  });

  describe('Click State Verification', () => {
    it('should verify element state after click', async () => {
      await page.click('#basic-button');

      const elementState = await page.evaluate(() =>
        window.testUtils?.getElementState('#basic-button')
      );

      expect(elementState).toBeDefined();
      expect(elementState?.visible).toBe(true);
      expect(elementState?.enabled).toBe(true);
    });

    it('should handle dynamic state changes triggered by clicks', async () => {
      // Click to toggle visibility of target element
      await page.click('#toggle-visibility-button');

      // Check that target element is now hidden
      const targetState = await page.evaluate(() =>
        window.testUtils?.getElementState('#toggle-target')
      );

      expect(targetState?.visible).toBe(false);

      // Click again to restore visibility
      await page.click('#toggle-visibility-button');

      const restoredState = await page.evaluate(() =>
        window.testUtils?.getElementState('#toggle-target')
      );

      expect(restoredState?.visible).toBe(true);
    });
  });

  describe('Form Element Click Interactions', () => {
    it('should click on checkboxes and verify state changes', async () => {
      // Test unchecked checkbox
      const checkbox1InitialState = await page.isChecked('#checkbox1');
      expect(checkbox1InitialState).toBe(false);

      await page.click('#checkbox1');

      const checkbox1ClickedState = await page.isChecked('#checkbox1');
      expect(checkbox1ClickedState).toBe(true);

      // Verify event was logged
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #checkbox1');

      // Click again to uncheck
      await page.click('#checkbox1');
      const checkbox1DoubleClickedState = await page.isChecked('#checkbox1');
      expect(checkbox1DoubleClickedState).toBe(false);
    });

    it('should click on pre-checked checkboxes', async () => {
      // Test pre-checked checkbox (checkbox2 is checked by default)
      const checkbox2InitialState = await page.isChecked('#checkbox2');
      expect(checkbox2InitialState).toBe(true);

      await page.click('#checkbox2');

      const checkbox2ClickedState = await page.isChecked('#checkbox2');
      expect(checkbox2ClickedState).toBe(false);

      // Verify event was logged
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #checkbox2');
    });

    it('should handle clicks on disabled checkboxes gracefully', async () => {
      // Verify checkbox3 is disabled
      const isDisabled = await page.isDisabled('#checkbox3');
      expect(isDisabled).toBe(true);

      // Attempt to click disabled checkbox
      await page.click('#checkbox3', { force: true });

      // Verify state hasn't changed (disabled checkboxes shouldn't respond)
      const checkboxState = await page.isChecked('#checkbox3');
      expect(checkboxState).toBe(false); // Should remain unchecked
    });

    it('should click on radio buttons and verify state changes', async () => {
      // Test that radio2 is initially selected
      const radio2InitialState = await page.isChecked('#radio2');
      expect(radio2InitialState).toBe(true);

      // Click on radio1
      await page.click('#radio1');

      // Verify radio1 is now selected and radio2 is deselected
      const radio1ClickedState = await page.isChecked('#radio1');
      const radio2AfterClick = await page.isChecked('#radio2');

      expect(radio1ClickedState).toBe(true);
      expect(radio2AfterClick).toBe(false);

      // Verify event was logged
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #radio1');
    });

    it('should handle clicks on disabled radio buttons gracefully', async () => {
      // Verify radio3 is disabled
      const isDisabled = await page.isDisabled('#radio3');
      expect(isDisabled).toBe(true);

      // Get current state of radio group before clicking disabled radio
      const radio1StateBefore = await page.isChecked('#radio1');
      const radio2StateBefore = await page.isChecked('#radio2');

      // Attempt to click disabled radio button
      await page.click('#radio3', { force: true });

      // Verify radio group state hasn't changed
      const radio1StateAfter = await page.isChecked('#radio1');
      const radio2StateAfter = await page.isChecked('#radio2');
      const radio3StateAfter = await page.isChecked('#radio3');

      expect(radio1StateAfter).toBe(radio1StateBefore);
      expect(radio2StateAfter).toBe(radio2StateBefore);
      expect(radio3StateAfter).toBe(false); // Should remain unchecked
    });

    it('should click on labels to trigger associated form controls', async () => {
      // Click on label for checkbox1
      await page.click('label[for="checkbox1"]');

      // Verify checkbox1 state changed
      const checkboxState = await page.isChecked('#checkbox1');
      expect(checkboxState).toBe(true);

      // Click on label for radio1
      await page.click('label[for="radio1"]');

      // Verify radio1 state changed
      const radioState = await page.isChecked('#radio1');
      expect(radioState).toBe(true);

      // Verify event log contains label clicks
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('label');
    });

    it('should handle select dropdown clicks', async () => {
      // Clear log before test
      await page.evaluate(() => window.testUtils?.clearEventLog());

      // Click on select dropdown
      await page.click('#basic-select');

      // Select an option
      await page.selectOption('#basic-select', 'option1');

      // Verify selection
      const selectedValue = await page.inputValue('#basic-select');
      expect(selectedValue).toBe('option1');

      // Verify events were logged
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('change');
    });

    it('should handle multi-select clicks with Ctrl modifier', async () => {
      // Click first option in multi-select
      await page.click('#multi-select option[value="multi1"]');

      // Ctrl+click second option to add to selection
      await page.click('#multi-select option[value="multi2"]', { modifiers: ['Control'] });

      // Verify multiple selections
      const selectedValues = await page.evaluate(() => {
        const select = document.getElementById('multi-select') as HTMLSelectElement;
        return Array.from(select.selectedOptions).map(option => option.value);
      });

      expect(selectedValues).toContain('multi1');
      expect(selectedValues).toContain('multi2');
    });
  });

  describe('Custom Element Click Interactions', () => {
    it('should click on custom dropdown and select options', async () => {
      // Click on custom dropdown toggle
      await page.click('#custom-dropdown-toggle');

      // Wait for dropdown menu to appear
      await page.waitForSelector('#custom-dropdown-menu.show');

      // Click on a custom dropdown item
      await page.click('.custom-dropdown-item[data-value="custom1"]');

      // Verify selection was made
      const selectedValue = await page.getAttribute('#custom-dropdown-toggle', 'data-selected-value');
      expect(selectedValue).toBe('custom1');

      // Verify menu is closed
      const menuVisible = await page.isVisible('#custom-dropdown-menu.show');
      expect(menuVisible).toBe(false);
    });

    it('should close custom dropdown when clicking outside', async () => {
      // Open custom dropdown
      await page.click('#custom-dropdown-toggle');

      // Verify dropdown is open
      await page.waitForSelector('#custom-dropdown-menu.show');

      // Click outside the dropdown
      await page.click('body');

      // Verify dropdown is closed
      const menuVisible = await page.isVisible('#custom-dropdown-menu.show');
      expect(menuVisible).toBe(false);
    });

    it('should handle clicks on contenteditable elements', async () => {
      // Click on contenteditable div
      await page.click('#contenteditable-div');

      // Verify it receives focus
      const isFocused = await page.evaluate(() => {
        return document.activeElement?.id === 'contenteditable-div';
      });
      expect(isFocused).toBe(true);

      // Verify event was logged
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #contenteditable-div');
    });
  });

  describe('Advanced Click Interaction Patterns', () => {
    it('should handle rapid successive clicks on form elements', async () => {
      // Perform rapid clicks on checkbox to test toggle behavior
      const clickCount = 5;
      for (let i = 0; i < clickCount; i++) {
        await page.click('#checkbox1');
      }

      // Since we clicked an odd number of times, checkbox should be checked
      const finalState = await page.isChecked('#checkbox1');
      expect(finalState).toBe(true);

      // Verify all clicks were registered
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      const clickEvents = (eventLog.match(/click on #checkbox1/g) || []).length;
      expect(clickEvents).toBe(clickCount);
    });

    it('should handle clicks with different timing intervals', async () => {
      // Clear log before test
      await page.evaluate(() => window.testUtils?.clearEventLog());

      // Click with varying delays
      await page.click('#basic-button');
      await page.waitForTimeout(100);

      await page.click('#basic-button');
      await page.waitForTimeout(500);

      await page.click('#basic-button');

      // Verify all clicks were registered with timing information
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      const clickEvents = (eventLog.match(/click on #basic-button/g) || []).length;
      expect(clickEvents).toBe(3);

      // Verify timestamps show different intervals
      const timestamps = eventLog.split('\n')
        .filter(line => line.includes('click on #basic-button'))
        .map(line => line.match(/\[(.*?)\]/)?.[1])
        .filter(Boolean);

      expect(timestamps).toHaveLength(3);
    });

    it('should handle clicks on elements becoming visible during animation', async () => {
      // This test uses the delayed element that appears after clicking enable button
      await page.click('#enable-disabled-button');

      // Wait for the delayed element to become visible
      await page.waitForSelector('#delayed-input', { state: 'visible', timeout: 10000 });

      // Now click on the newly visible element
      await page.click('#delayed-input');

      // Verify the click was registered
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #delayed-input');
    });

    it('should handle clicks on scrollable content', async () => {
      // Scroll to the button at bottom of scroll container
      await page.click('#scroll-target');

      // Verify the click was successful even though element needed scrolling
      const eventLog = await page.evaluate(() => window.testUtils?.getEventLog());
      expect(eventLog).toContain('click on #scroll-target');
    });
  });
});