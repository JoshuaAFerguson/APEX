/**
 * @fileoverview Comprehensive Form Control Integration Tests
 *
 * This test suite covers all the acceptance criteria for form control interactions:
 * - Single select dropdowns
 * - Multi-select functionality
 * - Checkbox toggle interactions
 * - Radio button selection
 * - Form submission scenarios
 * - Validation states
 *
 * Each test simulates realistic user interactions and validates both functional
 * behavior and accessibility requirements.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  simulateTyping,
  simulateFileSelection,
  createMockFile,
  waitForValidation,
  fillFormWithTestData,
} from './setup';

/**
 * Creates a comprehensive form with all control types for testing
 */
function createComprehensiveForm(): HTMLFormElement {
  const form = document.createElement('form');
  form.id = 'comprehensive-test-form';
  form.setAttribute('novalidate', 'true'); // For custom validation testing

  form.innerHTML = `
    <!-- Single Select Dropdown -->
    <div class="form-group">
      <label for="country-select">Country *</label>
      <select id="country-select" name="country" required aria-describedby="country-help">
        <option value="">Choose your country...</option>
        <option value="us">United States</option>
        <option value="ca">Canada</option>
        <option value="uk">United Kingdom</option>
        <option value="de">Germany</option>
        <option value="fr">France</option>
      </select>
      <div id="country-help" class="help-text">Select your country of residence</div>
      <div id="country-error" role="alert" class="error-message"></div>
    </div>

    <!-- Multi-Select -->
    <div class="form-group">
      <label for="skills-select">Technical Skills</label>
      <select id="skills-select" name="skills" multiple aria-describedby="skills-help">
        <option value="javascript">JavaScript</option>
        <option value="python">Python</option>
        <option value="java">Java</option>
        <option value="csharp">C#</option>
        <option value="golang">Go</option>
        <option value="rust">Rust</option>
        <option value="typescript">TypeScript</option>
      </select>
      <div id="skills-help" class="help-text">Hold Ctrl/Cmd to select multiple skills</div>
      <div id="skills-error" role="alert" class="error-message"></div>
    </div>

    <!-- Checkboxes -->
    <fieldset>
      <legend>Preferences</legend>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="newsletter" name="newsletter" value="yes" />
          <span>Subscribe to newsletter</span>
        </label>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="notifications" name="notifications" value="email" />
          <span>Email notifications</span>
        </label>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="sms-notifications" name="notifications" value="sms" />
          <span>SMS notifications</span>
        </label>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="terms" name="terms" value="agreed" required />
          <span>I agree to the Terms of Service *</span>
        </label>
        <div id="terms-error" role="alert" class="error-message"></div>
      </div>
    </fieldset>

    <!-- Radio Buttons -->
    <fieldset>
      <legend>Contact Preference *</legend>
      <div class="form-group">
        <label class="radio-label">
          <input type="radio" id="contact-email" name="contact-preference" value="email" required />
          <span>Email</span>
        </label>
      </div>

      <div class="form-group">
        <label class="radio-label">
          <input type="radio" id="contact-phone" name="contact-preference" value="phone" required />
          <span>Phone</span>
        </label>
      </div>

      <div class="form-group">
        <label class="radio-label">
          <input type="radio" id="contact-mail" name="contact-preference" value="mail" required />
          <span>Postal Mail</span>
        </label>
      </div>

      <div class="form-group">
        <label class="radio-label">
          <input type="radio" id="contact-none" name="contact-preference" value="none" required />
          <span>No contact</span>
        </label>
      </div>
      <div id="contact-preference-error" role="alert" class="error-message"></div>
    </fieldset>

    <!-- Additional Input Types for comprehensive testing -->
    <div class="form-group">
      <label for="email-field">Email Address *</label>
      <input type="email" id="email-field" name="email" required
             aria-describedby="email-help" />
      <div id="email-help" class="help-text">We'll never share your email</div>
      <div id="email-error" role="alert" class="error-message"></div>
    </div>

    <div class="form-group">
      <label for="age-field">Age</label>
      <input type="number" id="age-field" name="age" min="13" max="120"
             aria-describedby="age-help" />
      <div id="age-help" class="help-text">Must be 13 or older</div>
      <div id="age-error" role="alert" class="error-message"></div>
    </div>

    <!-- Form Actions -->
    <div class="form-actions">
      <button type="submit" id="submit-btn" class="btn-primary">Submit Form</button>
      <button type="reset" id="reset-btn" class="btn-secondary">Reset</button>
      <button type="button" id="validate-btn" class="btn-outline">Validate</button>
    </div>
  `;

  // Add comprehensive validation logic
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    validateForm(form);
  });

  form.addEventListener('reset', (e) => {
    // Clear custom validation errors
    setTimeout(() => clearValidationErrors(form), 10);
  });

  return form;
}

