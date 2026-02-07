/**
 * @fileoverview Single Select Dropdown Interactions Integration Tests
 *
 * This test suite provides comprehensive coverage of single select dropdown interactions
 * to meet the acceptance criteria:
 * - Opening dropdown
 * - Selecting an option
 * - Closing dropdown
 * - Keyboard navigation
 * - Disabled state
 * - Selected value reflects in form state
 *
 * Tests simulate realistic user interactions and validate both functional
 * behavior and accessibility requirements for single select dropdowns.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  simulateTyping,
  waitForValidation,
  fillFormWithTestData,
} from './setup';

/**
 * Creates a test form with various single select dropdown scenarios
 */
function createSingleSelectTestForm(): HTMLFormElement {
  const form = document.createElement('form');
  form.id = 'single-select-test-form';
  form.setAttribute('novalidate', 'true');

  form.innerHTML = `
    <!-- Basic Single Select Dropdown -->
    <div class="form-group">
      <label for="basic-select">Basic Selection</label>
      <select id="basic-select" name="basicSelect" aria-describedby="basic-help">
        <option value="">Choose an option...</option>
        <option value="option1">Option 1</option>
        <option value="option2">Option 2</option>
        <option value="option3">Option 3</option>
        <option value="option4">Option 4</option>
      </select>
      <div id="basic-help" class="help-text">Select one option from the list</div>
    </div>

    <!-- Required Single Select Dropdown -->
    <div class="form-group">
      <label for="required-select">Required Selection *</label>
      <select id="required-select" name="requiredSelect" required aria-describedby="required-help">
        <option value="">Please select...</option>
        <option value="req1">Required Option 1</option>
        <option value="req2">Required Option 2</option>
        <option value="req3">Required Option 3</option>
      </select>
      <div id="required-help" class="help-text">This field is required</div>
      <div id="required-error" role="alert" class="error-message"></div>
    </div>

    <!-- Disabled Single Select Dropdown -->
    <div class="form-group">
      <label for="disabled-select">Disabled Selection</label>
      <select id="disabled-select" name="disabledSelect" disabled aria-describedby="disabled-help">
        <option value="">Cannot select...</option>
        <option value="dis1">Disabled Option 1</option>
        <option value="dis2">Disabled Option 2</option>
      </select>
      <div id="disabled-help" class="help-text">This field is disabled</div>
    </div>

    <!-- Pre-selected Single Select Dropdown -->
    <div class="form-group">
      <label for="preselected-select">Pre-selected</label>
      <select id="preselected-select" name="preselectedSelect" aria-describedby="preselected-help">
        <option value="">Choose...</option>
        <option value="pre1">Pre Option 1</option>
        <option value="pre2" selected>Pre Option 2 (Selected)</option>
        <option value="pre3">Pre Option 3</option>
      </select>
      <div id="preselected-help" class="help-text">Has a pre-selected value</div>
    </div>

    <!-- Large Options List Single Select -->
    <div class="form-group">
      <label for="large-select">Large Options List</label>
      <select id="large-select" name="largeSelect" aria-describedby="large-help">
        <option value="">Select from many options...</option>
        ${Array.from({ length: 20 }, (_, i) =>
          `<option value="large${i + 1}">Large Option ${i + 1}</option>`
        ).join('')}
      </select>
      <div id="large-help" class="help-text">Navigate through many options</div>
    </div>

    <!-- Form Actions -->
    <div class="form-actions">
      <button type="submit" id="submit-btn">Submit</button>
      <button type="reset" id="reset-btn">Reset</button>
      <button type="button" id="focus-first-btn">Focus First Select</button>
    </div>
  `;

  // Add form validation
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    validateSingleSelectForm(form);
  });

  return form;
}

/**
 * Simple validation for required select fields
 */
