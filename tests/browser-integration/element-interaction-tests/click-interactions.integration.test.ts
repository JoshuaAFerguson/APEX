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
});