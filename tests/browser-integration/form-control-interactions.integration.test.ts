/**
 * @fileoverview Integration tests for form control interactions
 *
 * Comprehensive test suite covering:
 * - Single select dropdowns
 * - Multi-select controls
 * - Checkbox toggle interactions
 * - Radio button selections
 * - Form submission scenarios
 * - Validation states and error handling
 *
 * These tests verify that browser automation can reliably interact with
 * all standard form controls and validate their behavior.
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

describe('Form Control Interactions Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;
  let formPagePath: string;

  beforeAll(async () => {
    // Create browser instance
    browser = await createBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);

    // Setup temporary directory for screenshots
    tempDir = globalThis.browserTestContext.tempDir!;

    // Set up form page path
    formPagePath = path.resolve(__dirname, 'fixtures', 'form-test-page.html');

    // Verify form page exists
    await fs.access(formPagePath);
    console.log(`Using form test page: ${formPagePath}`);
  });

  afterAll(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  beforeEach(async () => {
    // Navigate to form page before each test
    await page.goto(`file://${formPagePath}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for form elements to be ready
    await waitForElement(page, '#test-form', { visible: true });
  });

  describe('Single Select Dropdown Interactions', () => {
    it('should select country from dropdown and verify selection', async () => {
      await withBrowserTest(async (page) => {
        // Find the country dropdown
        const countrySelect = await waitForElement(page, '#country', {
          visible: true,
          enabled: true
        });

        // Verify initial state (no selection)
        const initialValue = await countrySelect.inputValue();
        expect(initialValue).toBe('');

        // Select United States
        await countrySelect.selectOption('us');

        // Verify selection
        const selectedValue = await countrySelect.inputValue();
        expect(selectedValue).toBe('us');

        // Verify the display text
        const selectedText = await page.locator('#country option:checked').textContent();
        expect(selectedText).toBe('United States');

        // Take screenshot of selection
        await takeScreenshot(page, 'country-dropdown-selected', tempDir);

        // Test selecting different option
        await countrySelect.selectOption('uk');
        const newValue = await countrySelect.inputValue();
        expect(newValue).toBe('uk');

        // Test selecting back to empty
        await countrySelect.selectOption('');
        const emptyValue = await countrySelect.inputValue();
        expect(emptyValue).toBe('');

      }, page);
    });

    it('should handle dropdown interactions with keyboard navigation', async () => {
      await withBrowserTest(async (page) => {
        // Focus the dropdown
        await page.locator('#country').focus();

        // Use keyboard to navigate and select
        await page.keyboard.press('ArrowDown'); // Opens dropdown
        await page.keyboard.press('ArrowDown'); // Move to first option
        await page.keyboard.press('ArrowDown'); // Move to US
        await page.keyboard.press('Enter'); // Select

        // Verify keyboard selection
        const value = await page.locator('#country').inputValue();
        expect(value).toBe('us');

        await takeScreenshot(page, 'dropdown-keyboard-selection', tempDir);

      }, page);
    });
  });

  describe('Enhanced Multi-Select Controls', () => {
    beforeEach(async () => {
      // Create a multi-select control by modifying the existing page
      await page.evaluate(() => {
        // Add multi-select dropdown to the form
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.innerHTML = `
          <label for="skills">Skills (Multi-select)</label>
          <select id="skills" name="skills" multiple size="5">
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="csharp">C#</option>
            <option value="golang">Go</option>
            <option value="rust">Rust</option>
          </select>
        `;

        // Insert after the country dropdown
        const countryGroup = document.querySelector('#country')?.closest('.form-group');
        countryGroup?.parentNode?.insertBefore(formGroup, countryGroup.nextSibling);
      });
    });

    it('should handle multi-select dropdown interactions', async () => {
      await withBrowserTest(async (page) => {
        // Wait for multi-select to be available
        const multiSelect = await waitForElement(page, '#skills', {
          visible: true,
          enabled: true
        });

        // Select multiple options using Ctrl+Click
        await multiSelect.selectOption(['javascript', 'python', 'java']);

        // Verify multiple selections
        const selectedValues = await page.locator('#skills').evaluate(
          (select: HTMLSelectElement) => {
            return Array.from(select.selectedOptions).map(option => option.value);
          }
        );

        expect(selectedValues).toEqual(['javascript', 'python', 'java']);
        expect(selectedValues).toHaveLength(3);

        // Test adding more selections
        await multiSelect.selectOption(['javascript', 'python', 'java', 'rust']);
        const updatedValues = await page.locator('#skills').evaluate(
          (select: HTMLSelectElement) => {
            return Array.from(select.selectedOptions).map(option => option.value);
          }
        );

        expect(updatedValues).toContain('rust');
        expect(updatedValues).toHaveLength(4);

        await takeScreenshot(page, 'multi-select-interactions', tempDir);

        // Test deselecting options
        await multiSelect.selectOption(['javascript']);
        const finalValues = await page.locator('#skills').evaluate(
          (select: HTMLSelectElement) => {
            return Array.from(select.selectedOptions).map(option => option.value);
          }
        );

        expect(finalValues).toEqual(['javascript']);

      }, page);
    });

    it('should handle multi-select with keyboard shortcuts', async () => {
      await withBrowserTest(async (page) => {
        // Focus multi-select
        await page.locator('#skills').focus();

        // Use keyboard to select multiple options with Ctrl
        await page.keyboard.press('ArrowDown'); // Select first option
        await page.keyboard.press('Space'); // Select it

        // Hold Ctrl and select more
        await page.keyboard.down('Control');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
        await page.keyboard.up('Control');

        // Verify keyboard multi-selection worked
        const selectedCount = await page.locator('#skills').evaluate(
          (select: HTMLSelectElement) => select.selectedOptions.length
        );

        expect(selectedCount).toBeGreaterThan(1);

        await takeScreenshot(page, 'multi-select-keyboard', tempDir);

      }, page);
    });
  });

  describe('Checkbox Toggle Interactions', () => {
    it('should toggle checkbox states and verify changes', async () => {
      await withBrowserTest(async (page) => {
        // Test newsletter checkbox (not required)
        const newsletterCheckbox = await waitForElement(page, '#newsletter', {
          visible: true,
          enabled: true
        });

        // Verify initial state (unchecked)
        let isChecked = await newsletterCheckbox.isChecked();
        expect(isChecked).toBe(false);

        // Click to check
        await safeClick(page, '#newsletter');
        isChecked = await newsletterCheckbox.isChecked();
        expect(isChecked).toBe(true);

        await takeScreenshot(page, 'checkbox-checked', tempDir);

        // Click to uncheck
        await safeClick(page, '#newsletter');
        isChecked = await newsletterCheckbox.isChecked();
        expect(isChecked).toBe(false);

        // Test terms checkbox (required)
        const termsCheckbox = await waitForElement(page, '#terms', {
          visible: true,
          enabled: true
        });

        // Toggle terms checkbox
        await safeClick(page, '#terms');
        const termsChecked = await termsCheckbox.isChecked();
        expect(termsChecked).toBe(true);

        await takeScreenshot(page, 'terms-checkbox-checked', tempDir);

      }, page);
    });

    it('should handle checkbox interactions via keyboard', async () => {
      await withBrowserTest(async (page) => {
        // Focus checkbox and use Space to toggle
        await page.locator('#newsletter').focus();
        await page.keyboard.press('Space');

        const isChecked = await page.locator('#newsletter').isChecked();
        expect(isChecked).toBe(true);

        // Press Space again to uncheck
        await page.keyboard.press('Space');
        const isUnchecked = await page.locator('#newsletter').isChecked();
        expect(isUnchecked).toBe(false);

        await takeScreenshot(page, 'checkbox-keyboard-toggle', tempDir);

      }, page);
    });

    it('should verify checkbox labels are clickable', async () => {
      await withBrowserTest(async (page) => {
        // Click on the label instead of checkbox
        await safeClick(page, 'label[for="newsletter"]');

        const isChecked = await page.locator('#newsletter').isChecked();
        expect(isChecked).toBe(true);

        // Click label again to uncheck
        await safeClick(page, 'label[for="newsletter"]');
        const isUnchecked = await page.locator('#newsletter').isChecked();
        expect(isUnchecked).toBe(false);

      }, page);
    });
  });

  describe('Radio Button Group Interactions', () => {
    beforeEach(async () => {
      // Add radio button group to the form
      await page.evaluate(() => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.innerHTML = `
          <label>Preferred Contact Method</label>
          <div style="margin-top: 10px;">
            <div class="radio-group" style="margin: 5px 0;">
              <input type="radio" id="contact-email" name="contact-method" value="email" />
              <label for="contact-email" style="margin-left: 8px; font-weight: normal;">Email</label>
            </div>
            <div class="radio-group" style="margin: 5px 0;">
              <input type="radio" id="contact-phone" name="contact-method" value="phone" />
              <label for="contact-phone" style="margin-left: 8px; font-weight: normal;">Phone</label>
            </div>
            <div class="radio-group" style="margin: 5px 0;">
              <input type="radio" id="contact-mail" name="contact-method" value="mail" />
              <label for="contact-mail" style="margin-left: 8px; font-weight: normal;">Postal Mail</label>
            </div>
          </div>
        `;

        // Insert after the terms checkbox
        const termsGroup = document.querySelector('#terms')?.closest('.form-group');
        termsGroup?.parentNode?.insertBefore(formGroup, termsGroup.nextSibling);
      });
    });

    it('should handle radio button selection and mutual exclusivity', async () => {
      await withBrowserTest(async (page) => {
        // Wait for radio buttons to be available
        await waitForElement(page, '#contact-email', { visible: true, enabled: true });

        // Verify no radio button is selected initially
        const emailChecked = await page.locator('#contact-email').isChecked();
        const phoneChecked = await page.locator('#contact-phone').isChecked();
        const mailChecked = await page.locator('#contact-mail').isChecked();

        expect(emailChecked).toBe(false);
        expect(phoneChecked).toBe(false);
        expect(mailChecked).toBe(false);

        // Select email option
        await safeClick(page, '#contact-email');
        const emailSelected = await page.locator('#contact-email').isChecked();
        expect(emailSelected).toBe(true);

        await takeScreenshot(page, 'radio-email-selected', tempDir);

        // Select phone option - should deselect email
        await safeClick(page, '#contact-phone');
        const phoneSelected = await page.locator('#contact-phone').isChecked();
        const emailDeselected = await page.locator('#contact-email').isChecked();

        expect(phoneSelected).toBe(true);
        expect(emailDeselected).toBe(false);

        // Select mail option - should deselect phone
        await safeClick(page, '#contact-mail');
        const mailSelected = await page.locator('#contact-mail').isChecked();
        const phoneDeselected = await page.locator('#contact-phone').isChecked();

        expect(mailSelected).toBe(true);
        expect(phoneDeselected).toBe(false);

        await takeScreenshot(page, 'radio-mail-selected', tempDir);

      }, page);
    });

    it('should handle radio button interaction via labels', async () => {
      await withBrowserTest(async (page) => {
        // Click on label to select radio button
        await safeClick(page, 'label[for="contact-phone"]');

        const phoneSelected = await page.locator('#contact-phone').isChecked();
        expect(phoneSelected).toBe(true);

        // Click different label
        await safeClick(page, 'label[for="contact-email"]');

        const emailSelected = await page.locator('#contact-email').isChecked();
        const phoneDeselected = await page.locator('#contact-phone').isChecked();

        expect(emailSelected).toBe(true);
        expect(phoneDeselected).toBe(false);

      }, page);
    });

    it('should handle radio button keyboard navigation', async () => {
      await withBrowserTest(async (page) => {
        // Focus first radio button
        await page.locator('#contact-email').focus();

        // Use arrow keys to navigate and select
        await page.keyboard.press('ArrowDown'); // Move to phone
        let phoneSelected = await page.locator('#contact-phone').isChecked();
        expect(phoneSelected).toBe(true);

        await page.keyboard.press('ArrowDown'); // Move to mail
        let mailSelected = await page.locator('#contact-mail').isChecked();
        expect(mailSelected).toBe(true);

        // Test wrap-around
        await page.keyboard.press('ArrowDown'); // Should wrap to email
        let emailSelected = await page.locator('#contact-email').isChecked();
        expect(emailSelected).toBe(true);

        await takeScreenshot(page, 'radio-keyboard-navigation', tempDir);

      }, page);
    });
  });

  describe('Form Submission Scenarios', () => {
    it('should submit form with valid data successfully', async () => {
      await withBrowserTest(async (page) => {
        // Fill out all required fields
        await safeFill(page, '#username', 'testuser123');
        await safeFill(page, '#email', 'test@example.com');
        await safeFill(page, '#password', 'password123');

        // Select country
        await page.locator('#country').selectOption('us');

        // Fill optional fields
        await safeFill(page, '#age', '25');
        await safeFill(page, '#bio', 'This is a test bio.');

        // Check required terms checkbox
        await safeClick(page, '#terms');

        // Check optional newsletter
        await safeClick(page, '#newsletter');

        await takeScreenshot(page, 'form-filled-complete', tempDir);

        // Capture console messages during submission
        const consoleMessages = await captureConsoleMessages(page, async () => {
          await safeClick(page, '#submit-btn');

          // Wait for form processing
          await page.waitForTimeout(1000);
        });

        // Verify form output is displayed
        const outputVisible = await page.locator('#form-output').isVisible();
        expect(outputVisible).toBe(true);

        // Verify form data is displayed
        const formDataText = await page.locator('#form-data').textContent();
        expect(formDataText).toContain('testuser123');
        expect(formDataText).toContain('test@example.com');
        expect(formDataText).toContain('us');

        // Verify console messages indicate successful submission
        const successMessage = consoleMessages.find(
          msg => msg.text.includes('Form submitted successfully')
        );
        expect(successMessage).toBeDefined();

        await takeScreenshot(page, 'form-submission-success', tempDir);

      }, page);
    });

    it('should handle form submission with validation errors', async () => {
      await withBrowserTest(async (page) => {
        // Try to submit form without filling required fields
        const consoleMessages = await captureConsoleMessages(page, async () => {
          await safeClick(page, '#submit-btn');
          await page.waitForTimeout(500);
        });

        // Verify validation errors are shown
        const usernameError = await page.locator('#username-error').textContent();
        const emailError = await page.locator('#email-error').textContent();
        const passwordError = await page.locator('#password-error').textContent();
        const termsError = await page.locator('#terms-error').textContent();

        expect(usernameError).toContain('required');
        expect(emailError).toContain('required');
        expect(passwordError).toContain('required');
        expect(termsError).toContain('agree to the terms');

        // Verify form output is not displayed
        const outputVisible = await page.locator('#form-output').isVisible();
        expect(outputVisible).toBe(false);

        // Verify console shows validation failure
        const failureMessage = consoleMessages.find(
          msg => msg.text.includes('Form validation failed')
        );
        expect(failureMessage).toBeDefined();

        await takeScreenshot(page, 'form-validation-errors', tempDir);

      }, page);
    });

    it('should handle form reset functionality', async () => {
      await withBrowserTest(async (page) => {
        // Fill out some fields
        await safeFill(page, '#username', 'testuser');
        await safeFill(page, '#email', 'test@example.com');
        await safeClick(page, '#newsletter');
        await page.locator('#country').selectOption('ca');

        // Verify fields are filled
        const username = await page.locator('#username').inputValue();
        const email = await page.locator('#email').inputValue();
        const newsletter = await page.locator('#newsletter').isChecked();
        const country = await page.locator('#country').inputValue();

        expect(username).toBe('testuser');
        expect(email).toBe('test@example.com');
        expect(newsletter).toBe(true);
        expect(country).toBe('ca');

        // Click reset button
        const consoleMessages = await captureConsoleMessages(page, async () => {
          await safeClick(page, '#reset-btn');
          await page.waitForTimeout(500);
        });

        // Verify fields are cleared
        const clearedUsername = await page.locator('#username').inputValue();
        const clearedEmail = await page.locator('#email').inputValue();
        const clearedNewsletter = await page.locator('#newsletter').isChecked();
        const clearedCountry = await page.locator('#country').inputValue();

        expect(clearedUsername).toBe('');
        expect(clearedEmail).toBe('');
        expect(clearedNewsletter).toBe(false);
        expect(clearedCountry).toBe('');

        // Verify console shows reset message
        const resetMessage = consoleMessages.find(
          msg => msg.text.includes('Form reset')
        );
        expect(resetMessage).toBeDefined();

        await takeScreenshot(page, 'form-after-reset', tempDir);

      }, page);
    });

    it('should handle validate-only functionality', async () => {
      await withBrowserTest(async (page) => {
        // Setup alert handler to capture validation alerts
        let alertMessage = '';
        await setupAlertHandler(page, (message) => {
          alertMessage = message;
          return true; // Accept alert
        });

        // Fill form with valid data
        await safeFill(page, '#username', 'validuser');
        await safeFill(page, '#email', 'valid@example.com');
        await safeFill(page, '#password', 'validpass123');
        await safeClick(page, '#terms');

        // Click validate button
        const consoleMessages = await captureConsoleMessages(page, async () => {
          await safeClick(page, '#validate-btn');
          await page.waitForTimeout(1000);
        });

        // Verify validation success
        expect(alertMessage).toContain('Form is valid!');

        // Verify console shows validation result
        const validationMessage = consoleMessages.find(
          msg => msg.text.includes('Form validation result: true')
        );
        expect(validationMessage).toBeDefined();

        // Verify form output is NOT displayed (validate only, not submit)
        const outputVisible = await page.locator('#form-output').isVisible();
        expect(outputVisible).toBe(false);

        await takeScreenshot(page, 'form-validate-only-success', tempDir);

      }, page);
    });
  });

  describe('Validation States and Error Handling', () => {
    it('should display real-time validation errors on field blur', async () => {
      await withBrowserTest(async (page) => {
        // Test username validation
        await safeFill(page, '#username', 'ab'); // Too short
        await page.locator('#username').blur();
        await page.waitForTimeout(100);

        const usernameError = await page.locator('#username-error').textContent();
        expect(usernameError).toContain('at least 3 characters');

        // Test email validation
        await safeFill(page, '#email', 'invalid-email');
        await page.locator('#email').blur();
        await page.waitForTimeout(100);

        const emailError = await page.locator('#email-error').textContent();
        expect(emailError).toContain('valid email address');

        await takeScreenshot(page, 'real-time-validation-errors', tempDir);

        // Fix the errors and verify they clear
        await safeFill(page, '#username', 'validuser');
        await page.locator('#username').blur();
        await page.waitForTimeout(100);

        await safeFill(page, '#email', 'valid@example.com');
        await page.locator('#email').blur();
        await page.waitForTimeout(100);

        const clearedUsernameError = await page.locator('#username-error').textContent();
        const clearedEmailError = await page.locator('#email-error').textContent();

        expect(clearedUsernameError).toBe('');
        expect(clearedEmailError).toBe('');

        await takeScreenshot(page, 'validation-errors-cleared', tempDir);

      }, page);
    });

    it('should validate password requirements', async () => {
      await withBrowserTest(async (page) => {
        // Test short password
        await safeFill(page, '#password', '123');
        await safeClick(page, '#submit-btn');

        const passwordError = await page.locator('#password-error').textContent();
        expect(passwordError).toContain('at least 6 characters');

        // Test valid password
        await safeFill(page, '#password', 'validpass123');
        await safeFill(page, '#username', 'testuser');
        await safeFill(page, '#email', 'test@example.com');
        await safeClick(page, '#terms');

        await safeClick(page, '#submit-btn');
        await page.waitForTimeout(500);

        const clearedPasswordError = await page.locator('#password-error').textContent();
        expect(clearedPasswordError).toBe('');

      }, page);
    });

    it('should validate required field combinations', async () => {
      await withBrowserTest(async (page) => {
        // Fill some but not all required fields
        await safeFill(page, '#username', 'testuser');
        await safeFill(page, '#email', 'test@example.com');
        // Skip password and terms

        await safeClick(page, '#submit-btn');
        await page.waitForTimeout(500);

        // Verify specific missing field errors
        const passwordError = await page.locator('#password-error').textContent();
        const termsError = await page.locator('#terms-error').textContent();

        expect(passwordError).toContain('required');
        expect(termsError).toContain('agree to the terms');

        // Verify form did not submit
        const outputVisible = await page.locator('#form-output').isVisible();
        expect(outputVisible).toBe(false);

        await takeScreenshot(page, 'partial-required-validation', tempDir);

      }, page);
    });

    it('should handle numeric field validation', async () => {
      await withBrowserTest(async (page) => {
        // Test age field with invalid values
        await safeFill(page, '#age', '-5');

        // Fill other required fields to test age validation
        await safeFill(page, '#username', 'testuser');
        await safeFill(page, '#email', 'test@example.com');
        await safeFill(page, '#password', 'password123');
        await safeClick(page, '#terms');

        await safeClick(page, '#submit-btn');
        await page.waitForTimeout(500);

        // Browser HTML5 validation should handle min/max constraints
        const ageValue = await page.locator('#age').inputValue();

        // Test with valid age
        await safeFill(page, '#age', '25');
        await safeClick(page, '#submit-btn');
        await page.waitForTimeout(500);

        const outputVisible = await page.locator('#form-output').isVisible();
        expect(outputVisible).toBe(true);

        await takeScreenshot(page, 'numeric-validation-success', tempDir);

      }, page);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle rapid form interactions without errors', async () => {
      await withBrowserTest(async (page) => {
        // Rapidly interact with multiple form elements
        const errors = await capturePageErrors(page, async () => {
          // Rapid typing
          await safeFill(page, '#username', 'user1');
          await safeFill(page, '#username', 'user2');
          await safeFill(page, '#username', 'finaluser');

          // Rapid checkbox toggling
          await safeClick(page, '#newsletter');
          await safeClick(page, '#newsletter');
          await safeClick(page, '#newsletter');

          // Rapid dropdown changes
          await page.locator('#country').selectOption('us');
          await page.locator('#country').selectOption('uk');
          await page.locator('#country').selectOption('ca');

          await page.waitForTimeout(500);
        });

        // Verify no JavaScript errors occurred
        expect(errors.length).toBe(0);

        // Verify final state is consistent
        const finalUsername = await page.locator('#username').inputValue();
        const finalNewsletter = await page.locator('#newsletter').isChecked();
        const finalCountry = await page.locator('#country').inputValue();

        expect(finalUsername).toBe('finaluser');
        expect(finalNewsletter).toBe(true);
        expect(finalCountry).toBe('ca');

        await takeScreenshot(page, 'rapid-interactions-final', tempDir);

      }, page);
    });

    it('should handle form interactions during page transitions', async () => {
      await withBrowserTest(async (page) => {
        // Fill form data
        await safeFill(page, '#username', 'testuser');
        await safeClick(page, '#newsletter');

        // Reload page and verify form is reset
        await page.reload();
        await waitForElement(page, '#test-form', { visible: true });

        const clearedUsername = await page.locator('#username').inputValue();
        const clearedNewsletter = await page.locator('#newsletter').isChecked();

        expect(clearedUsername).toBe('');
        expect(clearedNewsletter).toBe(false);

      }, page);
    });

    it('should verify all form controls are accessible and functional', async () => {
      await withBrowserTest(async (page) => {
        // Test all form controls are present and functional
        const formControls = [
          '#username',
          '#email',
          '#password',
          '#age',
          '#country',
          '#bio',
          '#newsletter',
          '#terms',
          '#submit-btn',
          '#reset-btn',
          '#validate-btn'
        ];

        for (const selector of formControls) {
          const element = await waitForElement(page, selector, {
            visible: true,
            timeout: 5000
          });

          // Verify element exists and is in DOM
          const exists = await element.count();
          expect(exists).toBe(1);

          // For interactive elements, verify they can receive focus
          if (!selector.includes('btn')) {
            await element.focus();
            const isFocused = await element.evaluate(
              (el: HTMLElement) => document.activeElement === el
            );
            expect(isFocused).toBe(true);
          }
        }

        await takeScreenshot(page, 'all-controls-accessible', tempDir);

      }, page);
    });
  });
});