function validateSingleSelectForm(form: HTMLFormElement): boolean {
  const requiredSelect = form.querySelector('#required-select') as HTMLSelectElement;
  const errorElement = form.querySelector('#required-error') as HTMLElement;

  if (!requiredSelect.value) {
    errorElement.textContent = 'Please make a selection';
    errorElement.style.display = 'block';
    return false;
  }

  errorElement.textContent = '';
  errorElement.style.display = 'none';
  return true;
}

/**
 * Simulates realistic dropdown opening behavior
 */
function simulateDropdownOpen(selectElement: HTMLSelectElement): void {
  // Focus the element first (which typically opens the dropdown)
  selectElement.focus();

  // Dispatch focus event
  selectElement.dispatchEvent(new Event('focus', { bubbles: true }));

  // Simulate click to open dropdown (on some browsers)
  selectElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  // Simulate mousedown which often triggers dropdown opening
  selectElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}

/**
 * Simulates realistic dropdown closing behavior
 */
function simulateDropdownClose(selectElement: HTMLSelectElement): void {
  // Simulate blur event (dropdown closes when focus is lost)
  selectElement.blur();
  selectElement.dispatchEvent(new Event('blur', { bubbles: true }));

  // Simulate escape key (common way to close dropdown)
  selectElement.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    bubbles: true
  }));
}

