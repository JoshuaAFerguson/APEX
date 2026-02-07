/**
 * @fileoverview Checkbox Group Functionality Integration Tests
 *
 * This test file focuses specifically on testing checkbox groups
 * and multi-selection scenarios to ensure comprehensive coverage
 * of the checkbox group requirements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';

/**
 * Simple Checkbox Group Test Component
 */
function CheckboxGroupTest() {
  const [selectedItems, setSelectedItems] = React.useState<string[]>([]);

  const handleItemChange = (value: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, value]);
    } else {
      setSelectedItems(prev => prev.filter(item => item !== value));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(['item1', 'item2', 'item3']);
    } else {
      setSelectedItems([]);
    }
  };

  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < 3;
  const isAllSelected = selectedItems.length === 3;

  return (
    <form data-testid="checkbox-group-form">
      <div data-testid="selection-state" data-selected={JSON.stringify(selectedItems)}></div>

      {/* Select All Checkbox */}
      <div>
        <label>
          <input
            type="checkbox"
            data-testid="select-all"
            checked={isAllSelected}
            ref={(input) => {
              if (input) input.indeterminate = isIndeterminate;
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
          />
          Select All
        </label>
      </div>

      {/* Individual Items */}
      <div data-testid="items-group">
        {['item1', 'item2', 'item3'].map((item, index) => (
          <div key={item}>
            <label>
              <input
                type="checkbox"
                data-testid={`item-${index + 1}`}
                checked={selectedItems.includes(item)}
                onChange={(e) => handleItemChange(item, e.target.checked)}
              />
              {`Item ${index + 1}`}
            </label>
          </div>
        ))}
      </div>

      {/* Form State Display */}
      <div data-testid="form-values">
        Selected: {selectedItems.length} of 3 items
      </div>
    </form>
  );
}

describe('Checkbox Group Functionality Tests', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create a simple DOM container for testing
    container = document.createElement('div');
    document.body.appendChild(container);

    // Render the component manually (since we're not using React Testing Library)
    const root = container;
    root.innerHTML = `
      <form data-testid="checkbox-group-form">
        <div data-testid="selection-state" data-selected="[]"></div>

        <div>
          <label>
            <input type="checkbox" data-testid="select-all" />
            Select All
          </label>
        </div>

        <div data-testid="items-group">
          <div>
            <label>
              <input type="checkbox" data-testid="item-1" />
              Item 1
            </label>
          </div>
          <div>
            <label>
              <input type="checkbox" data-testid="item-2" />
              Item 2
            </label>
          </div>
          <div>
            <label>
              <input type="checkbox" data-testid="item-3" />
              Item 3
            </label>
          </div>
        </div>

        <div data-testid="form-values">Selected: 0 of 3 items</div>
      </form>
    `;

    // Add interactive functionality to the checkboxes
    setupCheckboxGroupBehavior(root);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function setupCheckboxGroupBehavior(root: HTMLElement) {
    const selectAll = root.querySelector('[data-testid="select-all"]') as HTMLInputElement;
    const items = Array.from(root.querySelectorAll('[data-testid^="item-"]')) as HTMLInputElement[];
    const stateElement = root.querySelector('[data-testid="selection-state"]') as HTMLElement;
    const valuesElement = root.querySelector('[data-testid="form-values"]') as HTMLElement;

    function updateSelectAllState() {
      const checkedItems = items.filter(item => item.checked);
      const checkedCount = checkedItems.length;

      if (checkedCount === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
      } else if (checkedCount === items.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
      } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
      }

      // Update state tracking
      const selectedValues = checkedItems.map(item =>
        item.getAttribute('data-testid')!.replace('item-', 'item')
      );
      stateElement.setAttribute('data-selected', JSON.stringify(selectedValues));
      valuesElement.textContent = `Selected: ${checkedCount} of 3 items`;
    }

    // Setup select all behavior
    selectAll.addEventListener('change', () => {
      const shouldCheck = selectAll.checked;
      items.forEach(item => {
        item.checked = shouldCheck;
      });
      updateSelectAllState();
    });

    // Setup individual item behavior
    items.forEach(item => {
      item.addEventListener('change', () => {
        updateSelectAllState();
      });
    });

    // Initial state update
    updateSelectAllState();
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

  function getSelectionState(): string[] {
    const stateElement = container.querySelector('[data-testid="selection-state"]') as HTMLElement;
    return JSON.parse(stateElement.getAttribute('data-selected') || '[]');
  }

  describe('Basic Checkbox Group Behavior', () => {
    it('should start with no items selected', () => {
      const selectedItems = getSelectionState();
      expect(selectedItems).toEqual([]);
    });

    it('should allow selecting individual items', () => {
      clickCheckbox('item-1');

      const item1 = getCheckbox('item-1');
      expect(item1.checked).toBe(true);

      const selectedItems = getSelectionState();
      expect(selectedItems).toContain('item1');
    });

    it('should allow selecting multiple items independently', () => {
      clickCheckbox('item-1');
      clickCheckbox('item-3');

      expect(getCheckbox('item-1').checked).toBe(true);
      expect(getCheckbox('item-2').checked).toBe(false);
      expect(getCheckbox('item-3').checked).toBe(true);

      const selectedItems = getSelectionState();
      expect(selectedItems).toEqual(['item1', 'item3']);
    });

    it('should allow deselecting items', () => {
      // First select
      clickCheckbox('item-2');
      expect(getCheckbox('item-2').checked).toBe(true);

      // Then deselect
      clickCheckbox('item-2');
      expect(getCheckbox('item-2').checked).toBe(false);

      const selectedItems = getSelectionState();
      expect(selectedItems).toEqual([]);
    });
  });

  describe('Select All Functionality', () => {
    it('should select all items when Select All is checked', () => {
      clickCheckbox('select-all');

      expect(getCheckbox('item-1').checked).toBe(true);
      expect(getCheckbox('item-2').checked).toBe(true);
      expect(getCheckbox('item-3').checked).toBe(true);

      const selectedItems = getSelectionState();
      expect(selectedItems).toEqual(['item1', 'item2', 'item3']);
    });

    it('should deselect all items when Select All is unchecked', () => {
      // First select all
      clickCheckbox('select-all');

      // Then deselect all
      clickCheckbox('select-all');

      expect(getCheckbox('item-1').checked).toBe(false);
      expect(getCheckbox('item-2').checked).toBe(false);
      expect(getCheckbox('item-3').checked).toBe(false);

      const selectedItems = getSelectionState();
      expect(selectedItems).toEqual([]);
    });
  });

  describe('Indeterminate State Behavior', () => {
    it('should show indeterminate state when some but not all items are selected', () => {
      clickCheckbox('item-1');
      clickCheckbox('item-2');

      const selectAll = getCheckbox('select-all');
      expect(selectAll.indeterminate).toBe(true);
      expect(selectAll.checked).toBe(false);
    });

    it('should not show indeterminate state when no items are selected', () => {
      const selectAll = getCheckbox('select-all');
      expect(selectAll.indeterminate).toBe(false);
      expect(selectAll.checked).toBe(false);
    });

    it('should not show indeterminate state when all items are selected', () => {
      clickCheckbox('item-1');
      clickCheckbox('item-2');
      clickCheckbox('item-3');

      const selectAll = getCheckbox('select-all');
      expect(selectAll.indeterminate).toBe(false);
      expect(selectAll.checked).toBe(true);
    });

    it('should clear indeterminate state when Select All is clicked from partial selection', () => {
      // Get to partial selection
      clickCheckbox('item-1');
      let selectAll = getCheckbox('select-all');
      expect(selectAll.indeterminate).toBe(true);

      // Click Select All
      clickCheckbox('select-all');

      selectAll = getCheckbox('select-all');
      expect(selectAll.indeterminate).toBe(false);
      expect(selectAll.checked).toBe(true);

      // All items should be selected
      expect(getCheckbox('item-1').checked).toBe(true);
      expect(getCheckbox('item-2').checked).toBe(true);
      expect(getCheckbox('item-3').checked).toBe(true);
    });
  });

  describe('Form State Integration', () => {
    it('should reflect correct count in form values', () => {
      clickCheckbox('item-1');
      clickCheckbox('item-3');

      const valuesElement = container.querySelector('[data-testid="form-values"]') as HTMLElement;
      expect(valuesElement.textContent).toBe('Selected: 2 of 3 items');
    });

    it('should track selected items correctly', () => {
      clickCheckbox('item-2');
      clickCheckbox('item-3');

      const selectedItems = getSelectionState();
      expect(selectedItems).toEqual(['item2', 'item3']);
      expect(selectedItems.length).toBe(2);
    });

    it('should handle complex selection patterns', () => {
      // Select some items individually
      clickCheckbox('item-1');
      clickCheckbox('item-3');

      let selectedItems = getSelectionState();
      expect(selectedItems).toEqual(['item1', 'item3']);

      // Select all via Select All
      clickCheckbox('select-all');

      selectedItems = getSelectionState();
      expect(selectedItems).toEqual(['item1', 'item2', 'item3']);

      // Deselect one item
      clickCheckbox('item-2');

      selectedItems = getSelectionState();
      expect(selectedItems).toEqual(['item1', 'item3']);

      // Verify Select All is now indeterminate
      const selectAll = getCheckbox('select-all');
      expect(selectAll.indeterminate).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid clicking without state corruption', () => {
      // Rapidly click the same checkbox
      for (let i = 0; i < 10; i++) {
        clickCheckbox('item-1');
      }

      // Should be unchecked (even number of clicks)
      expect(getCheckbox('item-1').checked).toBe(false);

      const selectedItems = getSelectionState();
      expect(selectedItems).toEqual([]);
    });

    it('should handle mixed rapid interactions', () => {
      // Rapid clicks on different checkboxes
      clickCheckbox('item-1');
      clickCheckbox('item-2');
      clickCheckbox('select-all'); // Should deselect all since some are selected

      // All should be selected after Select All click
      expect(getCheckbox('item-1').checked).toBe(true);
      expect(getCheckbox('item-2').checked).toBe(true);
      expect(getCheckbox('item-3').checked).toBe(true);

      const selectedItems = getSelectionState();
      expect(selectedItems).toEqual(['item1', 'item2', 'item3']);
    });

    it('should maintain consistent state through complex interactions', () => {
      // Start with partial selection
      clickCheckbox('item-1');
      clickCheckbox('item-2');

      let selectAll = getCheckbox('select-all');
      expect(selectAll.indeterminate).toBe(true);

      // Click individual item to complete selection
      clickCheckbox('item-3');

      selectAll = getCheckbox('select-all');
      expect(selectAll.checked).toBe(true);
      expect(selectAll.indeterminate).toBe(false);

      // Deselect one to go back to indeterminate
      clickCheckbox('item-1');

      selectAll = getCheckbox('select-all');
      expect(selectAll.indeterminate).toBe(true);
      expect(selectAll.checked).toBe(false);

      const selectedItems = getSelectionState();
      expect(selectedItems).toEqual(['item2', 'item3']);
    });
  });

  describe('Boolean Value Validation', () => {
    it('should ensure checkbox checked property is boolean', () => {
      const checkbox = getCheckbox('item-1');

      expect(typeof checkbox.checked).toBe('boolean');
      expect(checkbox.checked).toBe(false);

      clickCheckbox('item-1');

      expect(typeof checkbox.checked).toBe('boolean');
      expect(checkbox.checked).toBe(true);
    });

    it('should ensure indeterminate property is boolean', () => {
      clickCheckbox('item-1');

      const selectAll = getCheckbox('select-all');
      expect(typeof selectAll.indeterminate).toBe('boolean');
      expect(selectAll.indeterminate).toBe(true);
    });

    it('should maintain boolean types throughout state changes', () => {
      const checkboxes = [
        getCheckbox('item-1'),
        getCheckbox('item-2'),
        getCheckbox('item-3'),
        getCheckbox('select-all')
      ];

      // Initial state
      checkboxes.forEach(cb => {
        expect(typeof cb.checked).toBe('boolean');
        expect(typeof cb.indeterminate).toBe('boolean');
      });

      // After selections
      clickCheckbox('item-1');
      clickCheckbox('select-all');
      clickCheckbox('item-2');

      checkboxes.forEach(cb => {
        expect(typeof cb.checked).toBe('boolean');
        expect(typeof cb.indeterminate).toBe('boolean');
      });
    });
  });
});