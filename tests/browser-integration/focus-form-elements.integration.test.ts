/**
 * @fileoverview Focus on Form Elements Integration Tests
 *
 * Comprehensive test suite covering focus behavior on form elements according to acceptance criteria:
 * - Focus fires when element receives focus
 * - Focus works on input/textarea/select/button elements
 * - Focus ring/styles are applied
 * - TabIndex behavior is correct
 * - Programmatic focus works
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
} from './utils/test-helpers.js';

describe('Focus on Form Elements Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;
  let testPagePath: string;

  beforeAll(async () => {
    // Create browser instance
    browser = await createBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);

    // Setup temporary directory for screenshots
    tempDir = globalThis.browserTestContext.tempDir!;

    // Create focus test page
    testPagePath = path.resolve(tempDir, 'focus-form-elements-test-page.html');
    await createFocusTestPage(testPagePath);

    console.log(`Using focus test page: ${testPagePath}`);
  });

  afterAll(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  beforeEach(async () => {
    // Navigate to test page before each test
    await page.goto(`file://${testPagePath}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the test page to be ready
    await waitForElement(page, '#focus-test-container', { visible: true });

    // Clear any previous focus
    await page.evaluate(() => {
      if (document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur?.();
      }
    });
  });

  describe('1. Focus Event Firing on Form Elements', () => {
    it('should fire focus events when input element receives focus', async () => {
      await withBrowserTest(async (page) => {
        // Test text input focus
        const textInput = await waitForElement(page, '#text-input', { visible: true, enabled: true });

        // Monitor focus events
        const focusEvents = await captureConsoleMessages(page, async () => {
          await textInput.focus();
          await page.waitForTimeout(200);
        });

        // Verify focus event was fired
        const focusEvent = focusEvents.find(msg =>
          msg.text.includes('focus') && msg.text.includes('text-input')
        );
        expect(focusEvent).toBeDefined();

        // Verify element actually has focus
        const hasFocus = await page.evaluate(() => {
          const input = document.getElementById('text-input');
          return document.activeElement === input;
        });
        expect(hasFocus).toBe(true);

        // Test that focus data is logged correctly
        const focusData = await page.locator('#focus-events-log').textContent();
        expect(focusData).toContain('text-input');

        await takeScreenshot(page, 'input-focus-event', tempDir);
      }, page);
    });

    it('should fire focus events when textarea element receives focus', async () => {
      await withBrowserTest(async (page) => {
        const textareaElement = await waitForElement(page, '#bio-textarea', { visible: true, enabled: true });

        const focusEvents = await captureConsoleMessages(page, async () => {
          await textareaElement.focus();
          await page.waitForTimeout(200);
        });

        // Verify focus event was fired for textarea
        const focusEvent = focusEvents.find(msg =>
          msg.text.includes('focus') && msg.text.includes('bio-textarea')
        );
        expect(focusEvent).toBeDefined();

        // Check element has focus
        const hasFocus = await textareaElement.evaluate(el => document.activeElement === el);
        expect(hasFocus).toBe(true);

        await takeScreenshot(page, 'textarea-focus-event', tempDir);
      }, page);
    });

    it('should fire focus events when select element receives focus', async () => {
      await withBrowserTest(async (page) => {
        const selectElement = await waitForElement(page, '#country-select', { visible: true, enabled: true });

        const focusEvents = await captureConsoleMessages(page, async () => {
          await selectElement.focus();
          await page.waitForTimeout(200);
        });

        // Verify focus event was fired for select
        const focusEvent = focusEvents.find(msg =>
          msg.text.includes('focus') && msg.text.includes('country-select')
        );
        expect(focusEvent).toBeDefined();

        // Check element has focus
        const hasFocus = await selectElement.evaluate(el => document.activeElement === el);
        expect(hasFocus).toBe(true);

        await takeScreenshot(page, 'select-focus-event', tempDir);
      }, page);
    });

    it('should fire focus events when button element receives focus', async () => {
      await withBrowserTest(async (page) => {
        const buttonElement = await waitForElement(page, '#submit-button', { visible: true, enabled: true });

        const focusEvents = await captureConsoleMessages(page, async () => {
          await buttonElement.focus();
          await page.waitForTimeout(200);
        });

        // Verify focus event was fired for button
        const focusEvent = focusEvents.find(msg =>
          msg.text.includes('focus') && msg.text.includes('submit-button')
        );
        expect(focusEvent).toBeDefined();

        // Check element has focus
        const hasFocus = await buttonElement.evaluate(el => document.activeElement === el);
        expect(hasFocus).toBe(true);

        await takeScreenshot(page, 'button-focus-event', tempDir);
      }, page);
    });

    it('should fire blur events when element loses focus', async () => {
      await withBrowserTest(async (page) => {
        const textInput = await waitForElement(page, '#text-input', { visible: true, enabled: true });
        const emailInput = await waitForElement(page, '#email-input', { visible: true, enabled: true });

        // Focus first element
        await textInput.focus();
        await page.waitForTimeout(100);

        // Focus second element to blur first
        const blurEvents = await captureConsoleMessages(page, async () => {
          await emailInput.focus();
          await page.waitForTimeout(200);
        });

        // Verify blur event was fired for first element
        const blurEvent = blurEvents.find(msg =>
          msg.text.includes('blur') && msg.text.includes('text-input')
        );
        expect(blurEvent).toBeDefined();

        // Verify focus event was fired for second element
        const focusEvent = blurEvents.find(msg =>
          msg.text.includes('focus') && msg.text.includes('email-input')
        );
        expect(focusEvent).toBeDefined();

        await takeScreenshot(page, 'focus-blur-sequence', tempDir);
      }, page);
    });
  });

  describe('2. Focus Ring and Visual Styles Application', () => {
    it('should apply focus styles and ring when element receives focus', async () => {
      await withBrowserTest(async (page) => {
        const styledInput = await waitForElement(page, '#styled-input', { visible: true, enabled: true });

        // Get initial styles
        const initialStyles = await styledInput.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            outline: computed.outline,
            borderColor: computed.borderColor,
            boxShadow: computed.boxShadow,
            backgroundColor: computed.backgroundColor
          };
        });

        // Focus the element
        await styledInput.focus();
        await page.waitForTimeout(300); // Wait for CSS transitions

        // Get focused styles
        const focusedStyles = await styledInput.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            outline: computed.outline,
            borderColor: computed.borderColor,
            boxShadow: computed.boxShadow,
            backgroundColor: computed.backgroundColor
          };
        });

        // Verify focus styles are different (focus ring applied)
        expect(focusedStyles.borderColor).not.toBe(initialStyles.borderColor);
        expect(focusedStyles.boxShadow).not.toBe(initialStyles.boxShadow);
        expect(focusedStyles.boxShadow).toContain('rgba(0, 123, 255');

        // Check that element has focus-visible class or data attribute
        const hasFocusIndicator = await styledInput.evaluate(el => {
          return el.classList.contains('focused') || el.hasAttribute('data-focused');
        });
        expect(hasFocusIndicator).toBe(true);

        await takeScreenshot(page, 'focus-ring-applied', tempDir);
      }, page);
    });

    it('should remove focus styles when element loses focus', async () => {
      await withBrowserTest(async (page) => {
        const styledInput = await waitForElement(page, '#styled-input', { visible: true, enabled: true });
        const otherInput = await waitForElement(page, '#text-input', { visible: true, enabled: true });

        // Focus the styled input
        await styledInput.focus();
        await page.waitForTimeout(300);

        // Get focused styles
        const focusedStyles = await styledInput.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            borderColor: computed.borderColor,
            boxShadow: computed.boxShadow
          };
        });

        // Blur by focusing another element
        await otherInput.focus();
        await page.waitForTimeout(300);

        // Get blurred styles
        const blurredStyles = await styledInput.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            borderColor: computed.borderColor,
            boxShadow: computed.boxShadow
          };
        });

        // Verify focus styles are removed
        expect(blurredStyles.borderColor).not.toBe(focusedStyles.borderColor);
        expect(blurredStyles.boxShadow).not.toContain('rgba(0, 123, 255');

        // Check focus indicator is removed
        const hasFocusIndicator = await styledInput.evaluate(el => {
          return el.classList.contains('focused') || el.hasAttribute('data-focused');
        });
        expect(hasFocusIndicator).toBe(false);

        await takeScreenshot(page, 'focus-ring-removed', tempDir);
      }, page);
    });

    it('should apply different focus styles to different form element types', async () => {
      await withBrowserTest(async (page) => {
        const elements = [
          '#text-input',
          '#email-input',
          '#bio-textarea',
          '#country-select',
          '#submit-button'
        ];

        const focusedStyles = [];

        for (const selector of elements) {
          const element = await waitForElement(page, selector, { visible: true, enabled: true });

          await element.focus();
          await page.waitForTimeout(200);

          const styles = await element.evaluate(el => {
            const computed = getComputedStyle(el);
            return {
              outline: computed.outline,
              borderColor: computed.borderColor,
              boxShadow: computed.boxShadow,
              hasVisibleFocus: computed.outline !== 'none' ||
                              computed.boxShadow.includes('focus') ||
                              computed.boxShadow.includes('rgba(0, 123, 255')
            };
          });

          focusedStyles.push({
            selector,
            styles
          });
        }

        // Verify all elements have some form of focus styling
        expect(focusedStyles.every(item => item.styles.hasVisibleFocus)).toBe(true);

        await takeScreenshot(page, 'various-focus-styles', tempDir);
      }, page);
    });

    it('should respect :focus-within styles on containers', async () => {
      await withBrowserTest(async (page) => {
        const container = await waitForElement(page, '#form-container', { visible: true });
        const nestedInput = await waitForElement(page, '#nested-input', { visible: true, enabled: true });

        // Get initial container styles
        const initialContainerStyles = await container.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            borderColor: computed.borderColor,
            backgroundColor: computed.backgroundColor
          };
        });

        // Focus nested input
        await nestedInput.focus();
        await page.waitForTimeout(300);

        // Get container styles when child is focused
        const focusWithinStyles = await container.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            borderColor: computed.borderColor,
            backgroundColor: computed.backgroundColor
          };
        });

        // Verify container styles change due to focus-within
        expect(focusWithinStyles.backgroundColor).not.toBe(initialContainerStyles.backgroundColor);

        await takeScreenshot(page, 'focus-within-container', tempDir);
      }, page);
    });
  });

  describe('3. TabIndex Behavior and Navigation', () => {
    it('should respect custom tabindex order during tab navigation', async () => {
      await withBrowserTest(async (page) => {
        // Elements with custom tabindex in the test page: tabindex="3", tabindex="1", tabindex="2"
        const tabOrderElements = [
          { selector: '#tabindex-1', expectedOrder: 1 },
          { selector: '#tabindex-2', expectedOrder: 2 },
          { selector: '#tabindex-3', expectedOrder: 3 }
        ];

        // Start from the first element in tab order (tabindex="1")
        await page.locator('#tabindex-1').focus();
        await page.waitForTimeout(100);

        let currentFocus = await page.evaluate(() => document.activeElement?.id);
        expect(currentFocus).toBe('tabindex-1');

        // Tab to next element (should be tabindex="2")
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        currentFocus = await page.evaluate(() => document.activeElement?.id);
        expect(currentFocus).toBe('tabindex-2');

        // Tab to next element (should be tabindex="3")
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        currentFocus = await page.evaluate(() => document.activeElement?.id);
        expect(currentFocus).toBe('tabindex-3');

        await takeScreenshot(page, 'tabindex-navigation', tempDir);
      }, page);
    });

    it('should skip elements with tabindex="-1" during tab navigation', async () => {
      await withBrowserTest(async (page) => {
        const normalInput = await waitForElement(page, '#normal-tab-input', { visible: true, enabled: true });

        // Focus normal input
        await normalInput.focus();
        await page.waitForTimeout(100);

        let currentFocus = await page.evaluate(() => document.activeElement?.id);
        expect(currentFocus).toBe('normal-tab-input');

        // Tab forward - should skip the negative tabindex element
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        currentFocus = await page.evaluate(() => document.activeElement?.id);
        expect(currentFocus).not.toBe('negative-tabindex');

        // But negative tabindex element should still be focusable programmatically
        const negativeTabElement = await waitForElement(page, '#negative-tabindex', { visible: true });
        await negativeTabElement.focus();
        await page.waitForTimeout(100);

        currentFocus = await page.evaluate(() => document.activeElement?.id);
        expect(currentFocus).toBe('negative-tabindex');

        await takeScreenshot(page, 'negative-tabindex-behavior', tempDir);
      }, page);
    });

    it('should handle reverse tab navigation correctly', async () => {
      await withBrowserTest(async (page) => {
        // Focus last element in tab order
        await page.locator('#last-tab-element').focus();
        await page.waitForTimeout(100);

        let currentFocus = await page.evaluate(() => document.activeElement?.id);
        expect(currentFocus).toBe('last-tab-element');

        // Shift+Tab to previous element
        await page.keyboard.press('Shift+Tab');
        await page.waitForTimeout(100);

        currentFocus = await page.evaluate(() => document.activeElement?.id);
        expect(currentFocus).toBe('submit-button'); // Should go to previous focusable element

        await takeScreenshot(page, 'reverse-tab-navigation', tempDir);
      }, page);
    });

    it('should handle tab navigation wrapping from last to first element', async () => {
      await withBrowserTest(async (page) => {
        // Focus the last tabbable element
        const lastElement = await page.locator('#last-tab-element');
        await lastElement.focus();
        await page.waitForTimeout(100);

        // Tab forward from last element - should wrap to first
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        const currentFocus = await page.evaluate(() => document.activeElement?.id);
        // Should wrap to first focusable element
        expect(['text-input', 'tabindex-1'].includes(currentFocus)).toBe(true);

        await takeScreenshot(page, 'tab-wrapping', tempDir);
      }, page);
    });
  });

  describe('4. Programmatic Focus Functionality', () => {
    it('should focus element when focus() method is called', async () => {
      await withBrowserTest(async (page) => {
        // Use JavaScript to programmatically focus an element
        const focusResult = await page.evaluate(() => {
          const input = document.getElementById('email-input') as HTMLInputElement;
          const initialFocus = document.activeElement?.id;

          input.focus();

          const finalFocus = document.activeElement?.id;
          return {
            initialFocus,
            finalFocus,
            success: finalFocus === 'email-input'
          };
        });

        expect(focusResult.success).toBe(true);
        expect(focusResult.finalFocus).toBe('email-input');

        // Verify focus events were triggered
        const focusEvents = await page.locator('#focus-events-log').textContent();
        expect(focusEvents).toContain('email-input');

        await takeScreenshot(page, 'programmatic-focus', tempDir);
      }, page);
    });

    it('should handle programmatic focus with button click trigger', async () => {
      await withBrowserTest(async (page) => {
        const focusButton = await waitForElement(page, '#focus-trigger-button', { visible: true, enabled: true });
        const targetInput = '#focus-target-input';

        // Click button that programmatically focuses an input
        await focusButton.click();
        await page.waitForTimeout(200);

        // Check that target input received focus
        const hasFocus = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          return document.activeElement === element;
        }, targetInput);

        expect(hasFocus).toBe(true);

        // Verify focus events were logged
        const focusEvents = await page.locator('#focus-events-log').textContent();
        expect(focusEvents).toContain('focus-target-input');

        await takeScreenshot(page, 'button-triggered-focus', tempDir);
      }, page);
    });

    it('should handle programmatic focus on hidden elements gracefully', async () => {
      await withBrowserTest(async (page) => {
        // Try to programmatically focus a hidden element
        const focusResult = await page.evaluate(() => {
          const hiddenInput = document.getElementById('hidden-input') as HTMLInputElement;
          const initialFocus = document.activeElement?.id;

          try {
            hiddenInput.focus();
            const finalFocus = document.activeElement?.id;
            return {
              success: true,
              initialFocus,
              finalFocus,
              hiddenGotFocus: finalFocus === 'hidden-input'
            };
          } catch (error) {
            return {
              success: false,
              error: error.message,
              initialFocus
            };
          }
        });

        // Hidden elements typically cannot receive focus
        expect(focusResult.hiddenGotFocus).toBe(false);

        await takeScreenshot(page, 'hidden-element-focus-attempt', tempDir);
      }, page);
    });

    it('should handle programmatic focus on disabled elements gracefully', async () => {
      await withBrowserTest(async (page) => {
        // Try to programmatically focus a disabled element
        const focusResult = await page.evaluate(() => {
          const disabledInput = document.getElementById('disabled-input') as HTMLInputElement;
          const initialFocus = document.activeElement?.id;

          try {
            disabledInput.focus();
            const finalFocus = document.activeElement?.id;
            return {
              success: true,
              initialFocus,
              finalFocus,
              disabledGotFocus: finalFocus === 'disabled-input'
            };
          } catch (error) {
            return {
              success: false,
              error: error.message,
              initialFocus
            };
          }
        });

        // Disabled elements cannot receive focus
        expect(focusResult.disabledGotFocus).toBe(false);

        await takeScreenshot(page, 'disabled-element-focus-attempt', tempDir);
      }, page);
    });
  });

  describe('5. Complex Focus Scenarios and Edge Cases', () => {
    it('should handle focus within nested form elements', async () => {
      await withBrowserTest(async (page) => {
        const nestedInput = await waitForElement(page, '#nested-input', { visible: true, enabled: true });
        const outerContainer = await waitForElement(page, '#form-container', { visible: true });

        // Focus nested input
        await nestedInput.focus();
        await page.waitForTimeout(200);

        // Verify nested input has focus
        const nestedHasFocus = await nestedInput.evaluate(el => document.activeElement === el);
        expect(nestedHasFocus).toBe(true);

        // Verify container shows focus-within state
        const containerHasFocusWithin = await outerContainer.evaluate(el =>
          el.matches(':focus-within')
        );
        expect(containerHasFocusWithin).toBe(true);

        await takeScreenshot(page, 'nested-form-focus', tempDir);
      }, page);
    });

    it('should maintain focus during dynamic DOM changes', async () => {
      await withBrowserTest(async (page) => {
        // Focus an input
        const targetInput = await waitForElement(page, '#dynamic-test-input', { visible: true, enabled: true });
        await targetInput.focus();
        await page.waitForTimeout(100);

        // Verify focus
        let hasFocus = await targetInput.evaluate(el => document.activeElement === el);
        expect(hasFocus).toBe(true);

        // Trigger DOM change that adds/removes elements but doesn't affect focused element
        await page.evaluate(() => {
          const container = document.getElementById('dynamic-container');
          const newElement = document.createElement('div');
          newElement.textContent = 'Dynamic content added';
          container?.appendChild(newElement);
        });

        await page.waitForTimeout(100);

        // Verify focus is maintained
        hasFocus = await targetInput.evaluate(el => document.activeElement === el);
        expect(hasFocus).toBe(true);

        await takeScreenshot(page, 'focus-during-dom-changes', tempDir);
      }, page);
    });

    it('should handle rapid focus changes without errors', async () => {
      await withBrowserTest(async (page) => {
        const elements = [
          '#text-input',
          '#email-input',
          '#bio-textarea',
          '#country-select',
          '#submit-button'
        ];

        const errors = await capturePageErrors(page, async () => {
          // Rapidly change focus between elements
          for (let i = 0; i < 3; i++) {
            for (const selector of elements) {
              const element = await page.locator(selector);
              await element.focus();
              await page.waitForTimeout(50);
            }
          }
        });

        // Should not generate any JavaScript errors
        expect(errors.length).toBe(0);

        // Final focus should be on last element
        const finalFocus = await page.evaluate(() => document.activeElement?.id);
        expect(finalFocus).toBe('submit-button');

        await takeScreenshot(page, 'rapid-focus-changes', tempDir);
      }, page);
    });

    it('should validate comprehensive focus behavior coverage', async () => {
      await withBrowserTest(async (page) => {
        // Validate all acceptance criteria are met
        const acceptanceCriteria = {
          'focus_fires_when_element_receives_focus': false,
          'focus_works_on_input_elements': false,
          'focus_works_on_textarea_elements': false,
          'focus_works_on_select_elements': false,
          'focus_works_on_button_elements': false,
          'focus_ring_styles_are_applied': false,
          'tabindex_behavior_correct': false,
          'programmatic_focus_works': false
        };

        // Test each criteria quickly

        // 1. Test input focus
        await page.locator('#text-input').focus();
        let hasFocus = await page.evaluate(() => document.activeElement?.id === 'text-input');
        if (hasFocus) acceptanceCriteria['focus_works_on_input_elements'] = true;

        // 2. Test textarea focus
        await page.locator('#bio-textarea').focus();
        hasFocus = await page.evaluate(() => document.activeElement?.id === 'bio-textarea');
        if (hasFocus) acceptanceCriteria['focus_works_on_textarea_elements'] = true;

        // 3. Test select focus
        await page.locator('#country-select').focus();
        hasFocus = await page.evaluate(() => document.activeElement?.id === 'country-select');
        if (hasFocus) acceptanceCriteria['focus_works_on_select_elements'] = true;

        // 4. Test button focus
        await page.locator('#submit-button').focus();
        hasFocus = await page.evaluate(() => document.activeElement?.id === 'submit-button');
        if (hasFocus) acceptanceCriteria['focus_works_on_button_elements'] = true;

        // 5. Test focus styles
        const hasStyles = await page.locator('#styled-input').evaluate(el => {
          el.focus();
          const computed = getComputedStyle(el);
          return computed.boxShadow.includes('rgba(0, 123, 255') ||
                 computed.borderColor.includes('rgb(0, 123, 255)');
        });
        if (hasStyles) acceptanceCriteria['focus_ring_styles_are_applied'] = true;

        // 6. Test programmatic focus
        const programmaticWorks = await page.evaluate(() => {
          const input = document.getElementById('email-input') as HTMLElement;
          input.focus();
          return document.activeElement === input;
        });
        if (programmaticWorks) acceptanceCriteria['programmatic_focus_works'] = true;

        // 7. Check if focus events fire
        const focusEventsLog = await page.locator('#focus-events-log').textContent();
        if (focusEventsLog && focusEventsLog.trim() !== '') {
          acceptanceCriteria['focus_fires_when_element_receives_focus'] = true;
        }

        // 8. Test tabindex behavior
        await page.locator('#tabindex-1').focus();
        await page.keyboard.press('Tab');
        const tabWorked = await page.evaluate(() => document.activeElement?.id === 'tabindex-2');
        if (tabWorked) acceptanceCriteria['tabindex_behavior_correct'] = true;

        console.log('Focus Acceptance Criteria Coverage:', acceptanceCriteria);

        // All criteria should be met
        const allCriteriaMet = Object.values(acceptanceCriteria).every(met => met === true);
        expect(allCriteriaMet).toBe(true);

        await takeScreenshot(page, 'acceptance-criteria-validation', tempDir);
      }, page);
    });
  });
});

/**
 * Creates the HTML test page for focus testing
 */