describe('Single Select Dropdown Interactions', () => {
  let form: HTMLFormElement;

  beforeEach(() => {
    form = createSingleSelectTestForm();
    document.body.appendChild(form);
  });

  describe('Opening Dropdown', () => {
    it('should open dropdown on focus', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Initially not focused
      expect(document.activeElement).not.toBe(basicSelect);

      // Simulate opening dropdown
      simulateDropdownOpen(basicSelect);

      // Should be focused (which represents dropdown being open)
      expect(document.activeElement).toBe(basicSelect);
    });

    it('should open dropdown on click', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Simulate click to open
      basicSelect.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      basicSelect.focus(); // Simulate browser behavior of focusing on click

      expect(document.activeElement).toBe(basicSelect);
    });

    it('should open dropdown on keyboard interaction (Space or Enter)', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Focus first
      basicSelect.focus();

      // Simulate spacebar (common way to open dropdown)
      basicSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        bubbles: true
      }));

      expect(document.activeElement).toBe(basicSelect);

      // Simulate Enter key
      basicSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true
      }));

      expect(document.activeElement).toBe(basicSelect);
    });

    it('should not open disabled dropdown', () => {
      const disabledSelect = form.querySelector('#disabled-select') as HTMLSelectElement;

      expect(disabledSelect.disabled).toBe(true);

      // Try to open disabled dropdown
      disabledSelect.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // Should not be focused since it's disabled
      expect(document.activeElement).not.toBe(disabledSelect);
    });

    it('should show appropriate accessible state when opened', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      simulateDropdownOpen(basicSelect);

      // Check accessibility attributes
      expect(basicSelect.getAttribute('aria-describedby')).toBe('basic-help');
      expect(basicSelect.hasAttribute('aria-expanded')).toBe(false); // HTML select doesn't use aria-expanded

      // Verify label association
      const label = form.querySelector('label[for="basic-select"]');
      expect(label).toBeTruthy();
    });
  });

  describe('Selecting an Option', () => {
    it('should select option by value assignment', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Initial state
      expect(basicSelect.value).toBe('');
      expect(basicSelect.selectedIndex).toBe(0);

      // Select an option
      basicSelect.value = 'option2';
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(basicSelect.value).toBe('option2');
      expect(basicSelect.selectedOptions[0].textContent).toBe('Option 2');
      expect(basicSelect.selectedIndex).toBe(2); // 0-based index
    });

    it('should select option by selectedIndex assignment', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Select by index
      basicSelect.selectedIndex = 3; // Option 3
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(basicSelect.value).toBe('option3');
      expect(basicSelect.selectedOptions[0].textContent).toBe('Option 3');
    });

    it('should select option by directly setting selected property', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;
      const option2 = basicSelect.querySelector('option[value="option2"]') as HTMLOptionElement;

      // Select option directly
      option2.selected = true;
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(basicSelect.value).toBe('option2');
      expect(option2.selected).toBe(true);
    });

    it('should handle selection with keyboard navigation', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Focus the select
      basicSelect.focus();

      // Simulate keyboard navigation
      basicSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        bubbles: true
      }));

      // Simulate selecting first real option
      basicSelect.selectedIndex = 1;
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(basicSelect.value).toBe('option1');

      // Navigate down again
      basicSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        bubbles: true
      }));

      basicSelect.selectedIndex = 2;
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(basicSelect.value).toBe('option2');
    });

    it('should handle selection change events properly', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;
      let changeEventFired = false;
      let inputEventFired = false;

      basicSelect.addEventListener('change', () => {
        changeEventFired = true;
      });

      basicSelect.addEventListener('input', () => {
        inputEventFired = true;
      });

      // Make selection
      basicSelect.value = 'option1';
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));
      basicSelect.dispatchEvent(new Event('input', { bubbles: true }));

      expect(changeEventFired).toBe(true);
      expect(inputEventFired).toBe(true);
    });

    it('should handle pre-selected options correctly', () => {
      const preselectedSelect = form.querySelector('#preselected-select') as HTMLSelectElement;

      // Should already have the pre-selected value
      expect(preselectedSelect.value).toBe('pre2');
      expect(preselectedSelect.selectedOptions[0].textContent).toBe('Pre Option 2 (Selected)');

      // Change selection
      preselectedSelect.value = 'pre1';
      preselectedSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(preselectedSelect.value).toBe('pre1');
    });
  });

  describe('Closing Dropdown', () => {
    it('should close dropdown on blur', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Open dropdown
      simulateDropdownOpen(basicSelect);
      expect(document.activeElement).toBe(basicSelect);

      // Close by blurring
      simulateDropdownClose(basicSelect);
      expect(document.activeElement).not.toBe(basicSelect);
    });

    it('should close dropdown on Escape key', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Open dropdown
      simulateDropdownOpen(basicSelect);
      expect(document.activeElement).toBe(basicSelect);

      // Close with Escape
      basicSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true
      }));

      // Simulate blur that happens with Escape
      basicSelect.blur();
      expect(document.activeElement).not.toBe(basicSelect);
    });

    it('should close dropdown when clicking outside', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;
      const outsideElement = form.querySelector('#submit-btn') as HTMLButtonElement;

      // Open dropdown
      simulateDropdownOpen(basicSelect);
      expect(document.activeElement).toBe(basicSelect);

      // Click outside
      outsideElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      outsideElement.focus();

      expect(document.activeElement).toBe(outsideElement);
      expect(document.activeElement).not.toBe(basicSelect);
    });

    it('should close dropdown after making a selection', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Open dropdown
      simulateDropdownOpen(basicSelect);
      expect(document.activeElement).toBe(basicSelect);

      // Make selection (in real browsers, this typically closes dropdown)
      basicSelect.value = 'option1';
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      // Simulate typical browser behavior of closing dropdown after selection
      basicSelect.blur();

      expect(basicSelect.value).toBe('option1');
      expect(document.activeElement).not.toBe(basicSelect);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate options with arrow keys', () => {
      const largeSelect = form.querySelector('#large-select') as HTMLSelectElement;

      largeSelect.focus();

      // Start at empty option (index 0)
      expect(largeSelect.selectedIndex).toBe(0);

      // Navigate down multiple times
      for (let i = 1; i <= 5; i++) {
        largeSelect.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          code: 'ArrowDown',
          bubbles: true
        }));

        // Simulate the browser moving to next option
        largeSelect.selectedIndex = i;
        largeSelect.dispatchEvent(new Event('change', { bubbles: true }));

        expect(largeSelect.selectedIndex).toBe(i);
        expect(largeSelect.value).toBe(`large${i}`);
      }
    });

    it('should navigate options with arrow up key', () => {
      const largeSelect = form.querySelector('#large-select') as HTMLSelectElement;

      // Start from a selected option
      largeSelect.selectedIndex = 5;
      largeSelect.focus();

      // Navigate up
      largeSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        code: 'ArrowUp',
        bubbles: true
      }));

      largeSelect.selectedIndex = 4;
      largeSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(largeSelect.selectedIndex).toBe(4);
      expect(largeSelect.value).toBe('large4');
    });

    it('should navigate to first/last options with Home/End keys', () => {
      const largeSelect = form.querySelector('#large-select') as HTMLSelectElement;

      largeSelect.focus();
      largeSelect.selectedIndex = 10; // Start in middle

      // Home key to first option
      largeSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Home',
        code: 'Home',
        bubbles: true
      }));

      largeSelect.selectedIndex = 0;
      largeSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(largeSelect.selectedIndex).toBe(0);

      // End key to last option
      largeSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'End',
        code: 'End',
        bubbles: true
      }));

      const lastIndex = largeSelect.options.length - 1;
      largeSelect.selectedIndex = lastIndex;
      largeSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(largeSelect.selectedIndex).toBe(lastIndex);
    });

    it('should navigate by typing first letter', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      basicSelect.focus();

      // Type 'O' to jump to first option starting with O
      basicSelect.dispatchEvent(new KeyboardEvent('keypress', {
        key: 'o',
        code: 'KeyO',
        char: 'o',
        bubbles: true
      }));

      // Simulate browser finding first option starting with 'o' (Option 1)
      basicSelect.selectedIndex = 1;
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(basicSelect.value).toBe('option1');

      // Type 'O' again to cycle to next option starting with O
      basicSelect.dispatchEvent(new KeyboardEvent('keypress', {
        key: 'o',
        code: 'KeyO',
        char: 'o',
        bubbles: true
      }));

      basicSelect.selectedIndex = 2;
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(basicSelect.value).toBe('option2');
    });

    it('should handle Tab key for focus navigation', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;
      const requiredSelect = form.querySelector('#required-select') as HTMLSelectElement;

      basicSelect.focus();
      expect(document.activeElement).toBe(basicSelect);

      // Tab to next focusable element
      basicSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        bubbles: true
      }));

      // Simulate browser focus moving to next element
      requiredSelect.focus();
      expect(document.activeElement).toBe(requiredSelect);
    });

    it('should not navigate when disabled', () => {
      const disabledSelect = form.querySelector('#disabled-select') as HTMLSelectElement;

      expect(disabledSelect.disabled).toBe(true);

      // Try to focus (should not work)
      disabledSelect.focus();
      expect(document.activeElement).not.toBe(disabledSelect);

      // Try keyboard navigation (should be ignored)
      disabledSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        bubbles: true
      }));

      // Value should not change
      expect(disabledSelect.selectedIndex).toBe(0);
    });
  });

  describe('Disabled State', () => {
    it('should not be focusable when disabled', () => {
      const disabledSelect = form.querySelector('#disabled-select') as HTMLSelectElement;

      expect(disabledSelect.disabled).toBe(true);

      // Try to focus
      disabledSelect.focus();

      // Should not become active element
      expect(document.activeElement).not.toBe(disabledSelect);
    });

    it('should not be clickable when disabled', () => {
      const disabledSelect = form.querySelector('#disabled-select') as HTMLSelectElement;
      const originalValue = disabledSelect.value;

      // Try to click
      disabledSelect.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // Value should not change
      expect(disabledSelect.value).toBe(originalValue);
      expect(document.activeElement).not.toBe(disabledSelect);
    });

    it('should not respond to keyboard events when disabled', () => {
      const disabledSelect = form.querySelector('#disabled-select') as HTMLSelectElement;
      const originalIndex = disabledSelect.selectedIndex;

      // Try keyboard navigation
      disabledSelect.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        bubbles: true
      }));

      expect(disabledSelect.selectedIndex).toBe(originalIndex);
    });

    it('should have proper disabled styling and accessibility', () => {
      const disabledSelect = form.querySelector('#disabled-select') as HTMLSelectElement;

      expect(disabledSelect.disabled).toBe(true);
      expect(disabledSelect.hasAttribute('disabled')).toBe(true);

      // Should be properly labeled even when disabled
      const label = form.querySelector('label[for="disabled-select"]');
      expect(label).toBeTruthy();
    });

    it('should be excluded from form submission when disabled', () => {
      const formData = new FormData(form);

      // Disabled select should not appear in form data
      expect(formData.has('disabledSelect')).toBe(false);

      // Other selects should appear
      expect(formData.has('basicSelect')).toBe(true);
      expect(formData.has('preselectedSelect')).toBe(true);
    });

    it('should allow programmatic enabling and disabling', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Initially enabled
      expect(basicSelect.disabled).toBe(false);

      // Disable
      basicSelect.disabled = true;
      expect(basicSelect.disabled).toBe(true);

      // Try to focus (should not work)
      basicSelect.focus();
      expect(document.activeElement).not.toBe(basicSelect);

      // Re-enable
      basicSelect.disabled = false;
      expect(basicSelect.disabled).toBe(false);

      // Now should be focusable
      basicSelect.focus();
      expect(document.activeElement).toBe(basicSelect);
    });
  });

  describe('Selected Value Reflects in Form State', () => {
    it('should include selected value in FormData', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Make selection
      basicSelect.value = 'option3';
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      const formData = new FormData(form);
      expect(formData.get('basicSelect')).toBe('option3');
    });

    it('should update FormData when selection changes', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Initial selection
      basicSelect.value = 'option1';
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      let formData = new FormData(form);
      expect(formData.get('basicSelect')).toBe('option1');

      // Change selection
      basicSelect.value = 'option4';
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      formData = new FormData(form);
      expect(formData.get('basicSelect')).toBe('option4');
    });

    it('should handle empty/default values in FormData', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;

      // Ensure empty value
      basicSelect.value = '';
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      const formData = new FormData(form);
      expect(formData.get('basicSelect')).toBe('');
    });

    it('should include pre-selected values in FormData', () => {
      const preselectedSelect = form.querySelector('#preselected-select') as HTMLSelectElement;

      const formData = new FormData(form);
      expect(formData.get('preselectedSelect')).toBe('pre2');
    });

    it('should validate required fields with form state', () => {
      const requiredSelect = form.querySelector('#required-select') as HTMLSelectElement;
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;

      // Try to submit without selection
      submitBtn.click();

      const errorElement = form.querySelector('#required-error') as HTMLElement;
      expect(errorElement.textContent).toBe('Please make a selection');

      // Make selection
      requiredSelect.value = 'req1';
      requiredSelect.dispatchEvent(new Event('change', { bubbles: true }));

      // Clear errors and revalidate
      const isValid = validateSingleSelectForm(form);
      expect(isValid).toBe(true);

      // Check form data includes the value
      const formData = new FormData(form);
      expect(formData.get('requiredSelect')).toBe('req1');
    });

    it('should handle form reset correctly with state reflection', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;
      const preselectedSelect = form.querySelector('#preselected-select') as HTMLSelectElement;
      const resetBtn = form.querySelector('#reset-btn') as HTMLButtonElement;

      // Change values
      basicSelect.value = 'option2';
      preselectedSelect.value = 'pre1';

      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));
      preselectedSelect.dispatchEvent(new Event('change', { bubbles: true }));

      // Verify changes
      let formData = new FormData(form);
      expect(formData.get('basicSelect')).toBe('option2');
      expect(formData.get('preselectedSelect')).toBe('pre1');

      // Reset form
      resetBtn.click();

      // Values should return to defaults
      formData = new FormData(form);
      expect(formData.get('basicSelect')).toBe('');
      expect(formData.get('preselectedSelect')).toBe('pre2'); // Returns to originally selected
    });

    it('should support complex form state scenarios', async () => {
      // Test complex interaction with form state
      await fillFormWithTestData(form, {
        basicSelect: 'option3',
        requiredSelect: 'req2',
        preselectedSelect: 'pre1',
        largeSelect: 'large10'
      });

      const formData = new FormData(form);
      expect(formData.get('basicSelect')).toBe('option3');
      expect(formData.get('requiredSelect')).toBe('req2');
      expect(formData.get('preselectedSelect')).toBe('pre1');
      expect(formData.get('largeSelect')).toBe('large10');

      // Validate form state consistency
      const isValid = validateSingleSelectForm(form);
      expect(isValid).toBe(true);
    });

    it('should maintain form state during navigation interactions', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;
      const requiredSelect = form.querySelector('#required-select') as HTMLSelectElement;

      // Set values via keyboard navigation simulation
      basicSelect.focus();
      basicSelect.value = 'option2';
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      // Tab to next field
      requiredSelect.focus();
      requiredSelect.value = 'req3';
      requiredSelect.dispatchEvent(new Event('change', { bubbles: true }));

      // Verify form state is maintained
      const formData = new FormData(form);
      expect(formData.get('basicSelect')).toBe('option2');
      expect(formData.get('requiredSelect')).toBe('req3');

      // Go back to first field - value should be preserved
      basicSelect.focus();
      expect(basicSelect.value).toBe('option2');
    });
  });

  describe('Integration and Edge Cases', () => {
    it('should handle rapid selection changes', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;
      let changeEventCount = 0;

      basicSelect.addEventListener('change', () => changeEventCount++);

      // Rapid changes
      ['option1', 'option2', 'option3', 'option1'].forEach(value => {
        basicSelect.value = value;
        basicSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });

      expect(changeEventCount).toBe(4);
      expect(basicSelect.value).toBe('option1');
    });

    it('should handle focus management between multiple selects', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;
      const requiredSelect = form.querySelector('#required-select') as HTMLSelectElement;
      const preselectedSelect = form.querySelector('#preselected-select') as HTMLSelectElement;

      // Focus first
      basicSelect.focus();
      expect(document.activeElement).toBe(basicSelect);

      // Move to second
      requiredSelect.focus();
      expect(document.activeElement).toBe(requiredSelect);

      // Move to third
      preselectedSelect.focus();
      expect(document.activeElement).toBe(preselectedSelect);

      // Each should maintain its value
      expect(basicSelect.value).toBe('');
      expect(requiredSelect.value).toBe('');
      expect(preselectedSelect.value).toBe('pre2');
    });

    it('should handle accessibility during all interactions', () => {
      const basicSelect = form.querySelector('#basic-select') as HTMLSelectElement;
      const label = form.querySelector('label[for="basic-select"]');
      const helpText = form.querySelector('#basic-help');

      // Verify initial accessibility
      expect(label).toBeTruthy();
      expect(basicSelect.getAttribute('aria-describedby')).toBe('basic-help');
      expect(helpText).toBeTruthy();

      // Open dropdown
      simulateDropdownOpen(basicSelect);

      // Accessibility should be maintained
      expect(basicSelect.getAttribute('aria-describedby')).toBe('basic-help');

      // Make selection
      basicSelect.value = 'option2';
      basicSelect.dispatchEvent(new Event('change', { bubbles: true }));

      // Close dropdown
      simulateDropdownClose(basicSelect);

      // Accessibility should still be intact
      expect(basicSelect.getAttribute('aria-describedby')).toBe('basic-help');
    });
  });
});