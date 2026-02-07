/**
 * @fileoverview Comprehensive Element Interaction Integration Tests
 *
 * This test suite provides comprehensive coverage for all element interaction scenarios:
 * - Click interactions (basic, modified, double-click, right-click)
 * - Type/input interactions for all input types
 * - Hover and focus state interactions
 * - Select dropdown interactions (single and multi-select)
 * - Checkbox and radio button interactions
 * - Dynamic element interactions
 * - Error handling and edge cases
 * - Accessibility and keyboard navigation
 *
 * Tests real DOM interactions using Playwright for browser automation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import * as path from 'path';

describe('Comprehensive Element Interaction Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let testPageContent: string;

  beforeAll(async () => {
    // Initialize browser
    browser = await chromium.launch({
      headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
      slowMo: process.env.CI ? 0 : 50,
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'reduce',
    });

    // Create comprehensive test page
    testPageContent = createTestPageHTML();
  });

  afterAll(async () => {
    if (context) await context.close();
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    page = await context.newPage();
    page.setDefaultTimeout(10000);

    // Load test page
    await page.setContent(testPageContent);
    await page.waitForSelector('#interaction-log');

    // Clear interaction log
    await page.evaluate(() => {
      (window as any).interactionLog = [];
      const logElement = document.getElementById('interaction-log');
      if (logElement) {
        logElement.textContent = 'Interaction log cleared';
      }
    });
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  describe('Click Interactions', () => {
    it('should handle basic button clicks', async () => {
      await page.click('#basic-button');

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('click:basic-button');

      const clickCount = await page.getAttribute('#basic-button', 'data-click-count');
      expect(clickCount).toBe('1');
    });

    it('should handle clicks with modifier keys', async () => {
      // Ctrl+click
      await page.click('#basic-button', { modifiers: ['Control'] });

      let log = await page.evaluate(() => (window as any).interactionLog);
      expect(log.some((entry: string) => entry.includes('ctrlKey:true'))).toBe(true);

      // Clear log
      await page.evaluate(() => (window as any).interactionLog = []);

      // Shift+click
      await page.click('#basic-button', { modifiers: ['Shift'] });

      log = await page.evaluate(() => (window as any).interactionLog);
      expect(log.some((entry: string) => entry.includes('shiftKey:true'))).toBe(true);
    });

    it('should handle double-click interactions', async () => {
      await page.dblclick('#double-click-target');

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('dblclick:double-click-target');
    });

    it('should handle right-click (context menu)', async () => {
      await page.click('#context-menu-target', { button: 'right' });

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('contextmenu:context-menu-target');
    });

    it('should handle disabled element clicks', async () => {
      await page.click('#disabled-button', { force: true });

      const isDisabled = await page.isDisabled('#disabled-button');
      expect(isDisabled).toBe(true);
    });

    it('should handle nested element clicks with event propagation', async () => {
      await page.click('#nested-child');

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('click:nested-child');
      expect(log).toContain('click:nested-parent');
    });
  });

  describe('Type and Input Interactions', () => {
    it('should handle text input typing', async () => {
      const testText = 'Test input text';
      await page.fill('#text-input', testText);

      const value = await page.inputValue('#text-input');
      expect(value).toBe(testText);

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log.some((entry: string) => entry.includes('input:text-input'))).toBe(true);
    });

    it('should handle email input with validation', async () => {
      const validEmail = 'test@example.com';
      await page.fill('#email-input', validEmail);

      const value = await page.inputValue('#email-input');
      expect(value).toBe(validEmail);

      const isValid = await page.evaluate(() => {
        const input = document.getElementById('email-input') as HTMLInputElement;
        return input.checkValidity();
      });
      expect(isValid).toBe(true);
    });

    it('should handle number input with constraints', async () => {
      await page.fill('#number-input', '42');

      const value = await page.inputValue('#number-input');
      expect(value).toBe('42');
    });

    it('should handle textarea input with multiple lines', async () => {
      const multiLineText = 'Line 1\nLine 2\nLine 3';
      await page.fill('#textarea-input', multiLineText);

      const value = await page.inputValue('#textarea-input');
      expect(value).toBe(multiLineText);
    });

    it('should handle keyboard events during typing', async () => {
      await page.focus('#keyboard-input');

      await page.keyboard.type('Hello');
      await page.keyboard.press('Enter');

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log.some((entry: string) => entry.includes('keydown:Enter'))).toBe(true);
    });
  });

  describe('Hover and Focus Interactions', () => {
    it('should handle hover state changes', async () => {
      await page.hover('#hover-target');

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('mouseenter:hover-target');

      // Move away to trigger mouseleave
      await page.hover('body');
      const updatedLog = await page.evaluate(() => (window as any).interactionLog);
      expect(updatedLog).toContain('mouseleave:hover-target');
    });

    it('should handle focus and blur events', async () => {
      await page.focus('#focus-target');

      let log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('focus:focus-target');

      // Blur by focusing another element
      await page.focus('#text-input');

      log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('blur:focus-target');
    });

    it('should handle tab navigation between focusable elements', async () => {
      await page.focus('#first-focusable');

      await page.keyboard.press('Tab');

      const activeElement = await page.evaluate(() => document.activeElement?.id);
      expect(activeElement).toBe('second-focusable');
    });
  });

  describe('Select Dropdown Interactions', () => {
    it('should handle single select dropdown selection', async () => {
      await page.selectOption('#single-select', 'option2');

      const value = await page.evaluate(() => {
        const select = document.getElementById('single-select') as HTMLSelectElement;
        return select.value;
      });
      expect(value).toBe('option2');

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('change:single-select');
    });

    it('should handle multi-select dropdown selection', async () => {
      await page.selectOption('#multi-select', ['option1', 'option3']);

      const selectedValues = await page.evaluate(() => {
        const select = document.getElementById('multi-select') as HTMLSelectElement;
        return Array.from(select.selectedOptions).map(opt => opt.value);
      });

      expect(selectedValues).toContain('option1');
      expect(selectedValues).toContain('option3');
      expect(selectedValues.length).toBe(2);
    });
  });

  describe('Checkbox and Radio Button Interactions', () => {
    it('should handle checkbox toggle interactions', async () => {
      expect(await page.isChecked('#checkbox1')).toBe(false);

      await page.check('#checkbox1');
      expect(await page.isChecked('#checkbox1')).toBe(true);

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('change:checkbox1');

      await page.uncheck('#checkbox1');
      expect(await page.isChecked('#checkbox1')).toBe(false);
    });

    it('should handle radio button group selection', async () => {
      expect(await page.isChecked('#radio1')).toBe(false);
      expect(await page.isChecked('#radio2')).toBe(false);

      await page.check('#radio1');
      expect(await page.isChecked('#radio1')).toBe(true);
      expect(await page.isChecked('#radio2')).toBe(false);

      await page.check('#radio2');
      expect(await page.isChecked('#radio1')).toBe(false);
      expect(await page.isChecked('#radio2')).toBe(true);
    });
  });

  describe('Dynamic Element Interactions', () => {
    it('should interact with dynamically created elements', async () => {
      await page.click('#create-dynamic-button');

      await page.waitForSelector('#dynamic-element', { timeout: 5000 });

      await page.click('#dynamic-element');

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('click:dynamic-element');
    });

    it('should handle elements that change visibility', async () => {
      await page.click('#toggle-visibility');

      await page.waitForSelector('#toggleable-element', { state: 'visible' });

      await page.click('#toggleable-element');

      const log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('click:toggleable-element');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid selectors gracefully', async () => {
      const invalidSelectors = ['', '   ', 'invalid..selector'];

      for (const selector of invalidSelectors) {
        await expect(page.click(selector, { timeout: 1000 })).rejects.toThrow();
      }
    });

    it('should handle rapid sequential interactions', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 5; i++) {
        await page.click('#rapid-click-target');
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000);

      const clickCount = await page.getAttribute('#rapid-click-target', 'data-click-count');
      expect(parseInt(clickCount || '0')).toBe(5);
    });

    it('should handle timeout scenarios gracefully', async () => {
      await expect(
        page.click('#never-exists', { timeout: 1000 })
      ).rejects.toThrow();
    });
  });

  describe('Accessibility and Keyboard Navigation', () => {
    it('should handle Enter and Space key activation', async () => {
      await page.focus('#keyboard-button');
      await page.keyboard.press('Enter');

      let log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('click:keyboard-button');

      await page.evaluate(() => (window as any).interactionLog = []);
      await page.keyboard.press('Space');

      log = await page.evaluate(() => (window as any).interactionLog);
      expect(log).toContain('click:keyboard-button');
    });

    it('should handle arrow key navigation in radio groups', async () => {
      await page.focus('#radio1');
      await page.keyboard.press('ArrowDown');

      const activeElement = await page.evaluate(() => document.activeElement?.id);
      expect(activeElement).toBe('radio2');
    });
  });
});

/**
 * Creates comprehensive test page HTML with all necessary elements for testing
 */
