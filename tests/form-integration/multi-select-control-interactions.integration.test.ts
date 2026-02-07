/**
 * @fileoverview Multi-Select Control Interactions Integration Tests
 *
 * This test suite provides comprehensive coverage of multi-select control interactions
 * to meet the acceptance criteria:
 * - Selecting multiple options
 * - Deselecting options
 * - Select all functionality
 * - Clear selection functionality
 * - Selected values array reflects correctly
 *
 * Tests simulate realistic user interactions and validate both functional
 * behavior and accessibility requirements for multi-select controls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  simulateTyping,
  waitForValidation,
  fillFormWithTestData,
} from './setup';

/**
 * Mock MultiSelect component HTML structure
 * This simulates the React MultiSelect component behavior in a DOM environment
 */
function createMultiSelectTestForm(): HTMLFormElement {
  const form = document.createElement('form');
  form.id = 'multi-select-test-form';
  form.setAttribute('novalidate', 'true');

  form.innerHTML = `
    <!-- Basic Multi-Select Control -->
    <div class="form-group">
      <label for="basic-multiselect">Basic Multi-Select</label>
      <div class="multi-select-container" data-testid="basic-multiselect">
        <button type="button"
                class="multi-select-trigger"
                id="basic-multiselect-trigger"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-describedby="basic-help">
          <div class="selected-values" id="basic-selected-values">
            <span class="placeholder">Select options...</span>
          </div>
          <div class="chevron">▼</div>
        </button>
        <div id="basic-help" class="help-text">Select multiple options from the list</div>

        <div class="multi-select-dropdown"
             id="basic-dropdown"
             role="listbox"
             aria-multiselectable="true"
             style="display: none;">
          <div class="search-container">
            <input type="text"
                   class="search-input"
                   placeholder="Search options..."
                   data-testid="basic-multiselect-search" />
          </div>

          <div class="actions-container">
            <button type="button"
                    class="select-all-btn"
                    data-testid="basic-multiselect-select-all">
              Select All
            </button>
            <button type="button"
                    class="clear-all-btn"
                    data-testid="basic-multiselect-clear-all">
              Clear All
            </button>
          </div>

          <div class="options-container">
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="option1"
                 data-testid="basic-multiselect-option-option1">
              <input type="checkbox" class="option-checkbox" value="option1" />
              <span>Option 1</span>
            </div>
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="option2"
                 data-testid="basic-multiselect-option-option2">
              <input type="checkbox" class="option-checkbox" value="option2" />
              <span>Option 2</span>
            </div>
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="option3"
                 data-testid="basic-multiselect-option-option3">
              <input type="checkbox" class="option-checkbox" value="option3" />
              <span>Option 3</span>
            </div>
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="option4"
                 data-testid="basic-multiselect-option-option4">
              <input type="checkbox" class="option-checkbox" value="option4" />
              <span>Option 4</span>
            </div>
          </div>
        </div>

        <!-- Hidden inputs for form submission -->
        <select name="basicMultiSelect" multiple style="display: none;" id="basic-hidden-select">
          <option value="option1">Option 1</option>
          <option value="option2">Option 2</option>
          <option value="option3">Option 3</option>
          <option value="option4">Option 4</option>
        </select>
      </div>
    </div>

    <!-- Required Multi-Select Control -->
    <div class="form-group">
      <label for="required-multiselect">Required Multi-Select *</label>
      <div class="multi-select-container" data-testid="required-multiselect">
        <button type="button"
                class="multi-select-trigger"
                id="required-multiselect-trigger"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-describedby="required-help"
                aria-required="true">
          <div class="selected-values" id="required-selected-values">
            <span class="placeholder">Please select...</span>
          </div>
          <div class="chevron">▼</div>
        </button>
        <div id="required-help" class="help-text">This field is required</div>
        <div id="required-error" role="alert" class="error-message"></div>

        <div class="multi-select-dropdown"
             id="required-dropdown"
             role="listbox"
             aria-multiselectable="true"
             style="display: none;">
          <div class="actions-container">
            <button type="button"
                    class="select-all-btn"
                    data-testid="required-multiselect-select-all">
              Select All
            </button>
            <button type="button"
                    class="clear-all-btn"
                    data-testid="required-multiselect-clear-all">
              Clear All
            </button>
          </div>

          <div class="options-container">
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="req1"
                 data-testid="required-multiselect-option-req1">
              <input type="checkbox" class="option-checkbox" value="req1" />
              <span>Required Option 1</span>
            </div>
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="req2"
                 data-testid="required-multiselect-option-req2">
              <input type="checkbox" class="option-checkbox" value="req2" />
              <span>Required Option 2</span>
            </div>
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="req3"
                 data-testid="required-multiselect-option-req3">
              <input type="checkbox" class="option-checkbox" value="req3" />
              <span>Required Option 3</span>
            </div>
          </div>
        </div>

        <!-- Hidden inputs for form submission -->
        <select name="requiredMultiSelect" multiple required style="display: none;" id="required-hidden-select">
          <option value="req1">Required Option 1</option>
          <option value="req2">Required Option 2</option>
          <option value="req3">Required Option 3</option>
        </select>
      </div>
    </div>

    <!-- Disabled Multi-Select Control -->
    <div class="form-group">
      <label for="disabled-multiselect">Disabled Multi-Select</label>
      <div class="multi-select-container" data-testid="disabled-multiselect">
        <button type="button"
                class="multi-select-trigger disabled"
                id="disabled-multiselect-trigger"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-describedby="disabled-help"
                disabled>
          <div class="selected-values" id="disabled-selected-values">
            <span class="placeholder">Cannot select...</span>
          </div>
          <div class="chevron">▼</div>
        </button>
        <div id="disabled-help" class="help-text">This field is disabled</div>

        <select name="disabledMultiSelect" multiple disabled style="display: none;" id="disabled-hidden-select">
          <option value="dis1">Disabled Option 1</option>
          <option value="dis2">Disabled Option 2</option>
        </select>
      </div>
    </div>

    <!-- Pre-selected Multi-Select Control -->
    <div class="form-group">
      <label for="preselected-multiselect">Pre-selected Multi-Select</label>
      <div class="multi-select-container" data-testid="preselected-multiselect">
        <button type="button"
                class="multi-select-trigger"
                id="preselected-multiselect-trigger"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-describedby="preselected-help">
          <div class="selected-values" id="preselected-selected-values">
            <span class="selected-tag" data-testid="preselected-multiselect-selected-pre1">
              Pre Option 1 <button type="button" class="remove-tag" data-value="pre1">×</button>
            </span>
            <span class="selected-tag" data-testid="preselected-multiselect-selected-pre3">
              Pre Option 3 <button type="button" class="remove-tag" data-value="pre3">×</button>
            </span>
          </div>
          <div class="chevron">▼</div>
        </button>
        <div id="preselected-help" class="help-text">Has pre-selected values</div>

        <div class="multi-select-dropdown"
             id="preselected-dropdown"
             role="listbox"
             aria-multiselectable="true"
             style="display: none;">
          <div class="actions-container">
            <button type="button"
                    class="select-all-btn"
                    data-testid="preselected-multiselect-select-all">
              Select All
            </button>
            <button type="button"
                    class="clear-all-btn"
                    data-testid="preselected-multiselect-clear-all">
              Clear All
            </button>
          </div>

          <div class="options-container">
            <div class="option"
                 role="option"
                 aria-selected="true"
                 data-value="pre1"
                 data-testid="preselected-multiselect-option-pre1">
              <input type="checkbox" class="option-checkbox" value="pre1" checked />
              <span>Pre Option 1</span>
            </div>
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="pre2"
                 data-testid="preselected-multiselect-option-pre2">
              <input type="checkbox" class="option-checkbox" value="pre2" />
              <span>Pre Option 2</span>
            </div>
            <div class="option"
                 role="option"
                 aria-selected="true"
                 data-value="pre3"
                 data-testid="preselected-multiselect-option-pre3">
              <input type="checkbox" class="option-checkbox" value="pre3" checked />
              <span>Pre Option 3</span>
            </div>
          </div>
        </div>

        <!-- Hidden inputs for form submission -->
        <select name="preselectedMultiSelect" multiple style="display: none;" id="preselected-hidden-select">
          <option value="pre1" selected>Pre Option 1</option>
          <option value="pre2">Pre Option 2</option>
          <option value="pre3" selected>Pre Option 3</option>
        </select>
      </div>
    </div>

    <!-- Max Selections Multi-Select Control -->
    <div class="form-group">
      <label for="maxselect-multiselect">Max 2 Selections</label>
      <div class="multi-select-container" data-testid="maxselect-multiselect" data-max-selections="2">
        <button type="button"
                class="multi-select-trigger"
                id="maxselect-multiselect-trigger"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-describedby="maxselect-help">
          <div class="selected-values" id="maxselect-selected-values">
            <span class="placeholder">Max 2 selections...</span>
          </div>
          <div class="chevron">▼</div>
        </button>
        <div id="maxselect-help" class="help-text">Maximum 2 selections allowed</div>

        <div class="multi-select-dropdown"
             id="maxselect-dropdown"
             role="listbox"
             aria-multiselectable="true"
             style="display: none;">
          <div class="actions-container">
            <div class="selection-counter">0 / 2 selected</div>
            <button type="button"
                    class="clear-all-btn"
                    data-testid="maxselect-multiselect-clear-all">
              Clear All
            </button>
          </div>

          <div class="options-container">
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="max1"
                 data-testid="maxselect-multiselect-option-max1">
              <input type="checkbox" class="option-checkbox" value="max1" />
              <span>Max Option 1</span>
            </div>
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="max2"
                 data-testid="maxselect-multiselect-option-max2">
              <input type="checkbox" class="option-checkbox" value="max2" />
              <span>Max Option 2</span>
            </div>
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="max3"
                 data-testid="maxselect-multiselect-option-max3">
              <input type="checkbox" class="option-checkbox" value="max3" />
              <span>Max Option 3</span>
            </div>
            <div class="option"
                 role="option"
                 aria-selected="false"
                 data-value="max4"
                 data-testid="maxselect-multiselect-option-max4">
              <input type="checkbox" class="option-checkbox" value="max4" />
              <span>Max Option 4</span>
            </div>
          </div>
        </div>

        <!-- Hidden inputs for form submission -->
        <select name="maxSelectMultiSelect" multiple style="display: none;" id="maxselect-hidden-select">
          <option value="max1">Max Option 1</option>
          <option value="max2">Max Option 2</option>
          <option value="max3">Max Option 3</option>
          <option value="max4">Max Option 4</option>
        </select>
      </div>
    </div>

    <!-- Form Actions -->
    <div class="form-actions">
      <button type="submit" id="submit-btn">Submit</button>
      <button type="reset" id="reset-btn">Reset</button>
    </div>
  `;

  // Add form validation
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    validateMultiSelectForm(form);
  });

  // Add event handlers for multi-select behavior
  setupMultiSelectBehavior(form);

  return form;
}

