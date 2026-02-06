/**
 * @fileoverview Integration tests for type interactions
 *
 * Comprehensive test suite covering:
 * - Text input typing with various input types
 * - Textarea typing and content handling
 * - Real-time input validation during typing
 * - Special character and emoji input handling
 * - Typing speed and debounce behavior
 * - Input focus and blur events during typing
 * - Multi-line text handling and navigation
 * - Copy/paste operations and clipboard interactions
 *
 * These tests verify that browser automation can reliably simulate
 * realistic typing interactions across all input element types.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs/promises';

import {
  createBrowser,
  createBrowserContext,
  createPage,
  captureScreenshot,
  DEFAULT_BROWSER_CONFIG,
} from './setup.js';

import {
  safeClick,
  safeFill,
  waitForElement,
  takeScreenshot,
  captureConsoleMessages,
  capturePageErrors,
  setupAlertHandler,
  withBrowserTest,
  waitForNetworkIdle,
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
} from './utils/type-interaction-helpers.js';

describe('Type Interactions Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;
  let typeTestPagePath: string;

  beforeAll(async () => {
    // Create browser instance
    browser = await createBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);

    // Setup temporary directory for screenshots
    tempDir = globalThis.browserTestContext.tempDir!;

    // Set up type interaction test page path
    typeTestPagePath = path.resolve(__dirname, 'fixtures', 'type-interaction-test-page.html');

    // Verify type test page exists
    await fs.access(typeTestPagePath);
    console.log(`Using type interaction test page: ${typeTestPagePath}`);
  });

  afterAll(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  beforeEach(async () => {
    // Navigate to type test page before each test
    await page.goto(`file://${typeTestPagePath}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for page elements to be ready
    await waitForElement(page, '#type-test-container', { visible: true });
  });

  describe('Basic Text Input Typing', () => {
    it('should simulate typing in text input fields', async () => {
      await withBrowserTest(async (page) => {
        // Test basic text input typing
        const textInput = await waitForElement(page, '#basic-text-input', {
          visible: true,
          enabled: true
        });

        const testText = 'Hello, World!';
        await simulateTyping(page, '#basic-text-input', testText);

        // Verify text was typed correctly
        const inputValue = await textInput.inputValue();
        expect(inputValue).toBe(testText);

        await takeScreenshot(page, 'basic-text-typing', tempDir);

      }, page);
    });

    it('should handle typing with different input types', async () => {
      await withBrowserTest(async (page) => {
        // Test email input
        await simulateTyping(page, '#email-input', 'test@example.com');
        const emailValue = await page.locator('#email-input').inputValue();
        expect(emailValue).toBe('test@example.com');

        // Test password input (hidden text)
        await simulateTyping(page, '#password-input', 'securePassword123');
        const passwordValue = await page.locator('#password-input').inputValue();
        expect(passwordValue).toBe('securePassword123');

        // Test number input
        await simulateTyping(page, '#number-input', '12345');
        const numberValue = await page.locator('#number-input').inputValue();
        expect(numberValue).toBe('12345');

        // Test URL input
        await simulateTyping(page, '#url-input', 'https://example.com');
        const urlValue = await page.locator('#url-input').inputValue();
        expect(urlValue).toBe('https://example.com');

        await takeScreenshot(page, 'different-input-types-typing', tempDir);

      }, page);
    });

    it('should simulate slow typing with realistic delays', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#basic-text-input', {
          visible: true,
          enabled: true
        });

        const testText = 'Slow typing test';

        // Measure typing time
        const startTime = Date.now();
        await simulateSlowTyping(page, '#basic-text-input', testText, {
          delayBetweenChars: 50
        });
        const endTime = Date.now();

        // Verify text was typed correctly
        const inputValue = await textInput.inputValue();
        expect(inputValue).toBe(testText);

        // Verify typing took reasonable time (should be slower than instant)
        const typingDuration = endTime - startTime;
        expect(typingDuration).toBeGreaterThan(testText.length * 30); // At least 30ms per char

        await takeScreenshot(page, 'slow-typing-result', tempDir);

      }, page);
    });
  });

  describe('Textarea Typing Interactions', () => {
    it('should handle multi-line text typing in textarea', async () => {
      await withBrowserTest(async (page) => {
        const multiLineText = `Line 1 of text
Line 2 with different content
Line 3 with special chars: !@#$%^&*()
Final line with numbers: 123456789`;

        await simulateTyping(page, '#textarea-input', multiLineText);

        const textareaValue = await page.locator('#textarea-input').inputValue();
        expect(textareaValue).toBe(multiLineText);

        // Verify line breaks are preserved
        const lines = textareaValue.split('\n');
        expect(lines).toHaveLength(4);
        expect(lines[0]).toBe('Line 1 of text');
        expect(lines[3]).toBe('Final line with numbers: 123456789');

        await takeScreenshot(page, 'textarea-multiline-typing', tempDir);

      }, page);
    });

    it('should handle textarea cursor navigation while typing', async () => {
      await withBrowserTest(async (page) => {
        const textarea = await waitForElement(page, '#textarea-input', {
          visible: true,
          enabled: true
        });

        // Type initial text
        await simulateTyping(page, '#textarea-input', 'First line');

        // Use keyboard navigation to move cursor
        await textarea.focus();
        await page.keyboard.press('Enter');
        await simulateTyping(page, '#textarea-input', 'Second line', { append: true });

        // Navigate back and insert text
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('End');
        await simulateTyping(page, '#textarea-input', ' - edited', { append: true });

        const finalValue = await textarea.inputValue();
        expect(finalValue).toContain('First line - edited');
        expect(finalValue).toContain('Second line');

        await takeScreenshot(page, 'textarea-cursor-navigation', tempDir);

      }, page);
    });

    it('should handle large text blocks in textarea', async () => {
      await withBrowserTest(async (page) => {
        // Generate a large text block
        const largeText = Array.from({ length: 50 }, (_, i) =>
          `This is line ${i + 1} of a large text block with various content.`
        ).join('\n');

        await simulateTyping(page, '#textarea-input', largeText);

        const textareaValue = await page.locator('#textarea-input').inputValue();
        expect(textareaValue).toBe(largeText);

        // Verify character count
        expect(textareaValue.length).toBeGreaterThan(2000);

        // Verify line count
        const lineCount = textareaValue.split('\n').length;
        expect(lineCount).toBe(50);

        await takeScreenshot(page, 'textarea-large-text', tempDir);

      }, page);
    });
  });

  describe('Special Characters and Unicode Typing', () => {
    it('should handle special characters and symbols', async () => {
      await withBrowserTest(async (page) => {
        const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~';

        await simulateTyping(page, '#basic-text-input', specialChars);

        const inputValue = await page.locator('#basic-text-input').inputValue();
        expect(inputValue).toBe(specialChars);

        await takeScreenshot(page, 'special-characters-typing', tempDir);

      }, page);
    });

    it('should handle unicode characters and emojis', async () => {
      await withBrowserTest(async (page) => {
        const unicodeText = 'Hello 世界 🌍 Café résumé naïve 中文 العربية русский ñoël';

        await simulateTyping(page, '#basic-text-input', unicodeText);

        const inputValue = await page.locator('#basic-text-input').inputValue();
        expect(inputValue).toBe(unicodeText);

        await takeScreenshot(page, 'unicode-emoji-typing', tempDir);

      }, page);
    });

    it('should handle mixed content with quotes and escapes', async () => {
      await withBrowserTest(async (page) => {
        const complexText = `Text with "quotes" and 'apostrophes' and \n newlines and \t tabs`;

        await simulateTyping(page, '#textarea-input', complexText);

        const inputValue = await page.locator('#textarea-input').inputValue();
        expect(inputValue).toBe(complexText);

        await takeScreenshot(page, 'complex-escaped-text', tempDir);

      }, page);
    });
  });

  describe('Real-time Input Validation During Typing', () => {
    it('should trigger validation events while typing', async () => {
      await withBrowserTest(async (page) => {
        // Type into email field and watch for validation
        const events = await captureTypingEvents(page, async () => {
          await simulateSlowTyping(page, '#validated-email-input', 'invalid-email', {
            delayBetweenChars: 100
          });
          await page.waitForTimeout(500); // Wait for validation
        });

        // Verify input and validation events were captured
        expect(events.inputEvents.length).toBeGreaterThan(0);
        expect(events.changeEvents.length).toBeGreaterThan(0);

        // Check if validation error appears
        const errorElement = await page.locator('#email-validation-error');
        const errorVisible = await errorElement.isVisible();
        expect(errorVisible).toBe(true);

        await takeScreenshot(page, 'real-time-validation-error', tempDir);

        // Now type valid email and watch validation clear
        await page.locator('#validated-email-input').clear();
        await simulateTyping(page, '#validated-email-input', 'valid@example.com');
        await page.waitForTimeout(500);

        const errorStillVisible = await errorElement.isVisible();
        expect(errorStillVisible).toBe(false);

        await takeScreenshot(page, 'validation-error-cleared', tempDir);

      }, page);
    });

    it('should handle input length restrictions during typing', async () => {
      await withBrowserTest(async (page) => {
        const longText = 'a'.repeat(200); // Text longer than maxlength

        await simulateTyping(page, '#maxlength-input', longText);

        const inputValue = await page.locator('#maxlength-input').inputValue();

        // Should be truncated to maxlength (100 characters)
        expect(inputValue.length).toBeLessThanOrEqual(100);
        expect(inputValue).toBe('a'.repeat(100));

        await takeScreenshot(page, 'maxlength-truncation', tempDir);

      }, page);
    });

    it('should handle pattern validation during typing', async () => {
      await withBrowserTest(async (page) => {
        // Type invalid pattern first
        await simulateTyping(page, '#pattern-input', 'invalid123');

        // Check validation state
        const isValid = await page.locator('#pattern-input').evaluate(
          (input: HTMLInputElement) => input.validity.valid
        );
        expect(isValid).toBe(false);

        // Clear and type valid pattern
        await page.locator('#pattern-input').clear();
        await simulateTyping(page, '#pattern-input', 'ABC123'); // Valid pattern

        const isNowValid = await page.locator('#pattern-input').evaluate(
          (input: HTMLInputElement) => input.validity.valid
        );
        expect(isNowValid).toBe(true);

        await takeScreenshot(page, 'pattern-validation-success', tempDir);

      }, page);
    });
  });

  describe('Copy/Paste Operations', () => {
    it('should handle paste operations in text inputs', async () => {
      await withBrowserTest(async (page) => {
        const textToPaste = 'This text will be pasted';

        await simulatePasteText(page, '#basic-text-input', textToPaste);

        const inputValue = await page.locator('#basic-text-input').inputValue();
        expect(inputValue).toBe(textToPaste);

        await takeScreenshot(page, 'paste-operation-result', tempDir);

      }, page);
    });

    it('should handle copy operations from text inputs', async () => {
      await withBrowserTest(async (page) => {
        const originalText = 'Text to be copied';

        // First type the text
        await simulateTyping(page, '#basic-text-input', originalText);

        // Select all text and copy
        await page.locator('#basic-text-input').focus();
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Control+c');

        // Paste into another field
        await page.locator('#copy-target-input').focus();
        await page.keyboard.press('Control+v');

        const copiedValue = await page.locator('#copy-target-input').inputValue();
        expect(copiedValue).toBe(originalText);

        await takeScreenshot(page, 'copy-operation-result', tempDir);

      }, page);
    });

    it('should handle paste operations with formatting preservation', async () => {
      await withBrowserTest(async (page) => {
        const multiLineText = `Line 1
Line 2
Line 3`;

        await simulatePasteText(page, '#textarea-input', multiLineText);

        const pastedValue = await page.locator('#textarea-input').inputValue();
        expect(pastedValue).toBe(multiLineText);

        // Verify line breaks are preserved
        const lines = pastedValue.split('\n');
        expect(lines).toHaveLength(3);

        await takeScreenshot(page, 'paste-multiline-preserved', tempDir);

      }, page);
    });
  });

  describe('Focus and Blur Events During Typing', () => {
    it('should handle focus changes during typing operations', async () => {
      await withBrowserTest(async (page) => {
        // Start typing in first input
        await simulateTyping(page, '#basic-text-input', 'First field');

        // Tab to next field and continue typing
        await page.keyboard.press('Tab');
        await simulateTyping(page, '#email-input', 'second@field.com', {
          waitForFocus: true
        });

        // Verify both fields have correct values
        const firstValue = await page.locator('#basic-text-input').inputValue();
        const secondValue = await page.locator('#email-input').inputValue();

        expect(firstValue).toBe('First field');
        expect(secondValue).toBe('second@field.com');

        // Verify focus is on second field
        const focusedElement = await page.evaluate(() => document.activeElement?.id);
        expect(focusedElement).toBe('email-input');

        await takeScreenshot(page, 'focus-changes-typing', tempDir);

      }, page);
    });

    it('should handle blur validation after typing', async () => {
      await withBrowserTest(async (page) => {
        // Type in required field then blur
        await simulateTyping(page, '#required-input', '   '); // Whitespace only
        await page.keyboard.press('Tab'); // Trigger blur

        await page.waitForTimeout(200); // Wait for blur validation

        // Check if validation error appears on blur
        const errorVisible = await page.locator('#required-validation-error').isVisible();
        expect(errorVisible).toBe(true);

        await takeScreenshot(page, 'blur-validation-error', tempDir);

        // Go back and type valid content
        await page.locator('#required-input').focus();
        await page.locator('#required-input').clear();
        await simulateTyping(page, '#required-input', 'Valid content');
        await page.keyboard.press('Tab');

        await page.waitForTimeout(200);

        const errorCleared = await page.locator('#required-validation-error').isVisible();
        expect(errorCleared).toBe(false);

        await takeScreenshot(page, 'blur-validation-cleared', tempDir);

      }, page);
    });
  });

  describe('Keyboard Shortcuts and Combinations', () => {
    it('should handle common keyboard shortcuts during typing', async () => {
      await withBrowserTest(async (page) => {
        // Type text and test select all
        await simulateTyping(page, '#basic-text-input', 'Test text for shortcuts');

        await simulateKeyboardShortcuts(page, '#basic-text-input', [
          'Control+a', // Select all
          'Control+c'  // Copy
        ]);

        // Move to another field and paste
        await page.locator('#copy-target-input').focus();
        await page.keyboard.press('Control+v');

        const pastedValue = await page.locator('#copy-target-input').inputValue();
        expect(pastedValue).toBe('Test text for shortcuts');

        await takeScreenshot(page, 'keyboard-shortcuts-result', tempDir);

      }, page);
    });

    it('should handle undo/redo operations during typing', async () => {
      await withBrowserTest(async (page) => {
        const input = await waitForElement(page, '#basic-text-input', {
          visible: true,
          enabled: true
        });

        // Type initial text
        await simulateTyping(page, '#basic-text-input', 'Initial text');

        // Add more text
        await simulateTyping(page, '#basic-text-input', ' additional content', { append: true });

        // Test undo operation
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(100);

        let currentValue = await input.inputValue();
        // Note: Browser undo behavior may vary, so we test that it changed
        expect(currentValue).not.toBe('Initial text additional content');

        await takeScreenshot(page, 'undo-operation-result', tempDir);

      }, page);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid typing without performance issues', async () => {
      await withBrowserTest(async (page) => {
        const rapidText = 'a'.repeat(1000);

        const startTime = Date.now();
        await simulateTyping(page, '#basic-text-input', rapidText, {
          delayBetweenChars: 1 // Very fast typing
        });
        const endTime = Date.now();

        const inputValue = await page.locator('#basic-text-input').inputValue();
        expect(inputValue).toBe(rapidText);
        expect(inputValue.length).toBe(1000);

        // Should complete in reasonable time (less than 5 seconds)
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(5000);

        await takeScreenshot(page, 'rapid-typing-complete', tempDir);

      }, page);
    });

    it('should handle concurrent typing in multiple fields', async () => {
      await withBrowserTest(async (page) => {
        const scenarios = [
          { selector: '#basic-text-input', text: 'Field 1 content' },
          { selector: '#email-input', text: 'field2@example.com' },
          { selector: '#textarea-input', text: 'Textarea content with\nmultiple lines' }
        ];

        // Execute typing scenarios concurrently (simulate quick field switching)
        for (const scenario of scenarios) {
          await simulateTyping(page, scenario.selector, scenario.text);
          await page.waitForTimeout(50); // Brief delay between fields
        }

        // Verify all fields have correct content
        for (const scenario of scenarios) {
          const value = await page.locator(scenario.selector).inputValue();
          expect(value).toBe(scenario.text);
        }

        await takeScreenshot(page, 'concurrent-typing-complete', tempDir);

      }, page);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle typing in disabled inputs gracefully', async () => {
      await withBrowserTest(async (page) => {
        // Attempt to type in disabled input
        const errors = await capturePageErrors(page, async () => {
          try {
            await simulateTyping(page, '#disabled-input', 'Should not work', {
              timeout: 2000
            });
          } catch (error) {
            // Expected to fail, but shouldn't cause JavaScript errors
          }
        });

        // Verify no JavaScript errors occurred
        expect(errors.length).toBe(0);

        // Verify input remains empty
        const inputValue = await page.locator('#disabled-input').inputValue();
        expect(inputValue).toBe('');

        await takeScreenshot(page, 'disabled-input-handling', tempDir);

      }, page);
    });

    it('should handle typing in readonly inputs appropriately', async () => {
      await withBrowserTest(async (page) => {
        // Readonly input should be focusable but not editable
        const errors = await capturePageErrors(page, async () => {
          try {
            await simulateTyping(page, '#readonly-input', 'Should not change', {
              timeout: 2000
            });
          } catch (error) {
            // May fail to type, but shouldn't cause errors
          }
        });

        expect(errors.length).toBe(0);

        // Verify readonly input keeps original value
        const inputValue = await page.locator('#readonly-input').inputValue();
        expect(inputValue).toBe('Readonly value'); // Original value from HTML

        await takeScreenshot(page, 'readonly-input-handling', tempDir);

      }, page);
    });

    it('should recover gracefully from interrupted typing operations', async () => {
      await withBrowserTest(async (page) => {
        // Start typing operation
        await simulateTyping(page, '#basic-text-input', 'Partial text');

        // Simulate page navigation away and back
        await page.goBack();
        await page.goForward();

        // Page should reload, verify clean state
        await waitForElement(page, '#type-test-container', { visible: true });

        const inputValue = await page.locator('#basic-text-input').inputValue();
        expect(inputValue).toBe(''); // Should be clean after navigation

        // Verify we can continue typing normally
        await simulateTyping(page, '#basic-text-input', 'New text after navigation');
        const newValue = await page.locator('#basic-text-input').inputValue();
        expect(newValue).toBe('New text after navigation');

        await takeScreenshot(page, 'recovered-typing-after-navigation', tempDir);

      }, page);
    });
  });
});