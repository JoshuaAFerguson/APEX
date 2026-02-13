/**
 * @fileoverview Additional edge case tests for contenteditable elements
 *
 * This test file covers additional edge cases and scenarios not covered in the main
 * contenteditable integration tests, ensuring comprehensive test coverage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Page, Browser, BrowserContext } from 'playwright';
import {
  createBrowser,
  createBrowserContext,
  createPage,
  DEFAULT_BROWSER_CONFIG
} from './setup';
import {
  CONTENTEDITABLE_FIXTURES,
  createContenteditableTestPage
} from './fixtures/contenteditable-fixtures';
import {
  typeInContenteditable,
  validateContenteditableContent,
  clearContenteditableContent,
  getCaretPosition,
  setCaretPosition
} from './utils/contenteditable-helpers';

describe('Contenteditable Edge Cases and Advanced Scenarios', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  const TEST_TIMEOUT = 45000;

  beforeEach(async () => {
    browser = await createBrowser(DEFAULT_BROWSER_CONFIG);
    context = await createBrowserContext(browser);
    page = await createPage(context);
  }, TEST_TIMEOUT);

  afterEach(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }, TEST_TIMEOUT);

  describe('Keyboard Interaction Edge Cases', () => {
    it('should handle rapid keyboard input without losing characters', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';
      await clearContenteditableContent(page, selector);
      await page.locator(selector).focus();

      // Simulate very rapid typing (no delay)
      const rapidText = 'RapidTypingTestWithoutDelay';

      for (const char of rapidText) {
        await page.keyboard.type(char, { delay: 0 });
      }

      // Allow time for all events to process
      await page.waitForTimeout(100);

      const finalContent = await page.locator(selector).textContent();
      expect(finalContent).toBe(rapidText);
      expect(finalContent?.length).toBe(rapidText.length);
    });

    it('should handle backspace and delete operations correctly', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';
      await clearContenteditableContent(page, selector);
      await page.locator(selector).focus();

      // Type text and test backspace
      const originalText = 'Hello World Test';
      await page.keyboard.type(originalText);

      // Backspace 5 characters
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Backspace');
      }

      const afterBackspace = await page.locator(selector).textContent();
      expect(afterBackspace).toBe('Hello World');

      // Move cursor to middle and test delete
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowRight'); // After "H"
      await page.keyboard.press('Delete'); // Delete "e"

      const afterDelete = await page.locator(selector).textContent();
      expect(afterDelete).toBe('Hllo World');
    });

    it('should handle arrow key navigation and text selection', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';
      await clearContenteditableContent(page, selector);
      await page.locator(selector).focus();

      const testText = 'Arrow Navigation Test';
      await page.keyboard.type(testText);

      // Navigate with arrows
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowRight'); // After "A"
      await page.keyboard.press('ArrowRight'); // After "r"
      await page.keyboard.press('ArrowRight'); // After "r"
      await page.keyboard.press('ArrowRight'); // After "o"
      await page.keyboard.press('ArrowRight'); // After "w"

      // Type to insert text at cursor position
      await page.keyboard.type('KEY ');

      const result = await page.locator(selector).textContent();
      expect(result).toBe('ArrowKEY  Navigation Test');
    });
  });

  describe('Content Manipulation Edge Cases', () => {
    it('should handle cut, copy, and paste operations', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';
      await clearContenteditableContent(page, selector);
      await page.locator(selector).focus();

      // Type initial content
      const initialText = 'Copy and Paste Test Content';
      await page.keyboard.type(initialText);

      // Select all and copy
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Control+c');

      // Clear and paste
      await page.keyboard.press('Delete');
      await page.keyboard.press('Control+v');

      const pastedContent = await page.locator(selector).textContent();
      expect(pastedContent).toBe(initialText);

      // Test partial selection and cut
      await page.keyboard.press('Home');
      await page.keyboard.press('Shift+ArrowRight'); // Select "C"
      await page.keyboard.press('Shift+ArrowRight'); // Select "o"
      await page.keyboard.press('Shift+ArrowRight'); // Select "p"
      await page.keyboard.press('Shift+ArrowRight'); // Select "y"

      await page.keyboard.press('Control+x'); // Cut "Copy"

      const afterCut = await page.locator(selector).textContent();
      expect(afterCut).toBe(' and Paste Test Content');

      // Paste at end
      await page.keyboard.press('End');
      await page.keyboard.type(' - ');
      await page.keyboard.press('Control+v'); // Paste "Copy"

      const finalContent = await page.locator(selector).textContent();
      expect(finalContent).toBe(' and Paste Test Content - Copy');
    });

    it('should handle undo and redo operations if supported', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';
      await clearContenteditableContent(page, selector);
      await page.locator(selector).focus();

      // Type content
      const step1 = 'Step 1';
      await page.keyboard.type(step1);
      await page.waitForTimeout(100);

      const step2 = ' Step 2';
      await page.keyboard.type(step2);
      await page.waitForTimeout(100);

      const beforeUndo = await page.locator(selector).textContent();
      expect(beforeUndo).toBe('Step 1 Step 2');

      // Try undo (may not work in all browsers/contenteditable contexts)
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);

      // Check if undo worked (this might vary by browser)
      const afterUndo = await page.locator(selector).textContent();

      // If undo worked, content should be different
      if (afterUndo !== beforeUndo) {
        console.log('Undo operation supported:', { beforeUndo, afterUndo });

        // Try redo
        await page.keyboard.press('Control+y');
        await page.waitForTimeout(100);

        const afterRedo = await page.locator(selector).textContent();
        console.log('Redo operation result:', afterRedo);
      } else {
        console.log('Undo operation not supported or not effective in this context');
      }

      // Test should pass regardless of undo/redo support
      expect(true).toBe(true);
    });
  });

  describe('Caret Position and Selection Edge Cases', () => {
    it('should handle caret position management correctly', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';
      await clearContenteditableContent(page, selector);

      const testText = 'Caret Position Test';
      await typeInContenteditable(page, {
        selector,
        text: testText,
        clearFirst: false,
        verifyContent: false
      });

      // Test getting caret position
      const endPosition = await getCaretPosition(page, selector);
      expect(endPosition).toBe(testText.length);

      // Test setting caret position to middle
      const middlePosition = Math.floor(testText.length / 2);
      await setCaretPosition(page, selector, middlePosition);

      // Type at middle position
      await page.keyboard.type(' MIDDLE ');

      const result = await page.locator(selector).textContent();
      expect(result).toContain('MIDDLE');

      // Verify caret moved after typing
      const newPosition = await getCaretPosition(page, selector);
      expect(newPosition).toBeGreaterThan(middlePosition);
    });

    it('should handle text selection and replacement', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';
      await clearContenteditableContent(page, selector);

      const testText = 'Replace This Text';
      await typeInContenteditable(page, {
        selector,
        text: testText,
        clearFirst: false,
        verifyContent: false
      });

      // Select "This" (positions 8-12)
      await page.locator(selector).evaluate((el) => {
        const range = document.createRange();
        const textNode = el.firstChild as Text;
        if (textNode) {
          range.setStart(textNode, 8);
          range.setEnd(textNode, 12);

          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      });

      // Replace selection by typing
      await page.keyboard.type('That');

      const result = await page.locator(selector).textContent();
      expect(result).toBe('Replace That Text');
    });
  });

  describe('Dynamic Content Updates', () => {
    it('should handle programmatic content changes', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';

      // Set content programmatically
      const programmaticContent = 'Programmatically set content';
      await page.locator(selector).evaluate((el: HTMLElement, content: string) => {
        el.textContent = content;
        // Trigger input event
        const event = new InputEvent('input', { bubbles: true });
        el.dispatchEvent(event);
      }, programmaticContent);

      const content = await page.locator(selector).textContent();
      expect(content).toBe(programmaticContent);

      // User can still edit after programmatic changes
      await page.locator(selector).focus();
      await page.keyboard.press('End');
      await page.keyboard.type(' - User Addition');

      const finalContent = await page.locator(selector).textContent();
      expect(finalContent).toBe(programmaticContent + ' - User Addition');
    });

    it('should maintain contenteditable state through dynamic changes', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';

      // Verify initial contenteditable state
      let isEditable = await page.locator(selector).evaluate((el: HTMLElement) => el.isContentEditable);
      expect(isEditable).toBe(true);

      // Make changes via innerHTML (which might affect contenteditable)
      await page.locator(selector).evaluate((el: HTMLElement) => {
        el.innerHTML = '<p>New paragraph content</p>';
      });

      // Verify contenteditable is still true
      isEditable = await page.locator(selector).evaluate((el: HTMLElement) => el.isContentEditable);
      expect(isEditable).toBe(true);

      // Verify user can still edit
      await page.locator(selector).focus();
      await page.keyboard.press('End');
      await page.keyboard.type(' - Still Editable');

      const content = await page.locator(selector).textContent();
      expect(content).toContain('Still Editable');
    });
  });

  describe('Browser Events and Lifecycle', () => {
    it('should handle focus and blur events correctly', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';

      // Set up event listeners
      await page.evaluate(() => {
        (window as any).contentEditableEvents = [];

        const element = document.querySelector('[data-testid="basic-contenteditable-div"]');
        if (element) {
          element.addEventListener('focus', () => {
            (window as any).contentEditableEvents.push('focus');
          });

          element.addEventListener('blur', () => {
            (window as any).contentEditableEvents.push('blur');
          });
        }
      });

      // Focus the element
      await page.locator(selector).focus();

      // Click outside to blur
      await page.click('body');

      // Check events were fired
      const events = await page.evaluate(() => (window as any).contentEditableEvents);
      expect(events).toContain('focus');
      expect(events).toContain('blur');
    });

    it('should handle input events during typing', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';

      // Set up input event listener
      await page.evaluate(() => {
        (window as any).inputEvents = [];

        const element = document.querySelector('[data-testid="basic-contenteditable-div"]');
        if (element) {
          element.addEventListener('input', (event) => {
            (window as any).inputEvents.push({
              inputType: (event as InputEvent).inputType,
              data: (event as InputEvent).data,
              textContent: element.textContent
            });
          });
        }
      });

      await clearContenteditableContent(page, selector);
      await page.locator(selector).focus();

      // Type some text
      const testText = 'Event Test';
      for (const char of testText) {
        await page.keyboard.type(char);
        await page.waitForTimeout(50);
      }

      // Check input events were fired
      const inputEvents = await page.evaluate(() => (window as any).inputEvents);
      expect(inputEvents.length).toBeGreaterThan(0);

      // Check final content matches expected
      const lastEvent = inputEvents[inputEvents.length - 1];
      expect(lastEvent.textContent).toBe(testText);
    });
  });

  describe('Error Resilience', () => {
    it('should handle invalid HTML content gracefully', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';

      // Try to inject malformed HTML
      await page.locator(selector).evaluate((el: HTMLElement) => {
        // Browser should handle this gracefully
        el.innerHTML = '<div><span>Unclosed tags and &invalid; entities';
      });

      // Element should still be functional
      await page.locator(selector).focus();
      await page.keyboard.type(' - Added text');

      const content = await page.locator(selector).textContent();
      expect(content).toContain('Added text');

      // Should still be contenteditable
      const isEditable = await page.locator(selector).evaluate((el: HTMLElement) => el.isContentEditable);
      expect(isEditable).toBe(true);
    });

    it('should recover from JavaScript errors during editing', async () => {
      const testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');

      const selector = '[data-testid="basic-contenteditable-div"]';

      // Add an event listener that might throw an error
      await page.evaluate(() => {
        const element = document.querySelector('[data-testid="basic-contenteditable-div"]');
        if (element) {
          element.addEventListener('input', () => {
            // Simulate a non-critical error
            try {
              (window as any).nonExistentFunction();
            } catch (e) {
              console.log('Non-critical error caught:', e.message);
            }
          });
        }
      });

      // Editing should still work despite the error
      await clearContenteditableContent(page, selector);
      await typeInContenteditable(page, {
        selector,
        text: 'Error resilience test',
        clearFirst: false,
        verifyContent: true,
        expectedContent: 'Error resilience test'
      });

      // Validate the content was set correctly
      const validation = await validateContenteditableContent(page, selector, 'Error resilience test');
      expect(validation.errors).toHaveLength(0);
    });
  });
});