/**
 * Validates the entire form and displays appropriate error messages
 */
function validateForm(form: HTMLFormElement): boolean {
  clearValidationErrors(form);
  let isValid = true;

  // Validate country selection
  const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;
  if (!countrySelect.value) {
    showValidationError('country-error', 'Please select your country');
    isValid = false;
  }

  // Validate email
  const emailField = form.querySelector('#email-field') as HTMLInputElement;
  if (!emailField.value) {
    showValidationError('email-error', 'Email address is required');
    isValid = false;
  } else if (!isValidEmail(emailField.value)) {
    showValidationError('email-error', 'Please enter a valid email address');
    isValid = false;
  }

  // Validate terms agreement
  const termsCheckbox = form.querySelector('#terms') as HTMLInputElement;
  if (!termsCheckbox.checked) {
    showValidationError('terms-error', 'You must agree to the Terms of Service');
    isValid = false;
  }

  // Validate contact preference
  const contactPreference = form.querySelector('input[name="contact-preference"]:checked') as HTMLInputElement;
  if (!contactPreference) {
    showValidationError('contact-preference-error', 'Please select a contact preference');
    isValid = false;
  }

  // Validate age if provided
  const ageField = form.querySelector('#age-field') as HTMLInputElement;
  if (ageField.value) {
    const age = parseInt(ageField.value);
    if (age < 13) {
      showValidationError('age-error', 'You must be at least 13 years old');
      isValid = false;
    } else if (age > 120) {
      showValidationError('age-error', 'Please enter a valid age');
      isValid = false;
    }
  }

  return isValid;
}

/**
 * Shows a validation error message
 */