async function createFocusTestPage(filePath: string): Promise<void> {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Focus on Form Elements Test Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
            line-height: 1.6;
        }

        #focus-test-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }

        .form-section {
            margin: 25px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
        }

        .form-section h2 {
            margin-top: 0;
            color: #555;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }

        .form-group {
            margin: 15px 0;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #333;
        }

        input, textarea, select, button {
            padding: 10px;
            border: 2px solid #ccc;
            border-radius: 6px;
            font-size: 16px;
            transition: all 0.3s ease;
            margin: 5px 0;
        }

        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
        }

        button {
            background: #007bff;
            color: white;
            border: 2px solid #007bff;
            cursor: pointer;
            padding: 10px 20px;
        }

        button:focus {
            outline: none;
            background: #0056b3;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
        }

        button:hover {
            background: #0056b3;
        }

        /* Styled input with custom focus styles */
        #styled-input {
            border: 2px solid #ddd;
        }

        #styled-input:focus {
            border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
            background-color: #f8f9ff;
        }

        #styled-input.focused {
            border-color: #007bff !important;
        }

        /* Focus-within container styles */
        #form-container {
            border: 2px solid #eee;
            padding: 20px;
            border-radius: 8px;
            transition: all 0.3s ease;
        }

        #form-container:focus-within {
            border-color: #007bff;
            background-color: #f8f9ff;
        }

        /* Tab order demonstration */
        .tab-order-demo {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin: 15px 0;
        }

        .tab-order-demo input,
        .tab-order-demo button {
            min-width: 120px;
        }

        /* Element states */
        .hidden-element {
            display: none;
        }

        .disabled-element {
            opacity: 0.5;
            pointer-events: none;
        }

        /* Event log styling */
        #focus-events-log {
            background: #1a1a1a;
            color: #00ff00;
            font-family: monospace;
            padding: 10px;
            min-height: 120px;
            max-height: 200px;
            overflow-y: auto;
            border-radius: 4px;
            font-size: 12px;
            line-height: 1.4;
        }

        .status-indicator {
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }

        .status-focused {
            background: #28a745;
            color: white;
        }

        .status-blurred {
            background: #6c757d;
            color: white;
        }
    </style>