function createTestPageHTML(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Element Interaction Test Page</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          line-height: 1.6;
        }
        .section {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .hidden { display: none; }
        input, select, textarea, button {
          margin: 5px;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 3px;
        }
      </style>
    </head>
    <body>
      <main>
        <h1>Element Interaction Test Page</h1>
        <div id="interaction-log" role="log">Interaction log</div>

        <div class="section">
          <h2>Click Interactions</h2>
          <button id="basic-button" data-click-count="0">Basic Button</button>
          <button id="double-click-target">Double-click Target</button>
          <button id="context-menu-target">Right-click Target</button>
          <button id="disabled-button" disabled>Disabled Button</button>
          <button id="keyboard-button">Keyboard Button</button>
          <button id="rapid-click-target" data-click-count="0">Rapid Click Target</button>

          <div id="nested-parent">
            <button id="nested-child">Nested Child</button>
          </div>
        </div>

        <div class="section">
          <h2>Input Interactions</h2>
          <input type="text" id="text-input" placeholder="Text input">
          <input type="email" id="email-input" placeholder="Email input">
          <input type="number" id="number-input" min="1" max="100" placeholder="Number">
          <input type="text" id="keyboard-input" placeholder="Keyboard events">
          <textarea id="textarea-input" placeholder="Textarea"></textarea>
        </div>

        <div class="section">
          <h2>Hover and Focus</h2>
          <div id="hover-target" style="padding: 20px; background: #f9f9f9;">Hover Target</div>
          <input type="text" id="focus-target" placeholder="Focus target">
          <button id="first-focusable">First Focusable</button>
          <button id="second-focusable">Second Focusable</button>
        </div>

        <div class="section">
          <h2>Select Elements</h2>
          <select id="single-select">
            <option value="">Choose option</option>
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
            <option value="option3">Option 3</option>
          </select>

          <select id="multi-select" multiple>
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
            <option value="option3">Option 3</option>
          </select>
        </div>

        <div class="section">
          <h2>Checkboxes and Radios</h2>
          <label><input type="checkbox" id="checkbox1"> Checkbox 1</label>
          <label><input type="checkbox" id="checkbox2"> Checkbox 2</label>

          <fieldset>
            <legend>Radio Group</legend>
            <label><input type="radio" id="radio1" name="radio-group" value="radio1"> Radio 1</label>
            <label><input type="radio" id="radio2" name="radio-group" value="radio2"> Radio 2</label>
          </fieldset>
        </div>

        <div class="section">
          <h2>Dynamic Elements</h2>
          <button id="create-dynamic-button">Create Dynamic Element</button>
          <button id="toggle-visibility">Toggle Visibility</button>
          <div id="dynamic-container"></div>
          <div id="toggleable-element" class="hidden">Toggleable Element</div>
        </div>
      </main>

      <script>
        window.interactionLog = [];

        function logInteraction(type, elementId, event = {}) {
          const logEntry = \`\${type}:\${elementId}\`;
          window.interactionLog.push(logEntry);

          if (event.ctrlKey || event.shiftKey || event.altKey) {
            const detailEntry = \`\${type}:\${elementId}:ctrlKey:\${event.ctrlKey}:shiftKey:\${event.shiftKey}:altKey:\${event.altKey}\`;
            window.interactionLog.push(detailEntry);
          }

          const logElement = document.getElementById('interaction-log');
          if (logElement) {
            logElement.textContent = window.interactionLog.slice(-5).join(' | ');
          }
        }

        document.addEventListener('click', (e) => {
          if (e.target.id) {
            logInteraction('click', e.target.id, e);
            const currentCount = parseInt(e.target.getAttribute('data-click-count') || '0');
            e.target.setAttribute('data-click-count', (currentCount + 1).toString());
          }
        });

        document.addEventListener('dblclick', (e) => {
          if (e.target.id) logInteraction('dblclick', e.target.id, e);
        });

        document.addEventListener('contextmenu', (e) => {
          if (e.target.id) {
            e.preventDefault();
            logInteraction('contextmenu', e.target.id, e);
          }
        });

        document.addEventListener('input', (e) => {
          if (e.target.id) logInteraction('input', e.target.id, e);
        });

        document.addEventListener('change', (e) => {
          if (e.target.id) logInteraction('change', e.target.id, e);
        });

        document.addEventListener('focus', (e) => {
          if (e.target.id) logInteraction('focus', e.target.id, e);
        });

        document.addEventListener('blur', (e) => {
          if (e.target.id) logInteraction('blur', e.target.id, e);
        });

        document.addEventListener('mouseenter', (e) => {
          if (e.target.id) logInteraction('mouseenter', e.target.id, e);
        }, true);

        document.addEventListener('mouseleave', (e) => {
          if (e.target.id) logInteraction('mouseleave', e.target.id, e);
        }, true);

        document.addEventListener('keydown', (e) => {
          if (e.target.id && ['Enter', 'Space', 'Tab', 'ArrowDown'].includes(e.key)) {
            logInteraction(\`keydown:\${e.key}\`, e.target.id, e);
          }
        });

        document.getElementById('create-dynamic-button').addEventListener('click', () => {
          const container = document.getElementById('dynamic-container');
          const element = document.createElement('button');
          element.id = 'dynamic-element';
          element.textContent = 'Dynamic Element';
          container.appendChild(element);
        });

        document.getElementById('toggle-visibility').addEventListener('click', () => {
          const element = document.getElementById('toggleable-element');
          element.classList.toggle('hidden');
        });
      </script>
    </body>
    </html>
  `;
}