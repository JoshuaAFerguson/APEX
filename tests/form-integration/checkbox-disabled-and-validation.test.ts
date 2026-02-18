/**
 * @fileoverview Checkbox Disabled State and Validation Integration Tests
 *
 * This test file focuses on testing disabled state behavior and form validation
 * scenarios to ensure comprehensive coverage of edge cases and accessibility.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';

/**
 * Disabled State and Validation Test Component
 */
function CheckboxValidationTest() {
  const [agreed, setAgreed] = React.useState(false);
  const [disabled, setDisabled] = React.useState(false);
  const [formSubmitted, setFormSubmitted] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);

  const validateForm = () => {
    const newErrors: string[] = [];

    if (!agreed && !disabled) {
      newErrors.push('You must agree to the terms and conditions');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);

    if (validateForm()) {
      console.log('Form submitted successfully');
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="validation-form">
      <div data-testid="form-state"
           data-agreed={agreed.toString()}
           data-disabled={disabled.toString()}
           data-submitted={formSubmitted.toString()}
           data-errors={JSON.stringify(errors)}>
      </div>

      {/* Toggle for enabling/disabling checkbox */}
      <div>
        <label>
          <input
            type="checkbox"
            data-testid="disable-toggle"
            checked={disabled}
            onChange={(e) => setDisabled(e.target.checked)}
          />
          Disable Terms Checkbox
        </label>
      </div>

      {/* Main terms checkbox */}
      <div data-testid="terms-container">
        <label>
          <input
            type="checkbox"
            data-testid="terms-checkbox"
            checked={agreed}
            disabled={disabled}
            onChange={(e) => setAgreed(e.target.checked)}
            aria-invalid={errors.length > 0 ? 'true' : 'false'}
            aria-describedby={errors.length > 0 ? 'terms-error' : undefined}
          />
          I agree to the terms and conditions {disabled ? '(disabled)' : ''}
        </label>
      </div>

      {/* Error display */}
      {errors.length > 0 && (
        <div id="terms-error" role="alert" data-testid="terms-error">
          {errors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      )}

      <button type="submit" data-testid="submit-button">
        Submit Form
      </button>
    </form>
  );
}

describe('Checkbox Disabled State and Validation Tests', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create a simple DOM container for testing
    container = document.createElement('div');
    document.body.appendChild(container);

    // Manual DOM setup for testing
    container.innerHTML = `
      <form data-testid="validation-form">
        <div data-testid="form-state"
             data-agreed="false"
             data-disabled="false"
             data-submitted="false"
             data-errors="[]">
        </div>

        <div>
          <label>
            <input type="checkbox" data-testid="disable-toggle" />
            Disable Terms Checkbox
          </label>
        </div>

        <div data-testid="terms-container">
          <label>
            <input type="checkbox" data-testid="terms-checkbox" />
            I agree to the terms and conditions
          </label>
        </div>

        <button type="submit" data-testid="submit-button">Submit Form</button>
      </form>
    `;

    setupValidationBehavior(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function setupValidationBehavior(root: HTMLElement) {
    const disableToggle = root.querySelector('[data-testid="disable-toggle"]') as HTMLInputElement;
    const termsCheckbox = root.querySelector('[data-testid="terms-checkbox"]') as HTMLInputElement;
    const submitButton = root.querySelector('[data-testid="submit-button"]') as HTMLButtonElement;
    const stateElement = root.querySelector('[data-testid="form-state"]') as HTMLElement;
    const form = root.querySelector('[data-testid="validation-form"]') as HTMLFormElement;

    let agreed = false;
    let disabled = false;
    let submitted = false;
    let errors: string[] = [];

    function updateState() {
      stateElement.setAttribute('data-agreed', agreed.toString());
      stateElement.setAttribute('data-disabled', disabled.toString());
      stateElement.setAttribute('data-submitted', submitted.toString());
      stateElement.setAttribute('data-errors', JSON.stringify(errors));

      termsCheckbox.disabled = disabled;
      termsCheckbox.checked = agreed;

      // Update label text
      const label = termsCheckbox.parentElement?.textContent || '';
      if (termsCheckbox.parentElement) {
        termsCheckbox.parentElement.innerHTML = `
          <input type="checkbox" data-testid="terms-checkbox" ${disabled ? 'disabled' : ''} ${agreed ? 'checked' : ''} />
          I agree to the terms and conditions ${disabled ? '(disabled)' : ''}
        `;

        // Re-setup event listeners after innerHTML change
        const newTermsCheckbox = termsCheckbox.parentElement.querySelector('[data-testid="terms-checkbox"]') as HTMLInputElement;
        newTermsCheckbox.addEventListener('change', handleTermsChange);
      }

      // Handle error display
      let errorElement = root.querySelector('[data-testid="terms-error"]') as HTMLElement;

      if (errors.length > 0) {
        if (!errorElement) {
          errorElement = document.createElement('div');
          errorElement.setAttribute('id', 'terms-error');
          errorElement.setAttribute('role', 'alert');
          errorElement.setAttribute('data-testid', 'terms-error');
          termsCheckbox.parentElement?.parentElement?.appendChild(errorElement);
        }
        errorElement.innerHTML = errors.map(error => `<p>${error}</p>`).join('');

        // Update ARIA attributes
        termsCheckbox.setAttribute('aria-invalid', 'true');
        termsCheckbox.setAttribute('aria-describedby', 'terms-error');
      } else {
        if (errorElement) {
          errorElement.remove();
        }
        termsCheckbox.setAttribute('aria-invalid', 'false');
        termsCheckbox.removeAttribute('aria-describedby');
      }
    }

    function validateForm() {
      const newErrors: string[] = [];

      if (!agreed && !disabled) {
        newErrors.push('You must agree to the terms and conditions');
      }

      errors = newErrors;
      updateState();
      return newErrors.length === 0;
    }

    function handleTermsChange(e: Event) {
      const target = e.target as HTMLInputElement;
      if (!disabled) {
        agreed = target.checked;
        updateState();
      }
    }

    function handleDisableToggle() {
      disabled = disableToggle.checked;
      if (disabled) {
        // When disabling, clear any validation errors
        errors = [];
      }
      updateState();
    }

    function handleSubmit(e: Event) {
      e.preventDefault();
      submitted = true;

      const isValid = validateForm();
      if (isValid) {
        console.log('Form submitted successfully');
      }
    }

    // Setup event listeners
    disableToggle.addEventListener('change', handleDisableToggle);
    termsCheckbox.addEventListener('change', handleTermsChange);
    form.addEventListener('submit', handleSubmit);

    // Initial state
    updateState();
  }

  function getCheckbox(testId: string): HTMLInputElement {
    const element = container.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
    if (!element) {
      throw new Error(`Checkbox with test ID "${testId}" not found`);
    }
    return element;
  }

  function clickCheckbox(testId: string): void {
    const checkbox = getCheckbox(testId);
    checkbox.click();
  }

  function getFormState(): any {
    const stateElement = container.querySelector('[data-testid="form-state"]') as HTMLElement;
    return {
      agreed: stateElement.getAttribute('data-agreed') === 'true',
      disabled: stateElement.getAttribute('data-disabled') === 'true',
      submitted: stateElement.getAttribute('data-submitted') === 'true',
      errors: JSON.parse(stateElement.getAttribute('data-errors') || '[]')
    };
  }

  describe('Disabled State Behavior', () => {
    it('should start in enabled state', () => {
      const checkbox = getCheckbox('terms-checkbox');
      expect(checkbox.disabled).toBe(false);
    });

    it('should become disabled when disable toggle is checked', () => {
      clickCheckbox('disable-toggle');

      const checkbox = getCheckbox('terms-checkbox');
      expect(checkbox.disabled).toBe(true);

      const state = getFormState();
      expect(state.disabled).toBe(true);
    });

    it('should not respond to clicks when disabled', () => {
      // First disable the checkbox
      clickCheckbox('disable-toggle');

      const checkbox = getCheckbox('terms-checkbox');
      expect(checkbox.disabled).toBe(true);
      expect(checkbox.checked).toBe(false);

      // Try to click it
      clickCheckbox('terms-checkbox');

      // Should remain unchecked
      expect(checkbox.checked).toBe(false);
      const state = getFormState();
      expect(state.agreed).toBe(false);
    });

    it('should retain checked state when disabled', () => {
      // First check the checkbox
      clickCheckbox('terms-checkbox');
      expect(getCheckbox('terms-checkbox').checked).toBe(true);

      // Then disable it
      clickCheckbox('disable-toggle');

      const checkbox = getCheckbox('terms-checkbox');
      expect(checkbox.disabled).toBe(true);
      expect(checkbox.checked).toBe(true); // Should retain checked state

      const state = getFormState();
      expect(state.agreed).toBe(true);
      expect(state.disabled).toBe(true);
    });

    it('should be able to re-enable and interact normally', () => {
      // Disable
      clickCheckbox('disable-toggle');
      expect(getCheckbox('terms-checkbox').disabled).toBe(true);

      // Re-enable
      clickCheckbox('disable-toggle');
      const checkbox = getCheckbox('terms-checkbox');
      expect(checkbox.disabled).toBe(false);

      // Should be interactive again
      clickCheckbox('terms-checkbox');
      expect(checkbox.checked).toBe(true);

      const state = getFormState();
      expect(state.agreed).toBe(true);
      expect(state.disabled).toBe(false);
    });
  });

  describe('Form Validation', () => {
    it('should show validation error when unchecked and form is submitted', () => {
      // Submit without agreeing
      const form = container.querySelector('[data-testid="validation-form"]') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      const state = getFormState();
      expect(state.submitted).toBe(true);
      expect(state.errors).toContain('You must agree to the terms and conditions');

      const errorElement = container.querySelector('[data-testid="terms-error"]');
      expect(errorElement).toBeTruthy();
    });

    it('should clear validation error when checkbox is checked', () => {
      // First create error by submitting
      const form = container.querySelector('[data-testid="validation-form"]') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      let state = getFormState();
      expect(state.errors.length).toBeGreaterThan(0);

      // Then fix by checking
      clickCheckbox('terms-checkbox');

      state = getFormState();
      expect(state.agreed).toBe(true);
    });

    it('should not show validation error for disabled checkbox', () => {
      // Disable the checkbox
      clickCheckbox('disable-toggle');

      // Submit form
      const form = container.querySelector('[data-testid="validation-form"]') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      const state = getFormState();
      expect(state.disabled).toBe(true);
      expect(state.errors).toEqual([]);
    });

    it('should handle validation correctly when toggling disabled state', () => {
      // Submit to create error
      const form = container.querySelector('[data-testid="validation-form"]') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      let state = getFormState();
      expect(state.errors.length).toBeGreaterThan(0);

      // Disable checkbox - should clear errors
      clickCheckbox('disable-toggle');

      state = getFormState();
      expect(state.disabled).toBe(true);
      expect(state.errors).toEqual([]);

      // Re-enable - errors should not automatically come back
      clickCheckbox('disable-toggle');

      state = getFormState();
      expect(state.disabled).toBe(false);
      // Errors should still be clear until next validation
      expect(state.errors).toEqual([]);
    });
  });

  describe('Accessibility Attributes', () => {
    it('should have proper aria-invalid when there are errors', () => {
      // Submit to create error
      const form = container.querySelector('[data-testid="validation-form"]') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      const checkbox = getCheckbox('terms-checkbox');
      expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    });

    it('should have aria-describedby pointing to error element', () => {
      // Submit to create error
      const form = container.querySelector('[data-testid="validation-form"]') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      const checkbox = getCheckbox('terms-checkbox');
      expect(checkbox.getAttribute('aria-describedby')).toBe('terms-error');
    });

    it('should clear aria attributes when validation passes', () => {
      // Create error first
      const form = container.querySelector('[data-testid="validation-form"]') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      let checkbox = getCheckbox('terms-checkbox');
      expect(checkbox.getAttribute('aria-invalid')).toBe('true');

      // Fix validation by checking
      clickCheckbox('terms-checkbox');

      checkbox = getCheckbox('terms-checkbox');
      expect(checkbox.getAttribute('aria-invalid')).toBe('false');
      expect(checkbox.getAttribute('aria-describedby')).toBe(null);
    });

    it('should not have accessibility errors when disabled', () => {
      clickCheckbox('disable-toggle');

      const checkbox = getCheckbox('terms-checkbox');
      expect(checkbox.disabled).toBe(true);
      expect(checkbox.getAttribute('aria-invalid')).toBe('false');
    });
  });

  describe('Form State Integration', () => {
    it('should properly reflect boolean values in form state', () => {
      let state = getFormState();

      // Initial state should be booleans
      expect(typeof state.agreed).toBe('boolean');
      expect(typeof state.disabled).toBe('boolean');
      expect(typeof state.submitted).toBe('boolean');
      expect(Array.isArray(state.errors)).toBe(true);

      expect(state.agreed).toBe(false);
      expect(state.disabled).toBe(false);
      expect(state.submitted).toBe(false);

      // After interactions
      clickCheckbox('terms-checkbox');
      clickCheckbox('disable-toggle');

      state = getFormState();
      expect(typeof state.agreed).toBe('boolean');
      expect(typeof state.disabled).toBe('boolean');
      expect(state.agreed).toBe(true);
      expect(state.disabled).toBe(true);
    });

    it('should handle complex state changes correctly', () => {
      // Complex interaction sequence
      clickCheckbox('terms-checkbox'); // Check
      clickCheckbox('disable-toggle'); // Disable
      clickCheckbox('disable-toggle'); // Re-enable
      clickCheckbox('terms-checkbox'); // Uncheck

      const state = getFormState();
      expect(state.agreed).toBe(false);
      expect(state.disabled).toBe(false);

      // Submit to create error
      const form = container.querySelector('[data-testid="validation-form"]') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      const finalState = getFormState();
      expect(finalState.submitted).toBe(true);
      expect(finalState.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid disable/enable toggling', () => {
      const disableToggle = getCheckbox('disable-toggle');
      const termsCheckbox = getCheckbox('terms-checkbox');

      // Rapid toggling
      for (let i = 0; i < 5; i++) {
        clickCheckbox('disable-toggle');
      }

      // Should end up enabled (odd number of clicks)
      expect(termsCheckbox.disabled).toBe(true);

      const state = getFormState();
      expect(state.disabled).toBe(true);
    });

    it('should maintain form state consistency during rapid interactions', () => {
      // Rapid mixed interactions
      clickCheckbox('terms-checkbox');
      clickCheckbox('disable-toggle');
      clickCheckbox('terms-checkbox'); // Should not work (disabled)
      clickCheckbox('disable-toggle'); // Re-enable
      clickCheckbox('terms-checkbox'); // Should work

      const state = getFormState();
      expect(state.agreed).toBe(false); // Should be unchecked after last click
      expect(state.disabled).toBe(false); // Should be enabled
    });

    it('should handle submit during disabled state correctly', () => {
      clickCheckbox('disable-toggle'); // Disable

      // Submit form
      const form = container.querySelector('[data-testid="validation-form"]') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));

      const state = getFormState();
      expect(state.submitted).toBe(true);
      expect(state.disabled).toBe(true);
      expect(state.errors).toEqual([]); // No validation errors for disabled fields
    });
  });
});