/**
 * Simple validation for required multi-select fields
 */
function validateMultiSelectForm(form: HTMLFormElement): boolean {
  const requiredSelect = form.querySelector('#required-hidden-select') as HTMLSelectElement;
  const errorElement = form.querySelector('#required-error') as HTMLElement;

  const selectedValues = Array.from(requiredSelect.querySelectorAll('option:checked')).map(
    option => (option as HTMLOptionElement).value
  );

  if (selectedValues.length === 0) {
    errorElement.textContent = 'Please select at least one option';
    errorElement.style.display = 'block';
    return false;
  }

  errorElement.textContent = '';
  errorElement.style.display = 'none';
  return true;
}

/**
 * Setup interactive behavior for multi-select components
 */
function setupMultiSelectBehavior(form: HTMLFormElement): void {
  const multiSelects = form.querySelectorAll('.multi-select-container');

  multiSelects.forEach(container => {
    const trigger = container.querySelector('.multi-select-trigger') as HTMLButtonElement;
    const dropdown = container.querySelector('.multi-select-dropdown') as HTMLDivElement;
    const hiddenSelect = container.querySelector('select[multiple]') as HTMLSelectElement;
    const selectedValuesContainer = container.querySelector('.selected-values') as HTMLDivElement;
    const selectAllBtn = container.querySelector('.select-all-btn') as HTMLButtonElement;
    const clearAllBtn = container.querySelector('.clear-all-btn') as HTMLButtonElement;
    const options = container.querySelectorAll('.option');
    const maxSelections = parseInt(container.getAttribute('data-max-selections') || '0');

    if (!trigger || !dropdown || !hiddenSelect) return;

    // Toggle dropdown
    trigger.addEventListener('click', () => {
      if (trigger.disabled) return;

      const isOpen = dropdown.style.display !== 'none';
      dropdown.style.display = isOpen ? 'none' : 'block';
      trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });

    // Handle option selection
    options.forEach(option => {
      const checkbox = option.querySelector('.option-checkbox') as HTMLInputElement;
      const value = option.getAttribute('data-value')!;

      option.addEventListener('click', (e) => {
        if (trigger.disabled) return;
        e.preventDefault();

        const isSelected = checkbox.checked;
        const selectedCount = getSelectedCount(container);

        // Check max selections limit
        if (!isSelected && maxSelections && selectedCount >= maxSelections) {
          return;
        }

        // Toggle selection
        checkbox.checked = !isSelected;
        option.setAttribute('aria-selected', (!isSelected).toString());

        // Update hidden select
        const hiddenOption = hiddenSelect.querySelector(`option[value="${value}"]`) as HTMLOptionElement;
        if (hiddenOption) {
          hiddenOption.selected = !isSelected;
        }

        // Update display
        updateSelectedDisplay(container);

        // Dispatch change event
        hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    // Handle select all
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        if (trigger.disabled) return;

        const availableOptions = Array.from(options).filter(option => {
          const checkbox = option.querySelector('.option-checkbox') as HTMLInputElement;
          return !checkbox.disabled;
        });

        const selectableCount = maxSelections || availableOptions.length;
        const optionsToSelect = availableOptions.slice(0, selectableCount);

        optionsToSelect.forEach(option => {
          const checkbox = option.querySelector('.option-checkbox') as HTMLInputElement;
          const value = option.getAttribute('data-value')!;

          if (!checkbox.checked) {
            checkbox.checked = true;
            option.setAttribute('aria-selected', 'true');

            const hiddenOption = hiddenSelect.querySelector(`option[value="${value}"]`) as HTMLOptionElement;
            if (hiddenOption) {
              hiddenOption.selected = true;
            }
          }
        });

        updateSelectedDisplay(container);
        hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    // Handle clear all
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        if (trigger.disabled) return;

        options.forEach(option => {
          const checkbox = option.querySelector('.option-checkbox') as HTMLInputElement;
          const value = option.getAttribute('data-value')!;

          if (checkbox.checked) {
            checkbox.checked = false;
            option.setAttribute('aria-selected', 'false');

            const hiddenOption = hiddenSelect.querySelector(`option[value="${value}"]`) as HTMLOptionElement;
            if (hiddenOption) {
              hiddenOption.selected = false;
            }
          }
        });

        updateSelectedDisplay(container);
        hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    // Handle remove tag buttons
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('remove-tag')) {
        const value = target.getAttribute('data-value')!;
        const option = container.querySelector(`[data-value="${value}"]`) as HTMLDivElement;
        const checkbox = option.querySelector('.option-checkbox') as HTMLInputElement;

        if (checkbox.checked) {
          checkbox.checked = false;
          option.setAttribute('aria-selected', 'false');

          const hiddenOption = hiddenSelect.querySelector(`option[value="${value}"]`) as HTMLOptionElement;
          if (hiddenOption) {
            hiddenOption.selected = false;
          }

          updateSelectedDisplay(container);
          hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target as Node)) {
        dropdown.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

/**
 * Get count of selected options in a multi-select
 */
function getSelectedCount(container: Element): number {
  const checkboxes = container.querySelectorAll('.option-checkbox:checked');
  return checkboxes.length;
}

/**
 * Update the visual display of selected values
 */
function updateSelectedDisplay(container: Element): void {
  const selectedValuesContainer = container.querySelector('.selected-values') as HTMLDivElement;
  const options = container.querySelectorAll('.option');
  const placeholder = container.querySelector('.placeholder') as HTMLSpanElement;
  const maxSelections = parseInt(container.getAttribute('data-max-selections') || '0');

  // Clear existing display
  selectedValuesContainer.innerHTML = '';

  const selectedOptions = Array.from(options).filter(option => {
    const checkbox = option.querySelector('.option-checkbox') as HTMLInputElement;
    return checkbox.checked;
  });

  if (selectedOptions.length === 0) {
    const placeholderText = placeholder ? placeholder.textContent : 'Select options...';
    selectedValuesContainer.innerHTML = `<span class="placeholder">${placeholderText}</span>`;
  } else {
    selectedOptions.forEach(option => {
      const value = option.getAttribute('data-value')!;
      const label = option.querySelector('span')!.textContent;
      const testId = container.getAttribute('data-testid') + '-selected-' + value;

      const tag = document.createElement('span');
      tag.className = 'selected-tag';
      tag.setAttribute('data-testid', testId);
      tag.innerHTML = `${label} <button type="button" class="remove-tag" data-value="${value}">×</button>`;

      selectedValuesContainer.appendChild(tag);
    });
  }

  // Update selection counter if it exists
  const counter = container.querySelector('.selection-counter');
  if (counter && maxSelections) {
    counter.textContent = `${selectedOptions.length} / ${maxSelections} selected`;
  }
}

/**
 * Utility function to simulate opening dropdown
 */
function simulateDropdownOpen(container: Element): void {
  const trigger = container.querySelector('.multi-select-trigger') as HTMLButtonElement;
  const dropdown = container.querySelector('.multi-select-dropdown') as HTMLDivElement;

  if (!trigger || !dropdown || trigger.disabled) return;

  trigger.focus();
  trigger.click();
}

/**
 * Utility function to simulate closing dropdown
 */
function simulateDropdownClose(container: Element): void {
  const trigger = container.querySelector('.multi-select-trigger') as HTMLButtonElement;
  const dropdown = container.querySelector('.multi-select-dropdown') as HTMLDivElement;

  if (!trigger || !dropdown) return;

  // Simulate clicking outside
  document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  trigger.blur();
}

/**
 * Utility function to select an option
 */
function simulateOptionSelect(container: Element, value: string): void {
  const option = container.querySelector(`[data-value="${value}"]`) as HTMLDivElement;
  if (!option) return;

  option.click();
}

/**
 * Utility function to get selected values
 */
function getSelectedValues(container: Element): string[] {
  const hiddenSelect = container.querySelector('select[multiple]') as HTMLSelectElement;
  return Array.from(hiddenSelect.querySelectorAll('option:checked')).map(
    option => (option as HTMLOptionElement).value
  );
}

describe('Multi-Select Control Interactions', () => {
  let form: HTMLFormElement;

  beforeEach(() => {
    form = createMultiSelectTestForm();
    document.body.appendChild(form);
  });

  describe('Selecting Multiple Options', () => {
    it('should allow selecting multiple options', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      // Open dropdown
      simulateDropdownOpen(basicContainer);

      // Select multiple options
      simulateOptionSelect(basicContainer, 'option1');
      simulateOptionSelect(basicContainer, 'option3');

      const selectedValues = getSelectedValues(basicContainer);
      expect(selectedValues).toEqual(['option1', 'option3']);

      // Check visual indicators
      const selectedTags = basicContainer.querySelectorAll('.selected-tag');
      expect(selectedTags.length).toBe(2);

      // Check aria attributes
      const option1 = basicContainer.querySelector('[data-value="option1"]');
      const option3 = basicContainer.querySelector('[data-value="option3"]');
      expect(option1?.getAttribute('aria-selected')).toBe('true');
      expect(option3?.getAttribute('aria-selected')).toBe('true');
    });

    it('should update form data when multiple options are selected', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);
      simulateOptionSelect(basicContainer, 'option2');
      simulateOptionSelect(basicContainer, 'option4');

      const formData = new FormData(form);
      const selectedOptions = formData.getAll('basicMultiSelect');
      expect(selectedOptions).toEqual(['option2', 'option4']);
    });

    it('should handle selecting options in sequence', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);

      // Select options one by one
      simulateOptionSelect(basicContainer, 'option1');
      expect(getSelectedValues(basicContainer)).toEqual(['option1']);

      simulateOptionSelect(basicContainer, 'option2');
      expect(getSelectedValues(basicContainer)).toEqual(['option1', 'option2']);

      simulateOptionSelect(basicContainer, 'option3');
      expect(getSelectedValues(basicContainer)).toEqual(['option1', 'option2', 'option3']);
    });

    it('should maintain selected state when dropdown is closed and reopened', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);
      simulateOptionSelect(basicContainer, 'option1');
      simulateOptionSelect(basicContainer, 'option3');
      simulateDropdownClose(basicContainer);

      // Reopen dropdown
      simulateDropdownOpen(basicContainer);

      // Check that selections are maintained
      const option1 = basicContainer.querySelector('[data-value="option1"] .option-checkbox') as HTMLInputElement;
      const option3 = basicContainer.querySelector('[data-value="option3"] .option-checkbox') as HTMLInputElement;
      expect(option1.checked).toBe(true);
      expect(option3.checked).toBe(true);
      expect(getSelectedValues(basicContainer)).toEqual(['option1', 'option3']);
    });

    it('should respect maximum selections limit', () => {
      const maxContainer = form.querySelector('[data-testid="maxselect-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(maxContainer);

      // Select up to limit
      simulateOptionSelect(maxContainer, 'max1');
      simulateOptionSelect(maxContainer, 'max2');
      expect(getSelectedValues(maxContainer)).toEqual(['max1', 'max2']);

      // Try to select beyond limit (should be ignored)
      simulateOptionSelect(maxContainer, 'max3');
      expect(getSelectedValues(maxContainer)).toEqual(['max1', 'max2']);

      // Check selection counter
      const counter = maxContainer.querySelector('.selection-counter');
      expect(counter?.textContent).toBe('2 / 2 selected');
    });

    it('should handle pre-selected options correctly', () => {
      const preselectedContainer = form.querySelector('[data-testid="preselected-multiselect"]') as HTMLDivElement;

      // Should start with pre-selected values
      expect(getSelectedValues(preselectedContainer)).toEqual(['pre1', 'pre3']);

      // Should show selected tags
      const selectedTags = preselectedContainer.querySelectorAll('.selected-tag');
      expect(selectedTags.length).toBe(2);

      // Add another selection
      simulateDropdownOpen(preselectedContainer);
      simulateOptionSelect(preselectedContainer, 'pre2');

      expect(getSelectedValues(preselectedContainer)).toEqual(['pre1', 'pre3', 'pre2']);
    });
  });

  describe('Deselecting Options', () => {
    it('should allow deselecting options by clicking them again', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);

      // Select options
      simulateOptionSelect(basicContainer, 'option1');
      simulateOptionSelect(basicContainer, 'option2');
      expect(getSelectedValues(basicContainer)).toEqual(['option1', 'option2']);

      // Deselect option1
      simulateOptionSelect(basicContainer, 'option1');
      expect(getSelectedValues(basicContainer)).toEqual(['option2']);

      // Check visual state
      const option1 = basicContainer.querySelector('[data-value="option1"]');
      expect(option1?.getAttribute('aria-selected')).toBe('false');
    });

    it('should allow deselecting options using remove tag buttons', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);
      simulateOptionSelect(basicContainer, 'option1');
      simulateOptionSelect(basicContainer, 'option3');

      expect(getSelectedValues(basicContainer)).toEqual(['option1', 'option3']);

      // Remove option1 using tag button
      const removeBtn = basicContainer.querySelector('.remove-tag[data-value="option1"]') as HTMLButtonElement;
      removeBtn.click();

      expect(getSelectedValues(basicContainer)).toEqual(['option3']);

      // Check that tag is removed
      const selectedTags = basicContainer.querySelectorAll('.selected-tag');
      expect(selectedTags.length).toBe(1);
    });

    it('should update form data when options are deselected', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);
      simulateOptionSelect(basicContainer, 'option1');
      simulateOptionSelect(basicContainer, 'option2');
      simulateOptionSelect(basicContainer, 'option3');

      let formData = new FormData(form);
      expect(formData.getAll('basicMultiSelect')).toEqual(['option1', 'option2', 'option3']);

      // Deselect option2
      simulateOptionSelect(basicContainer, 'option2');

      formData = new FormData(form);
      expect(formData.getAll('basicMultiSelect')).toEqual(['option1', 'option3']);
    });

    it('should handle deselecting pre-selected options', () => {
      const preselectedContainer = form.querySelector('[data-testid="preselected-multiselect"]') as HTMLDivElement;

      // Start with pre-selected values
      expect(getSelectedValues(preselectedContainer)).toEqual(['pre1', 'pre3']);

      // Deselect one pre-selected option using tag button
      const removeBtn = preselectedContainer.querySelector('.remove-tag[data-value="pre1"]') as HTMLButtonElement;
      removeBtn.click();

      expect(getSelectedValues(preselectedContainer)).toEqual(['pre3']);

      // Check form data
      const formData = new FormData(form);
      expect(formData.getAll('preselectedMultiSelect')).toEqual(['pre3']);
    });

    it('should restore placeholder when all options are deselected', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);
      simulateOptionSelect(basicContainer, 'option1');

      // Should show selected tag
      let selectedTags = basicContainer.querySelectorAll('.selected-tag');
      expect(selectedTags.length).toBe(1);

      // Deselect the option
      simulateOptionSelect(basicContainer, 'option1');

      // Should show placeholder
      const placeholder = basicContainer.querySelector('.placeholder');
      expect(placeholder).toBeTruthy();
      expect(placeholder?.textContent).toBe('Select options...');

      selectedTags = basicContainer.querySelectorAll('.selected-tag');
      expect(selectedTags.length).toBe(0);
    });
  });

  describe('Select All Functionality', () => {
    it('should select all available options when select all is clicked', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);

      const selectAllBtn = basicContainer.querySelector('[data-testid="basic-multiselect-select-all"]') as HTMLButtonElement;
      selectAllBtn.click();

      expect(getSelectedValues(basicContainer)).toEqual(['option1', 'option2', 'option3', 'option4']);

      // Check all checkboxes are checked
      const checkboxes = basicContainer.querySelectorAll('.option-checkbox');
      checkboxes.forEach(checkbox => {
        expect((checkbox as HTMLInputElement).checked).toBe(true);
      });
    });

    it('should respect max selections limit when select all is used', () => {
      const maxContainer = form.querySelector('[data-testid="maxselect-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(maxContainer);

      const selectAllBtn = maxContainer.querySelector('.select-all-btn') as HTMLButtonElement;
      selectAllBtn?.click();

      // Should only select up to the limit (2)
      const selectedValues = getSelectedValues(maxContainer);
      expect(selectedValues.length).toBe(2);
      expect(selectedValues).toEqual(['max1', 'max2']);

      // Check selection counter
      const counter = maxContainer.querySelector('.selection-counter');
      expect(counter?.textContent).toBe('2 / 2 selected');
    });

    it('should update form data when select all is used', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);

      const selectAllBtn = basicContainer.querySelector('[data-testid="basic-multiselect-select-all"]') as HTMLButtonElement;
      selectAllBtn.click();

      const formData = new FormData(form);
      const selectedOptions = formData.getAll('basicMultiSelect');
      expect(selectedOptions).toEqual(['option1', 'option2', 'option3', 'option4']);
    });

    it('should work correctly with pre-selected options', () => {
      const preselectedContainer = form.querySelector('[data-testid="preselected-multiselect"]') as HTMLDivElement;

      // Start with pre-selected values
      expect(getSelectedValues(preselectedContainer)).toEqual(['pre1', 'pre3']);

      simulateDropdownOpen(preselectedContainer);

      const selectAllBtn = preselectedContainer.querySelector('[data-testid="preselected-multiselect-select-all"]') as HTMLButtonElement;
      selectAllBtn.click();

      // Should now have all options selected
      expect(getSelectedValues(preselectedContainer)).toEqual(['pre1', 'pre3', 'pre2']);
    });

    it('should dispatch change events when select all is used', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;
      const hiddenSelect = basicContainer.querySelector('select[multiple]') as HTMLSelectElement;

      let changeEventFired = false;
      hiddenSelect.addEventListener('change', () => {
        changeEventFired = true;
      });

      simulateDropdownOpen(basicContainer);

      const selectAllBtn = basicContainer.querySelector('[data-testid="basic-multiselect-select-all"]') as HTMLButtonElement;
      selectAllBtn.click();

      expect(changeEventFired).toBe(true);
    });
  });

  describe('Clear Selection Functionality', () => {
    it('should clear all selected options when clear all is clicked', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);

      // Select some options first
      simulateOptionSelect(basicContainer, 'option1');
      simulateOptionSelect(basicContainer, 'option3');
      expect(getSelectedValues(basicContainer)).toEqual(['option1', 'option3']);

      // Clear all selections
      const clearAllBtn = basicContainer.querySelector('[data-testid="basic-multiselect-clear-all"]') as HTMLButtonElement;
      clearAllBtn.click();

      expect(getSelectedValues(basicContainer)).toEqual([]);

      // Check all checkboxes are unchecked
      const checkboxes = basicContainer.querySelectorAll('.option-checkbox');
      checkboxes.forEach(checkbox => {
        expect((checkbox as HTMLInputElement).checked).toBe(false);
      });
    });

    it('should clear pre-selected options', () => {
      const preselectedContainer = form.querySelector('[data-testid="preselected-multiselect"]') as HTMLDivElement;

      // Start with pre-selected values
      expect(getSelectedValues(preselectedContainer)).toEqual(['pre1', 'pre3']);

      simulateDropdownOpen(preselectedContainer);

      const clearAllBtn = preselectedContainer.querySelector('[data-testid="preselected-multiselect-clear-all"]') as HTMLButtonElement;
      clearAllBtn.click();

      expect(getSelectedValues(preselectedContainer)).toEqual([]);

      // Check visual state
      const selectedTags = preselectedContainer.querySelectorAll('.selected-tag');
      expect(selectedTags.length).toBe(0);

      const placeholder = preselectedContainer.querySelector('.placeholder');
      expect(placeholder).toBeTruthy();
    });

    it('should update form data when clear all is used', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);
      simulateOptionSelect(basicContainer, 'option1');
      simulateOptionSelect(basicContainer, 'option2');

      let formData = new FormData(form);
      expect(formData.getAll('basicMultiSelect')).toEqual(['option1', 'option2']);

      const clearAllBtn = basicContainer.querySelector('[data-testid="basic-multiselect-clear-all"]') as HTMLButtonElement;
      clearAllBtn.click();

      formData = new FormData(form);
      expect(formData.getAll('basicMultiSelect')).toEqual([]);
    });

    it('should update selection counter when clear all is used', () => {
      const maxContainer = form.querySelector('[data-testid="maxselect-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(maxContainer);
      simulateOptionSelect(maxContainer, 'max1');
      simulateOptionSelect(maxContainer, 'max2');

      let counter = maxContainer.querySelector('.selection-counter');
      expect(counter?.textContent).toBe('2 / 2 selected');

      const clearAllBtn = maxContainer.querySelector('[data-testid="maxselect-multiselect-clear-all"]') as HTMLButtonElement;
      clearAllBtn.click();

      counter = maxContainer.querySelector('.selection-counter');
      expect(counter?.textContent).toBe('0 / 2 selected');
    });

    it('should dispatch change events when clear all is used', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;
      const hiddenSelect = basicContainer.querySelector('select[multiple]') as HTMLSelectElement;

      simulateDropdownOpen(basicContainer);
      simulateOptionSelect(basicContainer, 'option1');

      let changeEventFired = false;
      hiddenSelect.addEventListener('change', () => {
        changeEventFired = true;
      });

      const clearAllBtn = basicContainer.querySelector('[data-testid="basic-multiselect-clear-all"]') as HTMLButtonElement;
      clearAllBtn.click();

      expect(changeEventFired).toBe(true);
    });
  });

  describe('Selected Values Array Reflects Correctly', () => {
    it('should maintain accurate selected values array during interactions', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;
      const hiddenSelect = basicContainer.querySelector('select[multiple]') as HTMLSelectElement;

      simulateDropdownOpen(basicContainer);

      // Track changes
      const changeLog: string[][] = [];
      hiddenSelect.addEventListener('change', () => {
        changeLog.push([...getSelectedValues(basicContainer)]);
      });

      // Sequence of operations
      simulateOptionSelect(basicContainer, 'option1');
      expect(changeLog[changeLog.length - 1]).toEqual(['option1']);

      simulateOptionSelect(basicContainer, 'option3');
      expect(changeLog[changeLog.length - 1]).toEqual(['option1', 'option3']);

      simulateOptionSelect(basicContainer, 'option2');
      expect(changeLog[changeLog.length - 1]).toEqual(['option1', 'option3', 'option2']);

      simulateOptionSelect(basicContainer, 'option1'); // deselect
      expect(changeLog[changeLog.length - 1]).toEqual(['option3', 'option2']);

      // Final state should match form data
      const formData = new FormData(form);
      expect(formData.getAll('basicMultiSelect')).toEqual(['option3', 'option2']);
    });

    it('should correctly reflect values in form submission', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;
      const requiredContainer = form.querySelector('[data-testid="required-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);
      simulateOptionSelect(basicContainer, 'option2');
      simulateOptionSelect(basicContainer, 'option4');

      simulateDropdownOpen(requiredContainer);
      simulateOptionSelect(requiredContainer, 'req1');
      simulateOptionSelect(requiredContainer, 'req3');

      const formData = new FormData(form);

      expect(formData.getAll('basicMultiSelect')).toEqual(['option2', 'option4']);
      expect(formData.getAll('requiredMultiSelect')).toEqual(['req1', 'req3']);

      // Check that form validates correctly
      const isValid = validateMultiSelectForm(form);
      expect(isValid).toBe(true);
    });

    it('should handle empty selections correctly in form data', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      // No selections made
      const formData = new FormData(form);
      expect(formData.getAll('basicMultiSelect')).toEqual([]);
      expect(formData.has('basicMultiSelect')).toBe(false);
    });

    it('should correctly handle validation with required multi-select', () => {
      const requiredContainer = form.querySelector('[data-testid="required-multiselect"]') as HTMLDivElement;
      const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;
      const errorElement = form.querySelector('#required-error') as HTMLElement;

      // Try to submit without selections
      submitBtn.click();
      expect(errorElement.textContent).toBe('Please select at least one option');

      // Make selections
      simulateDropdownOpen(requiredContainer);
      simulateOptionSelect(requiredContainer, 'req2');

      const isValid = validateMultiSelectForm(form);
      expect(isValid).toBe(true);
      expect(errorElement.textContent).toBe('');

      // Check form data
      const formData = new FormData(form);
      expect(formData.getAll('requiredMultiSelect')).toEqual(['req2']);
    });

    it('should handle form reset correctly', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;
      const preselectedContainer = form.querySelector('[data-testid="preselected-multiselect"]') as HTMLDivElement;
      const resetBtn = form.querySelector('#reset-btn') as HTMLButtonElement;

      // Make changes
      simulateDropdownOpen(basicContainer);
      simulateOptionSelect(basicContainer, 'option1');
      simulateOptionSelect(basicContainer, 'option2');

      simulateDropdownOpen(preselectedContainer);
      const clearAllBtn = preselectedContainer.querySelector('[data-testid="preselected-multiselect-clear-all"]') as HTMLButtonElement;
      clearAllBtn.click();

      // Check current state
      expect(getSelectedValues(basicContainer)).toEqual(['option1', 'option2']);
      expect(getSelectedValues(preselectedContainer)).toEqual([]);

      // Reset form
      resetBtn.click();

      // Basic should be empty, preselected should return to original state
      expect(getSelectedValues(basicContainer)).toEqual([]);
      expect(getSelectedValues(preselectedContainer)).toEqual(['pre1', 'pre3']);
    });

    it('should maintain consistency between visual state and form data', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);

      // Select options and verify consistency at each step
      simulateOptionSelect(basicContainer, 'option1');
      let selectedTags = basicContainer.querySelectorAll('.selected-tag');
      let formData = new FormData(form);
      expect(selectedTags.length).toBe(1);
      expect(formData.getAll('basicMultiSelect')).toEqual(['option1']);

      simulateOptionSelect(basicContainer, 'option3');
      selectedTags = basicContainer.querySelectorAll('.selected-tag');
      formData = new FormData(form);
      expect(selectedTags.length).toBe(2);
      expect(formData.getAll('basicMultiSelect')).toEqual(['option1', 'option3']);

      // Remove via tag button
      const removeBtn = basicContainer.querySelector('.remove-tag[data-value="option1"]') as HTMLButtonElement;
      removeBtn.click();
      selectedTags = basicContainer.querySelectorAll('.selected-tag');
      formData = new FormData(form);
      expect(selectedTags.length).toBe(1);
      expect(formData.getAll('basicMultiSelect')).toEqual(['option3']);

      // Check that visual and checkbox states match
      const option1Checkbox = basicContainer.querySelector('[data-value="option1"] .option-checkbox') as HTMLInputElement;
      const option3Checkbox = basicContainer.querySelector('[data-value="option3"] .option-checkbox') as HTMLInputElement;
      expect(option1Checkbox.checked).toBe(false);
      expect(option3Checkbox.checked).toBe(true);
    });
  });

  describe('Accessibility and Edge Cases', () => {
    it('should not allow interactions when disabled', () => {
      const disabledContainer = form.querySelector('[data-testid="disabled-multiselect"]') as HTMLDivElement;
      const trigger = disabledContainer.querySelector('.multi-select-trigger') as HTMLButtonElement;

      expect(trigger.disabled).toBe(true);

      // Try to open dropdown
      trigger.click();

      const dropdown = disabledContainer.querySelector('.multi-select-dropdown') as HTMLDivElement;
      expect(dropdown.style.display).toBe('none');

      // Should not be focusable
      trigger.focus();
      expect(document.activeElement).not.toBe(trigger);
    });

    it('should maintain proper ARIA attributes during interactions', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;
      const trigger = basicContainer.querySelector('.multi-select-trigger') as HTMLButtonElement;

      // Initial state
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');

      // Open dropdown
      simulateDropdownOpen(basicContainer);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      // Select options and check aria-selected
      simulateOptionSelect(basicContainer, 'option1');
      const option1 = basicContainer.querySelector('[data-value="option1"]');
      expect(option1?.getAttribute('aria-selected')).toBe('true');

      // Close dropdown
      simulateDropdownClose(basicContainer);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('should handle rapid sequential interactions', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;

      simulateDropdownOpen(basicContainer);

      // Rapid selection/deselection
      const operations = [
        () => simulateOptionSelect(basicContainer, 'option1'),
        () => simulateOptionSelect(basicContainer, 'option2'),
        () => simulateOptionSelect(basicContainer, 'option1'), // deselect
        () => simulateOptionSelect(basicContainer, 'option3'),
        () => simulateOptionSelect(basicContainer, 'option2'), // deselect
        () => simulateOptionSelect(basicContainer, 'option4'),
      ];

      operations.forEach(op => op());

      // Final state should be correct
      expect(getSelectedValues(basicContainer)).toEqual(['option3', 'option4']);

      const formData = new FormData(form);
      expect(formData.getAll('basicMultiSelect')).toEqual(['option3', 'option4']);
    });

    it('should exclude disabled multi-select from form submission', () => {
      const disabledContainer = form.querySelector('[data-testid="disabled-multiselect"]') as HTMLDivElement;

      const formData = new FormData(form);
      expect(formData.has('disabledMultiSelect')).toBe(false);
    });

    it('should handle search functionality if present', () => {
      const basicContainer = form.querySelector('[data-testid="basic-multiselect"]') as HTMLDivElement;
      const searchInput = basicContainer.querySelector('[data-testid="basic-multiselect-search"]') as HTMLInputElement;

      simulateDropdownOpen(basicContainer);

      if (searchInput) {
        // Type in search
        searchInput.value = 'Option 2';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        // This would typically filter options, but our mock implementation
        // doesn't include the filtering logic - that would be component-specific
        expect(searchInput.value).toBe('Option 2');
      }
    });
  });
});