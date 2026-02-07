/**
 * @fileoverview Form Interaction Test Suite
 *
 * This test file comprehensively validates the form interaction utilities
 * in the element interaction infrastructure. It tests:
 * - performTextInput with various validation options
 * - fillForm for complex form workflows
 * - performClick with form elements
 * - Form validation and error handling
 * - Complex form scenarios and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTestBase, createBrowserTest } from '../../test-utils/browser-test-base.js';
import {
  performTextInput,
  performClick,
  fillForm,
  createTestForm,
  getElementState,
  waitForConditions,
  type FormField,
  type ElementInteractionOptions
} from '../utils/element-interaction-helpers.js';

describe('Form Interaction Utilities', () => {
  let browserTest: BrowserTestBase;

  beforeEach(async () => {
    browserTest = createBrowserTest({
      headless: true,
      timeout: 30000,
    });
    await browserTest.setup();

    // Set up a comprehensive form test page
    await browserTest.context.page!.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Form Interaction Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .form-group { margin: 15px 0; }
          .form-control {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
          }
          .form-label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
          }
          .error {
            border-color: #dc3545 !important;
            background-color: #f8d7da;
          }
          .success {
            border-color: #28a745 !important;
            background-color: #d4edda;
          }
          .error-message {
            color: #dc3545;
            font-size: 12px;
            margin-top: 5px;
          }
          .readonly { background-color: #e9ecef; }
          .required::after { content: ' *'; color: red; }
          .btn {
            padding: 10px 20px;
            margin: 5px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .btn-primary { background-color: #007bff; color: white; }
          .btn-secondary { background-color: #6c757d; color: white; }
          .btn-success { background-color: #28a745; color: white; }
          .btn:disabled { opacity: 0.6; cursor: not-allowed; }
          .hidden { display: none; }
          .loading::after { content: '...'; animation: dots 1s infinite; }
          @keyframes dots {
            0%, 20% { content: '...'; }
            40% { content: '....'; }
            60% { content: '.....'; }
            80%, 100% { content: '...'; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Form Interaction Test Page</h1>

          <div class="form-section">
            <h2>Basic Form</h2>
            <form id="basic-form">
              <div class="form-group">
                <label class="form-label required" for="basic-username">Username</label>
                <input type="text" id="basic-username" name="username" class="form-control" required>
                <div id="basic-username-error" class="error-message hidden"></div>
              </div>

              <div class="form-group">
                <label class="form-label required" for="basic-email">Email</label>
                <input type="email" id="basic-email" name="email" class="form-control" required>
                <div id="basic-email-error" class="error-message hidden"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="basic-phone">Phone</label>
                <input type="tel" id="basic-phone" name="phone" class="form-control" pattern="[0-9-()+ ]+">
                <div id="basic-phone-error" class="error-message hidden"></div>
              </div>

              <div class="form-group">
                <button type="submit" id="basic-submit" class="btn btn-primary">Submit</button>
                <button type="reset" id="basic-reset" class="btn btn-secondary">Reset</button>
              </div>
            </form>
            <div id="basic-form-result" class="hidden"></div>
          </div>

          <div class="form-section">
            <h2>Advanced Form</h2>
            <form id="advanced-form">
              <div class="form-group">
                <label class="form-label required" for="first-name">First Name</label>
                <input type="text" id="first-name" name="firstName" class="form-control" required minlength="2">
              </div>

              <div class="form-group">
                <label class="form-label required" for="last-name">Last Name</label>
                <input type="text" id="last-name" name="lastName" class="form-control" required minlength="2">
              </div>

              <div class="form-group">
                <label class="form-label required" for="age">Age</label>
                <input type="number" id="age" name="age" class="form-control" min="18" max="100" required>
              </div>

              <div class="form-group">
                <label class="form-label" for="bio">Biography</label>
                <textarea id="bio" name="bio" class="form-control" rows="4" maxlength="500"></textarea>
                <small id="bio-counter">0/500 characters</small>
              </div>

              <div class="form-group">
                <label class="form-label required" for="country">Country</label>
                <select id="country" name="country" class="form-control" required>
                  <option value="">Select a country</option>
                  <option value="us">United States</option>
                  <option value="ca">Canada</option>
                  <option value="uk">United Kingdom</option>
                  <option value="au">Australia</option>
                  <option value="de">Germany</option>
                  <option value="fr">France</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Gender</label>
                <div>
                  <label><input type="radio" name="gender" value="male"> Male</label>
                  <label><input type="radio" name="gender" value="female"> Female</label>
                  <label><input type="radio" name="gender" value="other"> Other</label>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Interests</label>
                <div>
                  <label><input type="checkbox" name="interests" value="sports"> Sports</label>
                  <label><input type="checkbox" name="interests" value="music"> Music</label>
                  <label><input type="checkbox" name="interests" value="travel"> Travel</label>
                  <label><input type="checkbox" name="interests" value="technology"> Technology</label>
                  <label><input type="checkbox" name="interests" value="reading"> Reading</label>
                </div>
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" id="newsletter" name="newsletter">
                  Subscribe to newsletter
                </label>
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" id="terms" name="terms" required>
                  I agree to the terms and conditions *
                </label>
              </div>

              <div class="form-group">
                <button type="submit" id="advanced-submit" class="btn btn-primary">Submit Advanced Form</button>
                <button type="reset" id="advanced-reset" class="btn btn-secondary">Reset</button>
                <button type="button" id="validate-form" class="btn btn-success">Validate</button>
              </div>
            </form>
            <div id="advanced-form-result" class="hidden"></div>
          </div>

          <div class="form-section">
            <h2>Dynamic Form</h2>
            <div id="dynamic-form-container">
              <!-- Dynamic form will be created here -->
            </div>
            <button id="create-dynamic-form" class="btn btn-primary">Create Dynamic Form</button>
            <div id="dynamic-form-result" class="hidden"></div>
          </div>

          <div class="form-section">
            <h2>Async Form Processing</h2>
            <form id="async-form">
              <div class="form-group">
                <label class="form-label" for="async-data">Data to Process</label>
                <input type="text" id="async-data" name="data" class="form-control" placeholder="Enter data">
              </div>
              <div class="form-group">
                <button type="submit" id="async-submit" class="btn btn-primary">
                  Process Async <span id="async-loading" class="hidden loading"></span>
                </button>
              </div>
            </form>
            <div id="async-result" class="hidden"></div>
          </div>
        </div>

        <script>
          // Basic form validation and submission
          document.getElementById('basic-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            // Simple validation
            let isValid = true;
            if (!data.username || data.username.length < 3) {
              showError('basic-username-error', 'Username must be at least 3 characters');
              isValid = false;
            } else {
              hideError('basic-username-error');
            }

            if (!data.email || !data.email.includes('@')) {
              showError('basic-email-error', 'Please enter a valid email');
              isValid = false;
            } else {
              hideError('basic-email-error');
            }

            if (isValid) {
              document.getElementById('basic-form-result').innerHTML =
                '<div style="color: green;">Basic form submitted successfully: ' + JSON.stringify(data, null, 2) + '</div>';
              document.getElementById('basic-form-result').classList.remove('hidden');
            }
          });

          // Advanced form validation
          document.getElementById('advanced-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            // Get multi-value fields
            const interests = formData.getAll('interests');
            if (interests.length > 0) {
              data.interests = interests;
            }

            document.getElementById('advanced-form-result').innerHTML =
              '<div style="color: green;">Advanced form submitted: ' + JSON.stringify(data, null, 2) + '</div>';
            document.getElementById('advanced-form-result').classList.remove('hidden');
          });

          // Bio character counter
          document.getElementById('bio').addEventListener('input', function() {
            const counter = document.getElementById('bio-counter');
            const length = this.value.length;
            counter.textContent = length + '/500 characters';
            if (length > 400) {
              counter.style.color = '#dc3545';
            } else {
              counter.style.color = '';
            }
          });

          // Form validation
          document.getElementById('validate-form').addEventListener('click', function() {
            const form = document.getElementById('advanced-form');
            const isValid = form.checkValidity();

            if (isValid) {
              alert('Form is valid!');
            } else {
              form.reportValidity();
            }
          });

          // Dynamic form creation
          document.getElementById('create-dynamic-form').addEventListener('click', function() {
            const container = document.getElementById('dynamic-form-container');
            container.innerHTML = `
              <form id="dynamic-form">
                <div class="form-group">
                  <label class="form-label" for="dynamic-field-1">Dynamic Field 1</label>
                  <input type="text" id="dynamic-field-1" name="field1" class="form-control">
                </div>
                <div class="form-group">
                  <label class="form-label" for="dynamic-field-2">Dynamic Field 2</label>
                  <input type="text" id="dynamic-field-2" name="field2" class="form-control">
                </div>
                <div class="form-group">
                  <button type="submit" class="btn btn-primary">Submit Dynamic</button>
                </div>
              </form>
            `;

            // Add event listener to dynamic form
            document.getElementById('dynamic-form').addEventListener('submit', function(e) {
              e.preventDefault();
              const formData = new FormData(this);
              const data = Object.fromEntries(formData.entries());
              document.getElementById('dynamic-form-result').innerHTML =
                '<div style="color: green;">Dynamic form submitted: ' + JSON.stringify(data, null, 2) + '</div>';
              document.getElementById('dynamic-form-result').classList.remove('hidden');
            });

            this.textContent = 'Dynamic Form Created';
            this.disabled = true;
          });

          // Async form processing
          document.getElementById('async-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const button = document.getElementById('async-submit');
            const loading = document.getElementById('async-loading');
            const result = document.getElementById('async-result');

            button.disabled = true;
            loading.classList.remove('hidden');

            // Simulate async processing
            setTimeout(() => {
              const formData = new FormData(e.target);
              const data = Object.fromEntries(formData.entries());

              result.innerHTML = '<div style="color: green;">Async processing completed: ' + JSON.stringify(data, null, 2) + '</div>';
              result.classList.remove('hidden');

              button.disabled = false;
              loading.classList.add('hidden');
            }, 2000);
          });

          function showError(elementId, message) {
            const errorElement = document.getElementById(elementId);
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');

            const inputId = elementId.replace('-error', '');
            const inputElement = document.getElementById(inputId);
            if (inputElement) {
              inputElement.classList.add('error');
            }
          }

          function hideError(elementId) {
            const errorElement = document.getElementById(elementId);
            errorElement.classList.add('hidden');

            const inputId = elementId.replace('-error', '');
            const inputElement = document.getElementById(inputId);
            if (inputElement) {
              inputElement.classList.remove('error');
            }
          }
        </script>
      </body>
      </html>
    `);

    await browserTest.context.page!.waitForLoadState('domcontentloaded');
  });

  afterEach(async () => {
    await browserTest.teardown();
  });

  describe('performTextInput', () => {
    it('should perform basic text input with validation', async () => {
      const testText = 'testusername123';

      const result = await performTextInput(
        browserTest.context.page!,
        '#basic-username',
        testText,
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: testText,
          typeDelay: 50
        }
      );

      expect(result.success).toBe(true);
      expect(result.finalValue).toBe(testText);
      expect(result.expectedMatch).toBe(true);
      expect(result.inputCleared).toBe(true);

      // Verify input actually contains the text
      const inputValue = await browserTest.context.page!.inputValue('#basic-username');
      expect(inputValue).toBe(testText);
    });

    it('should handle email input with validation', async () => {
      const testEmail = 'test@example.com';

      const result = await performTextInput(
        browserTest.context.page!,
        '#basic-email',
        testEmail,
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: testEmail
        }
      );

      expect(result.success).toBe(true);
      expect(result.finalValue).toBe(testEmail);
      expect(result.expectedMatch).toBe(true);
    });

    it('should handle textarea input with character counting', async () => {
      const bioText = 'This is a comprehensive biography that includes multiple sentences to test the textarea functionality and character counting features.';

      const result = await performTextInput(
        browserTest.context.page!,
        '#bio',
        bioText,
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: bioText,
          typeDelay: 25
        }
      );

      expect(result.success).toBe(true);
      expect(result.finalValue).toBe(bioText);

      // Verify character counter updated
      const counterText = await browserTest.context.page!.textContent('#bio-counter');
      expect(counterText).toContain(bioText.length.toString());
    });

    it('should handle input clearing and retry logic', async () => {
      // Pre-fill the input
      await browserTest.context.page!.fill('#basic-username', 'prefilled-text');

      const testText = 'new-username';
      const result = await performTextInput(
        browserTest.context.page!,
        '#basic-username',
        testText,
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: testText,
          retries: 3
        }
      );

      expect(result.success).toBe(true);
      expect(result.inputCleared).toBe(true);
      expect(result.finalValue).toBe(testText);
    });

    it('should detect input validation failure', async () => {
      const invalidText = 'ab'; // Too short for minlength requirement

      const result = await performTextInput(
        browserTest.context.page!,
        '#first-name',
        invalidText,
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: invalidText
        }
      );

      expect(result.success).toBe(true); // Input succeeds
      expect(result.finalValue).toBe(invalidText);

      // But form validation should catch it
      const isValid = await browserTest.context.page!.evaluate(() => {
        const input = document.getElementById('first-name') as HTMLInputElement;
        return input.checkValidity();
      });

      expect(isValid).toBe(false);
    });

    it('should handle number input with constraints', async () => {
      const ageValue = '25';

      const result = await performTextInput(
        browserTest.context.page!,
        '#age',
        ageValue,
        {
          clearFirst: true,
          validateInput: true,
          expectedValue: ageValue
        }
      );

      expect(result.success).toBe(true);
      expect(result.finalValue).toBe(ageValue);

      // Verify input is within valid range
      const isValid = await browserTest.context.page!.evaluate(() => {
        const input = document.getElementById('age') as HTMLInputElement;
        return input.checkValidity();
      });

      expect(isValid).toBe(true);
    });
  });

  describe('fillForm', () => {
    it('should fill basic form with validation', async () => {
      const formData = {
        '#basic-username': 'johndoe123',
        '#basic-email': 'john.doe@example.com',
        '#basic-phone': '+1 (555) 123-4567'
      };

      const result = await fillForm(browserTest.context.page!, '#basic-form', formData, {
        validateEach: true,
        clearBefore: true,
        waitBetweenFields: 100
      });

      expect(result.success).toBe(true);
      expect(result.fieldsProcessed).toBe(3);
      expect(result.fieldsSuccessful).toBe(3);
      expect(result.fieldErrors).toHaveLength(0);

      // Verify each field was filled correctly
      expect(result.fieldResults['#basic-username'].success).toBe(true);
      expect(result.fieldResults['#basic-email'].success).toBe(true);
      expect(result.fieldResults['#basic-phone'].success).toBe(true);

      // Verify actual form values
      const usernameValue = await browserTest.context.page!.inputValue('#basic-username');
      expect(usernameValue).toBe(formData['#basic-username']);
    });

    it('should fill advanced form with multiple field types', async () => {
      const formData = {
        '#first-name': 'John',
        '#last-name': 'Doe',
        '#age': '30',
        '#bio': 'Software developer with 10 years of experience in web development.',
        '#country': 'us'
      };

      const result = await fillForm(browserTest.context.page!, '#advanced-form', formData, {
        validateEach: true,
        clearBefore: true,
        submitAfter: false
      });

      expect(result.success).toBe(true);
      expect(result.fieldsProcessed).toBe(5);
      expect(result.fieldsSuccessful).toBe(5);

      // Verify select field
      const countryValue = await browserTest.context.page!.inputValue('#country');
      expect(countryValue).toBe('us');

      // Verify textarea
      const bioValue = await browserTest.context.page!.inputValue('#bio');
      expect(bioValue).toBe(formData['#bio']);
    });

    it('should handle checkbox and radio button interactions', async () => {
      // First fill the required text fields
      const basicData = {
        '#first-name': 'Jane',
        '#last-name': 'Smith',
        '#age': '28',
        '#country': 'ca'
      };

      await fillForm(browserTest.context.page!, '#advanced-form', basicData, {
        validateEach: true,
        clearBefore: true
      });

      // Handle checkboxes
      await browserTest.context.page!.check('input[name="interests"][value="technology"]');
      await browserTest.context.page!.check('input[name="interests"][value="reading"]');
      await browserTest.context.page!.check('#newsletter');
      await browserTest.context.page!.check('#terms');

      // Handle radio button
      await browserTest.context.page!.check('input[name="gender"][value="female"]');

      // Verify selections
      const technologyChecked = await browserTest.context.page!.isChecked('input[name="interests"][value="technology"]');
      expect(technologyChecked).toBe(true);

      const genderSelected = await browserTest.context.page!.isChecked('input[name="gender"][value="female"]');
      expect(genderSelected).toBe(true);

      const termsChecked = await browserTest.context.page!.isChecked('#terms');
      expect(termsChecked).toBe(true);
    });

    it('should handle form submission after filling', async () => {
      const formData = {
        '#basic-username': 'testuser',
        '#basic-email': 'test@test.com',
        '#basic-phone': '123-456-7890'
      };

      const fillResult = await fillForm(browserTest.context.page!, '#basic-form', formData, {
        validateEach: true,
        clearBefore: true,
        submitAfter: true
      });

      expect(fillResult.success).toBe(true);
      expect(fillResult.submitted).toBe(true);

      // Wait for form submission result
      await waitForConditions(browserTest.context.page!, '#basic-form-result', [
        { condition: 'visible', timeout: 5000 }
      ]);

      const resultVisible = await browserTest.context.page!.locator('#basic-form-result').isVisible();
      expect(resultVisible).toBe(true);

      const resultText = await browserTest.context.page!.textContent('#basic-form-result');
      expect(resultText).toContain('submitted successfully');
    });

    it('should handle validation errors gracefully', async () => {
      const invalidData = {
        '#basic-username': 'ab', // Too short
        '#basic-email': 'invalid-email', // Invalid format
        '#basic-phone': 'invalid-phone'
      };

      const result = await fillForm(browserTest.context.page!, '#basic-form', invalidData, {
        validateEach: false, // Skip individual validation to test form validation
        clearBefore: true,
        submitAfter: true
      });

      expect(result.success).toBe(true); // Fill succeeds
      expect(result.submitted).toBe(true);

      // Form should show validation errors
      await waitForConditions(browserTest.context.page!, '#basic-username-error', [
        { condition: 'visible', timeout: 3000 }
      ]);

      const usernameErrorVisible = await browserTest.context.page!.locator('#basic-username-error').isVisible();
      expect(usernameErrorVisible).toBe(true);
    });
  });

  describe('performClick', () => {
    it('should click form submit button with state capture', async () => {
      // Fill form first
      await fillForm(browserTest.context.page!, '#basic-form', {
        '#basic-username': 'clicktest',
        '#basic-email': 'click@test.com'
      }, { validateEach: true });

      const result = await performClick(browserTest.context.page!, '#basic-submit', {
        captureBeforeState: true,
        waitForStable: true,
        validateClick: true
      });

      expect(result.success).toBe(true);
      expect(result.beforeState).toBeDefined();
      expect(result.beforeState?.enabled).toBe(true);
      expect(result.clickValidated).toBe(true);
    });

    it('should click reset button and verify form clearing', async () => {
      // Fill form first
      await fillForm(browserTest.context.page!, '#basic-form', {
        '#basic-username': 'resettest',
        '#basic-email': 'reset@test.com'
      });

      // Get initial state
      const beforeState = await getElementState(browserTest.context.page!, '#basic-username');
      expect(beforeState?.value).toBe('resettest');

      // Click reset
      const result = await performClick(browserTest.context.page!, '#basic-reset', {
        captureBeforeState: true,
        waitForStable: true
      });

      expect(result.success).toBe(true);

      // Verify form was reset
      const afterState = await getElementState(browserTest.context.page!, '#basic-username');
      expect(afterState?.value).toBe('');
    });

    it('should click dynamic form creation button', async () => {
      const result = await performClick(browserTest.context.page!, '#create-dynamic-form', {
        captureBeforeState: true,
        waitForStable: true
      });

      expect(result.success).toBe(true);

      // Wait for dynamic form to be created
      await waitForConditions(browserTest.context.page!, '#dynamic-form', [
        { condition: 'visible', timeout: 3000 }
      ]);

      // Verify dynamic form exists
      const dynamicFormExists = await browserTest.context.page!.locator('#dynamic-form').isVisible();
      expect(dynamicFormExists).toBe(true);
    });

    it('should handle async form submission', async () => {
      // Fill async form
      await performTextInput(browserTest.context.page!, '#async-data', 'test async data');

      // Click submit button
      const result = await performClick(browserTest.context.page!, '#async-submit', {
        captureBeforeState: true,
        waitForStable: false // Don't wait since it will be in loading state
      });

      expect(result.success).toBe(true);

      // Verify loading state
      const loadingVisible = await browserTest.context.page!.locator('#async-loading').isVisible();
      expect(loadingVisible).toBe(true);

      // Wait for async processing to complete
      await waitForConditions(browserTest.context.page!, '#async-result', [
        { condition: 'visible', timeout: 5000 }
      ]);

      const resultVisible = await browserTest.context.page!.locator('#async-result').isVisible();
      expect(resultVisible).toBe(true);
    });
  });

  describe('Dynamic Form Creation and Interaction', () => {
    it('should create and interact with dynamically created forms', async () => {
      const formFields: FormField[] = [
        {
          selector: 'dynamic-input-1',
          type: 'text',
          label: 'Dynamic Input 1',
          required: true
        },
        {
          selector: 'dynamic-input-2',
          type: 'email',
          label: 'Dynamic Email',
          required: true
        },
        {
          selector: 'dynamic-textarea',
          type: 'textarea',
          label: 'Dynamic Textarea',
          rows: 3
        },
        {
          selector: 'dynamic-select',
          type: 'select',
          label: 'Dynamic Select',
          options: [
            { value: '', text: 'Choose option' },
            { value: 'option1', text: 'Option 1' },
            { value: 'option2', text: 'Option 2' }
          ]
        }
      ];

      const { form, fields } = await createTestForm(browserTest.context.page!, {
        id: 'test-dynamic-form',
        fields: formFields,
        submitButton: true,
        parent: '.container'
      });

      expect(form).toBeDefined();
      expect(Object.keys(fields)).toHaveLength(4);

      // Fill the dynamically created form
      const formData = {
        '#test-dynamic-form-dynamic-input-1': 'Dynamic Value 1',
        '#test-dynamic-form-dynamic-input-2': 'dynamic@test.com',
        '#test-dynamic-form-dynamic-textarea': 'This is dynamic textarea content',
        '#test-dynamic-form-dynamic-select': 'option2'
      };

      const fillResult = await fillForm(browserTest.context.page!, '#test-dynamic-form', formData, {
        validateEach: true,
        clearBefore: true
      });

      expect(fillResult.success).toBe(true);
      expect(fillResult.fieldsSuccessful).toBe(4);
    });
  });

  describe('Complex Form Workflows', () => {
    it('should handle multi-step form workflow', async () => {
      // Step 1: Fill basic information
      const step1Data = {
        '#first-name': 'MultiStep',
        '#last-name': 'User',
        '#age': '35'
      };

      const step1Result = await fillForm(browserTest.context.page!, '#advanced-form', step1Data, {
        validateEach: true,
        clearBefore: true
      });

      expect(step1Result.success).toBe(true);

      // Step 2: Fill additional information
      await performTextInput(browserTest.context.page!, '#bio', 'Multi-step form testing biography');
      await browserTest.context.page!.selectOption('#country', 'uk');

      // Step 3: Select preferences
      await browserTest.context.page!.check('input[name="interests"][value="sports"]');
      await browserTest.context.page!.check('input[name="interests"][value="music"]');
      await browserTest.context.page!.check('input[name="gender"][value="other"]');

      // Step 4: Final agreements
      await browserTest.context.page!.check('#newsletter');
      await browserTest.context.page!.check('#terms');

      // Step 5: Validate form before submission
      const validateResult = await performClick(browserTest.context.page!, '#validate-form', {
        waitForStable: true
      });

      expect(validateResult.success).toBe(true);

      // Step 6: Submit form
      const submitResult = await performClick(browserTest.context.page!, '#advanced-submit', {
        captureBeforeState: true,
        waitForStable: true
      });

      expect(submitResult.success).toBe(true);

      // Verify submission result
      await waitForConditions(browserTest.context.page!, '#advanced-form-result', [
        { condition: 'visible', timeout: 5000 }
      ]);

      const resultText = await browserTest.context.page!.textContent('#advanced-form-result');
      expect(resultText).toContain('Advanced form submitted');
    });

    it('should handle form field dependency and conditional logic', async () => {
      // Add conditional logic via JavaScript
      await browserTest.context.page!.evaluate(() => {
        const ageInput = document.getElementById('age') as HTMLInputElement;
        const bioField = document.getElementById('bio')?.closest('.form-group') as HTMLElement;

        ageInput.addEventListener('input', function() {
          const age = parseInt(this.value);
          if (age && age < 21) {
            if (bioField) {
              bioField.style.display = 'none';
            }
          } else {
            if (bioField) {
              bioField.style.display = '';
            }
          }
        });
      });

      // Test with age < 21 (should hide bio field)
      await performTextInput(browserTest.context.page!, '#age', '18');

      const bioHidden = await browserTest.context.page!.evaluate(() => {
        const bioField = document.getElementById('bio')?.closest('.form-group') as HTMLElement;
        return bioField?.style.display === 'none';
      });

      expect(bioHidden).toBe(true);

      // Test with age >= 21 (should show bio field)
      await performTextInput(browserTest.context.page!, '#age', '25', { clearFirst: true });

      const bioVisible = await browserTest.context.page!.evaluate(() => {
        const bioField = document.getElementById('bio')?.closest('.form-group') as HTMLElement;
        return bioField?.style.display !== 'none';
      });

      expect(bioVisible).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent form fields gracefully', async () => {
      const invalidData = {
        '#non-existent-field': 'test value',
        '#basic-username': 'valid value'
      };

      const result = await fillForm(browserTest.context.page!, '#basic-form', invalidData, {
        validateEach: false,
        clearBefore: true,
        continueOnError: true
      });

      expect(result.fieldsProcessed).toBe(2);
      expect(result.fieldsSuccessful).toBe(1); // Only the valid field
      expect(result.fieldErrors).toHaveLength(1);
      expect(result.fieldErrors[0]).toContain('non-existent-field');
    });

    it('should handle form submission with validation errors', async () => {
      // Submit form without required fields
      const submitResult = await performClick(browserTest.context.page!, '#basic-submit', {
        captureBeforeState: true,
        waitForStable: true
      });

      expect(submitResult.success).toBe(true); // Click succeeds

      // Check if browser validation kicked in
      const formValid = await browserTest.context.page!.evaluate(() => {
        const form = document.getElementById('basic-form') as HTMLFormElement;
        return form.checkValidity();
      });

      expect(formValid).toBe(false);
    });

    it('should handle disabled form elements', async () => {
      // Disable a form element
      await browserTest.context.page!.evaluate(() => {
        const input = document.getElementById('basic-username') as HTMLInputElement;
        input.disabled = true;
      });

      const result = await performTextInput(
        browserTest.context.page!,
        '#basic-username',
        'test value',
        { validateInput: false } // Skip validation since input is disabled
      );

      // Input should fail because element is disabled
      expect(result.success).toBe(false);
    });
  });
});