</head>
<body>
    <div id="focus-test-container">
        <h1>Focus on Form Elements Test Page</h1>

        <!-- Basic Form Elements Section -->
        <div class="form-section">
            <h2>Basic Form Elements</h2>

            <div class="form-group">
                <label for="text-input">Text Input:</label>
                <input type="text" id="text-input" placeholder="Enter text here">
                <span id="text-input-status" class="status-indicator">No focus</span>
            </div>

            <div class="form-group">
                <label for="email-input">Email Input:</label>
                <input type="email" id="email-input" placeholder="Enter email">
                <span id="email-input-status" class="status-indicator">No focus</span>
            </div>

            <div class="form-group">
                <label for="bio-textarea">Biography Textarea:</label>
                <textarea id="bio-textarea" rows="3" placeholder="Enter your bio"></textarea>
                <span id="bio-textarea-status" class="status-indicator">No focus</span>
            </div>

            <div class="form-group">
                <label for="country-select">Country Select:</label>
                <select id="country-select">
                    <option value="">Select a country</option>
                    <option value="us">United States</option>
                    <option value="uk">United Kingdom</option>
                    <option value="ca">Canada</option>
                </select>
                <span id="country-select-status" class="status-indicator">No focus</span>
            </div>

            <div class="form-group">
                <button type="button" id="submit-button">Submit Button</button>
                <span id="submit-button-status" class="status-indicator">No focus</span>
            </div>
        </div>

        <!-- Styled Focus Elements Section -->
        <div class="form-section">
            <h2>Focus Styles and Visual Feedback</h2>

            <div class="form-group">
                <label for="styled-input">Styled Input with Custom Focus Ring:</label>
                <input type="text" id="styled-input" placeholder="Focus me to see styles">
            </div>

            <div id="form-container">
                <h3>Focus-Within Container</h3>
                <div class="form-group">
                    <label for="nested-input">Nested Input (triggers container focus-within):</label>
                    <input type="text" id="nested-input" placeholder="Focus me">
                </div>
            </div>
        </div>

        <!-- Tab Order Section -->
        <div class="form-section">
            <h2>Tab Index and Navigation Order</h2>

            <p>Elements with custom tab order (should focus in order: 1, 2, 3):</p>
            <div class="tab-order-demo">
                <input type="text" id="tabindex-3" tabindex="3" placeholder="Tab Index 3">
                <input type="text" id="tabindex-1" tabindex="1" placeholder="Tab Index 1">
                <button type="button" id="tabindex-2" tabindex="2">Tab Index 2</button>
            </div>

            <p>Elements with normal and negative tab index:</p>
            <div class="tab-order-demo">
                <input type="text" id="normal-tab-input" placeholder="Normal tab order">
                <input type="text" id="negative-tabindex" tabindex="-1" placeholder="Negative tabindex (skip in tab)">
                <button type="button" id="last-tab-element">Last tab element</button>
            </div>
        </div>

        <!-- Programmatic Focus Section -->
        <div class="form-section">
            <h2>Programmatic Focus</h2>

            <div class="form-group">
                <button type="button" id="focus-trigger-button">Focus Target Input Programmatically</button>
                <input type="text" id="focus-target-input" placeholder="I will be focused by the button">
            </div>

            <div class="form-group">
                <input type="text" id="dynamic-test-input" placeholder="Dynamic test input">
                <div id="dynamic-container"></div>
            </div>
        </div>

        <!-- Edge Cases Section -->
        <div class="form-section">
            <h2>Edge Cases</h2>

            <div class="form-group">
                <label>Hidden Input (cannot receive focus):</label>
                <input type="text" id="hidden-input" class="hidden-element" placeholder="Hidden input">
            </div>

            <div class="form-group">
                <label>Disabled Input (cannot receive focus):</label>
                <input type="text" id="disabled-input" disabled placeholder="Disabled input">
            </div>
        </div>

        <!-- Event Log Section -->
        <div class="form-section">
            <h2>Focus Events Log</h2>
            <div id="focus-events-log">Focus events will be logged here...\n</div>
            <button type="button" id="clear-log">Clear Log</button>
        </div>
    </div>

    <script>
        // Focus event tracking
        const eventLog = document.getElementById('focus-events-log');

        function logEvent(type, element) {
            const timestamp = new Date().toISOString().substr(11, 12);
            const elementId = element.id || element.tagName.toLowerCase();
            const message = \`[\${timestamp}] \${type} on #\${elementId}\n\`;
            eventLog.textContent += message;
            eventLog.scrollTop = eventLog.scrollHeight;
            console.log('Focus event:', type, elementId);
        }

        function updateStatus(element, focused) {
            const statusElement = document.getElementById(element.id + '-status');
            if (statusElement) {
                statusElement.textContent = focused ? 'Focused' : 'Blurred';
                statusElement.className = 'status-indicator ' + (focused ? 'status-focused' : 'status-blurred');
            }
        }

        // Add focus event listeners to all form elements
        document.addEventListener('focus', function(e) {
            if (e.target.id) {
                logEvent('focus', e.target);
                updateStatus(e.target, true);

                // Add focused class for styled input
                if (e.target.id === 'styled-input') {
                    e.target.classList.add('focused');
                    e.target.setAttribute('data-focused', 'true');
                }
            }
        }, true);

        document.addEventListener('blur', function(e) {
            if (e.target.id) {
                logEvent('blur', e.target);
                updateStatus(e.target, false);

                // Remove focused class for styled input
                if (e.target.id === 'styled-input') {
                    e.target.classList.remove('focused');
                    e.target.removeAttribute('data-focused');
                }
            }
        }, true);

        // Programmatic focus button
        document.getElementById('focus-trigger-button').addEventListener('click', function() {
            const targetInput = document.getElementById('focus-target-input');
            targetInput.focus();
            logEvent('programmatic-focus', targetInput);
        });

        // Clear log button
        document.getElementById('clear-log').addEventListener('click', function() {
            eventLog.textContent = 'Focus events will be logged here...\n';
        });

        // Initialize
        logEvent('page-loaded', document.body);
        console.log('Focus test page loaded and ready');

        // Global utilities for tests
        window.testUtils = {
            logEvent: logEvent,
            clearLog: () => { eventLog.textContent = 'Focus events will be logged here...\n'; },
            getEventLog: () => eventLog.textContent,
            focusElement: (selector) => {
                const element = document.querySelector(selector);
                if (element) element.focus();
                return element;
            }
        };
    </script>
</body>
</html>`;

  await fs.writeFile(filePath, htmlContent, 'utf8');
}