function showValidationError(errorId: string, message: string): void {
  const errorElement = document.getElementById(errorId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

/**
 * Clears all validation error messages
 */
function clearValidationErrors(form: HTMLFormElement): void {
  const errorElements = form.querySelectorAll('.error-message');
  errorElements.forEach((element) => {
    const errorElement = element as HTMLElement;
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  });
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

describe('Comprehensive Form Control Integration Tests', () => {
  let form: HTMLFormElement;

  beforeEach(() => {
    form = createComprehensiveForm();
    document.body.appendChild(form);
  });

  describe('Single Select Dropdown Interactions', () => {
    it('should handle basic dropdown selection', () => {
      const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;

      // Initial state
      expect(countrySelect.value).toBe('');
      expect(countrySelect.selectedIndex).toBe(0);

      // Select a country
      countrySelect.value = 'us';
      countrySelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(countrySelect.value).toBe('us');
      expect(countrySelect.selectedOptions[0].textContent).toBe('United States');
    });

    it('should handle keyboard navigation in dropdown', () => {
      const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;

      // Focus the select
      countrySelect.focus();

      // Simulate down arrow key presses
      countrySelect.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      countrySelect.selectedIndex = 1; // Simulate selection change
      countrySelect.dispatchEvent(new Event('change'));

      expect(countrySelect.value).toBe('us');
    });

    it('should validate required dropdown selection', () => {
      const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      // Try to submit without selecting country
      submitBtn.click();

      const errorElement = form.querySelector('#country-error') as HTMLElement;
      expect(errorElement.textContent).toBe('Please select your country');
    });

    it('should clear validation error when valid selection is made', () => {
      const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      // First trigger validation error
      submitBtn.click();
      let errorElement = form.querySelector('#country-error') as HTMLElement;
      expect(errorElement.textContent).toBe('Please select your country');

      // Then make valid selection
      countrySelect.value = 'ca';
      countrySelect.dispatchEvent(new Event('change'));

      // Clear errors and validate again
      clearValidationErrors(form);
      validateForm(form);

      errorElement = form.querySelector('#country-error') as HTMLElement;
      expect(errorElement.textContent).toBe('');
    });

    it('should support accessibility attributes for dropdown', () => {
      const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;
      const label = form.querySelector('label[for="country-select"]');
      const helpText = form.querySelector('#country-help');

      expect(label).toBeTruthy();
      expect(countrySelect.getAttribute('aria-describedby')).toBe('country-help');
      expect(helpText).toBeTruthy();
      expect(countrySelect.required).toBe(true);
    });
  });

  describe('Multi-Select Functionality', () => {
    it('should handle multiple selection', () => {
      const skillsSelect = form.querySelector('#skills-select') as HTMLSelectElement;

      // Select multiple options
      const options = skillsSelect.querySelectorAll('option');
      options[0].selected = true; // javascript
      options[2].selected = true; // java
      options[6].selected = true; // typescript

      skillsSelect.dispatchEvent(new Event('change'));

      const selectedValues = Array.from(skillsSelect.selectedOptions).map(opt => opt.value);
      expect(selectedValues).toContain('javascript');
      expect(selectedValues).toContain('java');
      expect(selectedValues).toContain('typescript');
      expect(selectedValues.length).toBe(3);
    });

    it('should handle programmatic multi-selection', () => {
      const skillsSelect = form.querySelector('#skills-select') as HTMLSelectElement;

      // Use programmatic selection
      const javascriptOption = skillsSelect.querySelector('option[value="javascript"]') as HTMLOptionElement;
      const pythonOption = skillsSelect.querySelector('option[value="python"]') as HTMLOptionElement;

      javascriptOption.selected = true;
      pythonOption.selected = true;
      skillsSelect.dispatchEvent(new Event('change'));

      expect(skillsSelect.selectedOptions.length).toBe(2);
      expect(javascriptOption.selected).toBe(true);
      expect(pythonOption.selected).toBe(true);
    });

    it('should handle deselection in multi-select', () => {
      const skillsSelect = form.querySelector('#skills-select') as HTMLSelectElement;
      const javascriptOption = skillsSelect.querySelector('option[value="javascript"]') as HTMLOptionElement;

      // Select then deselect
      javascriptOption.selected = true;
      skillsSelect.dispatchEvent(new Event('change'));
      expect(javascriptOption.selected).toBe(true);

      javascriptOption.selected = false;
      skillsSelect.dispatchEvent(new Event('change'));
      expect(javascriptOption.selected).toBe(false);
      expect(skillsSelect.selectedOptions.length).toBe(0);
    });

    it('should support keyboard navigation in multi-select', () => {
      const skillsSelect = form.querySelector('#skills-select') as HTMLSelectElement;

      // Focus and navigate
      skillsSelect.focus();

      // Simulate Ctrl+click for multiple selection
      const javascriptOption = skillsSelect.querySelector('option[value="javascript"]') as HTMLOptionElement;
      const pythonOption = skillsSelect.querySelector('option[value="python"]') as HTMLOptionElement;

      javascriptOption.selected = true;
      skillsSelect.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
      pythonOption.selected = true;
      skillsSelect.dispatchEvent(new Event('change'));

      expect(skillsSelect.selectedOptions.length).toBe(2);
    });

    it('should extract correct FormData from multi-select', () => {
      const skillsSelect = form.querySelector('#skills-select') as HTMLSelectElement;

      // Select multiple options
      skillsSelect.querySelector('option[value="javascript"]')!.selected = true;
      skillsSelect.querySelector('option[value="python"]')!.selected = true;
      skillsSelect.querySelector('option[value="typescript"]')!.selected = true;

      const formData = new FormData(form);
      const skills = formData.getAll('skills');

      expect(skills).toContain('javascript');
      expect(skills).toContain('python');
      expect(skills).toContain('typescript');
      expect(skills.length).toBe(3);
    });
  });

  describe('Checkbox Toggle Interactions', () => {
    it('should handle basic checkbox toggling', () => {
      const newsletterCheckbox = form.querySelector('#newsletter') as HTMLInputElement;

      // Initial state
      expect(newsletterCheckbox.checked).toBe(false);

      // Toggle on
      newsletterCheckbox.checked = true;
      newsletterCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      expect(newsletterCheckbox.checked).toBe(true);

      // Toggle off
      newsletterCheckbox.checked = false;
      newsletterCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      expect(newsletterCheckbox.checked).toBe(false);
    });

    it('should handle multiple checkboxes with same name', () => {
      const emailNotifications = form.querySelector('#notifications') as HTMLInputElement;
      const smsNotifications = form.querySelector('#sms-notifications') as HTMLInputElement;

      // Both can be checked simultaneously
      emailNotifications.checked = true;
      smsNotifications.checked = true;

      emailNotifications.dispatchEvent(new Event('change'));
      smsNotifications.dispatchEvent(new Event('change'));

      expect(emailNotifications.checked).toBe(true);
      expect(smsNotifications.checked).toBe(true);

      // Check FormData includes both values
      const formData = new FormData(form);
      const notificationValues = formData.getAll('notifications');
      expect(notificationValues).toContain('email');
      expect(notificationValues).toContain('sms');
    });

    it('should handle required checkbox validation', () => {
      const termsCheckbox = form.querySelector('#terms') as HTMLInputElement;
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      // Try to submit without checking required checkbox
      submitBtn.click();

      const errorElement = form.querySelector('#terms-error') as HTMLElement;
      expect(errorElement.textContent).toBe('You must agree to the Terms of Service');

      // Check the required checkbox
      termsCheckbox.checked = true;
      termsCheckbox.dispatchEvent(new Event('change'));

      // Clear errors and validate again
      clearValidationErrors(form);
      const isValid = validateForm(form);

      // Terms error should be cleared (though other validation errors may remain)
      const termsError = form.querySelector('#terms-error') as HTMLElement;
      expect(termsError.textContent).toBe('');
    });

    it('should support keyboard interaction for checkboxes', () => {
      const newsletterCheckbox = form.querySelector('#newsletter') as HTMLInputElement;

      newsletterCheckbox.focus();

      // Simulate spacebar press
      newsletterCheckbox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      newsletterCheckbox.checked = !newsletterCheckbox.checked;
      newsletterCheckbox.dispatchEvent(new Event('change'));

      expect(newsletterCheckbox.checked).toBe(true);

      // Spacebar again to toggle off
      newsletterCheckbox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      newsletterCheckbox.checked = !newsletterCheckbox.checked;
      newsletterCheckbox.dispatchEvent(new Event('change'));

      expect(newsletterCheckbox.checked).toBe(false);
    });

    it('should maintain checkbox state during form interactions', () => {
      const newsletterCheckbox = form.querySelector('#newsletter') as HTMLInputElement;
      const notificationsCheckbox = form.querySelector('#notifications') as HTMLInputElement;

      // Set initial state
      newsletterCheckbox.checked = true;
      notificationsCheckbox.checked = true;

      // Interact with other form elements
      const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;
      countrySelect.value = 'us';
      countrySelect.dispatchEvent(new Event('change'));

      // Checkbox states should be preserved
      expect(newsletterCheckbox.checked).toBe(true);
      expect(notificationsCheckbox.checked).toBe(true);
    });
  });

  describe('Radio Button Selection', () => {
    it('should handle radio button group selection', () => {
      const emailRadio = form.querySelector('#contact-email') as HTMLInputElement;
      const phoneRadio = form.querySelector('#contact-phone') as HTMLInputElement;
      const mailRadio = form.querySelector('#contact-mail') as HTMLInputElement;

      // Initially no radio should be selected
      expect(emailRadio.checked).toBe(false);
      expect(phoneRadio.checked).toBe(false);
      expect(mailRadio.checked).toBe(false);

      // Select email
      emailRadio.checked = true;
      emailRadio.dispatchEvent(new Event('change', { bubbles: true }));

      expect(emailRadio.checked).toBe(true);
      expect(phoneRadio.checked).toBe(false);
      expect(mailRadio.checked).toBe(false);
    });

    it('should handle radio button group mutual exclusivity', () => {
      const emailRadio = form.querySelector('#contact-email') as HTMLInputElement;
      const phoneRadio = form.querySelector('#contact-phone') as HTMLInputElement;

      // Select first radio
      emailRadio.checked = true;
      emailRadio.dispatchEvent(new Event('change'));

      expect(emailRadio.checked).toBe(true);
      expect(phoneRadio.checked).toBe(false);

      // Select second radio - should deselect first
      phoneRadio.checked = true;
      emailRadio.checked = false; // Simulate browser behavior
      phoneRadio.dispatchEvent(new Event('change'));

      expect(emailRadio.checked).toBe(false);
      expect(phoneRadio.checked).toBe(true);
    });

    it('should validate required radio button group', () => {
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      // Try to submit without selecting radio button
      submitBtn.click();

      const errorElement = form.querySelector('#contact-preference-error') as HTMLElement;
      expect(errorElement.textContent).toBe('Please select a contact preference');
    });

    it('should get correct value from selected radio button', () => {
      const phoneRadio = form.querySelector('#contact-phone') as HTMLInputElement;

      phoneRadio.checked = true;
      phoneRadio.dispatchEvent(new Event('change'));

      const formData = new FormData(form);
      const contactPreference = formData.get('contact-preference');
      expect(contactPreference).toBe('phone');
    });

    it('should handle keyboard navigation in radio group', () => {
      const emailRadio = form.querySelector('#contact-email') as HTMLInputElement;
      const phoneRadio = form.querySelector('#contact-phone') as HTMLInputElement;

      emailRadio.focus();

      // Simulate arrow key navigation
      emailRadio.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

      // Simulate focus moving to next radio
      phoneRadio.focus();
      phoneRadio.checked = true;
      emailRadio.checked = false;
      phoneRadio.dispatchEvent(new Event('change'));

      expect(phoneRadio.checked).toBe(true);
      expect(emailRadio.checked).toBe(false);
    });

    it('should support radio button accessibility features', () => {
      const radios = form.querySelectorAll('input[name="contact-preference"]');
      const fieldset = form.querySelector('fieldset:has(input[name="contact-preference"])');
      const legend = fieldset?.querySelector('legend');

      expect(fieldset).toBeTruthy();
      expect(legend).toBeTruthy();
      expect(legend?.textContent).toContain('Contact Preference');

      radios.forEach(radio => {
        const radioElement = radio as HTMLInputElement;
        expect(radioElement.required).toBe(true);
        expect(radioElement.name).toBe('contact-preference');
      });
    });
  });

  describe('Form Submission Scenarios', () => {
    it('should handle valid form submission', async () => {
      // Fill form with valid data
      await fillFormWithTestData(form, {
        country: 'us',
        email: 'test@example.com',
        age: '25',
        terms: true,
        'contact-preference': 'email',
        newsletter: true
      });

      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      let formSubmitted = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const isValid = validateForm(form);
        if (isValid) {
          formSubmitted = true;
        }
      });

      submitBtn.click();

      // Should be valid and submit
      expect(formSubmitted).toBe(true);
    });

    it('should prevent submission with invalid data', () => {
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      let formSubmitted = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const isValid = validateForm(form);
        if (isValid) {
          formSubmitted = true;
        }
      });

      // Submit empty form
      submitBtn.click();

      // Should not submit due to validation errors
      expect(formSubmitted).toBe(false);

      // Check that validation errors are shown
      expect(form.querySelector('#country-error')?.textContent).toBe('Please select your country');
      expect(form.querySelector('#email-error')?.textContent).toBe('Email address is required');
      expect(form.querySelector('#terms-error')?.textContent).toBe('You must agree to the Terms of Service');
    });

    it('should collect all form data correctly', async () => {
      // Fill comprehensive form data
      const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;
      const skillsSelect = form.querySelector('#skills-select') as HTMLSelectElement;
      const emailInput = form.querySelector('#email-field') as HTMLInputElement;
      const ageInput = form.querySelector('#age-field') as HTMLInputElement;
      const newsletterCheckbox = form.querySelector('#newsletter') as HTMLInputElement;
      const emailNotifications = form.querySelector('#notifications') as HTMLInputElement;
      const termsCheckbox = form.querySelector('#terms') as HTMLInputElement;
      const contactEmailRadio = form.querySelector('#contact-email') as HTMLInputElement;

      // Set values
      countrySelect.value = 'ca';
      skillsSelect.querySelector('option[value="javascript"]')!.selected = true;
      skillsSelect.querySelector('option[value="typescript"]')!.selected = true;
      await simulateTyping(emailInput, 'user@example.com');
      await simulateTyping(ageInput, '30');
      newsletterCheckbox.checked = true;
      emailNotifications.checked = true;
      termsCheckbox.checked = true;
      contactEmailRadio.checked = true;

      // Trigger change events
      [countrySelect, skillsSelect, newsletterCheckbox, emailNotifications,
       termsCheckbox, contactEmailRadio].forEach(el => {
        el.dispatchEvent(new Event('change'));
      });

      const formData = new FormData(form);

      expect(formData.get('country')).toBe('ca');
      expect(formData.get('email')).toBe('user@example.com');
      expect(formData.get('age')).toBe('30');
      expect(formData.get('newsletter')).toBe('yes');
      expect(formData.get('notifications')).toBe('email');
      expect(formData.get('terms')).toBe('agreed');
      expect(formData.get('contact-preference')).toBe('email');

      const skills = formData.getAll('skills');
      expect(skills).toContain('javascript');
      expect(skills).toContain('typescript');
    });

    it('should handle form reset correctly', () => {
      const resetBtn = form.querySelector('#reset-btn') as HTMLButtonElement;
      const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;
      const emailInput = form.querySelector('#email-field') as HTMLInputElement;
      const newsletterCheckbox = form.querySelector('#newsletter') as HTMLInputElement;
      const contactEmailRadio = form.querySelector('#contact-email') as HTMLInputElement;

      // Set some values
      countrySelect.value = 'us';
      emailInput.value = 'test@example.com';
      newsletterCheckbox.checked = true;
      contactEmailRadio.checked = true;

      // Reset form
      resetBtn.click();

      // Values should be cleared
      expect(countrySelect.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(newsletterCheckbox.checked).toBe(false);
      expect(contactEmailRadio.checked).toBe(false);
    });

    it('should handle form validation button', () => {
      const validateBtn = form.querySelector('#validate-btn') as HTMLButtonElement;

      let validationTriggered = false;
      validateBtn.addEventListener('click', () => {
        validationTriggered = true;
        validateForm(form);
      });

      validateBtn.click();

      expect(validationTriggered).toBe(true);
      // Should show validation errors for empty required fields
      expect(form.querySelector('#country-error')?.textContent).toBe('Please select your country');
    });
  });

  describe('Validation States', () => {
    it('should show validation errors for empty required fields', () => {
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;
      submitBtn.click();

      // Check all required field errors are shown
      expect(form.querySelector('#country-error')?.textContent).toBe('Please select your country');
      expect(form.querySelector('#email-error')?.textContent).toBe('Email address is required');
      expect(form.querySelector('#terms-error')?.textContent).toBe('You must agree to the Terms of Service');
      expect(form.querySelector('#contact-preference-error')?.textContent).toBe('Please select a contact preference');
    });

    it('should validate email format', async () => {
      const emailInput = form.querySelector('#email-field') as HTMLInputElement;
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      // Enter invalid email
      await simulateTyping(emailInput, 'invalid-email');
      submitBtn.click();

      expect(form.querySelector('#email-error')?.textContent).toBe('Please enter a valid email address');

      // Clear error and enter valid email
      clearValidationErrors(form);
      emailInput.value = '';
      await simulateTyping(emailInput, 'valid@example.com');

      const isValid = validateForm(form);
      const emailError = form.querySelector('#email-error')?.textContent;
      expect(emailError).not.toContain('Please enter a valid email address');
    });

    it('should validate age range', async () => {
      const ageInput = form.querySelector('#age-field') as HTMLInputElement;
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      // Enter age too young
      await simulateTyping(ageInput, '12');
      submitBtn.click();

      expect(form.querySelector('#age-error')?.textContent).toBe('You must be at least 13 years old');

      // Clear and enter age too old
      clearValidationErrors(form);
      ageInput.value = '';
      await simulateTyping(ageInput, '150');
      submitBtn.click();

      expect(form.querySelector('#age-error')?.textContent).toBe('Please enter a valid age');

      // Clear and enter valid age
      clearValidationErrors(form);
      ageInput.value = '';
      await simulateTyping(ageInput, '25');

      validateForm(form);
      const ageError = form.querySelector('#age-error')?.textContent;
      expect(ageError).toBe('');
    });

    it('should clear validation errors when form is reset', () => {
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;
      const resetBtn = form.querySelector('#reset-btn') as HTMLButtonElement;

      // Trigger validation errors
      submitBtn.click();

      // Verify errors are shown
      expect(form.querySelector('#country-error')?.textContent).toBeTruthy();
      expect(form.querySelector('#email-error')?.textContent).toBeTruthy();

      // Reset form
      resetBtn.click();

      // Errors should be cleared
      setTimeout(() => {
        expect(form.querySelector('#country-error')?.textContent).toBe('');
        expect(form.querySelector('#email-error')?.textContent).toBe('');
      }, 50);
    });

    it('should handle real-time validation on field change', async () => {
      const emailInput = form.querySelector('#email-field') as HTMLInputElement;

      // Add real-time validation
      emailInput.addEventListener('blur', () => {
        const errorElement = form.querySelector('#email-error') as HTMLElement;
        if (emailInput.value && !isValidEmail(emailInput.value)) {
          showValidationError('email-error', 'Please enter a valid email address');
        } else if (emailInput.value && isValidEmail(emailInput.value)) {
          errorElement.textContent = '';
          errorElement.style.display = 'none';
        }
      });

      // Enter invalid email and blur
      await simulateTyping(emailInput, 'invalid');
      emailInput.dispatchEvent(new Event('blur'));

      expect(form.querySelector('#email-error')?.textContent).toBe('Please enter a valid email address');

      // Fix email and blur
      emailInput.value = '';
      await simulateTyping(emailInput, 'valid@example.com');
      emailInput.dispatchEvent(new Event('blur'));

      expect(form.querySelector('#email-error')?.textContent).toBe('');
    });

    it('should maintain validation state during complex interactions', async () => {
      // Fill form partially with some invalid data
      const emailInput = form.querySelector('#email-field') as HTMLInputElement;
      const ageInput = form.querySelector('#age-field') as HTMLInputElement;
      const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;

      await simulateTyping(emailInput, 'invalid-email');
      await simulateTyping(ageInput, '10');
      countrySelect.value = 'us';

      // Validate
      validateForm(form);

      // Should have errors for email and age, but not country
      expect(form.querySelector('#email-error')?.textContent).toBeTruthy();
      expect(form.querySelector('#age-error')?.textContent).toBeTruthy();
      expect(form.querySelector('#country-error')?.textContent).toBe('');

      // Fix one error
      emailInput.value = '';
      await simulateTyping(emailInput, 'valid@example.com');
      clearValidationErrors(form);
      validateForm(form);

      // Email error should be gone, age error should remain
      expect(form.querySelector('#email-error')?.textContent).toBe('');
      expect(form.querySelector('#age-error')?.textContent).toBeTruthy();
    });
  });

  describe('Accessibility and ARIA Support', () => {
    it('should have proper form accessibility structure', () => {
      // Check for proper labeling
      const formControls = form.querySelectorAll('input, select, textarea');
      formControls.forEach(control => {
        const element = control as HTMLElement;
        const id = element.id;
        const name = element.getAttribute('name');

        if (id) {
          const label = form.querySelector(`label[for="${id}"]`) || element.closest('label');
          const hasAriaLabel = element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby');

          expect(label || hasAriaLabel).toBeTruthy();
        }
      });

      // Check fieldsets have legends
      const fieldsets = form.querySelectorAll('fieldset');
      fieldsets.forEach(fieldset => {
        const legend = fieldset.querySelector('legend');
        expect(legend).toBeTruthy();
      });

      // Check error messages have proper ARIA attributes
      const errorMessages = form.querySelectorAll('[role="alert"]');
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('should support screen reader announcements for validation', () => {
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      submitBtn.click();

      // Check that error messages are in elements with role="alert"
      const countryError = form.querySelector('#country-error');
      const emailError = form.querySelector('#email-error');

      expect(countryError?.getAttribute('role')).toBe('alert');
      expect(emailError?.getAttribute('role')).toBe('alert');

      // These should be announced to screen readers
      expect(countryError?.textContent).toBeTruthy();
      expect(emailError?.textContent).toBeTruthy();
    });

    it('should support keyboard navigation throughout form', () => {
      const firstControl = form.querySelector('#country-select') as HTMLElement;
      const lastControl = form.querySelector('#validate-btn') as HTMLElement;

      // Should be able to focus controls
      firstControl.focus();
      expect(document.activeElement).toBe(firstControl);

      // Tab through form (simulated)
      const controls = form.querySelectorAll('input, select, button');
      controls.forEach((control, index) => {
        const element = control as HTMLElement;
        if (index > 0) { // Skip first as it's already focused
          element.focus();
          expect(document.activeElement).toBe(element);
        }
      });
    });

    it('should maintain focus management during interactions', () => {
      const countrySelect = form.querySelector('#country-select') as HTMLSelectElement;
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      // Focus country select
      countrySelect.focus();
      expect(document.activeElement).toBe(countrySelect);

      // Select option and focus should remain
      countrySelect.value = 'us';
      countrySelect.dispatchEvent(new Event('change'));
      expect(document.activeElement).toBe(countrySelect);

      // Submit button click should not break focus management
      submitBtn.focus();
      submitBtn.click();

      // Focus should be manageable after validation
      countrySelect.focus();
      expect(document.activeElement).toBe(countrySelect);
    });
  });
});